import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, bad, toApiError, parseJson } from "@/lib/api";
import { saveUpload, ensureStorage, isAllowedImageMime, isAllowedVideoMime, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, buildSignedUrl } from "@/lib/storage";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  const url = new URL(req.url);
  const tradeId = url.searchParams.get("tradeId");
  const kind = url.searchParams.get("kind");
  const where: any = { userId: user.id };
  if (tradeId) where.tradeId = tradeId;
  if (kind) where.kind = kind;
  const items = await db.tradeMedia.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { annotations: true },
  });
  // Inline the signed URL into each item so the client doesn't have to make
  // N+1 follow-up GET /api/media/[id] requests just to render thumbnails.
  // The signed token is short-lived (15 min) but matches the typical view
  // session length; re-fetching the list refreshes them as needed.
  const withUrls = await Promise.all(items.map(async (m) => ({ ...m, url: await buildSignedUrl(m.storedPath) })));
  return ok({ items: withUrls });
}

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return toApiError(e); }
  await ensureStorage();
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const tradeId = (formData.get("tradeId") as string | null) ?? null;
  const strategyId = (formData.get("strategyId") as string | null) ?? null;
  const reviewId = (formData.get("reviewId") as string | null) ?? null;
  const stage = (formData.get("stage") as string | null) ?? null;
  const caption = (formData.get("caption") as string | null) ?? null;

  if (!file) return bad("File is required");

  // Validate ownership of parent
  if (tradeId) {
    const trade = await db.trade.findFirst({ where: { id: tradeId, userId: user.id } });
    if (!trade) return bad("Trade not found or not owned by user");
  }
  if (strategyId) {
    const strat = await db.strategy.findFirst({ where: { id: strategyId, userId: user.id } });
    if (!strat) return bad("Strategy not found or not owned by user");
  }
  if (reviewId) {
    const rev = await db.review.findFirst({ where: { id: reviewId, userId: user.id } });
    if (!rev) return bad("Review not found or not owned by user");
  }

  // Validate MIME/size (spec section 104)
  const isImage = isAllowedImageMime(file.type);
  const isVideo = isAllowedVideoMime(file.type);
  if (!isImage && !isVideo) return bad("Unsupported file type. Allowed: PNG, JPEG, WebP, GIF, MP4, WebM, MOV.");
  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > maxBytes) {
    return bad(`File too large. Max ${isImage ? "20 MB" : "500 MB"}.`);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const storedPath = await saveUpload(user.id, file.name, buffer, isImage ? "images" : "videos");

  const media = await db.tradeMedia.create({
    data: {
      userId: user.id,
      tradeId,
      strategyId,
      reviewId,
      kind: isImage ? "image" : "video",
      stage,
      filename: file.name,
      storedPath,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadStatus: "ready",
      caption,
    },
  });
  await audit("media.uploaded", "trade_media", media.id, { kind: media.kind });
  return ok(media);
}
