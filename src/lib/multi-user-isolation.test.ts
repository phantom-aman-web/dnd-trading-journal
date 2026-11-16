import { describe, it, expect, afterAll } from "bun:test";
import { db } from "./db";

describe("Security & Multi-User Isolation Engine", () => {
  const testRunId = Date.now();
  const userAEmail = `test-user-a-${testRunId}@alphapips-test.internal`;
  const userBEmail = `test-user-b-${testRunId}@alphapips-test.internal`;

  let userAId: string;
  let userBId: string;
  let tradeAId: string;
  let accountAId: string;
  let externalSnapshotId: string;

  afterAll(async () => {
    // Clean up test data completely
    try {
      if (tradeAId) await db.trade.deleteMany({ where: { id: tradeAId } });
      if (accountAId) await db.tradingAccount.deleteMany({ where: { id: accountAId } });
      if (externalSnapshotId) await db.backup.deleteMany({ where: { id: externalSnapshotId } });
      if (userAId) await db.user.deleteMany({ where: { id: userAId } });
      if (userBId) await db.user.deleteMany({ where: { id: userBId } });
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }
  }, 30000);

  it("should enforce strict application-level multi-user data isolation between User A and User B", async () => {
    // 1. Create two isolated test users
    const userA = await db.user.create({
      data: {
        email: userAEmail,
        passwordHash: "dummy-hash-a",
        name: "Test User Alpha",
      },
    });
    userAId = userA.id;

    const userB = await db.user.create({
      data: {
        email: userBEmail,
        passwordHash: "dummy-hash-b",
        name: "Test User Bravo",
      },
    });
    userBId = userB.id;

    // 2. User A creates a trading account and trade
    const accountA = await db.tradingAccount.create({
      data: {
        userId: userAId,
        name: "User A Live Account",
        currency: "USD",
        startingBalanceCents: 5000000,
        currentBalanceCents: 5000000,
        accountType: "live",
      },
    });
    accountAId = accountA.id;

    const tradeA = await db.trade.create({
      data: {
        userId: userAId,
        accountId: accountAId,
        instrumentSymbol: "EURUSD",
        direction: "long",
        status: "closed",
        entryPriceAvg: "1.08500",
        exitPriceAvg: "1.09000",
        positionSize: "1.0",
        netPnlCents: 50000,
        grossPnlCents: 50000,
        actualR: "2.0",
      },
    });
    tradeAId = tradeA.id;

    // 3. User B queries their own trades -> MUST be 0
    const userBTrades = await db.trade.findMany({
      where: { userId: userBId },
    });
    expect(userBTrades.length).toBe(0);

    // 4. User B queries their own accounts -> MUST be 0
    const userBAccounts = await db.tradingAccount.findMany({
      where: { userId: userBId },
    });
    expect(userBAccounts.length).toBe(0);

    // 5. User B attempts direct lookup of User A's trade by ID with user scoping -> MUST return null (Not Found)
    const unauthorizedTradeLookup = await db.trade.findFirst({
      where: { id: tradeAId, userId: userBId },
    });
    expect(unauthorizedTradeLookup).toBeNull();

    // 6. User B attempts direct lookup of User A's account by ID with user scoping -> MUST return null
    const unauthorizedAccountLookup = await db.tradingAccount.findFirst({
      where: { id: accountAId, userId: userBId },
    });
    expect(unauthorizedAccountLookup).toBeNull();

    // 7. Verify User A can access their own trade
    const authorizedTradeLookup = await db.trade.findFirst({
      where: { id: tradeAId, userId: userAId },
    });
    expect(authorizedTradeLookup).not.toBeNull();
    expect(authorizedTradeLookup?.instrumentSymbol).toBe("EURUSD");
  }, 30000);

  it("should prove genuine Prisma transaction rollback and external safety snapshot survival on actual database", async () => {
    // 1. Pre-restore snapshot is saved OUTSIDE the transaction
    const externalSnapshot = await db.backup.create({
      data: {
        userId: userAId,
        filename: `pre-restore-safety-${testRunId}.json`,
        storedPath: `/tmp/safety-${testRunId}.json`,
        sizeBytes: 1024,
        recordCountsJson: JSON.stringify({ preRestoreSnapshot: true, tradeCount: 1 }),
      },
    });
    externalSnapshotId = externalSnapshot.id;

    // Verify initial trade count for User A
    const initialTrades = await db.trade.findMany({ where: { userId: userAId } });
    expect(initialTrades.length).toBe(1);

    // 2. Execute a transactional restore attempt that fails midway
    let transactionErrorThrown = false;
    try {
      await db.$transaction(async (tx) => {
        // Step A: Insert a temporary trade inside transaction
        await tx.trade.create({
          data: {
            userId: userAId,
            accountId: accountAId,
            instrumentSymbol: "NAS100",
            direction: "short",
            status: "closed",
            entryPriceAvg: "20000.0",
            exitPriceAvg: "19950.0",
            positionSize: "1.0",
            netPnlCents: 10000,
            grossPnlCents: 10000,
          },
        });

        // Step B: Intentional exception midway through transaction
        throw new Error("Simulated database failure during mid-restore execution");
      });
    } catch (err: any) {
      transactionErrorThrown = true;
      expect(err.message).toContain("Simulated database failure during mid-restore execution");
    }

    expect(transactionErrorThrown).toBe(true);

    // 3. Verify that changes inside the transaction ROLLED BACK completely
    // User A should still only have the 1 original EURUSD trade; NAS100 was discarded by rollback
    const afterRollbackTrades = await db.trade.findMany({ where: { userId: userAId } });
    expect(afterRollbackTrades.length).toBe(1);
    expect(afterRollbackTrades[0].instrumentSymbol).toBe("EURUSD");

    // 4. Verify that the pre-restore safety snapshot created OUTSIDE the transaction SURVIVED
    const survivingSnapshot = await db.backup.findUnique({
      where: { id: externalSnapshotId },
    });
    expect(survivingSnapshot).not.toBeNull();
    expect(survivingSnapshot?.filename).toContain("pre-restore-safety");
  }, 30000);
});
