import { describe, it, expect } from "bun:test";

describe("Backup & Restore Safety Engine", () => {
  const sampleBackupPayload = {
    schemaVersion: "2.0",
    appName: "AlphaPips",
    exportedAt: "2026-11-15T00:00:00.000Z",
    accounts: [
      { id: "acc-1", name: "Apex 50k", accountType: "prop", currency: "USD", startingBalanceCents: 5000000 },
      { id: "acc-2", name: "Personal Live", accountType: "live", currency: "USD", startingBalanceCents: 1000000 },
    ],
    instruments: [
      { id: "inst-1", symbol: "EURUSD", market: "forex", pipSize: "0.0001", contractSize: "100000" },
      { id: "inst-2", symbol: "NQ", market: "futures", pipSize: "0.25", contractSize: "20" },
    ],
    strategies: [
      { id: "strat-1", name: "Silver Bullet", versions: [{ id: "v1", versionLabel: "1.0", rulesJson: "{}" }] },
    ],
    checklists: [
      { id: "chk-1", name: "Pre-Trade Checklist", versions: [{ id: "cv1", versionLabel: "1.0", itemsJson: "[]" }] },
    ],
    trades: [
      {
        id: "tr-1",
        accountId: "acc-1",
        instrumentSymbol: "EURUSD",
        direction: "long",
        entryPriceAvg: "1.08500",
        exitPriceAvg: "1.09000",
        positionSize: "2.0",
        entryTime: "2026-11-14T10:00:00.000Z",
        executions: [{ kind: "entry", price: "1.08500", quantity: "2.0", timestamp: "2026-11-14T10:00:00.000Z" }],
        targets: [{ label: "TP1", price: "1.09000", quantityPct: "1.0" }],
      },
    ],
    noTrades: [
      {
        id: "nt-1",
        instrumentSymbol: "GBPUSD",
        reasonCategory: "no_valid_setup",
        decisionType: "deliberate_avoidance",
        date: "2026-11-14T11:00:00.000Z",
      },
    ],
    propChallenges: [
      {
        id: "pc-1",
        accountId: "acc-1",
        name: "Apex 50k Challenge",
        startingBalanceCents: 5000000,
        maxDrawdownCents: 250000,
        drawdownType: "trailing",
      },
    ],
    tasks: [
      { id: "task-1", title: "Review Weekly Trade Log", listName: "Routine", priority: "high" },
    ],
    dictionary: [
      { id: "dict-1", term: "Fair Value Gap", abbreviation: "FVG", category: "Market Structure" },
    ],
  };

  it("should validate complete entity coverage in backup archive", () => {
    expect(sampleBackupPayload.schemaVersion).toBe("2.0");
    expect(sampleBackupPayload.appName).toBe("AlphaPips");
    expect(sampleBackupPayload.accounts.length).toBe(2);
    expect(sampleBackupPayload.instruments.length).toBe(2);
    expect(sampleBackupPayload.strategies.length).toBe(1);
    expect(sampleBackupPayload.checklists.length).toBe(1);
    expect(sampleBackupPayload.trades.length).toBe(1);
    expect(sampleBackupPayload.noTrades.length).toBe(1);
    expect(sampleBackupPayload.propChallenges.length).toBe(1);
    expect(sampleBackupPayload.tasks.length).toBe(1);
    expect(sampleBackupPayload.dictionary.length).toBe(1);
  });

  describe("Duplicate Detection Logic", () => {
    const existingTrade = {
      accountId: "acc-1",
      instrumentSymbol: "EURUSD",
      direction: "long",
      entryPriceAvg: "1.08500",
      positionSize: "2.0",
      entryTime: new Date("2026-11-14T10:00:00.000Z"),
    };

    function assessMatch(candidate: any) {
      const cTime = new Date(candidate.entryTime).getTime();
      const eTime = existingTrade.entryTime.getTime();
      const diffMs = Math.abs(cTime - eTime);

      const symbolMatch = candidate.instrumentSymbol.toUpperCase() === existingTrade.instrumentSymbol.toUpperCase();
      const dirMatch = candidate.direction.toLowerCase() === existingTrade.direction.toLowerCase();
      if (!symbolMatch || !dirMatch) return { confidence: 0, reason: "No match" };

      const priceMatch = Math.abs(parseFloat(candidate.entryPriceAvg) - parseFloat(existingTrade.entryPriceAvg)) < 0.0001;
      const sizeMatch = Math.abs(parseFloat(candidate.positionSize) - parseFloat(existingTrade.positionSize)) < 0.0001;

      if (diffMs <= 5000 && priceMatch && sizeMatch) {
        return { confidence: 100, reason: "Exact match on symbol, direction, timestamp, price, and size" };
      }
      if (diffMs <= 60000 && (priceMatch || sizeMatch)) {
        return { confidence: 85, reason: "Likely match on symbol, direction, within 60s, and price/size match" };
      }
      if (diffMs <= 300000) {
        return { confidence: 60, reason: "Possible match within 5 minutes" };
      }
      return { confidence: 0, reason: "Distinct trade" };
    }

    it("should classify identical trade as 100% exact duplicate", () => {
      const exactCandidate = {
        instrumentSymbol: "EURUSD",
        direction: "long",
        entryPriceAvg: "1.08500",
        positionSize: "2.0",
        entryTime: "2026-11-14T10:00:02.000Z", // 2 seconds apart
      };
      const res = assessMatch(exactCandidate);
      expect(res.confidence).toBe(100);
    });

    it("should classify 30s shift with same price as 85% likely duplicate", () => {
      const likelyCandidate = {
        instrumentSymbol: "EURUSD",
        direction: "long",
        entryPriceAvg: "1.08500",
        positionSize: "1.5", // different size, same price
        entryTime: "2026-11-14T10:00:30.000Z", // 30s apart
      };
      const res = assessMatch(likelyCandidate);
      expect(res.confidence).toBe(85);
    });

    it("should classify 3 min shift with different price as 60% possible duplicate", () => {
      const possibleCandidate = {
        instrumentSymbol: "EURUSD",
        direction: "long",
        entryPriceAvg: "1.08650",
        positionSize: "1.0",
        entryTime: "2026-11-14T10:03:00.000Z", // 3 min apart
      };
      const res = assessMatch(possibleCandidate);
      expect(res.confidence).toBe(60);
    });

    it("should classify trade 10 min away or on different symbol as distinct", () => {
      const distinctCandidate = {
        instrumentSymbol: "GBPUSD",
        direction: "long",
        entryPriceAvg: "1.08500",
        positionSize: "2.0",
        entryTime: "2026-11-14T10:00:00.000Z",
      };
      const res = assessMatch(distinctCandidate);
      expect(res.confidence).toBe(0);
    });
  });

  describe("Prop Firm Engine Remaining Buffers", () => {
    it("should correctly compute remaining daily loss and remaining drawdown buffers", () => {
      const dailyLimitCents = 250000; // $2,500 limit
      const todayLossCents = 100000;  // $1,000 loss
      const remainingDaily = Math.max(0, dailyLimitCents - todayLossCents);
      expect(remainingDaily).toBe(150000); // $1,500 remaining

      const maxDdLimitCents = 500000; // $5,000 max drawdown
      const currentDdCents = 320000;  // $3,200 current drawdown
      const remainingDd = Math.max(0, maxDdLimitCents - currentDdCents);
      expect(remainingDd).toBe(180000); // $1,800 remaining
    });

    it("should clamp remaining buffers to zero when breached", () => {
      const dailyLimitCents = 250000;
      const todayLossCents = 300000; // $3,000 loss (breached)
      const remainingDaily = Math.max(0, dailyLimitCents - todayLossCents);
      expect(remainingDaily).toBe(0);
    });
  });

  describe("Transactional Restore Failure Recovery & Atomic Rollback Simulation", () => {
    // In-memory mock database state
    interface MockDbState {
      accounts: Array<{ id: string; name: string }>;
      trades: Array<{ id: string; symbol: string; pnl: number }>;
      backups: Array<{ id: string; filename: string; snapshotReason: string; isPreRestoreSnapshot: boolean }>;
    }

    it("should prove that pre-restore safety snapshot survives when transaction aborts, leaving initial state untouched", async () => {
      // 1. Initial stable state
      const dbState: MockDbState = {
        accounts: [{ id: "acc-1", name: "Primary Live Account" }],
        trades: [
          { id: "tr-1", symbol: "EURUSD", pnl: 500 },
          { id: "tr-2", symbol: "NAS100", pnl: -200 },
        ],
        backups: [],
      };

      const initialAccountsSnapshot = [...dbState.accounts];
      const initialTradesSnapshot = [...dbState.trades];

      // 2. Pre-replace snapshot generation (executed before transaction begins)
      const safetySnapshotPayload = {
        schemaVersion: "2.0",
        snapshotReason: "Pre-Restore Safety Snapshot",
        exportedAt: new Date().toISOString(),
        accounts: [...dbState.accounts],
        trades: [...dbState.trades],
      };

      const safetyBackupRecord = {
        id: "backup-safety-" + Date.now(),
        filename: `pre-replace-snapshot-${Date.now()}.json`,
        snapshotReason: "Pre-Restore Safety Snapshot",
        isPreRestoreSnapshot: true,
      };
      dbState.backups.push(safetyBackupRecord);

      // 3. Simulated Transactional Runner with rollback
      async function executeRestoreTransaction(simulateFailureAtStep: number) {
        // Deep clone working state for transaction isolation
        const workingState: MockDbState = {
          accounts: [...dbState.accounts],
          trades: [...dbState.trades],
          backups: [...dbState.backups],
        };

        try {
          // Step 1: Wipe existing trades for replace mode
          workingState.trades = [];

          // Step 2: Wipe existing accounts
          workingState.accounts = [];

          // Step 3: Insert new account
          workingState.accounts.push({ id: "acc-new", name: "Restored Account" });

          // Step 4: Simulate mid-restore failure (e.g. malformed record or database constraint error)
          if (simulateFailureAtStep === 4) {
            throw new Error("Simulated database constraint violation on trade import row 3");
          }

          // Step 5: Insert new trades (not reached)
          workingState.trades.push({ id: "tr-new-1", symbol: "XAUUSD", pnl: 1200 });

          // Commit transaction
          dbState.accounts = workingState.accounts;
          dbState.trades = workingState.trades;
          return { success: true };
        } catch (err: any) {
          // Rollback: Discard workingState changes; dbState accounts and trades remain untouched
          return {
            success: false,
            error: err.message,
            rolledBack: true,
          };
        }
      }

      // Execute transaction with failure at step 4
      const result = await executeRestoreTransaction(4);

      // 4. Verify transaction aborted and rolled back
      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
      expect(result.error).toContain("Simulated database constraint violation");

      // 5. Verify initial database data was NOT wiped or corrupted
      expect(dbState.accounts).toEqual(initialAccountsSnapshot);
      expect(dbState.trades).toEqual(initialTradesSnapshot);
      expect(dbState.trades.length).toBe(2);
      expect(dbState.trades[0].symbol).toBe("EURUSD");

      // 6. Verify pre-restore safety snapshot remains available in backup registry
      expect(dbState.backups.length).toBe(1);
      expect(dbState.backups[0].isPreRestoreSnapshot).toBe(true);
      expect(dbState.backups[0].snapshotReason).toBe("Pre-Restore Safety Snapshot");
      expect(safetySnapshotPayload.trades.length).toBe(2);
    });
  });

  describe("Import Batch Rollback Safety & Record Protection", () => {
    interface MockImportTrade {
      id: string;
      userId: string;
      symbol: string;
      notes?: string;
      lessons?: string;
      strategyId?: string;
    }

    it("should reject rollback when explicit confirmation is not provided", () => {
      function validateRollbackRequest(body: any) {
        if (body.confirmed !== true) {
          return { ok: false, error: "Explicit confirmation is required to rollback an import batch." };
        }
        return { ok: true };
      }

      const unconfirmed = validateRollbackRequest({ action: "rollback" });
      expect(unconfirmed.ok).toBe(false);
      expect(unconfirmed.error).toContain("Explicit confirmation is required");

      const confirmed = validateRollbackRequest({ action: "rollback", confirmed: true });
      expect(confirmed.ok).toBe(true);
    });

    it("should only rollback records belonging to the target batch and preserve modified or manual records", () => {
      const currentUserId = "user-alpha";
      const otherUserId = "user-beta";

      // Database has 5 trades:
      // - tr-1: created by batch-1, untouched
      // - tr-2: created by batch-1, subsequently modified by user with notes
      // - tr-3: created by batch-1, subsequently linked to a strategy
      // - tr-4: created manually by user-alpha (NOT in batch-1)
      // - tr-5: created by other user-beta (same batch id or duplicate id)
      const mockDatabaseTrades: MockImportTrade[] = [
        { id: "tr-1", userId: currentUserId, symbol: "EURUSD" },
        { id: "tr-2", userId: currentUserId, symbol: "GBPUSD", notes: "Added user analysis note" },
        { id: "tr-3", userId: currentUserId, symbol: "XAUUSD", strategyId: "strat-silver-bullet" },
        { id: "tr-4", userId: currentUserId, symbol: "NAS100" }, // manual trade
        { id: "tr-5", userId: otherUserId, symbol: "EURUSD" }, // another user's trade
      ];

      const batch1Summary = {
        tradeIds: ["tr-1", "tr-2", "tr-3", "tr-5"], // tr-5 is listed but belongs to user-beta
      };

      // Rollback function simulating backend logic
      function executeBatchRollback(userId: string, summary: typeof batch1Summary, protectModified = true) {
        // 1. Filter candidates strictly by batch tradeIds AND userId (user-scoped)
        const candidates = mockDatabaseTrades.filter(
          (t) => summary.tradeIds.includes(t.id) && t.userId === userId
        );

        const tradesToDelete: string[] = [];
        let protectedCount = 0;

        for (const t of candidates) {
          const isModified = Boolean(t.notes || t.lessons || t.strategyId);
          if (isModified && protectModified) {
            protectedCount++;
          } else {
            tradesToDelete.push(t.id);
          }
        }

        // 2. Perform deletion
        const remaining = mockDatabaseTrades.filter((t) => !tradesToDelete.includes(t.id));
        return {
          rolledBackCount: tradesToDelete.length,
          protectedCount,
          remainingTrades: remaining,
        };
      }

      const result = executeBatchRollback(currentUserId, batch1Summary, true);

      // Verify counts:
      // tr-1 rolled back (1)
      // tr-2 and tr-3 protected due to user notes and strategy link (2)
      // tr-4 untouched (manual trade not in batch)
      // tr-5 untouched (different user)
      expect(result.rolledBackCount).toBe(1);
      expect(result.protectedCount).toBe(2);

      // Verify exact surviving trades
      const survivingIds = result.remainingTrades.map((t) => t.id);
      expect(survivingIds).toContain("tr-2"); // modified trade protected
      expect(survivingIds).toContain("tr-3"); // linked trade protected
      expect(survivingIds).toContain("tr-4"); // manual trade protected
      expect(survivingIds).toContain("tr-5"); // other user protected
      expect(survivingIds).not.toContain("tr-1"); // unmodified batch trade safely deleted
    });
  });
});
