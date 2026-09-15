import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { TradeMetricRow, computeAggregateMetrics, safeParsePsychTags } from "@/lib/financial-engine";

function safeParseArr(json: string | null): string[] {
  if (!json) return [];
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch { return []; }
}

export async function GET(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const where: any = { userId: user.id };
  if (kind) where.kind = kind;
  const items = await db.review.findMany({
    where,
    orderBy: { periodStart: "desc" },
    include: { tradeLinks: { include: { trade: true } }, actionItems: true },
  });
  return ok({ items });
}

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const { kind, periodStart, periodEnd, title, marketConditions, planFollowed, bestTradeId, worstTradeId, biggestMistake, emotionalState, biggestLesson, nextFocus, reflection, linkedTradeIds } = body;
  if (!kind || !periodStart || !periodEnd) return bad("kind, periodStart, periodEnd are required");

  // Compute auto metrics for the period
  const trades = await db.trade.findMany({
    where: {
      userId: user.id,
      isArchived: false,
      entryTime: { gte: new Date(periodStart), lte: new Date(periodEnd) },
    },
    orderBy: { entryTime: "asc" },
  });
  const rows: TradeMetricRow[] = trades.map((t) => ({
    id: t.id,
    netPnlCents: t.netPnlCents,
    actualR: t.actualR,
    status: (["win","loss","breakeven"].includes(t.status) ? "closed" : t.status) as any,
    outcome: t.status as any,
    direction: t.direction,
    entryTime: t.entryTime,
    setupGrade: t.setupGrade,
    instrumentSymbol: t.instrumentSymbol,
    session: t.session,
    strategyId: t.strategyId,
    strategyVersionId: t.strategyVersionId,
    behaviorFlags: safeParseArr(t.behaviorFlagsJson),
    psychTags: safeParsePsychTags(t.psychBeforeJson),
  }));
  const metrics = computeAggregateMetrics(rows, null);

  const review = await db.review.create({
    data: {
      userId: user.id,
      kind,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      title,
      marketConditions,
      planFollowed,
      bestTradeId,
      worstTradeId,
      biggestMistake,
      emotionalState,
      biggestLesson,
      nextFocus,
      reflection,
      metricsJson: JSON.stringify(metrics),
      tradeLinks: linkedTradeIds && linkedTradeIds.length > 0
        ? { create: linkedTradeIds.map((tradeId: string) => ({ tradeId })) }
        : undefined,
    },
    include: { tradeLinks: true },
  });
  return ok(review);
}
