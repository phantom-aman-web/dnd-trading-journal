import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const item = await db.instrument.findFirst({ where: { id, userId: user.id } });
  if (!item) return notFound("Instrument not found");
  return ok(item);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const item = await db.instrument.findFirst({ where: { id, userId: user.id } });
  if (!item) return notFound("Instrument not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const updated = await db.instrument.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.market !== undefined ? { market: body.market } : {}),
      ...(body.pipSize !== undefined ? { pipSize: body.pipSize } : {}),
      ...(body.tickSize !== undefined ? { tickSize: body.tickSize } : {}),
      ...(body.contractSize !== undefined ? { contractSize: body.contractSize } : {}),
      ...(body.pricePrecision !== undefined ? { pricePrecision: body.pricePrecision } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
    },
  });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const item = await db.instrument.findFirst({ where: { id, userId: user.id } });
  if (!item) return notFound("Instrument not found");
  await db.instrument.delete({ where: { id } });
  return ok({ ok: true });
}
