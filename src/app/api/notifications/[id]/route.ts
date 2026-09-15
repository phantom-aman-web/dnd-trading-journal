import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, notFound, toApiError } from "@/lib/api";

export async function PATCH(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const notif = await db.notification.findFirst({ where: { id, userId: user.id } });
  if (!notif) return notFound("Notification not found");
  const updated = await db.notification.update({
    where: { id },
    data: { read: true },
  });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const notif = await db.notification.findFirst({ where: { id, userId: user.id } });
  if (!notif) return notFound("Notification not found");
  await db.notification.delete({ where: { id } });
  return ok({ ok: true });
}
