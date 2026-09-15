import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, notFound, toApiError, parseJson } from "@/lib/api";
import { buildSignedUrl, deleteStored } from "@/lib/storage";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const media = await db.tradeMedia.findFirst({
    where: { id, userId: user.id },
    include: { annotations: true },
  });
  if (!media) return notFound("Media not found");
  // Note: the returned signed URL can be opened with `&download=1` to force
  // a Content-Disposition: attachment response (handled by /api/media/file).
  // Clients that want a download link should append `&download=1` to `url`.
  return ok({ ...media, url: await buildSignedUrl(media.storedPath) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const media = await db.tradeMedia.findFirst({ where: { id, userId: user.id } });
  if (!media) return notFound("Media not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  const data: Record<string, unknown> = {};
  if (body.caption !== undefined) data.caption = body.caption;
  if (body.timeframe !== undefined) data.timeframe = body.timeframe || null;
  if (body.stage !== undefined) data.stage = body.stage;
  if (body.tags !== undefined) data.tagsJson = JSON.stringify(body.tags);
  // BUG-EVID-1 fix: allow tradeId to be set/updated so orphaned uploads
  // (created before the trade existed) can be attached to their trade.
  // Validate ownership of the target trade before writing.
  if (body.tradeId !== undefined) {
    const targetTradeId = body.tradeId || null;
    if (targetTradeId) {
      const owned = await db.trade.findFirst({
        where: { id: targetTradeId as string, userId: user.id },
        select: { id: true },
      });
      if (!owned) return bad("Trade not found or not owned by user");
    }
    data.tradeId = targetTradeId;
  }
  const updated = await db.tradeMedia.update({
    where: { id },
    data,
  });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const media = await db.tradeMedia.findFirst({ where: { id, userId: user.id } });
  if (!media) return notFound("Media not found");
  await deleteStored(media.storedPath);
  await db.tradeMedia.delete({ where: { id } });
  return ok({ ok: true });
}

// Annotations sub-resource (spec section 46)
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const { id } = await ctx.params;
  const media = await db.tradeMedia.findFirst({ where: { id, userId: user.id } });
  if (!media) return notFound("Media not found");
  const body = await parseJson(req);
  if (!body) return bad("Invalid JSON body");
  if (body.action === "setAnnotations") {
    await db.mediaAnnotation.deleteMany({ where: { mediaId: id } });
    if (Array.isArray(body.annotations) && body.annotations.length > 0) {
      await db.mediaAnnotation.createMany({
        data: body.annotations.map((a: any) => ({
          mediaId: id,
          kind: a.kind,
          payloadJson: JSON.stringify(a.payload ?? {}),
        })),
      });
    }
    const updated = await db.tradeMedia.findUnique({
      where: { id },
      include: { annotations: true },
    });
    return ok(updated);
  }
  return bad("Unknown action");
}
