"use client";

import { create } from "zustand";
import { offlineDb, type SyncQueueItem, type SyncConflictItem } from "./offline-db";
import { toast } from "sonner";

export type SyncStateStatus =
  | "synced"
  | "saved_locally"
  | "pending_sync"
  | "synchronizing"
  | "sync_failed"
  | "conflict";

interface SyncState {
  isOnline: boolean;
  status: SyncStateStatus;
  pendingCount: number;
  lastSyncedAt: Date | null;
  conflicts: SyncConflictItem[];
  setStatus: (status: SyncStateStatus) => void;
  setPendingCount: (count: number) => void;
  setLastSyncedAt: (date: Date | null) => void;
  setConflicts: (conflicts: SyncConflictItem[]) => void;
  triggerSync: () => Promise<void>;
  resolveConflict: (conflictId: string, choice: "local" | "server") => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: typeof window !== "undefined" ? navigator.onLine : true,
  status: "synced",
  pendingCount: 0,
  lastSyncedAt: null,
  conflicts: [],

  setStatus: (status) => set({ status }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setConflicts: (conflicts) => set({ conflicts }),

  triggerSync: async () => {
    await syncEngine.processQueue();
  },

  resolveConflict: async (conflictId, choice) => {
    await syncEngine.resolveConflict(conflictId, choice);
  },
}));

class OfflineSyncEngine {
  private isSyncing = false;
  private currentUserId: string | null = null;
  private hasSetupListeners = false;
  private lastFocusCheck = 0;

  setupGlobalListeners() {
    if (typeof window === "undefined" || this.hasSetupListeners) return;
    this.hasSetupListeners = true;

    // Detect actual initial status
    const initialOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    useSyncStore.setState({ isOnline: initialOnline });

    window.addEventListener("online", () => this.handleNetworkChange(true));
    window.addEventListener("offline", () => this.handleNetworkChange(false));

    // Handle tab regaining focus / visibility
    const handleVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        this.handleFocusRecheck();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", () => this.handleFocusRecheck());
  }

  private handleFocusRecheck() {
    if (typeof navigator === "undefined") return;
    const isCurrentlyOnline = typeof navigator.onLine === "boolean" ? navigator.onLine : true;
    const storeOnline = useSyncStore.getState().isOnline;

    // If connectivity state transitioned while tab was backgrounded or asleep:
    if (isCurrentlyOnline !== storeOnline) {
      this.handleNetworkChange(isCurrentlyOnline);
      return;
    }

    // If online, do a sensible throttled recheck (at most once every 30 seconds)
    const now = Date.now();
    if (isCurrentlyOnline && now - this.lastFocusCheck > 30000) {
      this.lastFocusCheck = now;
      this.refreshPendingCount();
    }
  }

  init(userId: string) {
    this.currentUserId = userId;
    this.setupGlobalListeners();
    this.refreshPendingCount();

    // If online on start, process any pending queue
    if (typeof navigator !== "undefined" && navigator.onLine) {
      this.processQueue();
    }
  }

  setCurrentUser(userId: string | null) {
    this.currentUserId = userId;
    if (userId) {
      this.refreshPendingCount();
    }
  }

  async refreshPendingCount() {
    try {
      const conflicts = await offlineDb.getConflicts();
      useSyncStore.getState().setConflicts(conflicts);

      const queue = this.currentUserId
        ? await offlineDb.getPendingQueue(this.currentUserId)
        : [];
      useSyncStore.getState().setPendingCount(queue.length);

      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      useSyncStore.setState({ isOnline });

      if (conflicts.length > 0) {
        useSyncStore.getState().setStatus("conflict");
      } else if (queue.length > 0) {
        useSyncStore.getState().setStatus(isOnline ? "pending_sync" : "saved_locally");
      } else {
        useSyncStore.getState().setStatus(isOnline ? "synced" : "saved_locally");
      }
    } catch {
      // Storage unavailable
    }
  }

  private handleNetworkChange(online: boolean) {
    const prevOnline = useSyncStore.getState().isOnline;
    useSyncStore.setState({ isOnline: online });

    if (online) {
      // Immediately clear offline mode indicator state
      const currentConflicts = useSyncStore.getState().conflicts;
      const currentPending = useSyncStore.getState().pendingCount;
      if (currentConflicts.length > 0) {
        useSyncStore.getState().setStatus("conflict");
      } else if (currentPending > 0) {
        useSyncStore.getState().setStatus("pending_sync");
      } else {
        useSyncStore.getState().setStatus("synced");
      }

      if (!prevOnline) {
        toast.info("Connection restored. Synchronizing pending operations...", { duration: 3000 });
      }

      // Small debounce allowing network adapter to stabilize
      setTimeout(() => {
        this.processQueue();
      }, 300);
    } else {
      useSyncStore.getState().setStatus("saved_locally");
      if (prevOnline) {
        toast.warning("Working in Offline Mode. Actions will be saved locally.", { duration: 4000 });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Offline Creation Wrappers
  // -------------------------------------------------------------------------

  async queueCreateTrade(tradePayload: any, userId?: string): Promise<any> {
    const effectiveUserId = userId || this.currentUserId || "current_user";
    const localId = tradePayload.id || `local_trade_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      ...tradePayload,
      id: localId,
      userId: effectiveUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _isOfflineLocal: true,
    };

    await offlineDb.put("trades", record);
    await offlineDb.enqueueOperation({
      userId: effectiveUserId,
      entity: "trade",
      action: "create",
      recordId: localId,
      payload: record,
      idempotencyKey: `create_trade_${localId}`,
    });

    await this.refreshPendingCount();
    if (navigator.onLine) {
      this.processQueue();
    }
    return record;
  }

  async queueCreateAccount(accountPayload: any, userId?: string): Promise<any> {
    const effectiveUserId = userId || this.currentUserId || "current_user";
    const localId = accountPayload.id || `local_account_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      ...accountPayload,
      id: localId,
      userId: effectiveUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _isOfflineLocal: true,
    };

    await offlineDb.put("accounts", record);
    await offlineDb.enqueueOperation({
      userId: effectiveUserId,
      entity: "account",
      action: "create",
      recordId: localId,
      payload: record,
      idempotencyKey: `create_account_${localId}`,
    });

    await this.refreshPendingCount();
    if (navigator.onLine) {
      this.processQueue();
    }
    return record;
  }

  async queueCreateTask(taskPayload: any, userId?: string): Promise<any> {
    const effectiveUserId = userId || this.currentUserId || "current_user";
    const localId = taskPayload.id || `local_task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      ...taskPayload,
      id: localId,
      userId: effectiveUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _isOfflineLocal: true,
    };

    await offlineDb.enqueueOperation({
      userId: effectiveUserId,
      entity: "task",
      action: "create",
      recordId: localId,
      payload: record,
      idempotencyKey: `create_task_${localId}`,
    });

    await this.refreshPendingCount();
    if (navigator.onLine) {
      this.processQueue();
    }
    return record;
  }



  async queueCreateNoTrade(noTradePayload: any, userId?: string): Promise<any> {
    const effectiveUserId = userId || this.currentUserId || "current_user";
    const localId = noTradePayload.id || `local_notrade_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      ...noTradePayload,
      id: localId,
      userId: effectiveUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _isOfflineLocal: true,
    };

    await offlineDb.put("no_trades", record);
    await offlineDb.enqueueOperation({
      userId: effectiveUserId,
      entity: "noTrade",
      action: "create",
      recordId: localId,
      payload: record,
      idempotencyKey: `create_notrade_${localId}`,
    });

    await this.refreshPendingCount();
    if (navigator.onLine) {
      this.processQueue();
    }
    return record;
  }

  async queueCreateDictionary(dictPayload: any, userId?: string): Promise<any> {
    const effectiveUserId = userId || this.currentUserId || "current_user";
    const localId = dictPayload.id || `local_dict_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      ...dictPayload,
      id: localId,
      userId: effectiveUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _isOfflineLocal: true,
    };

    await offlineDb.put("dictionary", record);
    await offlineDb.enqueueOperation({
      userId: effectiveUserId,
      entity: "dictionary",
      action: "create",
      recordId: localId,
      payload: record,
      idempotencyKey: `create_dict_${localId}`,
    });

    await this.refreshPendingCount();
    if (navigator.onLine) {
      this.processQueue();
    }
    return record;
  }



  // -------------------------------------------------------------------------
  // Cache incoming online data into IndexedDB
  // -------------------------------------------------------------------------

  async cacheTrades(trades: any[]) {
    if (!trades || trades.length === 0) return;
    try {
      await offlineDb.putMany("trades", trades);
    } catch {}
  }

  async cacheNoTrades(noTrades: any[]) {
    if (!noTrades || noTrades.length === 0) return;
    try {
      await offlineDb.putMany("no_trades", noTrades);
    } catch {}
  }

  async cacheDictionary(entries: any[]) {
    if (!entries || entries.length === 0) return;
    try {
      await offlineDb.putMany("dictionary", entries);
    } catch {}
  }

  // -------------------------------------------------------------------------
  // Process Queue
  // -------------------------------------------------------------------------

  async processQueue() {
    if (this.isSyncing) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      useSyncStore.getState().setStatus("saved_locally");
      useSyncStore.setState({ isOnline: false });
      return;
    }

    this.isSyncing = true;
    useSyncStore.getState().setStatus("synchronizing");

    try {
      // 1. Check live reachability with ping
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const pingRes = await fetch("/api/me", { cache: "no-store", signal: controller.signal }).catch(() => null);
      clearTimeout(timeout);

      // Check if browser went offline during fetch
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        useSyncStore.getState().setStatus("saved_locally");
        useSyncStore.setState({ isOnline: false });
        return;
      }

      // If ping failed but navigator.onLine is true, do not reset to saved_locally
      if (!pingRes || !pingRes.ok) {
        const queueCount = this.currentUserId
          ? (await offlineDb.getPendingQueue(this.currentUserId).catch(() => [])).length
          : 0;
        useSyncStore.getState().setStatus(queueCount > 0 ? "pending_sync" : "synced");
        return;
      }

      if (!this.currentUserId) {
        useSyncStore.getState().setStatus("synced");
        useSyncStore.getState().setLastSyncedAt(new Date());
        return;
      }

      const queue = await offlineDb.getPendingQueue(this.currentUserId);
      if (queue.length === 0) {
        useSyncStore.getState().setStatus("synced");
        useSyncStore.getState().setLastSyncedAt(new Date());
        return;
      }

      for (const item of queue) {
        try {
          await this.syncItem(item);
          await offlineDb.removeQueueItem(item.id);
        } catch (err: any) {
          console.error(`Failed to sync operation ${item.id}:`, err);
          item.attempts += 1;
          item.lastError = err?.message || String(err);
          await offlineDb.put("sync_queue", item);

          // If conflict detected, record conflict
          if (err?.status === 409 || err?.message?.includes("conflict")) {
            await offlineDb.recordConflict({
              entity: item.entity,
              recordId: item.recordId,
              localData: item.payload,
              serverData: err?.serverData || null,
            });
          }
        }
      }

      await this.refreshPendingCount();
      useSyncStore.getState().setLastSyncedAt(new Date());
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    const headers = {
      "Content-Type": "application/json",
      "X-Idempotency-Key": item.idempotencyKey,
    };

    if (item.entity === "trade" && item.action === "create") {
      const payload = { ...item.payload };
      delete payload._isOfflineLocal;
      const res = await fetch("/api/trades", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw Object.assign(new Error(errorData?.error || "Failed to sync trade"), { status: res.status, serverData: errorData });
      }
      const created = await res.json();
      // Replace temporary local ID with server ID in IndexedDB
      await offlineDb.delete("trades", item.recordId);
      await offlineDb.put("trades", created);
    } else if (item.entity === "noTrade" && item.action === "create") {
      const payload = { ...item.payload };
      delete payload._isOfflineLocal;
      const res = await fetch("/api/no-trades", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw Object.assign(new Error(errorData?.error || "Failed to sync observation"), { status: res.status });
      }
      const created = await res.json();
      await offlineDb.delete("no_trades", item.recordId);
      await offlineDb.put("no_trades", created);
    } else if (item.entity === "dictionary" && item.action === "create") {
      const payload = { ...item.payload };
      delete payload._isOfflineLocal;
      const res = await fetch("/api/dictionary", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw Object.assign(new Error(errorData?.error || "Failed to sync dictionary entry"), { status: res.status });
      }
      const created = await res.json();
      await offlineDb.delete("dictionary", item.recordId);
      await offlineDb.put("dictionary", created);
    } else if (item.entity === "account" && item.action === "create") {
      const payload = { ...item.payload };
      delete payload._isOfflineLocal;
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw Object.assign(new Error(errorData?.error || "Failed to sync account"), { status: res.status });
      }
      const created = await res.json();
      await offlineDb.delete("accounts", item.recordId);
      await offlineDb.put("accounts", created);
    } else if (item.entity === "account" && item.action === "update") {
      const payload = { ...item.payload };
      delete payload._isOfflineLocal;
      const res = await fetch(`/api/accounts/${item.recordId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw Object.assign(new Error(errorData?.error || "Failed to update account"), { status: res.status });
      }
      const updated = await res.json();
      await offlineDb.put("accounts", updated);
    } else if (item.entity === "account" && item.action === "delete") {
      const res = await fetch(`/api/accounts/${item.recordId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok && res.status !== 404) {
        const errorData = await res.json().catch(() => ({}));
        throw Object.assign(new Error(errorData?.error || "Failed to delete account"), { status: res.status });
      }
      await offlineDb.delete("accounts", item.recordId);
    } else if (item.entity === "task" && item.action === "create") {
      const payload = { ...item.payload };
      delete payload._isOfflineLocal;
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw Object.assign(new Error(errorData?.error || "Failed to sync task"), { status: res.status });
      }
    } else if (item.entity === "task" && item.action === "update") {
      const payload = { ...item.payload };
      delete payload._isOfflineLocal;
      const res = await fetch(`/api/tasks/${item.recordId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw Object.assign(new Error(errorData?.error || "Failed to update task"), { status: res.status });
      }
    } else if (item.entity === "task" && item.action === "delete") {
      const res = await fetch(`/api/tasks/${item.recordId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok && res.status !== 404) {
        const errorData = await res.json().catch(() => ({}));
        throw Object.assign(new Error(errorData?.error || "Failed to delete task"), { status: res.status });
      }
    }
  }

  async resolveConflict(conflictId: string, choice: "local" | "server") {
    const conflict = await offlineDb.get<SyncConflictItem>("sync_conflicts", conflictId);
    if (!conflict) return;

    if (choice === "local") {
      // Re-enqueue local data
      await offlineDb.enqueueOperation({
        userId: this.currentUserId!,
        entity: conflict.entity as any,
        action: "update",
        recordId: conflict.recordId,
        payload: conflict.localData,
        idempotencyKey: `resolve_${conflictId}_${Date.now()}`,
      });
    } else {
      // Overwrite local with server
      if (conflict.serverData) {
        const storeName = conflict.entity === "trade" ? "trades" : conflict.entity === "noTrade" ? "no_trades" : "dictionary";
        await offlineDb.put(storeName, conflict.serverData);
      }
    }

    await offlineDb.resolveConflict(conflictId);
    await this.refreshPendingCount();
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  async handleLogout(userId: string) {
    await offlineDb.wipeUserData(userId);
    useSyncStore.getState().setPendingCount(0);
    useSyncStore.getState().setConflicts([]);
    useSyncStore.getState().setStatus("synced");
  }
}

export const syncEngine = new OfflineSyncEngine();
export const offlineSyncEngine = syncEngine;

if (typeof window !== "undefined") {
  syncEngine.setupGlobalListeners();
}
