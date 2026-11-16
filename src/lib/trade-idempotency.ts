import crypto from "crypto";
import { db } from "./db";

// Table definition and index initialization
let tableInitialized = false;

export async function ensureIdempotencyTable(): Promise<void> {
  if (tableInitialized) return;
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS trade_idempotency (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "payloadHash" TEXT NOT NULL,
        "tradeId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS trade_idempotency_user_key_idx
      ON trade_idempotency ("userId", "key");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS trade_idempotency_user_created_idx
      ON trade_idempotency ("userId", "createdAt");
    `);
    tableInitialized = true;
  } catch (err) {
    console.error("Failed to ensure trade_idempotency table:", err);
    throw err;
  }
}

/**
 * Computes a deterministic SHA-256 hash of trade creation payload.
 * Normalizes keys so formatting / whitespace / key order differences don't create false mismatches.
 */
export function computeTradePayloadHash(payload: Record<string, any>): string {
  // Extract core financial and trade parameters that define the trade payload
  const core = {
    accountId: payload.accountId,
    instrumentSymbol: (payload.instrumentSymbol || "").trim().toUpperCase(),
    direction: payload.direction,
    market: payload.market || null,
    session: payload.session || null,
    strategyId: payload.strategyId || null,
    strategyVersionId: payload.strategyVersionId || null,
    plannedEntryPrice: payload.plannedEntryPrice || null,
    plannedStopPrice: payload.plannedStopPrice || null,
    plannedTargetPrice: payload.plannedTargetPrice || null,
    plannedRiskPct: payload.plannedRiskPct || null,
    status: payload.status || "open",
    executions: (payload.executions || []).map((e: any) => ({
      kind: e.kind,
      price: String(e.price || "").trim(),
      quantity: String(e.quantity || "").trim(),
    })),
    notes: payload.notes || null,
  };

  const serialized = JSON.stringify(core, Object.keys(core).sort());
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

export type ClaimResult =
  | { status: "claimed"; recordId: string }
  | { status: "completed"; tradeId: string }
  | { status: "conflict"; message: string }
  | { status: "in_flight" };

/**
 * Atomically claims an idempotency key for a given user.
 * Uses PostgreSQL INSERT ... ON CONFLICT DO NOTHING to guarantee concurrency safety without throwing 23505 errors.
 */
export async function claimIdempotencyKey(
  userId: string,
  key: string,
  payloadHash: string,
): Promise<ClaimResult> {
  await ensureIdempotencyTable();

  // 1. Attempt atomic reservation
  const recordId = `idem_${crypto.randomUUID()}`;
  const insertedCount = await db.$executeRawUnsafe(
    `INSERT INTO trade_idempotency (id, "userId", "key", "payloadHash", "tradeId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("userId", "key") DO NOTHING`,
    recordId,
    userId,
    key,
    payloadHash,
  );

  // If 1 row inserted, this request owns the key reservation
  if (insertedCount === 1) {
    return { status: "claimed", recordId };
  }

  // 2. If 0 rows inserted, key was previously claimed or completed. Query the existing record.
  const existingRows = await db.$queryRawUnsafe<any[]>(
    `SELECT id, "payloadHash", "tradeId" FROM trade_idempotency WHERE "userId" = $1 AND "key" = $2 LIMIT 1`,
    userId,
    key,
  );

  if (existingRows && existingRows.length > 0) {
    const existing = existingRows[0];
    if (existing.payloadHash !== payloadHash) {
      return {
        status: "conflict",
        message: "Idempotency key mismatch: this key was already used with a different request payload.",
      };
    }
    if (existing.tradeId && existing.tradeId !== "PENDING") {
      return {
        status: "completed",
        tradeId: existing.tradeId,
      };
    }
    // If pending, concurrent duplicate request in progress
    return { status: "in_flight" };
  }

  return { status: "claimed", recordId };
}

/**
 * Finalizes the idempotency record with the created trade ID.
 */
export async function finalizeIdempotencyKey(
  userId: string,
  key: string,
  tradeId: string,
): Promise<void> {
  await ensureIdempotencyTable();
  await db.$executeRawUnsafe(
    `UPDATE trade_idempotency SET "tradeId" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = $2 AND "key" = $3`,
    tradeId,
    userId,
    key,
  );
}

/**
 * Releases/deletes a pending idempotency record if trade creation failed.
 */
export async function releaseIdempotencyKey(
  userId: string,
  key: string,
): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `DELETE FROM trade_idempotency WHERE "userId" = $1 AND "key" = $2 AND "tradeId" = 'PENDING'`,
      userId,
      key,
    );
  } catch (e) {
    console.warn("Failed to release idempotency key:", e);
  }
}

/**
 * Polls for a pending trade in flight (up to timeoutMs).
 */
export async function waitForInFlightTrade(
  userId: string,
  key: string,
  timeoutMs: number = 5000,
): Promise<string | null> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100));
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT "tradeId" FROM trade_idempotency WHERE "userId" = $1 AND "key" = $2 LIMIT 1`,
      userId,
      key,
    );
    if (rows && rows.length > 0 && rows[0].tradeId && rows[0].tradeId !== "PENDING") {
      return rows[0].tradeId;
    }
  }
  return null;
}
