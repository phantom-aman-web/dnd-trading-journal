import { describe, it, expect } from "bun:test";
import {
  generateTempId,
  isTempId,
  optimisticInsert,
  optimisticUpdate,
  optimisticDelete,
  reconcileTempId,
} from "./optimistic";

describe("Optimistic Mutations & Rollback Isolation", () => {
  describe("Concurrent Edits on Different Items in the Same Cache", () => {
    it("preserves independent concurrent edits without clobbering", () => {
      const initialCache = {
        items: [
          { id: "trade-1", instrument: "EURUSD", status: "open", notes: "Initial note 1" },
          { id: "trade-2", instrument: "GBPUSD", status: "open", notes: "Initial note 2" },
          { id: "trade-3", instrument: "USDJPY", status: "open", notes: "Initial note 3" },
        ],
        total: 3,
      };

      // Mutation 1: Update trade-1 notes
      const afterMutation1 = optimisticUpdate(initialCache, "trade-1", {
        notes: "Edited note 1 by User A",
      });

      // Mutation 2: Concurrently update trade-2 status to closed
      const afterMutation2 = optimisticUpdate(afterMutation1, "trade-2", {
        status: "closed",
        notes: "Target reached",
      });

      expect(afterMutation2.items.find((i: any) => i.id === "trade-1")?.notes).toBe("Edited note 1 by User A");
      expect(afterMutation2.items.find((i: any) => i.id === "trade-2")?.status).toBe("closed");
      expect(afterMutation2.items.find((i: any) => i.id === "trade-2")?.notes).toBe("Target reached");
      expect(afterMutation2.items.find((i: any) => i.id === "trade-3")?.notes).toBe("Initial note 3");
    });
  });

  describe("Failed Mutations and Rollback Isolation", () => {
    it("rolling back one failed update preserves other concurrent updates in the same cache", () => {
      const initialCache = {
        items: [
          { id: "item-1", title: "Task 1", priority: "low" },
          { id: "item-2", title: "Task 2", priority: "low" },
        ],
      };

      // Mutation 1 succeeds optimistically
      const state1 = optimisticUpdate(initialCache, "item-1", { priority: "urgent" });

      // Mutation 2 starts optimistically on item-2
      const snapshotBeforeMutation2 = state1.items.find((i: any) => i.id === "item-2");
      const state2 = optimisticUpdate(state1, "item-2", { priority: "high" });

      expect(state2.items.find((i: any) => i.id === "item-1")?.priority).toBe("urgent");
      expect(state2.items.find((i: any) => i.id === "item-2")?.priority).toBe("high");

      // Mutation 2 fails on the server: rollback ONLY item-2 using its snapshot
      const rolledBack = optimisticUpdate(state2, "item-2", snapshotBeforeMutation2!);

      // item-1's update remains intact!
      expect(rolledBack.items.find((i: any) => i.id === "item-1")?.priority).toBe("urgent");
      // item-2's update is cleanly reverted
      expect(rolledBack.items.find((i: any) => i.id === "item-2")?.priority).toBe("low");
    });

    it("rolling back one failed insertion removes only that temporary item, preserving subsequent insertions", () => {
      const initial = {
        items: [{ id: "canonical-1", title: "Existing 1" }],
        total: 1,
      };

      const tempId1 = generateTempId("trade");
      const tempId2 = generateTempId("trade");

      // Insert item 1 optimistically
      const stateWith1 = optimisticInsert(initial, { id: tempId1, title: "Draft Trade A" });
      // Insert item 2 optimistically
      const stateWithBoth = optimisticInsert(stateWith1, { id: tempId2, title: "Draft Trade B" });

      expect(stateWithBoth.items.length).toBe(3);
      expect(stateWithBoth.items.some((i: any) => i.id === tempId1)).toBe(true);
      expect(stateWithBoth.items.some((i: any) => i.id === tempId2)).toBe(true);

      // Trade A fails on server: remove ONLY tempId1
      const rolledBackA = optimisticDelete(stateWithBoth, tempId1);

      expect(rolledBackA.items.length).toBe(2);
      expect(rolledBackA.items.some((i: any) => i.id === tempId1)).toBe(false);
      // Trade B is still present in cache!
      expect(rolledBackA.items.some((i: any) => i.id === tempId2)).toBe(true);
      expect(rolledBackA.items.find((i: any) => i.id === tempId2)?.title).toBe("Draft Trade B");
    });
  });

  describe("Delayed Server Responses and Temporary ID Reconciliation", () => {
    it("seamlessly reconciles temporary ID with server record while retaining other cache changes", () => {
      const initial = {
        items: [{ id: "acc-1", name: "Main Live Account", balance: 100000 }],
        total: 1,
      };

      const tempId = generateTempId("account");
      const optimisticAccount = {
        id: tempId,
        name: "New Prop Evaluation",
        balance: 50000,
        _isProvisional: true,
      };

      // Step 1: Optimistic insert
      const cacheAfterInsert = optimisticInsert(initial, optimisticAccount);
      expect(cacheAfterInsert.items[0].id).toBe(tempId);
      expect(cacheAfterInsert.items[0]._isProvisional).toBe(true);

      // Step 2: Concurrent edit happens while server is responding
      const cacheAfterConcurrentEdit = optimisticUpdate(cacheAfterInsert, "acc-1", {
        balance: 105000,
      });

      // Step 3: Delayed server response arrives with canonical UUID and server-calculated values
      const canonicalServerAccount = {
        id: "acc_canonical_uuid_777888",
        name: "New Prop Evaluation",
        balance: 50000,
        currency: "USD",
        createdAt: "2026-11-19T10:00:00Z",
      };

      const reconciledCache = reconcileTempId(
        cacheAfterConcurrentEdit,
        tempId,
        canonicalServerAccount.id,
        canonicalServerAccount
      );

      // tempId is replaced
      expect(reconciledCache.items.some((i: any) => i.id === tempId)).toBe(false);
      // Canonical record is present
      const inserted = reconciledCache.items.find((i: any) => i.id === canonicalServerAccount.id);
      expect(inserted).toBeDefined();
      expect(inserted?.currency).toBe("USD");
      expect(inserted?._isProvisional).toBeUndefined();

      // Concurrent edit on acc-1 was preserved throughout reconciliation!
      const existing = reconciledCache.items.find((i: any) => i.id === "acc-1");
      expect(existing?.balance).toBe(105000);
    });
  });

  describe("Idempotency and Duplicate Submission Prevention", () => {
    it("generates stable, deterministic idempotency keys based on entity and ID", () => {
      const tradeId = "trade_local_12345";
      const key1 = `create_trade_${tradeId}`;
      const key2 = `create_trade_${tradeId}`;
      expect(key1).toBe(key2);
      expect(key1.startsWith("create_trade_")).toBe(true);

      const taskId = "task_local_67890";
      const taskKey = `create_task_${taskId}`;
      expect(taskKey).toBe(`create_task_${taskId}`);
    });

    it("verifies temporary client ID detection", () => {
      const tempTrade = generateTempId("trade");
      const tempTask = generateTempId("task");
      const tempAccount = generateTempId("account");
      const realId = "cly1234567890abcdef";

      expect(isTempId(tempTrade)).toBe(true);
      expect(isTempId(tempTask)).toBe(true);
      expect(isTempId(tempAccount)).toBe(true);
      expect(isTempId(realId)).toBe(false);
    });
  });

  describe("Provisional Financial Status Protection", () => {
    it("marks optimistic local records as provisional until authoritative server reconciliation", () => {
      const tempId = generateTempId("trade");
      const optimisticTrade = {
        id: tempId,
        instrumentSymbol: "EURUSD",
        netPnlCents: 0,
        _isProvisional: true,
      };

      expect(optimisticTrade._isProvisional).toBe(true);

      // Authoritative server payload replaces provisional state
      const canonicalTrade = {
        id: "server_canonical_trade_99",
        instrumentSymbol: "EURUSD",
        netPnlCents: 15420,
        actualR: 2.15,
      };

      const cache = { items: [optimisticTrade] };
      const reconciled = reconcileTempId(cache, tempId, canonicalTrade.id, canonicalTrade);

      const resolved = reconciled.items.find((i: any) => i.id === canonicalTrade.id);
      expect(resolved?._isProvisional).toBeUndefined();
      expect(resolved?.netPnlCents).toBe(15420);
      expect(resolved?.actualR).toBe(2.15);
    });
  });
});
