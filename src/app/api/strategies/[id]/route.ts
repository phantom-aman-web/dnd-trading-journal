import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import { computeAggregateMetrics, type TradeMetricRow, type TradeOutcome } from "@/lib/financial-engine";

function computeAdherencePct(planAdherenceJson: string | null | undefined): number | null {
  if (!planAdherenceJson) return null;
  try {
    const pa = JSON.parse(planAdherenceJson);
    if (pa && typeof pa.adherencePct === "number") return Math.round(pa.adherencePct);
    if (pa && typeof pa.followedPlan === "boolean") return pa.followedPlan ? 100 : 0;
    const rc = pa?.ruleCompliance;
    if (!rc || typeof rc !== "object") return null;
    const values = Object.values(rc);
    if (values.length === 0) return null;
    const truthy = values.filter((v) => v === true).length;
    return Math.round((truthy / values.length) * 100);
  } catch {
    return null;
  }
}

function mapToTradeMetricRow(t: any): TradeMetricRow {
  let outcome: TradeOutcome = "open";
  if (!t.isDraft && t.status !== "planned" && t.status !== "open") {
    if (t.netPnlCents > 0) outcome = "win";
    else if (t.netPnlCents < 0) outcome = "loss";
    else outcome = "breakeven";
  }

  return {
    id: t.id,
    netPnlCents: t.netPnlCents ?? 0,
    grossPnlCents: t.grossPnlCents ?? t.netPnlCents ?? 0,
    actualR: t.actualR ? String(t.actualR) : null,
    status: t.status,
    outcome,
    exitTime: t.exitTime ? new Date(t.exitTime).toISOString() : null,
    entryTime: t.entryTime ? new Date(t.entryTime).toISOString() : null,
    instrumentSymbol: t.instrumentSymbol,
    direction: t.direction,
    setupGrade: t.setupGrade,
    session: t.session,
    strategyId: t.strategyId,
    strategyVersionId: t.strategyVersionId,
  };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const strat = await db.strategy.findFirst({
    where: { id, userId: user.id },
    include: {
      versions: { orderBy: { effectiveDate: "desc" } },
      experiments: true,
      checklistConfig: true,
    },
  });
  if (!strat) return notFound("Strategy not found");

  // Fetch all trades historically attributed to this strategy or any of its versions
  const trades = await db.trade.findMany({
    where: {
      userId: user.id,
      OR: [
        { strategyId: id },
        { strategyVersion: { strategyId: id } },
      ],
      isArchived: false,
    },
    orderBy: { entryTime: "asc" },
  });

  // Authoritative aggregate metrics for the strategy as a whole
  const aggregate = computeAggregateMetrics(trades.map(mapToTradeMetricRow), null);

  // Direction breakdown (Long vs Short)
  const longTrades = trades.filter((t) => t.direction === "long");
  const shortTrades = trades.filter((t) => t.direction === "short");
  const longAgg = computeAggregateMetrics(longTrades.map(mapToTradeMetricRow), null);
  const shortAgg = computeAggregateMetrics(shortTrades.map(mapToTradeMetricRow), null);

  // Instrument breakdown
  const instrumentMap = new Map<string, any[]>();
  for (const t of trades) {
    const sym = t.instrumentSymbol;
    if (!instrumentMap.has(sym)) instrumentMap.set(sym, []);
    instrumentMap.get(sym)!.push(t);
  }
  const byInstrument = [...instrumentMap.entries()].map(([sym, tArr]) => {
    const m = computeAggregateMetrics(tArr.map(mapToTradeMetricRow), null);
    return {
      symbol: sym,
      tradesCount: m.totalTrades,
      winRate: m.winRate,
      netPnlCents: m.netPnlCents,
      avgR: m.avgR,
      profitFactor: m.profitFactor,
    };
  }).sort((a, b) => b.tradesCount - a.tradesCount);

  // Average holding duration across closed trades
  const closedWithDur = trades.filter((t) => t.entryTime && t.exitTime && !t.isDraft && t.status !== "planned" && t.status !== "open");
  let avgHoldMinutes: number | null = null;
  if (closedWithDur.length > 0) {
    const totalMin = closedWithDur.reduce((acc, t) => {
      const dur = Math.max(0, (new Date(t.exitTime!).getTime() - new Date(t.entryTime!).getTime()) / 60000);
      return acc + dur;
    }, 0);
    avgHoldMinutes = Math.round(totalMin / closedWithDur.length);
  }

  // Checklist adherence
  const adherenceScores = trades
    .map((t) => computeAdherencePct(t.planAdherenceJson))
    .filter((s): s is number => s !== null);
  const avgAdherencePct = adherenceScores.length > 0
    ? Math.round(adherenceScores.reduce((a, b) => a + b, 0) / adherenceScores.length)
    : null;

  // Performance per version using authoritative financial engine
  const versionPerf = strat.versions.map((v) => {
    const vTrades = trades.filter((t) => t.strategyVersionId === v.id);
    const m = computeAggregateMetrics(vTrades.map(mapToTradeMetricRow), null);
    const vAdherence = vTrades
      .map((t) => computeAdherencePct(t.planAdherenceJson))
      .filter((s): s is number => s !== null);
    const vAvgAdh = vAdherence.length > 0
      ? Math.round(vAdherence.reduce((a, b) => a + b, 0) / vAdherence.length)
      : null;

    return {
      versionId: v.id,
      versionLabel: v.versionLabel,
      effectiveDate: v.effectiveDate,
      changeReason: v.changeReason,
      changeSummary: v.changeSummary,
      rulesJson: v.rulesJson,
      tradesCount: m.totalTrades,
      closedTrades: m.closedTrades,
      wins: m.wins,
      losses: m.losses,
      breakevens: m.breakevens,
      winRate: m.winRate,
      pnlCents: m.netPnlCents,
      grossProfitCents: m.grossProfitCents,
      grossLossCents: m.grossLossCents,
      profitFactor: m.profitFactor,
      expectancyCents: m.expectancyCents,
      avgR: m.avgR,
      totalR: m.totalR,
      checklistAdherencePct: vAvgAdh,
      isLowSample: vTrades.length < 20,
    };
  });

  return ok({
    ...strat,
    trades,
    aggregate,
    directionBreakdown: {
      long: { tradesCount: longAgg.totalTrades, winRate: longAgg.winRate, netPnlCents: longAgg.netPnlCents, avgR: longAgg.avgR },
      short: { tradesCount: shortAgg.totalTrades, winRate: shortAgg.winRate, netPnlCents: shortAgg.netPnlCents, avgR: shortAgg.avgR },
    },
    byInstrument,
    avgHoldMinutes,
    checklistAdherencePct: avgAdherencePct,
    versionPerformance: versionPerf,
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const strat = await db.strategy.findFirst({ where: { id, userId: user.id } });
  if (!strat) return notFound("Strategy not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const updated = await db.strategy.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.purpose !== undefined ? { purpose: body.purpose } : {}),
      ...(body.instruments !== undefined ? { instruments: body.instruments } : {}),
      ...(body.market !== undefined ? { market: body.market } : {}),
      ...(body.timeframe !== undefined ? { timeframe: body.timeframe } : {}),
      ...(body.session !== undefined ? { session: body.session } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.checklistConfigId !== undefined ? { checklistConfigId: body.checklistConfigId || null } : {}),
    },
  });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const strat = await db.strategy.findFirst({ where: { id, userId: user.id } });
  if (!strat) return notFound("Strategy not found");
  await db.strategy.delete({ where: { id } });
  return ok({ ok: true });
}

// Create a new strategy version (spec section 57, 58)
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const strat = await db.strategy.findFirst({ where: { id, userId: user.id } });
  if (!strat) return notFound("Strategy not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { versionLabel, changeReason, changeSummary, expectedImpact, rules, customFields, checklist, effectiveDate } = body;
  if (!versionLabel) return bad("Version label is required");
  const existing = await db.strategyVersion.findUnique({
    where: { strategyId_versionLabel: { strategyId: id, versionLabel } },
  });
  if (existing) return bad("Version label already exists");

  const cleanRulesList = Array.isArray(rules) ? rules : (rules?.rules ?? rules?.items ?? []);
  const cleanFieldsList = Array.isArray(customFields)
    ? customFields
    : (rules && typeof rules === "object" && Array.isArray((rules as any).customFields) ? (rules as any).customFields : []);

  const rulesData = {
    rules: cleanRulesList,
    items: cleanRulesList,
    customFields: cleanFieldsList,
  };

  const version = await db.strategyVersion.create({
    data: {
      strategyId: id,
      versionLabel,
      changeReason,
      changeSummary,
      expectedImpact,
      rulesJson: JSON.stringify(rulesData),
      checklistJson: checklist ? JSON.stringify(checklist) : null,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
    },
  });
  await audit("strategy.versioned", "strategy_version", version.id, { strategyId: id, versionLabel });
  return ok(version);
}
