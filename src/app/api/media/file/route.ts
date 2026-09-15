import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyFileToken, readStored } from "@/lib/storage";

/**
 * Serves a stored media file via short-lived signed token.
 * Per spec section 49: controlled access via signed URLs.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return new NextResponse("Missing token", { status: 400 });
  const payload = verifyFileToken(token);
  if (!payload) return new NextResponse("Invalid or expired token", { status: 403 });

  // Optional: download=1 to force download
  const isDownload = url.searchParams.get("download") === "1";

  try {
    const buf = await readStored(payload.p);
    // Get mime from db
    const media = await db.tradeMedia.findFirst({ where: { storedPath: payload.p } });
    const mime = media?.mimeType ?? "application/octet-stream";
    const filename = media?.filename ?? "file";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.length),
        "Cache-Control": "private, max-age=900",
        ...(isDownload ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
      },
    });
  } catch {
    return new NextResponse("File not found", { status: 404 });
  }
}
