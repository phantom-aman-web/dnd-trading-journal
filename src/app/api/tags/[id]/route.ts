import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const tag = await db.tag.findFirst({ where: { id, userId: user.id } });
  if (!tag) return notFound("Tag not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const updated = await db.tag.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
      ...(body.archived !== undefined ? { archived: body.archived } : {}),
    },
  });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const tag = await db.tag.findFirst({ where: { id, userId: user.id } });
  if (!tag) return notFound("Tag not found");
  await db.tag.delete({ where: { id } });
  return ok({ ok: true });
}
