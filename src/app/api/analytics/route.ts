import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, toApiError } from "@/lib/api";
import { getCached, setCached } from "@/lib/server-cache";
import { TradeMetricRow, computeAggregateMetrics, groupBy, safeParsePsychTags } from "@/lib/financial-engine";
import { computeTimeInTradeAnalytics } from "@/lib/duration-analytics";

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

  const cacheKey = `analytics:${user.id}:${dimension}:${accountId ?? "all"}:${fromStr ?? ""}:${toStr ?? ""}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return ok(cached);

  const where: any = { userId: user.id, isArchived: false };
  if (accountId) where.accountId = accountId;
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
  if (accountId) {
    const acc = await db.tradingAccount.findUnique({
      where: { id: accountId },
      select: { startingBalanceCents: true },
    });
    if (acc) startingBalanceCents = acc.startingBalanceCents;
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
    return send({
      items: [...flags].map((flag) => {
        const withFlag = rows.filter((t) => t.behaviorFlags?.includes(flag));
        const m = computeAggregateMetrics(withFlag, null);
        return {
          key: flag,
          label: flag.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
          trades: m.totalTrades,
          avgR: m.avgR,
          pnlCents: m.netPnlCents || 0,
          winRate: m.winRate,
        };
      }),
    });
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
    const hourMap = new Map<string, TradeMetricRow[]>();
    for (const t of rows) {
      if (!t.entryTime) continue;
      const d = new Date(t.entryTime);
      const wd = fmtWeekday.format(d);
      // `hour: 'numeric', hour12: false` may return "24" at midnight on some
      // runtimes — normalize to "00".
      let hrRaw = fmtHour.format(d);
      if (hrRaw === "24") hrRaw = "00";
      const hr = `${hrRaw.padStart(2, "0")}:00`;
      (weekdayMap.get(wd) ?? weekdayMap.set(wd, []).get(wd)!).push(t);
      (hourMap.get(hr) ?? hourMap.set(hr, []).get(hr)!).push(t);
    }
    return send({
      weekday: [...weekdayMap.entries()].map(([k, arr]) => ({
        label: k, items: computeAggregateMetrics(arr, null),
      })),
      hour: [...hourMap.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k, arr]) => ({
        label: k, items: computeAggregateMetrics(arr, null),
      })),
    });
  }
  if (dimension === "holding-time" || dimension === "time-in-trade") {
    return send(computeTimeInTradeAnalytics(trades));
  }
  return send({ aggregate: computeAggregateMetrics(rows, startingBalanceCents) });
}
