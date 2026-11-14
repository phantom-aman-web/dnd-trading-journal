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

  init(userId: string) {
    this.currentUserId = userId;
    if (typeof window === "undefined") return;

    window.addEventListener("online", () => this.handleNetworkChange(true));
    window.addEventListener("offline", () => this.handleNetworkChange(false));

    this.refreshPendingCount();

    // If online on start, process any pending queue
    if (navigator.onLine) {
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
    if (!this.currentUserId) return;
    try {
      const queue = await offlineDb.getPendingQueue(this.currentUserId);
      const conflicts = await offlineDb.getConflicts();
      useSyncStore.getState().setPendingCount(queue.length);
      useSyncStore.getState().setConflicts(conflicts);

      if (conflicts.length > 0) {
        useSyncStore.getState().setStatus("conflict");
      } else if (queue.length > 0) {
        useSyncStore.getState().setStatus(navigator.onLine ? "pending_sync" : "saved_locally");
      } else {
        useSyncStore.getState().setStatus("synced");
      }
    } catch {
      // Storage unavailable
    }
  }

  private handleNetworkChange(online: boolean) {
    useSyncStore.setState({ isOnline: online });
    if (online) {
      toast.info("Connection restored. Synchronizing pending operations...", { duration: 3000 });
      this.processQueue();
    } else {
      toast.warning("Working in Offline Mode. Actions will be saved locally.", { duration: 4000 });
      useSyncStore.getState().setStatus("saved_locally");
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
    if (this.isSyncing || !navigator.onLine || !this.currentUserId) return;

    this.isSyncing = true;
    useSyncStore.getState().setStatus("synchronizing");

    try {
      // 1. Check live reachability with ping
      const pingRes = await fetch("/api/me", { cache: "no-store" }).catch(() => null);
      if (!pingRes || !pingRes.ok) {
        useSyncStore.getState().setStatus("saved_locally");
        this.isSyncing = false;
        return;
      }

      const queue = await offlineDb.getPendingQueue(this.currentUserId);
      if (queue.length === 0) {
        useSyncStore.getState().setStatus("synced");
        useSyncStore.getState().setLastSyncedAt(new Date());
        this.isSyncing = false;
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
