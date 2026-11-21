import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const { id } = await ctx.params;
  const item = await db.watchlistOutcome.findFirst({
    where: { id, userId: user.id },
  });

  if (!item) return notFound("Watchlist item not found");
  return ok(item);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const { id } = await ctx.params;
  const existing = await db.watchlistOutcome.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) return notFound("Watchlist item not found");

  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");

  // Handle trade conversion idempotency check
  if (body.action === "convert") {
    if (existing.convertedTradeId) {
      // Check if converted trade still exists
      const existingTrade = await db.trade.findFirst({
        where: { id: existing.convertedTradeId, userId: user.id },
        select: { id: true, instrumentSymbol: true },
      });
      if (existingTrade) {
        return ok({
          alreadyConverted: true,
          tradeId: existingTrade.id,
          message: "Setup was already converted to trade #" + existingTrade.id,
          item: existing,
        });
      }
    }
  }

  const dataToUpdate: any = {};
  if (body.symbol !== undefined) dataToUpdate.symbol = String(body.symbol).toUpperCase().trim();
  if (body.direction !== undefined) dataToUpdate.direction = body.direction === "short" ? "short" : "long";
  if (body.timeframe !== undefined) dataToUpdate.timeframe = String(body.timeframe).trim();
  if (body.plannedEntry !== undefined) dataToUpdate.plannedEntry = body.plannedEntry ? String(body.plannedEntry).trim() : null;
  if (body.invalidationLevel !== undefined) dataToUpdate.invalidationLevel = body.invalidationLevel ? String(body.invalidationLevel).trim() : null;
  if (body.targetLevel !== undefined) dataToUpdate.targetLevel = body.targetLevel ? String(body.targetLevel).trim() : null;
  if (body.status !== undefined) dataToUpdate.status = String(body.status);
  if (body.recordedOutcome !== undefined) dataToUpdate.recordedOutcome = String(body.recordedOutcome);
  if (body.notes !== undefined) dataToUpdate.notes = body.notes ? String(body.notes) : null;
  if (body.strategyId !== undefined) dataToUpdate.strategyId = body.strategyId ? String(body.strategyId) : null;
  if (body.convertedTradeId !== undefined) dataToUpdate.convertedTradeId = body.convertedTradeId ? String(body.convertedTradeId) : null;

  const updated = await db.watchlistOutcome.update({
    where: { id },
    data: dataToUpdate,
  });

  await audit("watchlist.updated", "watchlistOutcome", id, {
    status: updated.status,
    recordedOutcome: updated.recordedOutcome,
    convertedTradeId: updated.convertedTradeId,
  });

  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return toApiError(e);
  }

  const { id } = await ctx.params;
  const existing = await db.watchlistOutcome.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) return notFound("Watchlist item not found");

  await db.watchlistOutcome.delete({
    where: { id },
  });

  await audit("watchlist.deleted", "watchlistOutcome", id, {
    symbol: existing.symbol,
  });

  return ok({ success: true, id });
}
