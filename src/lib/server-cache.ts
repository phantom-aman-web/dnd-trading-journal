/**
 * DnD — High-Performance In-Memory Server Cache.
 *
 * Caches heavy database query results and financial aggregations across API routes.
 * Drastically cuts latency over remote database connections (e.g. Supabase across regions).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry<unknown>>();

// Cleanup stale entries periodically (every 2 minutes)
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (now > entry.expiresAt) {
        memoryStore.delete(key);
      }
    }
  }, 120_000);
  if (timer.unref) timer.unref();
}

/**
 * Get cached item if present and fresh.
 */
export function getCached<T>(key: string): T | null {
  const entry = memoryStore.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Store item in cache with TTL.
 */
export function setCached<T>(key: string, data: T, ttlMs = 30_000): T {
  memoryStore.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
  return data;
}

/**
 * Invalidate all cache keys matching a prefix or specific key.
 * Typically called on mutations (e.g. `invalidateUserCache(userId)`).
 */
export function invalidateCache(prefix: string): void {
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
    }
  }
}

