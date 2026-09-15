/**
 * DnD — Storage helpers.
 * Refactored to use Supabase Storage for Vercel deployment.
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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

const BUCKET_NAME = "media";
const SIGNED_URL_TTL = 60 * 15; // 15 minutes

// Lazily initialized Supabase client
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.PROJECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase credentials missing. Need PROJECT_URL and SERVICE_ROLE_KEY.");
  }
  _supabase = createClient(url, key);
  return _supabase;
}

export async function ensureStorage(): Promise<void> {
  // Supabase bucket should be created by user.
}

export async function saveUpload(
  userId: string,
  filename: string,
  data: Buffer,
  subdir = "media",
  contentType = "application/octet-stream"
): Promise<string> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const id = crypto.randomUUID();
  const stored = `${userId}/${subdir}/${id}-${safeName}`;
  
  const { error } = await getSupabase().storage.from(BUCKET_NAME).upload(stored, data, {
    contentType,
    upsert: false
  });
  
  if (error) {
    throw new Error(`Failed to upload to Supabase: ${error.message}`);
  }
  
  return stored;
}

export async function deleteStored(stored: string): Promise<void> {
  await getSupabase().storage.from(BUCKET_NAME).remove([stored]);
}

/** Build a relative signed URL for use in the frontend. */
export async function buildSignedUrl(stored: string): Promise<string> {
  const { data, error } = await getSupabase()
    .storage
    .from(BUCKET_NAME)
    .createSignedUrl(stored, SIGNED_URL_TTL);
    
  if (error || !data) {
    return "";
  }
  
  return data.signedUrl;
}
