/**
 * DnD — Auth utilities.
 * Credentials-based email/password with bcrypt, signed httpOnly JWT session cookie.
 * Per spec section 18: do not hand-roll password storage; we use bcrypt for hashing.
 */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

const SESSION_COOKIE = "dnd_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Resolve the JWT signing secret LAZILY (on first use).
 *
 * This is deferred to runtime — NOT module load — so that `next build`
 * (which imports this module in production mode) doesn't fail when the
 * env var isn't set during the build process.
 *
 * Production runtime: SESSION_SECRET MUST be set. If missing when a JWT
 * operation is attempted, throws (returns 500 for that auth request).
 *
 * Development: a documented dev-only fallback is used so the sandbox/dev
 * server can boot without env configuration.
 */
let _resolvedSecret: string | null = null;
let _secretChecked = false;

function resolveSecret(): string {
  if (_secretChecked) return _resolvedSecret!;
  _secretChecked = true;

  const envSecret = process.env.SESSION_SECRET;
  if (envSecret && envSecret.length >= 32) {
    _resolvedSecret = envSecret;
    return _resolvedSecret;
  }

  if (process.env.NODE_ENV === "production") {
    // Defer the throw to runtime — the caller should catch and return 500.
    throw new Error(
      "[security] SESSION_SECRET is missing or too short (< 32 chars). " +
        "Set SESSION_SECRET in the environment to a random string of at least 32 characters. " +
        "See .env.example.",
    );
  }

  // Dev-only documented fallback.
  _resolvedSecret =
    "dnd-dev-only-secret-DO-NOT-USE-IN-PRODUCTION-" + (process.env.USER || "sandbox");
  if (typeof console !== "undefined" && console.error) {
    console.error(
      "[security] SESSION_SECRET not set — using dev-only fallback. " +
        "This is safe for local development ONLY. Set SESSION_SECRET (>= 32 chars) before deploying. See .env.example.",
    );
  }
  return _resolvedSecret;
}

const encoder = new TextEncoder();

function getKey() {
  return encoder.encode(resolveSecret());
}

export interface SessionPayload {
  sub: string; // user id
  email: string;
  iat?: number;
  exp?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: { sub: string; email: string }): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getKey());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      settings: { select: { timezone: true } },
    },
  });
  // Flatten the user's timezone (from UserSettings, default "UTC") onto the
  // returned session user so callers (calendar/analytics/etc.) can do
  // timezone-aware date math without an extra DB round-trip.
  return user
    ? { ...user, timezone: user.settings?.timezone ?? "UTC" }
    : null;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

/**
 * Authorize a user-owned resource. Throws 403-shaped error if missing or owned by another user.
 * Per spec section 101: every protected operation must perform authorization.
 */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    const err = new Error("Unauthorized");
    (err as any).statusCode = 401;
    throw err;
  }
  return user;
}

export function notFound(msg = "Not found") {
  const err = new Error(msg);
  (err as any).statusCode = 404;
  throw err;
}

export function forbidden(msg = "Forbidden") {
  const err = new Error(msg);
  (err as any).statusCode = 403;
  throw err;
}
