import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const item = await db.actionItem.findFirst({ where: { id, userId: user.id } });
  if (!item) return notFound("Action item not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const updated = await db.actionItem.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.linkedStrategyId !== undefined ? { linkedStrategyId: body.linkedStrategyId } : {}),
      ...(body.linkedChecklistId !== undefined ? { linkedChecklistId: body.linkedChecklistId } : {}),
    },
  });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const item = await db.actionItem.findFirst({ where: { id, userId: user.id } });
  if (!item) return notFound("Action item not found");
  await db.actionItem.delete({ where: { id } });
  return ok({ ok: true });
}
