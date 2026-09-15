import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, notFound, toApiError } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const trade = await db.trade.findFirst({
    where: { id, userId: user.id },
    include: { executions: true },
  });
  if (!trade) return notFound("Trade not found");
  const dup = await db.trade.create({
    data: {
      userId: user.id,
      accountId: trade.accountId,
      instrumentId: trade.instrumentId,
      instrumentSymbol: trade.instrumentSymbol,
      market: trade.market,
      direction: trade.direction,
      status: "open",
      session: trade.session,
      strategyId: trade.strategyId,
      strategyVersionId: trade.strategyVersionId,
      checklistVersionId: trade.checklistVersionId,
      setupGrade: trade.setupGrade,
      setupScore: trade.setupScore,
      tagsJson: trade.tagsJson,
      plannedEntryPrice: trade.plannedEntryPrice,
      plannedStopPrice: trade.plannedStopPrice,
      plannedTargetPrice: trade.plannedTargetPrice,
      plannedRiskPct: trade.plannedRiskPct,
      tradingTimezone: trade.tradingTimezone,
      setupJson: trade.setupJson,
      thesisJson: trade.thesisJson,
      notes: trade.notes,
      lessons: trade.lessons,
      planAdherenceJson: trade.planAdherenceJson,
      psychBeforeJson: trade.psychBeforeJson,
      psychAfterJson: trade.psychAfterJson,
      behaviorFlagsJson: trade.behaviorFlagsJson,
      isDraft: true,
      executions: {
        create: trade.executions.map((e) => ({
          kind: e.kind,
          seq: e.seq,
          price: e.price,
          quantity: e.quantity,
          timestamp: new Date(),
          notes: e.notes,
        })),
      },
    },
  });
  await audit("trade.duplicated", "trade", dup.id, { fromTradeId: id });
  return ok(dup);
}
