import { describe, it, expect } from "bun:test";
import {
  generateTempId,
  isTempId,
  updateCacheList,
  optimisticInsert,
  optimisticUpdate,
  optimisticDelete,
  reconcileTempId,
} from "./optimistic";

describe("Optimistic UI Helpers", () => {
  it("generates formatted temporary client IDs", () => {
    const id1 = generateTempId("trade");
    const id2 = generateTempId("task");

    expect(id1.startsWith("temp_trade_")).toBe(true);
    expect(id2.startsWith("temp_task_")).toBe(true);
    expect(id1).not.toBe(id2);
    expect(isTempId(id1)).toBe(true);
    expect(isTempId(id2)).toBe(true);
    expect(isTempId("canonical_uuid_12345")).toBe(false);
    expect(isTempId(null)).toBe(false);
    expect(isTempId(undefined)).toBe(false);
  });

  describe("updateCacheList across shapes", () => {
    it("handles plain arrays", () => {
      const initial = [{ id: "1", name: "Alpha" }, { id: "2", name: "Beta" }];
      const updated = updateCacheList<{ id: string; name: string }>(initial, (items) => [
        ...items,
        { id: "3", name: "Gamma" },
      ]);
      expect(updated.length).toBe(3);
      expect(updated[2].id).toBe("3");
    });

    it("handles { items, total } envelopes", () => {
      const initial = {
        items: [{ id: "1", name: "Task 1" }],
        total: 1,
      };
      const updated = optimisticInsert(initial, { id: "2", name: "Task 2" });
      expect(updated.items.length).toBe(2);
      expect(updated.items[0].id).toBe("2");
      expect(updated.total).toBe(2);

      const deleted = optimisticDelete(updated, "1");
      expect(deleted.items.length).toBe(1);
      expect(deleted.items[0].id).toBe("2");
      expect(deleted.total).toBe(1);
    });

    it("handles named entity envelopes ({ tasks, accounts, challenges, strategies })", () => {
      const initialTasks = { tasks: [{ id: "t1", title: "Task 1" }] };
      const updatedTasks = optimisticInsert(initialTasks, { id: "t2", title: "Task 2" });
      expect(updatedTasks.tasks.length).toBe(2);

      const initialAccounts = { accounts: [{ id: "a1", name: "Account 1" }] };
      const updatedAccounts = optimisticUpdate(initialAccounts, "a1", { name: "Updated Account" });
      expect(updatedAccounts.accounts[0].name).toBe("Updated Account");
    });
  });

  describe("optimistic mutations & reconciliation", () => {
    it("optimistically inserts at start by default and prevents duplicates", () => {
      const list = [{ id: "1", title: "Original" }];
      const withNew = optimisticInsert(list, { id: "temp_1", title: "New Item" });
      expect(withNew[0].id).toBe("temp_1");
      expect(withNew[1].id).toBe("1");

      // Duplicate prevention
      const dup = optimisticInsert(withNew, { id: "temp_1", title: "New Item" });
      expect(dup.length).toBe(2);
    });

    it("optimistically updates fields without mutating original object", () => {
      const original = [{ id: "1", status: "todo", title: "Fix bug" }];
      const updated = optimisticUpdate(original, "1", { status: "completed" });

      expect(updated[0].status).toBe("completed");
      expect(original[0].status).toBe("todo"); // original untouched
    });

    it("optimistically deletes a record", () => {
      const list = [{ id: "1", val: "A" }, { id: "2", val: "B" }];
      const deleted = optimisticDelete(list, "1");

      expect(deleted.length).toBe(1);
      expect(deleted[0].id).toBe("2");
    });

    it("reconciles temporary ID with canonical server record", () => {
      const tempItem = { id: "temp_task_123", title: "My Task", status: "todo" };
      const list = [tempItem, { id: "real_1", title: "Older Task", status: "completed" }];

      const canonicalItem = { id: "srv_task_789", title: "My Task", status: "todo" };
      const reconciled = reconcileTempId(list, "temp_task_123", canonicalItem);

      expect(reconciled.length).toBe(2);
      expect(reconciled[0].id).toBe("srv_task_789");
      expect(reconciled.some((x: any) => x.id === "temp_task_123")).toBe(false);
    });
  });
});
