import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { db } from "./db";
import {
  ensureIdempotencyTable,
  computeTradePayloadHash,
  claimIdempotencyKey,
  finalizeIdempotencyKey,
  releaseIdempotencyKey,
  waitForInFlightTrade,
} from "./trade-idempotency";

describe("Trade Creation Idempotency & Concurrency Hardening", () => {
  const testRunId = Date.now();
  const userAEmail = `test-idem-a-${testRunId}@alphapips-test.internal`;
  const userBEmail = `test-idem-b-${testRunId}@alphapips-test.internal`;

  let userAId: string;
  let userBId: string;
  let accountAId: string;
  let accountBId: string;
  const createdTradeIds: string[] = [];

  beforeAll(async () => {
    await ensureIdempotencyTable();

    // 1. Create two isolated test users and accounts
    const userA = await db.user.create({
      data: {
        email: userAEmail,
        passwordHash: "dummy-hash-a",
        name: "Idem Test User A",
      },
    });
    userAId = userA.id;

    const userB = await db.user.create({
      data: {
        email: userBEmail,
        passwordHash: "dummy-hash-b",
        name: "Idem Test User B",
      },
    });
    userBId = userB.id;

    const accountA = await db.tradingAccount.create({
      data: {
        userId: userAId,
        name: "User A Account",
        currency: "USD",
        startingBalanceCents: 10000000,
        currentBalanceCents: 10000000,
      },
    });
    accountAId = accountA.id;

    const accountB = await db.tradingAccount.create({
      data: {
        userId: userBId,
        name: "User B Account",
        currency: "USD",
        startingBalanceCents: 10000000,
        currentBalanceCents: 10000000,
      },
    });
    accountBId = accountB.id;
  }, 30000);

  afterAll(async () => {
    try {
      // Clean up trades, idempotency records, accounts, users
      if (createdTradeIds.length > 0) {
        await db.trade.deleteMany({ where: { id: { in: createdTradeIds } } });
      }
      if (userAId || userBId) {
        await db.$executeRawUnsafe(
          `DELETE FROM trade_idempotency WHERE "userId" IN ($1, $2)`,
          userAId || "",
          userBId || "",
        );
      }
      if (accountAId) await db.tradingAccount.deleteMany({ where: { id: accountAId } });
      if (accountBId) await db.tradingAccount.deleteMany({ where: { id: accountBId } });
      if (userAId) await db.user.deleteMany({ where: { id: userAId } });
      if (userBId) await db.user.deleteMany({ where: { id: userBId } });
    } catch (e) {
      console.warn("Cleanup warning in idempotency tests:", e);
    }
  }, 30000);

  const basePayload = {
    accountId: "", // set dynamically
    instrumentSymbol: "EURUSD",
    direction: "long" as const,
    plannedEntryPrice: "1.08500",
    plannedStopPrice: "1.08200",
    plannedTargetPrice: "1.09100",
    plannedRiskPct: "1.0",
    executions: [
      { kind: "entry" as const, price: "1.08500", quantity: "1.0" },
    ],
    notes: "Idempotency test trade execution",
  };

  it("Scenario 1: Immediate sequential replay returns the original trade", async () => {
    const key = `seq-test-key-${Date.now()}`;
    const payload = { ...basePayload, accountId: accountAId };
    const hash = computeTradePayloadHash(payload);

    // 1st request claims key
    const claim1 = await claimIdempotencyKey(userAId, key, hash);
    expect(claim1.status).toBe("claimed");

    // Create the trade
    const trade1 = await db.trade.create({
      data: {
        userId: userAId,
        accountId: accountAId,
        instrumentSymbol: payload.instrumentSymbol,
        direction: payload.direction,
        plannedEntryPrice: payload.plannedEntryPrice,
        status: "open",
      },
    });
    createdTradeIds.push(trade1.id);
    await finalizeIdempotencyKey(userAId, key, trade1.id);

    // Immediate 2nd request with same key and payload
    const claim2 = await claimIdempotencyKey(userAId, key, hash);
    expect(claim2.status).toBe("completed");
    if (claim2.status === "completed") {
      expect(claim2.tradeId).toBe(trade1.id);
    }
  }, 20000);

  it("Scenario 2: Replay after 30+ seconds returns the original trade (no expiration wipe)", async () => {
    const key = `aged-key-${Date.now()}`;
    const payload = { ...basePayload, accountId: accountAId, notes: "Aged trade test" };
    const hash = computeTradePayloadHash(payload);

    const claim = await claimIdempotencyKey(userAId, key, hash);
    expect(claim.status).toBe("claimed");

    const trade = await db.trade.create({
      data: {
        userId: userAId,
        accountId: accountAId,
        instrumentSymbol: payload.instrumentSymbol,
        direction: payload.direction,
        status: "open",
      },
    });
    createdTradeIds.push(trade.id);
    await finalizeIdempotencyKey(userAId, key, trade.id);

    // Manually backdate the idempotency record by 45 seconds to simulate 30+ s replay
    await db.$executeRawUnsafe(
      `UPDATE trade_idempotency SET "createdAt" = NOW() - INTERVAL '45 seconds' WHERE "userId" = $1 AND key = $2`,
      userAId,
      key,
    );

    // Replay after 45 seconds
    const replayClaim = await claimIdempotencyKey(userAId, key, hash);
    expect(replayClaim.status).toBe("completed");
    if (replayClaim.status === "completed") {
      expect(replayClaim.tradeId).toBe(trade.id);
    }
  }, 20000);

  it("Scenario 3: Replay after browser reload returns the original trade", async () => {
    // A browser reload loses in-memory client state and sends the cached key from localStorage/headers
    const key = `reload-key-${Date.now()}`;
    const payload = { ...basePayload, accountId: accountAId, notes: "Browser reload scenario" };
    const hash = computeTradePayloadHash(payload);

    // Before reload
    const claimBefore = await claimIdempotencyKey(userAId, key, hash);
    expect(claimBefore.status).toBe("claimed");
    const trade = await db.trade.create({
      data: {
        userId: userAId,
        accountId: accountAId,
        instrumentSymbol: payload.instrumentSymbol,
        direction: payload.direction,
        status: "open",
      },
    });
    createdTradeIds.push(trade.id);
    await finalizeIdempotencyKey(userAId, key, trade.id);

    // Fresh simulated session after reload
    const freshPayloadAfterReload = { ...basePayload, accountId: accountAId, notes: "Browser reload scenario" };
    const freshHash = computeTradePayloadHash(freshPayloadAfterReload);
    const claimAfter = await claimIdempotencyKey(userAId, key, freshHash);

    expect(claimAfter.status).toBe("completed");
    if (claimAfter.status === "completed") {
      expect(claimAfter.tradeId).toBe(trade.id);
    }
  }, 20000);

  it("Scenario 4: Concurrent duplicate requests cannot create duplicate trades (race-condition safe)", async () => {
    const key = `concurrent-key-${Date.now()}`;
    const payload = { ...basePayload, accountId: accountAId, notes: "Concurrent race test" };
    const hash = computeTradePayloadHash(payload);

    // Dispatch 5 concurrent requests with identical key and payload simultaneously
    const results = await Promise.all([
      claimIdempotencyKey(userAId, key, hash),
      claimIdempotencyKey(userAId, key, hash),
      claimIdempotencyKey(userAId, key, hash),
      claimIdempotencyKey(userAId, key, hash),
      claimIdempotencyKey(userAId, key, hash),
    ]);

    // Exactly ONE request must get "claimed"
    const claimedCount = results.filter((r) => r.status === "claimed").length;
    expect(claimedCount).toBe(1);

    // All other 4 requests must get "in_flight" (or "completed")
    const inFlightCount = results.filter((r) => r.status === "in_flight").length;
    expect(inFlightCount).toBe(4);

    // Create the single trade
    const trade = await db.trade.create({
      data: {
        userId: userAId,
        accountId: accountAId,
        instrumentSymbol: payload.instrumentSymbol,
        direction: payload.direction,
        status: "open",
      },
    });
    createdTradeIds.push(trade.id);
    await finalizeIdempotencyKey(userAId, key, trade.id);

    // A waiting client now successfully resolves the trade ID
    const resolvedId = await waitForInFlightTrade(userAId, key, 1000);
    expect(resolvedId).toBe(trade.id);
  }, 20000);

  it("Scenario 5: Same key with different payload is safely rejected with conflict (409)", async () => {
    const key = `conflict-key-${Date.now()}`;
    const payloadA = { ...basePayload, accountId: accountAId, direction: "long" as const, plannedEntryPrice: "1.08500" };
    const hashA = computeTradePayloadHash(payloadA);

    // First request with payload A
    const claim1 = await claimIdempotencyKey(userAId, key, hashA);
    expect(claim1.status).toBe("claimed");

    // Second request with SAME key but DIFFERENT payload (e.g. short direction, different price)
    const payloadB = { ...basePayload, accountId: accountAId, direction: "short" as const, plannedEntryPrice: "1.09500" };
    const hashB = computeTradePayloadHash(payloadB);

    const claim2 = await claimIdempotencyKey(userAId, key, hashB);
    expect(claim2.status).toBe("conflict");
    if (claim2.status === "conflict") {
      expect(claim2.message).toContain("different request payload");
    }
  }, 20000);

  it("Scenario 6: Different keys can create different intentional trades even with identical parameters", async () => {
    const key1 = `diff-key-1-${Date.now()}`;
    const key2 = `diff-key-2-${Date.now()}`;
    const payload = { ...basePayload, accountId: accountAId, notes: "Intentional separate scale-in trade" };
    const hash = computeTradePayloadHash(payload);

    // Key 1 claims and creates Trade 1
    const claim1 = await claimIdempotencyKey(userAId, key1, hash);
    expect(claim1.status).toBe("claimed");
    const trade1 = await db.trade.create({
      data: {
        userId: userAId,
        accountId: accountAId,
        instrumentSymbol: payload.instrumentSymbol,
        direction: payload.direction,
        status: "open",
      },
    });
    createdTradeIds.push(trade1.id);
    await finalizeIdempotencyKey(userAId, key1, trade1.id);

    // Key 2 claims and creates Trade 2 independently
    const claim2 = await claimIdempotencyKey(userAId, key2, hash);
    expect(claim2.status).toBe("claimed");
    const trade2 = await db.trade.create({
      data: {
        userId: userAId,
        accountId: accountAId,
        instrumentSymbol: payload.instrumentSymbol,
        direction: payload.direction,
        status: "open",
      },
    });
    createdTradeIds.push(trade2.id);
    await finalizeIdempotencyKey(userAId, key2, trade2.id);

    expect(trade1.id).not.toBe(trade2.id);
  }, 20000);

  it("Scenario 7: Cross-user key isolation — User A's key does not block User B from using the same key string", async () => {
    const sharedKeyString = `shared-client-uuid-${Date.now()}`;
    const payloadA = { ...basePayload, accountId: accountAId };
    const payloadB = { ...basePayload, accountId: accountBId };

    const hashA = computeTradePayloadHash(payloadA);
    const hashB = computeTradePayloadHash(payloadB);

    // User A claims the key
    const claimA = await claimIdempotencyKey(userAId, sharedKeyString, hashA);
    expect(claimA.status).toBe("claimed");
    const tradeA = await db.trade.create({
      data: {
        userId: userAId,
        accountId: accountAId,
        instrumentSymbol: payloadA.instrumentSymbol,
        direction: payloadA.direction,
        status: "open",
      },
    });
    createdTradeIds.push(tradeA.id);
    await finalizeIdempotencyKey(userAId, sharedKeyString, tradeA.id);

    // User B uses the exact SAME key string — MUST NOT be blocked or conflict
    const claimB = await claimIdempotencyKey(userBId, sharedKeyString, hashB);
    expect(claimB.status).toBe("claimed");
    const tradeB = await db.trade.create({
      data: {
        userId: userBId,
        accountId: accountBId,
        instrumentSymbol: payloadB.instrumentSymbol,
        direction: payloadB.direction,
        status: "open",
      },
    });
    createdTradeIds.push(tradeB.id);
    await finalizeIdempotencyKey(userBId, sharedKeyString, tradeB.id);

    expect(tradeA.id).not.toBe(tradeB.id);
    expect(tradeA.userId).toBe(userAId);
    expect(tradeB.userId).toBe(userBId);
  }, 20000);

  it("Scenario 8: Exactly-one-record DB verification across multiple replays", async () => {
    const key = `db-count-key-${Date.now()}`;
    const payload = { ...basePayload, accountId: accountAId, notes: "Strict DB count check" };
    const hash = computeTradePayloadHash(payload);

    const initialTradesCount = await db.trade.count({
      where: { userId: userAId, accountId: accountAId, notes: "Strict DB count check" },
    });
    expect(initialTradesCount).toBe(0);

    // Step 1: Initial request creates trade
    const claim = await claimIdempotencyKey(userAId, key, hash);
    expect(claim.status).toBe("claimed");
    const trade = await db.trade.create({
      data: {
        userId: userAId,
        accountId: accountAId,
        instrumentSymbol: payload.instrumentSymbol,
        direction: payload.direction,
        status: "open",
        notes: payload.notes,
      },
    });
    createdTradeIds.push(trade.id);
    await finalizeIdempotencyKey(userAId, key, trade.id);

    // Step 2: Simulate subsequent replays (immediate, delayed, reloaded)
    const replay1 = await claimIdempotencyKey(userAId, key, hash);
    expect(replay1.status).toBe("completed");
    if (replay1.status === "completed") {
      expect(replay1.tradeId).toBe(trade.id);
    }

    const replay2 = await claimIdempotencyKey(userAId, key, hash);
    expect(replay2.status).toBe("completed");
    if (replay2.status === "completed") {
      expect(replay2.tradeId).toBe(trade.id);
    }

    // Step 3: Count rows in the database — MUST BE EXACTLY ONE
    const finalTradesCount = await db.trade.count({
      where: { userId: userAId, accountId: accountAId, notes: "Strict DB count check" },
    });
    expect(finalTradesCount).toBe(1);
  }, 40000);
});
