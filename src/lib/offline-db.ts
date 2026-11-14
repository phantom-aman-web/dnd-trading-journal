"use client";

/**
 * AlphaPips — Robust IndexedDB Offline Database
 *
 * Implements structured local storage for offline operation:
 * - trades
 * - no_trades
 * - accounts
 * - strategies
 * - dictionary
 * - sync_queue (pending mutations)
 * - sync_conflicts (detected conflicts requiring user resolution)
 * - sync_meta (last synchronized timestamps, active userId)
 */

const DB_NAME = "alphapips_offline_db";
const DB_VERSION = 1;

export interface SyncQueueItem {
  id: string; // unique operation id
  idempotencyKey: string;
  userId: string;
  entity: "trade" | "noTrade" | "dictionary" | "account" | "task";
  action: "create" | "update" | "delete";
  recordId: string;
  payload: any;
  clientCreatedAt: string;
  attempts: number;
  lastError?: string;
}

export interface SyncConflictItem {
  id: string;
  entity: string;
  recordId: string;
  localData: any;
  serverData: any;
  detectedAt: string;
  resolved: boolean;
}

export interface SyncMeta {
  userId: string;
  lastSyncAt: string | null;
  status: "synced" | "saved_locally" | "pending_sync" | "synchronizing" | "sync_failed" | "conflict";
}

class OfflineDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof window === "undefined" || !window.indexedDB) {
      return Promise.reject(new Error("IndexedDB is not supported in this environment"));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Stores for entities
        if (!db.objectStoreNames.contains("trades")) {
          const store = db.createObjectStore("trades", { keyPath: "id" });
          store.createIndex("userId", "userId", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        if (!db.objectStoreNames.contains("no_trades")) {
          const store = db.createObjectStore("no_trades", { keyPath: "id" });
          store.createIndex("userId", "userId", { unique: false });
          store.createIndex("date", "date", { unique: false });
        }

        if (!db.objectStoreNames.contains("accounts")) {
          const store = db.createObjectStore("accounts", { keyPath: "id" });
          store.createIndex("userId", "userId", { unique: false });
        }

        if (!db.objectStoreNames.contains("strategies")) {
          const store = db.createObjectStore("strategies", { keyPath: "id" });
          store.createIndex("userId", "userId", { unique: false });
        }

        if (!db.objectStoreNames.contains("dictionary")) {
          const store = db.createObjectStore("dictionary", { keyPath: "id" });
          store.createIndex("userId", "userId", { unique: false });
          store.createIndex("strategyId", "strategyId", { unique: false });
        }

        // Synchronization queue & conflicts
        if (!db.objectStoreNames.contains("sync_queue")) {
          const store = db.createObjectStore("sync_queue", { keyPath: "id" });
          store.createIndex("userId", "userId", { unique: false });
          store.createIndex("idempotencyKey", "idempotencyKey", { unique: true });
          store.createIndex("clientCreatedAt", "clientCreatedAt", { unique: false });
        }

        if (!db.objectStoreNames.contains("sync_conflicts")) {
          const store = db.createObjectStore("sync_conflicts", { keyPath: "id" });
          store.createIndex("recordId", "recordId", { unique: false });
        }

        if (!db.objectStoreNames.contains("sync_meta")) {
          db.createObjectStore("sync_meta", { keyPath: "userId" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // -------------------------------------------------------------------------
  // Generic CRUD Helpers
  // -------------------------------------------------------------------------

  async put<T>(storeName: string, item: T): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async putMany<T>(storeName: string, items: T[]): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      items.forEach((item) => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllByUser<T>(storeName: string, userId: string): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const index = store.index("userId");
      const req = index.getAll(userId);
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearStore(storeName: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // -------------------------------------------------------------------------
  // Queue Management
  // -------------------------------------------------------------------------

  async enqueueOperation(op: Omit<SyncQueueItem, "id" | "attempts" | "clientCreatedAt">): Promise<SyncQueueItem> {
    const item: SyncQueueItem = {
      ...op,
      id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      attempts: 0,
      clientCreatedAt: new Date().toISOString(),
    };
    await this.put("sync_queue", item);
    return item;
  }

  async getPendingQueue(userId: string): Promise<SyncQueueItem[]> {
    const items = await this.getAllByUser<SyncQueueItem>("sync_queue", userId);
    return items.sort((a, b) => new Date(a.clientCreatedAt).getTime() - new Date(b.clientCreatedAt).getTime());
  }

  async removeQueueItem(id: string): Promise<void> {
    await this.delete("sync_queue", id);
  }

  async recordConflict(conflict: Omit<SyncConflictItem, "id" | "detectedAt" | "resolved">): Promise<SyncConflictItem> {
    const item: SyncConflictItem = {
      ...conflict,
      id: `conflict_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      detectedAt: new Date().toISOString(),
      resolved: false,
    };
    await this.put("sync_conflicts", item);
    return item;
  }

  async getConflicts(): Promise<SyncConflictItem[]> {
    const items = await this.getAll<SyncConflictItem>("sync_conflicts");
    return items.filter((c) => !c.resolved);
  }

  async resolveConflict(id: string): Promise<void> {
    const item = await this.get<SyncConflictItem>("sync_conflicts", id);
    if (item) {
      item.resolved = true;
      await this.put("sync_conflicts", item);
    }
  }

  // -------------------------------------------------------------------------
  // User Isolation & Cleanup
  // -------------------------------------------------------------------------

  async wipeUserData(userId: string): Promise<void> {
    // Clean all user-specific data upon logout
    const stores = ["trades", "no_trades", "accounts", "strategies", "dictionary", "sync_queue", "sync_conflicts"];
    for (const s of stores) {
      await this.clearStore(s);
    }
    await this.delete("sync_meta", userId);
  }
}

export const offlineDb = new OfflineDatabase();
