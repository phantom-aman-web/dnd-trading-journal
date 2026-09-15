import { PrismaClient } from "@prisma/client";

// ─── DATABASE CONFIGURATION GUARD (PERMANENT FIX) ─────────────────────────
// SPEC: Neon PostgreSQL is the AUTHORITATIVE database. NO SQLite fallback.
//
// Root cause of recurring .env reversion:
//   The Z.ai sandbox platform's initialization writes .env with the template
//   default DATABASE_URL=file:/home/z/my-project/db/custom.db at container
//   start. This guard detects that and fails LOUDLY with a clear error,
//   rather than silently falling back to SQLite.
//
// This guard runs BEFORE PrismaClient instantiation. If DATABASE_URL is
// missing or not postgresql://, the app refuses to start.

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "FATAL: DATABASE_URL is not set. The application requires Neon PostgreSQL. " +
    "Set DATABASE_URL=postgresql://... in your .env file. " +
    "The application will NOT start without a valid PostgreSQL connection.",
  );
}

if (
  !DATABASE_URL.startsWith("postgresql://") &&
  !DATABASE_URL.startsWith("postgres://")
) {
  throw new Error(
    "FATAL: DATABASE_URL must be a PostgreSQL connection string (postgresql://... or postgres://...). " +
    `Received: "${DATABASE_URL.slice(0, 30)}..." ` +
    "The application does NOT support SQLite fallback. " +
    "Set DATABASE_URL to a valid Neon PostgreSQL URL in your .env file.",
  );
}

// ─── PrismaClient ────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
