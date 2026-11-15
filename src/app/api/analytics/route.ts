import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, toApiError } from "@/lib/api";
import { getCached, setCached } from "@/lib/server-cache";
import { TradeMetricRow, computeAggregateMetrics, groupBy, safeParsePsychTags } from "@/lib/financial-engine";
import { computeTimeInTradeAnalytics } from "@/lib/duration-analytics";
import { computeChecklistAdherence, type TradeChecklistRecord } from "@/lib/checklist-adherence";
import { evaluateDataQuality, type ScannableTradeRecord } from "@/lib/data-quality-engine";
import { computeDrawdownAnalytics } from "@/lib/drawdown-analytics-engine";

function safeParseArr(json: string | null): string[] {
  if (!json) return [];
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch { return []; }
}

export async function GET(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const url = new URL(req.url);
  const dimension = url.searchParams.get("dimension") ?? "overview";
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const accountId = url.searchParams.get("accountId") ?? undefined;
  const instrumentId = url.searchParams.get("instrumentId") || undefined;
  const strategyId = url.searchParams.get("strategyId") || undefined;
  const direction = url.searchParams.get("direction") || undefined;
  const session = url.searchParams.get("session") || undefined;

  const cacheKey = `analytics:${user.id}:${dimension}:${accountId ?? "all"}:${fromStr ?? ""}:${toStr ?? ""}:${instrumentId ?? "all"}:${strategyId ?? "all"}:${direction ?? "all"}:${session ?? "all"}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return ok(cached);

  const where: any = { userId: user.id, isArchived: false };
  if (accountId && accountId !== "all") where.accountId = accountId;
  if (instrumentId && instrumentId !== "all") where.instrumentId = instrumentId;
  if (strategyId && strategyId !== "all") {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { strategyId },
          { strategyVersion: { strategyId } },
        ],
      },
    ];
  }
  if (direction && direction !== "all") where.direction = direction;
  if (session && session !== "all") where.session = session;

  // SPEC v3 §18.8: realized performance analytics use EXIT time, not entry time.
  // SPEC v3 §18.4: half-open interval [start, end) — never use 23:59:59.999.
  if (fromStr || toStr) {
    where.exitTime = {};
    if (fromStr) where.exitTime.gte = new Date(fromStr);
    if (toStr) {
      const endExclusive = new Date(toStr);
      endExclusive.setDate(endExclusive.getDate() + 1);
      endExclusive.setHours(0, 0, 0, 0);
      where.exitTime.lt = endExclusive;
    }
  }
  let startingBalanceCents: number | null = null;
  const fromDate = fromStr ? new Date(fromStr) : null;
  let priorRealizedPnlCents = 0;

  if (fromDate) {
    const priorWhere: any = {
      userId: user.id,
      isArchived: false,
      exitTime: { lt: fromDate },
    };
    if (accountId && accountId !== "all") priorWhere.accountId = accountId;
    const priorTrades = await db.trade.findMany({
      where: priorWhere,
      select: { netPnlCents: true },
    });
    priorRealizedPnlCents = priorTrades.reduce((sum, t) => sum + (t.netPnlCents || 0), 0);
  }

  if (accountId && accountId !== "all") {
    const acc = await db.tradingAccount.findUnique({
      where: { id: accountId },
      select: { startingBalanceCents: true, currency: true },
    });
    if (acc) {
      startingBalanceCents = Math.max(0, acc.startingBalanceCents + priorRealizedPnlCents);
    }
  } else {
    const accs = await db.tradingAccount.findMany({
      where: { userId: user.id, isArchived: false },
      select: { startingBalanceCents: true, currency: true },
    });
    const currencies = new Set(accs.map((a) => a.currency || "USD"));
    if (currencies.size <= 1 && accs.length > 0) {
      const baseBal = accs.reduce((sum, a) => sum + (a.startingBalanceCents || 0), 0);
      startingBalanceCents = Math.max(0, baseBal + priorRealizedPnlCents);
    } else {
      // Mixed currencies across accounts: pooled balance drawdown without exchange rates is invalid
      startingBalanceCents = null;
    }
  }
  const trades = await db.trade.findMany({ where, orderBy: { exitTime: "asc" } });
  const rows: TradeMetricRow[] = trades.map((t) => ({
    id: t.id,
    netPnlCents: t.netPnlCents,
    grossPnlCents: t.grossPnlCents,
    actualR: t.actualR,
    status: (["win","loss","breakeven"].includes(t.status) ? "closed" : t.status) as any,
    outcome: t.status as any,
    direction: t.direction,
    entryTime: t.entryTime ? t.entryTime.toISOString() : null,
    exitTime: t.exitTime ? t.exitTime.toISOString() : null,
    setupGrade: t.setupGrade,
    instrumentSymbol: t.instrumentSymbol,
    session: t.session,
    strategyId: t.strategyId,
    strategyVersionId: t.strategyVersionId,
    behaviorFlags: safeParseArr(t.behaviorFlagsJson),
    psychTags: safeParsePsychTags(t.psychBeforeJson),
    ruleCompliant: !(safeParseArr(t.behaviorFlagsJson).length > 0),
  }));

  // Holding duration calculation (closed trades with entry & exit times)
  const tradesWithDuration = trades.filter((t) => t.entryTime && t.exitTime);
  let avgHoldMinutesAll: number | null = null;
  let avgHoldMinutesWins: number | null = null;
  let avgHoldMinutesLosses: number | null = null;

  if (tradesWithDuration.length > 0) {
    const getMinutes = (t: any) =>
      Math.max(0, (new Date(t.exitTime!).getTime() - new Date(t.entryTime!).getTime()) / 60000);
    const winTrades = tradesWithDuration.filter((t) => t.status === "win");
    const lossTrades = tradesWithDuration.filter((t) => t.status === "loss");

    const totalMin = tradesWithDuration.reduce((s, t) => s + getMinutes(t), 0);
    avgHoldMinutesAll = Math.round(totalMin / tradesWithDuration.length);

    if (winTrades.length > 0) {
      avgHoldMinutesWins = Math.round(
        winTrades.reduce((s, t) => s + getMinutes(t), 0) / winTrades.length,
      );
    }
    if (lossTrades.length > 0) {
      avgHoldMinutesLosses = Math.round(
        lossTrades.reduce((s, t) => s + getMinutes(t), 0) / lossTrades.length,
      );
    }
  }

  // Excursion (MAE / MFE) calculations per DND_FINANCIAL_METRICS.md §5
  let mfeSum = 0;
  let maeSum = 0;
  let mfeCount = 0;
  let maeCount = 0;
  let retentionSum = 0;
  let retentionCount = 0;

  for (const t of trades) {
    if (!t.planAdherenceJson) continue;
    try {
      const pa = JSON.parse(t.planAdherenceJson);
      if (pa.mfeR != null && Number.isFinite(Number(pa.mfeR))) {
        mfeSum += Number(pa.mfeR);
        mfeCount++;
        if (t.status === "win" && t.actualR && Number(pa.mfeR) > 0) {
          const ret = (Number(t.actualR) / Number(pa.mfeR)) * 100;
          retentionSum += Math.min(100, Math.max(0, ret));
          retentionCount++;
        }
      }
      if (pa.maeR != null && Number.isFinite(Number(pa.maeR))) {
        maeSum += Number(pa.maeR);
        maeCount++;
      }
    } catch {}
  }

  const excursion = {
    avgMfeR: mfeCount > 0 ? (mfeSum / mfeCount).toFixed(2) : null,
    avgMaeR: maeCount > 0 ? (maeSum / maeCount).toFixed(2) : null,
    avgProfitRetentionPct: retentionCount > 0 ? Math.round(retentionSum / retentionCount) : null,
    tradesWithExcursionCount: Math.max(mfeCount, maeCount),
  };

  const send = (data: any) => ok(setCached(cacheKey, data, 30_000));

  if (dimension === "overview") {
    return send({
      aggregate: computeAggregateMetrics(rows, startingBalanceCents),
      holdingDuration: {
        avgAllMinutes: avgHoldMinutesAll,
        avgWinMinutes: avgHoldMinutesWins,
        avgLossMinutes: avgHoldMinutesLosses,
      },
      excursion,
    });
  }
  if (dimension === "instrument") {
    return send({ items: groupBy(rows, (t) => t.instrumentSymbol) });
  }
  if (dimension === "session") {
    return send({
      items: groupBy(rows, (t) => t.session, (k) => {
        const map: Record<string, string> = { asia: "Asia", london: "London", ny_am: "New York AM", ny_pm: "New York PM", custom: "Custom" };
        return map[k] ?? k;
      }),
    });
  }
  if (dimension === "strategy") {
    // Fetch the user's strategies and resolve names so the analytics
    // breakdown labels show strategy names rather than raw cuid IDs.
    const strats = await db.strategy.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
    });
    const strategyMap = new Map<string, string>();
    strats.forEach((s) => strategyMap.set(s.id, s.name));
    return send({
      items: groupBy(rows, (t) => t.strategyId, (k) => strategyMap.get(k) ?? "Unknown"),
    });
  }
  if (dimension === "setupGrade") {
    return send({ items: groupBy(rows, (t) => t.setupGrade, (k) => k ?? "Ungraded") });
  }
  if (dimension === "behavior") {
    const flags = new Set<string>();
    rows.forEach((t) => t.behaviorFlags?.forEach((f) => flags.add(f)));
    const totalTrades = rows.length;
    return send({
      totalTrades,
      items: [...flags].map((flag) => {
        const withFlag = rows.filter((t) => t.behaviorFlags?.includes(flag));
        const m = computeAggregateMetrics(withFlag, null);
        const occurrences = withFlag.length;
        const pctTrades = totalTrades > 0 ? Math.round((occurrences / totalTrades) * 1000) / 10 : 0;
        return {
          key: flag,
          label: flag.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
          occurrences,
          trades: m.totalTrades,
          percentageOfTrades: pctTrades,
          avgR: m.avgR,
          pnlCents: m.netPnlCents || 0,
          netPnlCents: m.netPnlCents || 0,
          winRate: m.winRate,
          wins: m.wins,
          losses: m.losses,
          expectancyR: m.expectancyR,
          expectancyCents: m.expectancyCents,
        };
      }),
    });
  }
  if (dimension === "checklist") {
    const strats = await db.strategy.findMany({
      where: { userId: user.id },
      include: { versions: true },
    });

    const strategyMetaMap = new Map<string, { name: string; versions: Map<string, { label: string; rulesJson: string }> }>();
    for (const s of strats) {
      const vMap = new Map<string, { label: string; rulesJson: string }>();
      for (const v of s.versions) {
        vMap.set(v.id, { label: v.versionLabel, rulesJson: v.rulesJson });
      }
      strategyMetaMap.set(s.id, { name: s.name, versions: vMap });
    }

    const tradesForChecklist = await db.trade.findMany({
      where,
      include: {
        checklistEvaluations: {
          orderBy: { evaluatedAt: "desc" },
          take: 1,
        },
        strategyVersion: true,
        strategy: true,
      },
      orderBy: { exitTime: "asc" },
    });

    const tradeRecords: TradeChecklistRecord[] = tradesForChecklist.map((t) => {
      const latestEval = t.checklistEvaluations?.[0];
      return {
        id: t.id,
        strategyId: t.strategyId,
        strategyName: t.strategy?.name,
        strategyVersionId: t.strategyVersionId,
        strategyVersionLabel: t.strategyVersion?.versionLabel,
        rulesJson: t.strategyVersion?.rulesJson,
        rawAnswersJson: latestEval?.rawAnswersJson ?? null,
        outcome: t.status,
        netPnlCents: t.netPnlCents,
        actualR: t.actualR,
      };
    });

    const summary = computeChecklistAdherence(tradeRecords, strategyMetaMap);
    return send(summary);
  }
  if (dimension === "time") {
    // By weekday and hour, both derived in the user's configured timezone
    // (UserSettings.timezone, default "UTC"). Using Intl.DateTimeFormat with
    // a `timeZone` option is the correct way to do this in SQLite/Node —
    // `d.getDay()` / `d.getHours()` would otherwise reflect the server's
    // local timezone, not the user's.
    const tz = (user.timezone as string) || "UTC";
    const fmtWeekday = (() => {
      try { return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }); }
      catch { return new Intl.DateTimeFormat("en-US", { weekday: "short" }); }
    })();
    const fmtHour = (() => {
      try { return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }); }
      catch { return new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false }); }
    })();
    const weekdayMap = new Map<string, TradeMetricRow[]>();
    const entryHourMap = new Map<string, TradeMetricRow[]>();
    const exitHourMap = new Map<string, TradeMetricRow[]>();

    for (const t of rows) {
      // Setup Entry Hour & Weekday (performance by trade initiation)
      const entryTimeStr = t.entryTime || t.exitTime;
      if (entryTimeStr) {
        const d = new Date(entryTimeStr);
        const wd = fmtWeekday.format(d);
        let hrRaw = fmtHour.format(d);
        if (hrRaw === "24") hrRaw = "00";
        const hr = `${hrRaw.padStart(2, "0")}:00`;
        (weekdayMap.get(wd) ?? weekdayMap.set(wd, []).get(wd)!).push(t);
        (entryHourMap.get(hr) ?? entryHourMap.set(hr, []).get(hr)!).push(t);
      }

      // Realization Hour (P&L attributed to cash realization / close timestamp)
      const exitTimeStr = t.exitTime || t.entryTime;
      if (exitTimeStr) {
        const dExit = new Date(exitTimeStr);
        let hrRaw = fmtHour.format(dExit);
        if (hrRaw === "24") hrRaw = "00";
        const hrExit = `${hrRaw.padStart(2, "0")}:00`;
        (exitHourMap.get(hrExit) ?? exitHourMap.set(hrExit, []).get(hrExit)!).push(t);
      }
    }

    const mapToMetrics = (map: Map<string, TradeMetricRow[]>) =>
      [...map.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, arr]) => {
          const m = computeAggregateMetrics(arr, null);
          return {
            label: k,
            items: m,
            pnlCents: m.netPnlCents,
            netPnlCents: m.netPnlCents,
            trades: m.totalTrades,
            avgR: m.avgR,
            winRate: m.winRate,
          };
        });

    return send({
      totalTrades: rows.length,
      totalNetPnlCents: rows.reduce((s, t) => s + (t.netPnlCents || 0), 0),
      weekday: [...weekdayMap.entries()].map(([k, arr]) => {
        const m = computeAggregateMetrics(arr, null);
        return {
          label: k,
          items: m,
          pnlCents: m.netPnlCents,
          netPnlCents: m.netPnlCents,
          trades: m.totalTrades,
          avgR: m.avgR,
          winRate: m.winRate,
        };
      }),
      hour: mapToMetrics(entryHourMap),
      entryHour: mapToMetrics(entryHourMap),
      realizationHour: mapToMetrics(exitHourMap),
    });
  }
  if (dimension === "holding-time" || dimension === "time-in-trade") {
    return send(computeTimeInTradeAnalytics(trades));
  }
  if (dimension === "data-quality") {
    const tradesForQuality = await db.trade.findMany({
      where,
      include: {
        strategy: { select: { id: true, name: true } },
        strategyVersion: { select: { id: true, rulesJson: true } },
        checklistEvaluations: { select: { id: true } },
        executions: { select: { id: true } },
      },
      orderBy: { entryTime: "desc" },
    });

    const scannable: ScannableTradeRecord[] = tradesForQuality.map((t) => {
      let hasRules = false;
      if (t.strategyVersion?.rulesJson) {
        try {
          const parsed = JSON.parse(t.strategyVersion.rulesJson);
          hasRules = Array.isArray(parsed) && parsed.length > 0;
        } catch {}
      }
      return {
        id: t.id,
        accountId: t.accountId,
        instrumentSymbol: t.instrumentSymbol,
        direction: t.direction,
        status: t.status,
        entryTime: t.entryTime,
        exitTime: t.exitTime,
        plannedStopPrice: t.plannedStopPrice,
        plannedRiskAmountCents: t.plannedRiskAmountCents,
        plannedRiskPct: t.plannedRiskPct,
        strategyId: t.strategyId,
        strategyName: t.strategy?.name,
        strategyVersionId: t.strategyVersionId,
        hasChecklistRules: hasRules,
        hasChecklistAnswers: (t.checklistEvaluations?.length || 0) > 0,
        notes: t.notes,
        executionsCount: t.executions?.length || 0,
      };
    });

    return send(evaluateDataQuality(scannable));
  }
  if (dimension === "drawdown") {
    let accCurrency = "USD";
    let isMulti = false;
    if (accountId && accountId !== "all") {
      const acc = await db.tradingAccount.findUnique({
        where: { id: accountId },
        select: { currency: true },
      });
      if (acc?.currency) accCurrency = acc.currency;
    } else {
      const accs = await db.tradingAccount.findMany({
        where: { userId: user.id, isArchived: false },
        select: { currency: true },
      });
      const currencies = new Set(accs.map((a) => a.currency || "USD"));
      if (currencies.size > 1) {
        isMulti = true;
      } else if (accs.length > 0) {
        accCurrency = accs[0].currency || "USD";
      }
    }

    const report = computeDrawdownAnalytics(
      trades.map((t) => ({
        id: t.id,
        netPnlCents: t.netPnlCents,
        exitTime: t.exitTime,
        status: t.status,
        plannedRiskAmountCents: t.plannedRiskAmountCents,
      })),
      startingBalanceCents,
      accCurrency,
      isMulti,
    );
    return send(report);
  }
  return send({ aggregate: computeAggregateMetrics(rows, startingBalanceCents) });
}
