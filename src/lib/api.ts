/** DnD — API route helpers. */

import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function bad(msg = "Bad request", details?: unknown) {
  return NextResponse.json({ error: msg, details }, { status: 400 });
}

export function unauthorized(msg = "Unauthorized") {
  return NextResponse.json({ error: msg }, { status: 401 });
}

export function forbidden(msg = "Forbidden") {
  return NextResponse.json({ error: msg }, { status: 403 });
}

export function notFound(msg = "Not found") {
  return NextResponse.json({ error: msg }, { status: 404 });
}

export function serverError(msg = "Internal error", errorId?: string) {
  return NextResponse.json({ error: msg, errorId }, { status: 500 });
}

/** Convert a thrown error to an appropriate API response (per spec section 107). */
export function toApiError(e: unknown) {
  const err = e as { statusCode?: number; message?: string };
  const status = err?.statusCode ?? 500;
  const msg = err?.message ?? "Internal error";
  if (status === 401) return unauthorized(msg);
  if (status === 403) return forbidden(msg);
  if (status === 404) return notFound(msg);
  if (status === 400) return bad(msg);
  // Per spec section 107: never expose internal errors
  return serverError("Something went wrong. Please try again.", cryptoId());
}

function cryptoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Parse a JSON body safely, returns null on failure. */
export async function parseJson<T = Record<string, any>>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Simple in-memory rate limiter (per spec section 106). */
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}
