/**
 * AlphaPips — Optimistic UI Update Helpers & Cache Reconcilers
 *
 * Provides standardized optimistic mutation handling across TanStack Query caches:
 * 1. Temporary ID generation (temp_<entity>_<timestamp>_<rand>)
 * 2. Immutable cache transformations supporting arrays, paginated envelopes ({ items, total }),
 *    and named arrays ({ tasks, accounts, challenges, strategies })
 * 3. Automatic rollback to previous snapshot on network or validation failure
 * 4. Safe reconciliation of temporary IDs with canonical server IDs
 * 5. Offline synchronization awareness
 */

import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Generate a distinct client-side temporary ID.
 */
export function generateTempId(prefix = "record"): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 9);
  return `temp_${prefix}_${timestamp}_${rand}`;
}

/**
 * Check whether an ID is a temporary client-side ID.
 */
export function isTempId(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return id.startsWith("temp_") || id.startsWith("local_");
}

/**
 * Update an entity list within any React Query cache structure (plain array or envelope).
 */
export function updateCacheList<T = any>(
  cacheData: any,
  updater: (items: any[]) => any[],
  deltaCount = 0
): any {
  if (!cacheData) return cacheData;

  if (Array.isArray(cacheData)) {
    return updater(cacheData);
  }

  if (typeof cacheData === "object") {
    // Standard envelope: { items: [...] }
    if (Array.isArray(cacheData.items)) {
      const nextItems = updater(cacheData.items);
      const nextTotal =
        typeof cacheData.total === "number"
          ? Math.max(0, cacheData.total + deltaCount)
          : undefined;
      return {
        ...cacheData,
        items: nextItems,
        ...(nextTotal !== undefined ? { total: nextTotal } : {}),
      };
    }

    // Specific entity envelopes
    if (Array.isArray(cacheData.tasks)) {
      return { ...cacheData, tasks: updater(cacheData.tasks) };
    }
    if (Array.isArray(cacheData.accounts)) {
      return { ...cacheData, accounts: updater(cacheData.accounts) };
    }
    if (Array.isArray(cacheData.challenges)) {
      return { ...cacheData, challenges: updater(cacheData.challenges) };
    }
    if (Array.isArray(cacheData.strategies)) {
      return { ...cacheData, strategies: updater(cacheData.strategies) };
    }
    if (Array.isArray(cacheData.trades)) {
      return { ...cacheData, trades: updater(cacheData.trades) };
    }
  }

  return cacheData;
}

/**
 * Optimistically insert a new record into a cache structure.
 */
export function optimisticInsert<T = any>(
  cacheData: any,
  newItem: T,
  position: "start" | "end" = "start"
): any {
  return updateCacheList(
    cacheData,
    (items) => {
      // Prevent duplicate insertion if already present
      if (items.some((it: any) => it.id === (newItem as any)?.id)) {
        return items;
      }
      return position === "start" ? [newItem, ...items] : [...items, newItem];
    },
    1
  );
}

/**
 * Optimistically update an existing record by ID in a cache structure.
 */
export function optimisticUpdate<T = any>(
  cacheData: any,
  id: string,
  patch: Partial<T> | Record<string, any> | ((item: any) => any)
): any {
  return updateCacheList(cacheData, (items) =>
    items.map((it: any) => {
      if (it.id !== id) return it;
      if (typeof patch === "function") {
        return patch(it);
      }
      return { ...it, ...patch };
    })
  );
}

/**
 * Optimistically delete a record by ID from a cache structure.
 */
export function optimisticDelete(
  cacheData: any,
  id: string
): any {
  return updateCacheList(
    cacheData,
    (items) => items.filter((it: any) => it.id !== id),
    -1
  );
}

/**
 * Reconcile a temporary ID with the confirmed canonical record from the server.
 * Supports both:
 *   reconcileTempId(cache, tempId, canonicalItem)
 *   reconcileTempId(cache, tempId, canonicalId, canonicalItem)
 */
export function reconcileTempId<T = any>(
  cacheData: any,
  tempId: string,
  arg3: string | T,
  arg4?: T
): any {
  const canonicalItem: any = arg4 !== undefined ? arg4 : arg3;
  const canonicalId =
    typeof arg3 === "string" && arg4 !== undefined ? arg3 : (canonicalItem as any)?.id;

  return updateCacheList(cacheData, (items) =>
    items.map((it: any) => {
      if (it.id === tempId) {
        if (typeof canonicalItem === "object" && canonicalItem !== null) {
          return {
            ...canonicalItem,
            id: canonicalId || (canonicalItem as any).id,
          };
        }
        return canonicalItem;
      }
      return it;
    })
  );
}

/**
 * Safely roll back an optimistic insertion by removing only the temporary record,
 * preserving any concurrent or subsequent mutations on the cache.
 */
export function rollbackOptimisticInsert(
  queryClient: QueryClient,
  queryKey: any[],
  tempId: string
) {
  queryClient.setQueriesData({ queryKey }, (current: any) =>
    optimisticDelete(current, tempId)
  );
}

/**
 * Safely roll back an optimistic update by restoring only that specific record's
 * previous fields, preserving other concurrent records.
 */
export function rollbackOptimisticUpdate(
  queryClient: QueryClient,
  queryKey: any[],
  id: string,
  previousSnapshot: any
) {
  queryClient.setQueriesData({ queryKey }, (current: any) =>
    optimisticUpdate(current, id, previousSnapshot)
  );
}

/**
 * Notify the user of a failed optimistic mutation and explain that data was restored.
 */
export function notifyOptimisticFailure(
  error: any,
  fallbackMessage = "Failed to save changes. Your previous data has been restored."
) {
  const message =
    error?.message ||
    (typeof error === "string" ? error : null) ||
    fallbackMessage;
  toast.error(message, {
    description: "Previous state has been automatically restored.",
    duration: 4500,
  });
}
