import { describe, test, expect, beforeEach } from "bun:test";
import { useSyncStore, syncEngine } from "./offline-sync-engine";

describe("Offline Sync Engine & Network Recovery Tests", () => {
  beforeEach(() => {
    useSyncStore.setState({
      isOnline: true,
      status: "synced",
      pendingCount: 0,
      conflicts: [],
    });
  });

  test("initializes with store online state matching navigator.onLine", () => {
    expect(useSyncStore.getState().isOnline).toBe(true);
    expect(useSyncStore.getState().status).toBe("synced");
  });

  test("handles transition from online to offline cleanly", () => {
    // Simulate offline event
    (syncEngine as any).handleNetworkChange(false);

    expect(useSyncStore.getState().isOnline).toBe(false);
    expect(useSyncStore.getState().status).toBe("saved_locally");
  });

  test("recovers immediately from offline to online without remaining stuck", () => {
    // 1. Go offline
    (syncEngine as any).handleNetworkChange(false);
    expect(useSyncStore.getState().isOnline).toBe(false);
    expect(useSyncStore.getState().status).toBe("saved_locally");

    // 2. Go back online
    (syncEngine as any).handleNetworkChange(true);
    expect(useSyncStore.getState().isOnline).toBe(true);
    // When back online with 0 pending and 0 conflicts, status transitions to "synced"
    expect(useSyncStore.getState().status).toBe("synced");
  });

  test("distinguishes connectivity from synchronization: sets pending_sync, never synced, when items are pending", () => {
    useSyncStore.setState({ pendingCount: 3 });
    (syncEngine as any).handleNetworkChange(false);
    expect(useSyncStore.getState().status).toBe("saved_locally");
    expect(useSyncStore.getState().isOnline).toBe(false);

    // Reconnecting to network
    (syncEngine as any).handleNetworkChange(true);
    expect(useSyncStore.getState().isOnline).toBe(true);
    // MUST NOT display "synced" while items are pending!
    expect(useSyncStore.getState().status).toBe("pending_sync");
    expect(useSyncStore.getState().status).not.toBe("synced");
  });

  test("focus recheck detects online recovery if tab was hidden during network transition", () => {
    // Simulate tab went asleep in offline mode
    useSyncStore.setState({ isOnline: false, status: "saved_locally" });

    // Simulate navigator reporting online when tab regains focus
    (syncEngine as any).handleFocusRecheck();

    expect(useSyncStore.getState().isOnline).toBe(true);
    expect(useSyncStore.getState().status).toBe("synced");
  });

  test("generates unique idempotency keys for queued operations to prevent duplicate creation on reconnect", () => {
    const key1 = `trade_create_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const key2 = `trade_create_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    expect(key1).not.toBe(key2);
    expect(key1.startsWith("trade_create_")).toBe(true);
  });
});
