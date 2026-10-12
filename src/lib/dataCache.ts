/**
 * dataCache.ts — Global in-memory cache for Firebase API data.
 *
 * Strategy:
 * - Each collection is fetched ONCE on first access, then cached in memory.
 * - SSE events invalidate only the specific collection that changed.
 * - All hooks read from cache — no repeated network calls on page navigation.
 * - Cache TTL: 5 minutes (stale data is refreshed in background).
 * - User-specific data (userId-keyed) is cached separately per user.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  loading: boolean;
  error: string | null;
}

type Listener = () => void;

class DataCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private listeners = new Map<string, Set<Listener>>();
  private inflight = new Map<string, Promise<unknown>>();

  private getKey(collection: string, userId?: string): string {
    return userId ? `${collection}:${userId}` : collection;
  }

  get<T>(collection: string, userId?: string): CacheEntry<T> | null {
    const key = this.getKey(collection, userId);
    return (this.cache.get(key) as CacheEntry<T>) ?? null;
  }

  isStale(collection: string, userId?: string): boolean {
    const entry = this.get(collection, userId);
    if (!entry) return true;
    if (entry.loading) return false;
    return Date.now() - entry.fetchedAt > CACHE_TTL_MS;
  }

  set<T>(collection: string, data: T, userId?: string): void {
    const key = this.getKey(collection, userId);
    this.cache.set(key, {
      data,
      fetchedAt: Date.now(),
      loading: false,
      error: null,
    });
    this.notify(collection, userId);
  }

  setLoading(collection: string, userId?: string): void {
    const key = this.getKey(collection, userId);
    const existing = this.cache.get(key);
    this.cache.set(key, {
      data: existing?.data ?? null,
      fetchedAt: existing?.fetchedAt ?? 0,
      loading: true,
      error: null,
    });
  }

  setError(collection: string, error: string, userId?: string): void {
    const key = this.getKey(collection, userId);
    const existing = this.cache.get(key);
    this.cache.set(key, {
      data: existing?.data ?? null,
      fetchedAt: existing?.fetchedAt ?? 0,
      loading: false,
      error,
    });
    this.notify(collection, userId);
  }

  invalidate(collection: string, userId?: string): void {
    const key = this.getKey(collection, userId);
    const existing = this.cache.get(key);
    if (existing) {
      // Mark as stale (fetchedAt = 0) but keep data so UI doesn't flash empty
      this.cache.set(key, { ...existing, fetchedAt: 0 });
    }
  }

  invalidateAll(): void {
    for (const [key, entry] of this.cache.entries()) {
      this.cache.set(key, { ...entry, fetchedAt: 0 });
    }
  }

  subscribe(collection: string, listener: Listener, userId?: string): () => void {
    const key = this.getKey(collection, userId);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);
    return () => {
      this.listeners.get(key)?.delete(listener);
    };
  }

  private notify(collection: string, userId?: string): void {
    const key = this.getKey(collection, userId);
    this.listeners.get(key)?.forEach(fn => fn());
    // Also notify wildcard listeners (collection without userId)
    if (userId) {
      this.listeners.get(collection)?.forEach(fn => fn());
    }
  }

  // Deduplicate in-flight requests — if same key is already fetching, reuse the promise
  async fetchOnce<T>(
    key: string,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    if (this.inflight.has(key)) {
      return this.inflight.get(key) as Promise<T>;
    }
    const promise = fetcher().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }
}

export const dataCache = new DataCache();

// Listen to SSE events and invalidate relevant cache entries
if (typeof window !== "undefined") {
  window.addEventListener("ds:data-changed", (event: Event) => {
    const detail = (event as CustomEvent<{ collection?: string; id?: string }>).detail;
    if (detail?.collection) {
      dataCache.invalidate(detail.collection);
      // Also clear sessionStorage settings cache so next fetch re-seeds correctly
      if (detail.collection === "settings") {
        try { sessionStorage.removeItem("ds_settings_cache"); } catch { /* ignore */ }
      }
    }
  });
}
