import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, toApiError } from "@/lib/api";
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
  const trades = await db.trade.findMany({
    where,
    orderBy: { exitTime: "asc" },
  });
  return trades.map((t): TradeMetricRow => ({
    id: t.id,
    netPnlCents: t.netPnlCents,
    grossPnlCents: t.grossPnlCents,
    actualR: t.actualR,
    status: (["win","loss","breakeven"].includes(t.status) ? "closed" : t.status) as any,
    outcome: t.status as any,
    direction: t.direction,
    entryTime: t.entryTime,
    exitTime: t.exitTime,
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
  const trades = await loadTrades(user.id, from, to, accountId);

  // Account starting balance for equity curve baseline. Computed BEFORE
  // buildEquityCurve so the equity curve's first point reflects the real
  // account balance rather than an implicit 0-cent baseline (spec section 22).
  const accountWhere: any = { userId: user.id };
  if (accountId) accountWhere.id = accountId;
  const accounts = await db.tradingAccount.findMany({ where: accountWhere });
  const startingBalance = accounts.reduce((s, a) => s + a.startingBalanceCents, 0);

  const aggregate = computeAggregateMetrics(trades, null);
  const equityCurve = buildEquityCurve(trades, startingBalance);
  const dailyPnl = buildDailyPnl(trades);
  const rDist = buildRDistribution(trades);

  // Group breakdowns
  const byInstrument = groupBy(trades, (t) => t.instrumentSymbol);
  const bySession = groupBy(trades, (t) => t.session, (k) => {
    const map: Record<string, string> = { asia: "Asia", london: "London", ny_am: "New York AM", ny_pm: "New York PM", custom: "Custom" };
    return map[k] ?? k;
  });
  const byStrategy = groupBy(trades, (t) => t.strategyId);
  // Resolve strategy names
  const strategyMap = new Map<string, string>();
  if (byStrategy.length > 0) {
    const strats = await db.strategy.findMany({ where: { userId: user.id }, select: { id: true, name: true } });
    strats.forEach((s) => strategyMap.set(s.id, s.name));
  }
  byStrategy.forEach((g) => (g.label = strategyMap.get(g.key) ?? "Unknown"));

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
  const aplusMetrics = computeAggregateMetrics(aplus);
  const nonAplusMetrics = computeAggregateMetrics(nonAplus, null);

  // Insights (spec section 23, 24)
  const insights = generateInsights(trades);

  return ok({
    preset,
    range: from && to ? { from: from.toISOString(), to: to.toISOString() } : null,
    aggregate,
    startingBalanceCents: startingBalance,
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
  });
}
