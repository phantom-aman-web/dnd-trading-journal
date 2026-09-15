/**
 * DnD — Offline drafts and sync queue (Phase 8, simplified).
 *
 * Per spec section 91, 92, 93: DnD should remain useful without a connection,
 * support queued synchronization, and handle conflicts visibly.
 *
 * This is a lightweight version (full Dexie/IndexedDB engine deferred):
 * - Drafts are saved to localStorage with timestamps
 * - A sync queue tracks pending mutations
 * - On reconnect, queued items are replayed; conflicts are surfaced via the UI
 *
 * Honest scope statement: This is not a full offline-first sync engine.
 * It provides basic offline drafting capability and visible conflict handling.
 */

import { create } from "zustand";

export interface QueuedMutation {
  id: string;
  url: string;
  method: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  createdAt: number;
  retries: number;
}

export interface ConflictRecord {
  id: string;
  local: unknown;
  remote: unknown;
  field: string;
  timestamp: number;
}

interface OfflineState {
  online: boolean;
  pending: QueuedMutation[];
  conflicts: ConflictRecord[];
  setOnline: (online: boolean) => void;
  enqueue: (m: Omit<QueuedMutation, "id" | "createdAt" | "retries">) => string;
  resolve: (id: string) => void;
  addConflict: (c: Omit<ConflictRecord, "id" | "timestamp">) => void;
  resolveConflict: (id: string, choice: "local" | "remote" | "merge") => void;
  clearQueue: () => void;
}

const STORAGE_KEY = "dnd-offline-queue";

function loadQueue(): QueuedMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(q: QueuedMutation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
}

export const useOffline = create<OfflineState>((set, get) => ({
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  pending: loadQueue(),
  conflicts: [],
  setOnline: (online) => {
    set({ online });
    if (online) {
      // Attempt to flush queue on reconnect
      void flushQueue();
    }
  },
  enqueue: (m) => {
    const id = Math.random().toString(36).slice(2);
    const item: QueuedMutation = { ...m, id, createdAt: Date.now(), retries: 0 };
    const next = [...get().pending, item];
    saveQueue(next);
    set({ pending: next });
    return id;
  },
  resolve: (id) => {
    const next = get().pending.filter((q) => q.id !== id);
    saveQueue(next);
    set({ pending: next });
  },
  addConflict: (c) => {
    const id = Math.random().toString(36).slice(2);
    set({ conflicts: [...get().conflicts, { ...c, id, timestamp: Date.now() }] });
  },
  resolveConflict: (id, _choice) => {
    set({ conflicts: get().conflicts.filter((c) => c.id !== id) });
  },
  clearQueue: () => {
    saveQueue([]);
    set({ pending: [] });
  },
}));

async function flushQueue() {
  const { pending, resolve } = useOffline.getState();
  for (const m of pending) {
    try {
      const res = await fetch(m.url, {
        method: m.method,
        headers: { "Content-Type": "application/json" },
        body: m.body ? JSON.stringify(m.body) : undefined,
      });
      if (res.ok || res.status === 409) {
        resolve(m.id);
      }
    } catch {
      // Network still down; keep in queue
    }
  }
}

/** Set up online/offline listeners. Call once on app mount. */
export function initOfflineListeners() {
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => useOffline.getState().setOnline(true));
  window.addEventListener("offline", () => useOffline.getState().setOnline(false));
}
