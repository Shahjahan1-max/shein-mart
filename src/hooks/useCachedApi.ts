/**
 * useCachedApi.ts — React hook that reads from the global data cache.
 *
 * - First call: fetches from API and stores in cache.
 * - Subsequent calls (same collection, same userId): returns cached data instantly.
 * - SSE event for the collection: re-fetches in background, updates cache.
 * - Page navigation: instant — no loading state if cache is warm.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { dataCache } from "../lib/dataCache";
import { api } from "../lib/apiClient";

interface UseCachedState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCachedCollection<T>(
  collection: string,
  apiPath: string,
  userId?: string,
  transform?: (raw: unknown) => T[],
): UseCachedState<T[]> {
  const cacheKey = userId ? `${collection}:${userId}` : collection;

  const getSnapshot = useCallback((): { data: T[]; loading: boolean; error: string | null } => {
    const entry = dataCache.get<T[]>(collection, userId);
    if (!entry) return { data: [], loading: true, error: null };
    return {
      data: (entry.data as T[]) ?? [],
      loading: entry.loading && !entry.data,
      error: entry.error,
    };
  }, [collection, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [state, setState] = useState(getSnapshot);

  const fetchData = useCallback(async (force = false) => {
    if (!force && !dataCache.isStale(collection, userId)) return;

    dataCache.setLoading(collection, userId);
    setState(getSnapshot());

    try {
      const result = await dataCache.fetchOnce(cacheKey, async () => {
        const res = await api.get<{ success?: boolean; data?: unknown }>(apiPath);
        const raw = (res as { data?: unknown }).data ?? res;
        return transform ? transform(raw) : (Array.isArray(raw) ? raw : []) as T[];
      });
      dataCache.set(collection, result, userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load data.";
      dataCache.setError(collection, msg, userId);
    }
    setState(getSnapshot());
  }, [collection, userId, apiPath, cacheKey, getSnapshot, transform]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Fetch on mount if stale
    void fetchData();

    // Subscribe to cache updates
    const unsub = dataCache.subscribe(collection, () => {
      setState(getSnapshot());
    }, userId);

    return unsub;
  }, [collection, userId, fetchData, getSnapshot]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refetch: () => void fetchData(true),
  };
}

export function useCachedDoc<T>(
  collection: string,
  docId: string,
  apiPath: string,
  fallback: T,
): UseCachedState<T> {
  const cacheKey = `${collection}/${docId}`;

  const getSnapshot = useCallback((): { data: T; loading: boolean; error: string | null } => {
    const entry = dataCache.get<T>(cacheKey);
    if (!entry) return { data: fallback, loading: true, error: null };
    return {
      data: (entry.data as T) ?? fallback,
      loading: entry.loading && !entry.data,
      error: entry.error,
    };
  }, [cacheKey, fallback]); // eslint-disable-line react-hooks/exhaustive-deps

  const [state, setState] = useState(getSnapshot);

  const fetchData = useCallback(async (force = false) => {
    if (!force && !dataCache.isStale(cacheKey)) return;

    dataCache.setLoading(cacheKey);
    setState(getSnapshot());

    try {
      const result = await dataCache.fetchOnce(cacheKey, async () => {
        const res = await api.get<{ success?: boolean; data?: T }>(apiPath);
        return (res as { data?: T }).data ?? (res as T);
      });
      dataCache.set(cacheKey, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load data.";
      dataCache.setError(cacheKey, msg);
    }
    setState(getSnapshot());
  }, [cacheKey, apiPath, getSnapshot]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetchData();

    const unsub = dataCache.subscribe(collection, () => {
      setState(getSnapshot());
    });

    return unsub;
  }, [collection, fetchData, getSnapshot]);

  return {
    data: state.data ?? fallback,
    loading: state.loading,
    error: state.error,
    refetch: () => void fetchData(true),
  };
}
