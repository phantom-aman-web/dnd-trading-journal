/**
 * DnD — Storage helpers.
 * Per spec section 49: private object storage with short-lived signed URLs.
 * This implementation uses the local filesystem under /home/z/my-project/storage/
 * and serves files via a signed-token API endpoint.
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const STORAGE_ROOT = "/home/z/my-project/storage";

const SIGNED_URL_TTL = 60 * 15; // 15 minutes

/**
 * Resolve the HMAC secret for signed media URLs LAZILY (on first use).
 *
 * Deferred to runtime — NOT module load — so that `next build` (which
 * imports this module in production mode) doesn't fail when the env var
 * isn't set during the build process.
 *
 * Production runtime: STORAGE_SECRET MUST be set. If missing when a signed
 * URL operation is attempted, throws (returns 500 for that request).
 *
 * Development: a documented dev-only fallback is used so the sandbox/dev
 * server can boot without env configuration.
 */
let _resolvedStorageSecret: string | null = null;
let _storageSecretChecked = false;

function resolveStorageSecret(): string {
  if (_storageSecretChecked) return _resolvedStorageSecret!;
  _storageSecretChecked = true;

  const envSecret = process.env.STORAGE_SECRET;
  if (envSecret && envSecret.length >= 32) {
    _resolvedStorageSecret = envSecret;
    return _resolvedStorageSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[security] STORAGE_SECRET is missing or too short (< 32 chars). " +
        "Set STORAGE_SECRET in the environment to a random string of at least 32 characters. " +
        "See .env.example.",
    );
  }

  _resolvedStorageSecret =
    "dnd-dev-only-storage-secret-DO-NOT-USE-IN-PRODUCTION-" + (process.env.USER || "sandbox");
  if (typeof console !== "undefined" && console.error) {
    console.error(
      "[security] STORAGE_SECRET not set — using dev-only fallback. " +
        "This is safe for local development ONLY. Set STORAGE_SECRET (>= 32 chars) before deploying. See .env.example.",
    );
  }
  return _resolvedStorageSecret;
}

export async function ensureStorage(): Promise<void> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
}

/**
 * Save an uploaded file (Buffer) and return its stored relative path.
 * Files are namespaced by userId to enforce ownership.
 */
export async function saveUpload(
  userId: string,
  filename: string,
  data: Buffer,
  subdir = "media",
): Promise<string> {
  await ensureStorage();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const id = crypto.randomUUID();
  const dir = path.join(STORAGE_ROOT, userId, subdir);
  await fs.mkdir(dir, { recursive: true });
  const stored = `${id}-${safeName}`;
  await fs.writeFile(path.join(dir, stored), data);
  return `${userId}/${subdir}/${stored}`;
}

/** Resolve a stored relative path to an absolute filesystem path. */
export function resolveStoredPath(stored: string): string {
  // prevent path traversal
  const safe = stored.replace(/\.\./g, "").replace(/^\/+/, "");
  return path.join(STORAGE_ROOT, safe);
}

/** Read a stored file as Buffer. */
export async function readStored(stored: string): Promise<Buffer> {
  return fs.readFile(resolveStoredPath(stored));
}

/** Get file size in bytes. */
export async function storedSize(stored: string): Promise<number> {
  const stat = await fs.stat(resolveStoredPath(stored));
  return stat.size;
}

/** Delete a stored file (best-effort). */
export async function deleteStored(stored: string): Promise<void> {
  try {
    await fs.unlink(resolveStoredPath(stored));
  } catch {
    /* ignore */
  }
}

/**
 * Generate a short-lived signed token for a stored file.
 * Token = base64url(payload).signature, payload = { p: stored, exp: ts }
 */
export function signFileToken(stored: string): string {
  const payload = {
    p: stored,
    exp: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", resolveStorageSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export interface SignedTokenPayload {
  p: string;
  exp: number;
}

export function verifyFileToken(token: string): SignedTokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", resolveStorageSecret()).update(body).digest("base64url");
  // Constant-time comparison to prevent timing-attack oracle on token
  // forgery (spec section 49). `crypto.timingSafeEqual` throws when the two
  // buffers differ in length, which itself would be a distinguishable
  // failure mode — guard with a length pre-check that returns early without
  // short-circuiting on a single-character mismatch.
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedTokenPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Build a relative signed URL for use in the frontend. */
export function buildSignedUrl(stored: string): string {
  return `/api/media/file?token=${signFileToken(stored)}`;
}

/** MIME types allowed for images and videos (spec section 104). */
export const ALLOWED_IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const ALLOWED_VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];

export function isAllowedImageMime(mime: string): boolean {
  return ALLOWED_IMAGE_MIMES.includes(mime.toLowerCase());
}
export function isAllowedVideoMime(mime: string): boolean {
  return ALLOWED_VIDEO_MIMES.includes(mime.toLowerCase());
}

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
