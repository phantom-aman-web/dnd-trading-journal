import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, notFound, toApiError } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const plan = await db.dailyPlan.findFirst({ where: { id, userId: user.id } });
  if (!plan) return notFound("Daily plan not found");
  return ok(plan);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const plan = await db.dailyPlan.findFirst({ where: { id, userId: user.id } });
  if (!plan) return notFound("Daily plan not found");
  // Trade.dailyPlanId uses onDelete: SetNull, so linked trades are
  // automatically unlinked — no manual updateMany required.
  await db.dailyPlan.delete({ where: { id } });
  await audit("daily_plan.deleted", "daily_plan", id, { date: plan.date });
  return ok({ ok: true });
}
