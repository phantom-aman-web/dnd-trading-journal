import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, toApiError } from "@/lib/api";
import { getCached, setCached } from "@/lib/server-cache";
import {
  TradeMetricRow,
  computeAggregateMetrics,
  buildEquityCurve,
  buildDailyPnl,
  buildRDistribution,
  groupBy,
  generateInsights,
  safeParsePsychTags,
} from "@/lib/financial-engine";
import { isSyntheticSampleTrade } from "@/lib/prop-firm-engine";

async function loadTrades(userId: string, from?: Date, to?: Date, accountId?: string) {
  const where: any = { userId, isArchived: false };
  if (accountId) where.accountId = accountId;
  // SPEC v3 §18.8: realized performance analytics use EXIT time, not entry time.
  // A trade's P&L is "realized" when the position closes, so we filter by exitTime.
  // Also, the trade must have a non-null exitTime to be included in realized metrics.
  if (from || to) {
    where.exitTime = {};
    if (from) where.exitTime.gte = from;
    // SPEC v3 §18.4: half-open interval [start, end). The old `to.setHours(23,59,59,999)`
    // violated this and could miss sub-second events. We add 1 day and use lt.
    if (to) {
      const endExclusive = new Date(to);
      endExclusive.setDate(endExclusive.getDate() + 1);
      endExclusive.setHours(0, 0, 0, 0);
      where.exitTime.lt = endExclusive;
    }
  }
  const rawTrades = await db.trade.findMany({
    where,
    orderBy: { exitTime: "asc" },
  });
  const trades = rawTrades.filter((t) => !isSyntheticSampleTrade(t));
  return trades.map((t): TradeMetricRow => ({
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
}

function safeParseArr(json: string | null): string[] {
  if (!json) return [];
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch { return []; }
}

function rangeFromQuery(req: NextRequest): { from?: Date; to?: Date; preset: string } {
  const url = new URL(req.url);
  const preset = url.searchParams.get("preset") ?? "thisMonth";
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  switch (preset) {
    case "today":
      break;
    case "thisWeek": {
      const day = (now.getDay() + 6) % 7;
      from.setDate(now.getDate() - day);
      break;
    }
    case "thisMonth":
      from.setDate(1);
      break;
    case "thisQuarter": {
      const q = Math.floor(now.getMonth() / 3);
      from.setMonth(q * 3, 1);
      break;
    }
    case "thisYear":
      from.setMonth(0, 1);
      break;
    case "custom": {
      const f = url.searchParams.get("from");
      const t = url.searchParams.get("to");
      return {
        from: f ? new Date(f) : undefined,
        to: t ? new Date(t) : undefined,
        preset,
      };
    }
    case "all":
    default:
      return { preset: "all" };
  }
  return { from, to, preset };
}

export async function GET(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { from, to, preset } = rangeFromQuery(req);
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId") ?? undefined;

  const cacheKey = `dashboard:${user.id}:${preset}:${accountId ?? "all"}:${from?.toISOString() ?? ""}:${to?.toISOString() ?? ""}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return ok(cached);

  const trades = await loadTrades(user.id, from, to, accountId);

  // Account starting balance for equity curve baseline. Computed BEFORE
  // buildEquityCurve so the equity curve's first point reflects the real
  // account balance rather than an implicit 0-cent baseline (spec section 22).
  const accountWhere: any = { userId: user.id };
  if (accountId) accountWhere.id = accountId;
  const accounts = await db.tradingAccount.findMany({ where: accountWhere });

  // Period starting balance:
  // Initial capital + all realized P&L prior to the filtered period start date.
  let priorRealizedPnlCents = 0;
  if (from) {
    const priorWhere: any = {
      userId: user.id,
      isArchived: false,
      exitTime: { lt: from },
    };
    if (accountId) priorWhere.accountId = accountId;
    const priorTrades = await db.trade.findMany({
      where: priorWhere,
      select: { netPnlCents: true, tagsJson: true, notes: true },
    });
    priorRealizedPnlCents = priorTrades
      .filter((t) => !isSyntheticSampleTrade(t))
      .reduce((s, t) => s + (t.netPnlCents || 0), 0);
  }

  // Multi-currency check for All Accounts:
  // If user has accounts in different currencies, pooling starting balances without
  // exchange rates is financially invalid.
  const currencies = new Set(accounts.map((a) => a.currency || "USD"));
  const hasMixedCurrencies = !accountId && currencies.size > 1;

  const baseStartingBalance = hasMixedCurrencies
    ? null
    : accounts.reduce((s, a) => s + (a.startingBalanceCents || 0), 0);

  const effectiveStartingBalance =
    baseStartingBalance != null && baseStartingBalance > 0
      ? Math.max(0, baseStartingBalance + priorRealizedPnlCents)
      : null;

  const aggregate = computeAggregateMetrics(trades, effectiveStartingBalance);
  const equityCurve = buildEquityCurve(trades, effectiveStartingBalance ?? 0);
  const dailyPnl = buildDailyPnl(trades);
  const rDist = buildRDistribution(trades);

  // Group breakdowns
  const byInstrument = groupBy(trades, (t) => t.instrumentSymbol);
  const bySession = groupBy(trades, (t) => t.session, (k) => {
    const map: Record<string, string> = {
      asian_range: "Asian Range",
      asia: "Asia",
      london_open: "London Open",
      london: "London",
      ny_am: "New York AM",
      ny_lunch: "New York Lunch",
      ny_pm: "New York PM",
      off_hours: "Off Hours",
      custom: "Custom",
    };
    return map[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  });
  const byStrategy = groupBy(trades, (t) => t.strategyId);
  // Resolve strategy names
  const strategyMap = new Map<string, string>();
  if (byStrategy.length > 0) {
    const strats = await db.strategy.findMany({ where: { userId: user.id }, select: { id: true, name: true } });
    strats.forEach((s) => strategyMap.set(s.id, s.name));
  }
  byStrategy.forEach((g) => (g.label = strategyMap.get(g.key) ?? "Unknown"));

  // Long vs Short breakdown
  const longs = trades.filter((t) => t.direction === "long");
  const shorts = trades.filter((t) => t.direction === "short");
  const longMetrics = computeAggregateMetrics(longs, null);
  const shortMetrics = computeAggregateMetrics(shorts, null);
  const longVsShort = {
    long: {
      trades: longMetrics.totalTrades,
      closedTrades: longMetrics.closedTrades,
      wins: longMetrics.wins,
      losses: longMetrics.losses,
      winRate: longMetrics.winRate,
      avgR: longMetrics.avgR,
      profitFactor: longMetrics.profitFactor,
      expectancyR: longMetrics.expectancyR,
      pnlCents: longMetrics.netPnlCents,
    },
    short: {
      trades: shortMetrics.totalTrades,
      closedTrades: shortMetrics.closedTrades,
      wins: shortMetrics.wins,
      losses: shortMetrics.losses,
      winRate: shortMetrics.winRate,
      avgR: shortMetrics.avgR,
      profitFactor: shortMetrics.profitFactor,
      expectancyR: shortMetrics.expectancyR,
      pnlCents: shortMetrics.netPnlCents,
    },
  };

  // Period comparison (current vs previous equivalent period)
  let comparison: {
    prevNetPnlCents: number;
    pnlChangeCents: number;
    prevWinRate: string | null;
    winRateDelta: string | null;
    prevTrades: number;
    tradesDelta: number;
  } | null = null;

  if (from && to) {
    try {
      const msDiff = to.getTime() - from.getTime();
      const prevTo = new Date(from.getTime() - 1);
      const prevFrom = new Date(prevTo.getTime() - msDiff);
      const prevTrades = await loadTrades(user.id, prevFrom, prevTo, accountId);
      const prevAgg = computeAggregateMetrics(prevTrades, null);
      const curWin = aggregate.winRate ? parseFloat(aggregate.winRate) : null;
      const prevWin = prevAgg.winRate ? parseFloat(prevAgg.winRate) : null;
      comparison = {
        prevNetPnlCents: prevAgg.netPnlCents,
        pnlChangeCents: aggregate.netPnlCents - prevAgg.netPnlCents,
        prevWinRate: prevAgg.winRate ?? null,
        winRateDelta: curWin != null && prevWin != null ? (curWin - prevWin).toFixed(1) + "%" : null,
        prevTrades: prevAgg.totalTrades,
        tradesDelta: aggregate.totalTrades - prevAgg.totalTrades,
      };
    } catch {
      comparison = null;
    }
  }

  // Behavior analytics
  const behaviorFlags = new Set<string>();
  trades.forEach((t) => t.behaviorFlags?.forEach((f) => behaviorFlags.add(f)));
  const byBehavior = [...behaviorFlags].map((flag) => {
    const withFlag = trades.filter((t) => t.behaviorFlags?.includes(flag));
    const m = computeAggregateMetrics(withFlag, null);
    return {
      key: flag,
      label: flag.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      trades: m.totalTrades,
      avgR: m.avgR,
      pnlCents: m.netPnlCents,
      winRate: m.winRate,
    };
  });

  // A+ vs non-A+ (spec section 74)
  const aplus = trades.filter((t) => t.setupGrade === "A+");
  const nonAplus = trades.filter((t) => t.setupGrade && t.setupGrade !== "A+" && t.setupGrade !== "Invalid");
  const aplusMetrics = computeAggregateMetrics(aplus, null);
  const nonAplusMetrics = computeAggregateMetrics(nonAplus, null);

  // Insights (spec section 23, 24)
  const insights = generateInsights(trades);

  const responsePayload = {
    preset,
    range: from && to ? { from: from.toISOString(), to: to.toISOString() } : null,
    aggregate,
    comparison,
    longVsShort,
    startingBalanceCents: effectiveStartingBalance,
    equityCurve,
    dailyPnl,
    rDistribution: rDist,
    byInstrument,
    bySession,
    byStrategy,
    byBehavior,
    aplusVsNonAplus: {
      aplus: {
        trades: aplusMetrics.totalTrades,
        winRate: aplusMetrics.winRate,
        avgR: aplusMetrics.avgR,
        expectancyR: aplusMetrics.expectancyR,
        pnlCents: aplusMetrics.netPnlCents,
        maxDrawdownCents: aplusMetrics.maxDrawdownCents,
      },
      nonAplus: {
        trades: nonAplusMetrics.totalTrades,
        winRate: nonAplusMetrics.winRate,
        avgR: nonAplusMetrics.avgR,
        expectancyR: nonAplusMetrics.expectancyR,
        pnlCents: nonAplusMetrics.netPnlCents,
        maxDrawdownCents: nonAplusMetrics.maxDrawdownCents,
      },
    },
    insights,
    totalTrades: trades.length,
  };

  setCached(cacheKey, responsePayload, 30_000);
  return ok(responsePayload);
}
