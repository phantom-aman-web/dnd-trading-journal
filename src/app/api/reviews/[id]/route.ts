import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const review = await db.review.findFirst({
    where: { id, userId: user.id },
    include: { tradeLinks: { include: { trade: true } }, actionItems: true },
  });
  if (!review) return notFound("Review not found");
  return ok(review);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const review = await db.review.findFirst({ where: { id, userId: user.id } });
  if (!review) return notFound("Review not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const updated = await db.review.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.marketConditions !== undefined ? { marketConditions: body.marketConditions } : {}),
      ...(body.planFollowed !== undefined ? { planFollowed: body.planFollowed } : {}),
      ...(body.bestTradeId !== undefined ? { bestTradeId: body.bestTradeId } : {}),
      ...(body.worstTradeId !== undefined ? { worstTradeId: body.worstTradeId } : {}),
      ...(body.biggestMistake !== undefined ? { biggestMistake: body.biggestMistake } : {}),
      ...(body.emotionalState !== undefined ? { emotionalState: body.emotionalState } : {}),
      ...(body.biggestLesson !== undefined ? { biggestLesson: body.biggestLesson } : {}),
      ...(body.nextFocus !== undefined ? { nextFocus: body.nextFocus } : {}),
      ...(body.reflection !== undefined ? { reflection: body.reflection } : {}),
    },
  });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const review = await db.review.findFirst({ where: { id, userId: user.id } });
  if (!review) return notFound("Review not found");
  await db.review.delete({ where: { id } });
  return ok({ ok: true });
}
