/**
 * useApi.ts — React hooks for all API data fetching.
 *
 * Each hook:
 * - Fetches data from the backend API (not localStorage)
 * - Provides loading/error states
 * - Exposes a refetch function for manual refresh
 * - Falls back gracefully on error
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  api,
  apiUrl,
  ApiError,
  deleteFirebaseDoc,
  getFirebaseDoc,
  listFirebaseDocs,
  listFirebaseDocsPaginated,
  saveFirebaseDoc,
  toQueryString,
  type PaginatedResponse,
  type PaginationParams,
} from "../lib/apiClient";
import { toast } from "./use-toast";

let realtimeEventsStarted = false;
let realtimeEventsRetryTimer: number | null = null;
let realtimeRetryCount = 0;
let realtimeOnlineListenerAttached = false;
const REALTIME_MAX_RETRY_DELAY = 5 * 60_000; // max 5 minutes between retries

// ─── Shared tab-visible dispatcher ────────────────────────────────────────────
// A single visibilitychange listener fires ds:tab-visible once per tab-focus
// event. All hooks subscribe to this instead of registering their own
// visibilitychange listeners — preventing N parallel API calls on tab switch.
let _tabVisibleListenerAttached = false;
let _tabVisibleDebounceTimer: number | null = null;

function ensureTabVisibleDispatcher() {
  if (_tabVisibleListenerAttached || typeof document === "undefined") return;
  _tabVisibleListenerAttached = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    // Debounce — if several hooks subscribe, we still only dispatch once per focus
    if (_tabVisibleDebounceTimer !== null) window.clearTimeout(_tabVisibleDebounceTimer);
    _tabVisibleDebounceTimer = window.setTimeout(() => {
      _tabVisibleDebounceTimer = null;
      window.dispatchEvent(new CustomEvent("ds:tab-visible"));
    }, 150);
  });
}

// ─── Module-level request deduplication cache ─────────────────────────────────
// Prevents multiple components on the same page from making identical API calls
const _inflightRequests = new Map<string, Promise<unknown>>();
const _responseCache = new Map<string, { data: unknown; ts: number }>();
/** Default cache TTL for frequently-changing data (30 seconds) */
const RESPONSE_CACHE_TTL = 30_000;
/** Extended cache TTL for slowly-changing public catalog / landing-page data.
 *  Safe to use because the SSE data-changed event invalidates these caches
 *  immediately whenever an admin makes a change. */
export const CATALOG_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

function cachedFetch<T>(key: string, fetcher: () => Promise<T>, ttl = RESPONSE_CACHE_TTL): Promise<T> {
  // Return cached response if fresh
  const cached = _responseCache.get(key);
  if (cached && Date.now() - cached.ts < ttl) {
    return Promise.resolve(cached.data as T);
  }
  // Deduplicate in-flight requests
  if (_inflightRequests.has(key)) {
    return _inflightRequests.get(key) as Promise<T>;
  }
  const promise = fetcher().then(data => {
    _responseCache.set(key, { data, ts: Date.now() });
    _inflightRequests.delete(key);
    return data;
  }).catch(err => {
    _inflightRequests.delete(key);
    throw err;
  });
  _inflightRequests.set(key, promise);
  return promise;
}

/** Convenience wrapper that uses the extended catalog cache TTL (5 minutes).
 *  Safe because SSE data-changed events invalidate the cache immediately
 *  whenever an admin publishes a change. */
function cachedFetchCatalog<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  return cachedFetch(key, fetcher, CATALOG_CACHE_TTL_MS);
}

export function invalidateCache(key: string): void {
  _responseCache.delete(key);
}

function invalidateCachePrefix(prefix: string): void {
  for (const key of _responseCache.keys()) {
    if (key.startsWith(prefix)) _responseCache.delete(key);
  }
}

function getRetryDelay(): number {
  // Exponential backoff capped to avoid noisy browser resource errors.
  const delay = Math.min(3_000 * Math.pow(2, realtimeRetryCount), REALTIME_MAX_RETRY_DELAY);
  return delay;
}

function scheduleRealtimeReconnect() {
  if (typeof window === "undefined") return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    if (!realtimeOnlineListenerAttached) {
      realtimeOnlineListenerAttached = true;
      window.addEventListener("online", () => {
        realtimeOnlineListenerAttached = false;
        realtimeRetryCount = 0;
        ensureRealtimeEvents();
      }, { once: true });
    }
    return;
  }
  if (realtimeEventsRetryTimer === null) {
    const delay = getRetryDelay();
    realtimeRetryCount++;
    realtimeEventsRetryTimer = window.setTimeout(() => {
      realtimeEventsRetryTimer = null;
      ensureRealtimeEvents();
    }, delay);
  }
}

function hasRealtimeSession(): boolean {
  try {
    return Boolean(
      window.localStorage.getItem("ds_auth_user") ||
      window.localStorage.getItem("ds_admin_session"),
    );
  } catch {
    return false;
  }
}

function ensureRealtimeEvents() {
  if (realtimeEventsStarted || typeof window === "undefined" || typeof EventSource === "undefined") return;
  // Public pages render static/default content and do not need a persistent
  // serverless stream per visitor; authenticated areas still receive updates.
  if (!hasRealtimeSession()) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    scheduleRealtimeReconnect();
    return;
  }
  realtimeEventsStarted = true;
  if (realtimeEventsRetryTimer !== null) {
    window.clearTimeout(realtimeEventsRetryTimer);
    realtimeEventsRetryTimer = null;
  }
  const events = new EventSource(apiUrl("/api/events"));
  events.onopen = () => {
    realtimeRetryCount = 0; // reset backoff on successful connection
  };
  events.addEventListener("data-changed", event => {
    let detail: unknown = null;
    try {
      detail = JSON.parse((event as MessageEvent).data);
    } catch {}
    window.dispatchEvent(new CustomEvent("ds:data-changed", { detail }));
    // Invalidate module-level cache for the changed collection
    const col = (detail as { collection?: string })?.collection;
    if (col) {
      if (col === "settings") invalidateCache(`settings:platform`);
      invalidateCachePrefix(`collection:${col}`);
      invalidateCachePrefix(`doc:${col}:`);
    }
  });
  events.onerror = () => {
    // Vercel serverless functions timeout SSE connections after ~10s — this is normal
    // Silently reconnect with exponential backoff, no console noise
    events.close();
    realtimeEventsStarted = false;
    scheduleRealtimeReconnect();
  };
}

// ─── Generic fetch hook ───────────────────────────────────────────────────────

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

type UseCollectionState<T> = Omit<UseApiState<T[]>, "data"> & { data: T[] };
type UseApiOptions = {
  realtimeCollections?: string[];
  pollMs?: number;
  initialData?: unknown;
};

interface UsePaginatedState<T> extends UseCollectionState<T> {
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reset: () => void;
  loadingMore: boolean;
}

export function useApiData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: UseApiOptions = {},
): UseApiState<T> {
  const hasInitialData = options.initialData !== undefined;
  const [data, setData] = useState<T | null>(() => hasInitialData ? options.initialData as T : null);
  const [loading, setLoading] = useState(!hasInitialData);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const hasDataRef = useRef(hasInitialData);
  const realtimeKey = options.realtimeCollections?.join("|") ?? "";

  const lastFetchTsRef = useRef<number>(0);

  const fetch = useCallback(async () => {
    const showLoading = !hasDataRef.current && data === null;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      hasDataRef.current = true;
      lastFetchTsRef.current = Date.now();
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => {
    if (!options.pollMs) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") fetch();
    }, options.pollMs);
    return () => window.clearInterval(interval);
  }, [fetch, options.pollMs]);

  useEffect(() => {
    ensureRealtimeEvents();
    ensureTabVisibleDispatcher();
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ collection?: string }>).detail;
      if (detail?.collection) {
        invalidateCachePrefix(`collection:${detail.collection}`);
      }
      if (options.realtimeCollections?.length) {
        if (!detail?.collection) return;
        if (!options.realtimeCollections.includes(detail.collection)) return;
      }
      fetch();
    };
    const onTabVisible = () => {
      // Quiet background sync on tab focus ONLY if data is stale (> 60 seconds old)
      if (Date.now() - lastFetchTsRef.current < 60_000) return;
      fetch();
    };
    window.addEventListener("ds:data-changed", onChange);
    window.addEventListener("ds:tab-visible", onTabVisible);
    return () => {
      window.removeEventListener("ds:data-changed", onChange);
      window.removeEventListener("ds:tab-visible", onTabVisible);
    };
  }, [fetch, realtimeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refetch: fetch };
}

export function useFirebaseCollection<T>(collection: string, deps: unknown[] = []): UseCollectionState<T> {
  const state = useApiData<T[]>(
    () => cachedFetch(`collection:${collection}`, () => listFirebaseDocs<T>(collection)),
    [collection, ...deps],
    { realtimeCollections: [collection] },
  );
  return { ...state, data: state.data ?? [] };
}

export function useUserCollection<T>(collection: string, userId?: string, deps: unknown[] = []): UseCollectionState<T> {
  const cleanUserId = (userId ?? "").trim();
  const state = useApiData<T[]>(
    async () => {
      if (!cleanUserId) return [];
      const res = await cachedFetch(
        `collection:${collection}:user:${cleanUserId}`,
        () => api.get<{ success?: boolean; data?: T[] } | T[]>(`/api/firebase/${encodeURIComponent(collection)}?userId=${encodeURIComponent(cleanUserId)}`)
      );
      if (Array.isArray(res)) return res;
      if (res && typeof res === "object" && "data" in res && Array.isArray(res.data)) return res.data;
      return [];
    },
    [collection, cleanUserId, ...deps],
    { realtimeCollections: [collection] },
  );
  return { ...state, data: state.data ?? [] };
}

export function useFirebaseCollectionPage<T>(
  collection: string,
  params: PaginationParams = {},
  deps: unknown[] = [],
): UsePaginatedState<T> {
  return usePaginatedApiData<T>(
    cursor => listFirebaseDocsPaginated<T>(collection, { pageSize: 25, orderField: "createdAt", orderDir: "desc", ...params, cursor }),
    [collection, ...deps],
    [collection],
  );
}

export function useAssignedTaskItemsPage<T>(userId: string, code: string, pageSize = 25): UsePaginatedState<T> {
  return usePaginatedApiData<T>(
    async cursor => {
      if (!userId || !code) return Promise.resolve({ data: [], hasMore: false, nextCursor: null });
      const res = await api.get<PaginatedResponse<T>>(`/api/assigned-task-items${toQueryString({
        pageSize,
        cursor,
        userId,
        code,
      })}`);
      return { data: res.data ?? [], hasMore: Boolean(res.hasMore), nextCursor: res.nextCursor ?? null };
    },
    [userId, code, pageSize],
    ["assignedTaskItems"],
  );
}

export function useFirebaseDoc<T>(
  collection: string,
  id: string,
  fallback: T,
  options: { renderFallbackImmediately?: boolean; cacheTtl?: number } = {},
) {
  const state = useApiData<T>(async () => {
    const data = await cachedFetch(
      `doc:${collection}:${id}`,
      () => getFirebaseDoc<T>(collection, id),
      options.cacheTtl,
    );
    return data ?? fallback;
  }, [collection, id], {
    realtimeCollections: [collection],
    ...(options.renderFallbackImmediately ? { initialData: fallback } : {}),
  });
  return { ...state, data: state.data ?? fallback };
}

export function usePaginatedApiData<T>(
  fetchPage: (cursor: string | null) => Promise<PaginatedResponse<T>>,
  deps: unknown[] = [],
  realtimeCollections: string[] = [],
): UsePaginatedState<T> {
  const cacheKey = realtimeCollections.length
    ? `paged:${realtimeCollections.join(",")}:${JSON.stringify(deps)}`
    : "";
  const cached = cacheKey ? _responseCache.get(cacheKey) : null;
  const cachedPage = cached?.data as PaginatedResponse<T> | undefined;

  const [data, setData] = useState<T[]>(() => cachedPage?.data ? cachedPage.data : []);
  const [loading, setLoading] = useState(() => !cachedPage?.data || cachedPage.data.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(() => cachedPage?.nextCursor ?? null);
  const [hasMore, setHasMore] = useState(() => Boolean(cachedPage?.hasMore));
  const cursorRef = useRef<string | null>(cachedPage?.nextCursor ?? null);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const realtimeKey = realtimeCollections.join("|");
  const lastPagedFetchTsRef = useRef<number>(0);

  const loadFirst = useCallback(async () => {
    // Only show full loading state if we have 0 items in state to avoid UI flicker
    setData(prev => {
      if (prev.length === 0) setLoading(true);
      return prev;
    });
    setError(null);
    try {
      const result = await fetchPageRef.current(null);
      const items = result.data ?? [];
      setData(items);
      setHasMore(Boolean(result.hasMore));
      setCursor(result.nextCursor ?? null);
      cursorRef.current = result.nextCursor ?? null;
      lastPagedFetchTsRef.current = Date.now();
      if (cacheKey) {
        _responseCache.set(cacheKey, { data: result, ts: Date.now() });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [cacheKey, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await fetchPageRef.current(cursorRef.current);
      setData(prev => {
        const byId = new Map<string, T>();
        [...prev, ...(result.data ?? [])].forEach(item => {
          const id = String((item as { id?: unknown }).id ?? JSON.stringify(item));
          byId.set(id, item);
        });
        return [...byId.values()];
      });
      setHasMore(Boolean(result.hasMore));
      setCursor(result.nextCursor ?? null);
      cursorRef.current = result.nextCursor ?? null;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load more data.");
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore]);

  useEffect(() => { loadFirst(); }, [loadFirst]);

  useEffect(() => {
    ensureRealtimeEvents();
    ensureTabVisibleDispatcher();
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ collection?: string }>).detail;
      if (detail?.collection) {
        invalidateCachePrefix(`paged:${detail.collection}`);
      }
      if (realtimeCollections.length) {
        if (!detail?.collection) return;
        if (!realtimeCollections.includes(detail.collection)) return;
      }
      loadFirst();
    };
    const onTabVisible = () => {
      // Quiet background refresh ONLY if data is stale (> 60 seconds old)
      if (Date.now() - lastPagedFetchTsRef.current < 60_000) return;
      loadFirst();
    };
    window.addEventListener("ds:data-changed", onChange);
    window.addEventListener("ds:tab-visible", onTabVisible);
    return () => {
      window.removeEventListener("ds:data-changed", onChange);
      window.removeEventListener("ds:tab-visible", onTabVisible);
    };
  }, [loadFirst, realtimeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    loading,
    error,
    refetch: loadFirst,
    hasMore,
    loadMore,
    reset: loadFirst,
    loadingMore,
  };
}

export async function saveGenericFirebaseDoc<T extends { id?: string }>(
  collection: string,
  id: string,
  data: T,
): Promise<T> {
  return saveFirebaseDoc(collection, id, data);
}

export async function updateAssignedTaskItem<T extends { id?: string }>(
  itemId: string,
  data: Partial<T>,
): Promise<T> {
  const res = await api.put<{ success: boolean; data: T }>(
    `/api/assigned-task-items/${encodeURIComponent(itemId)}`,
    data,
    { requiresAdmin: true },
  );
  return res.data;
}

export interface ConfirmAssignedTaskItemResult {
  item: Record<string, unknown>;
  user: { id: string; balance?: number; earnings?: number };
  progress: { taskIndex?: number; completedCount?: number; totalEarned?: number };
  session: Record<string, unknown>;
  alreadyCompleted: boolean;
  commissionApplied: boolean;
}

export async function confirmAssignedTaskItem(itemId: string): Promise<ConfirmAssignedTaskItemResult> {
  const res = await api.post<{ success: boolean; data: ConfirmAssignedTaskItemResult }>(
    `/api/assigned-task-items/${encodeURIComponent(itemId)}/confirm`,
    {},
  );
  // Invalidate task session and progress caches so next fetch gets fresh data
  const userId = itemId.split("_")[0];
  if (userId) {
    invalidateCache(`taskSession:${userId}`);
    invalidateCache(`settings:platform`);
  }
  return res.data;
}

export interface UploadedAsset {
  id: string;
  url: string;
  path: string;
  fileName: string;
  contentType: string;
  uploadedBy: string;
  createdAt: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve((event.target?.result as string) || "");
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

export async function uploadAssetFile(file: File, folder = "assets"): Promise<UploadedAsset> {
  const dataUrl = await readFileAsDataUrl(file);
  const res = await api.post<{ success: boolean; data: UploadedAsset }>(
    "/api/assets/upload",
    {
      dataUrl,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      folder,
    },
    { requiresAdmin: true },
  );
  return res.data;
}

export interface UploadedProfileImage {
  profileImage: string;
  path: string;
  user: ApiUser;
}

export async function uploadUserProfileImage(
  userId: string,
  payload: { dataUrl: string; fileName: string; contentType: string },
): Promise<UploadedProfileImage> {
  const res = await api.post<{ success: boolean; data: ApiUser; profileImage: string; path: string }>(
    `/api/users/${encodeURIComponent(userId)}/profile-image`,
    payload,
  );
  return {
    profileImage: res.profileImage || String(res.data?.profileImage || ""),
    path: res.path,
    user: res.data,
  };
}

export async function deleteGenericFirebaseDoc(collection: string, id: string): Promise<void> {
  return deleteFirebaseDoc(collection, id);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface ApiUser {
  [key: string]: unknown;
  id: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  referralCode: string;
  referredBy?: string;
  referredByUserId?: string;
  referralCodeUsed?: string;
  balance?: number;
  earnings?: number;
  withdrawWallet?: string;
  withdrawWalletProtocol?: string;
  walletLocked?: boolean;
  walletUpdatedAt?: string;
  walletUpdatedBy?: string;
  withdrawalWallet?: string;
  withdrawalWalletProtocol?: string;
  withdrawalWalletLocked?: boolean;
  withdrawalWalletUpdatedAt?: string;
  withdrawalWalletUpdatedBy?: string;
  profileImage?: string;
  status?: string;
  createdAt: string;
  updatedAt?: string;
}

export function useUsers() {
  const state = useApiData<ApiUser[]>(
    () => cachedFetch("collection:users", () => api.get<ApiUser[]>("/api/users")),
    [],
    { realtimeCollections: ["users"] },
  );
  return { ...state, data: state.data ?? [] };
}

export function useTeamMembers(userId?: string, referralCode?: string) {
  const state = useApiData<ApiUser[]>(async () => {
    if (!userId && !referralCode) return [];
    const qs = toQueryString({ userId, referralCode });
    const res = await cachedFetch(`collection:users:team:${userId || ""}:${referralCode || ""}`, () =>
      api.get<{ success: boolean; data: ApiUser[] }>(`/api/users/team${qs}`)
    );
    return res.data ?? [];
  }, [userId, referralCode], { realtimeCollections: ["users"] });
  return { ...state, data: state.data ?? [] };
}

export function useUsersPage(pageSize = 25, params: PaginationParams = {}) {
  return usePaginatedApiData<ApiUser>(
    async cursor => {
      const res = await api.get<PaginatedResponse<ApiUser>>(`/api/users${toQueryString({ pageSize, ...params, cursor })}`);
      return { data: res.data ?? [], hasMore: Boolean(res.hasMore), nextCursor: res.nextCursor ?? null };
    },
    [pageSize, JSON.stringify(params)],
    ["users"],
  );
}

export function useUser(userId?: string) {
  return useApiData<ApiUser | null>(async () => {
    if (!userId) return null;
    return api.get<ApiUser>(`/api/users/${userId}`);
  }, [userId]);
}

export async function updateUser(
  userId: string,
  patch: Partial<ApiUser>,
  options: { requiresAdmin?: boolean } = {},
): Promise<ApiUser> {
  return api.patch<ApiUser>(`/api/users/${userId}`, patch, options);
}

export interface UserPurgeTotals {
  usersProcessed: number;
  usersDeleted: number;
  transactionsDeleted: number;
  recordsDeleted: number;
  menuDeleted: number;
  supportDeleted: number;
}

export async function purgeUserData(
  userIds: string[],
  scopes: string[],
): Promise<{ success: boolean; totals: UserPurgeTotals }> {
  return api.post<{ success: boolean; totals: UserPurgeTotals }>(
    "/api/super-admin/users/purge",
    { userIds, scopes },
    { requiresAdmin: true },
  );
}

export async function fetchAllUsersForExport(): Promise<ApiUser[]> {
  try {
    const res = await api.get<{ success?: boolean; data?: ApiUser[] } | ApiUser[]>("/api/users", { requiresAdmin: true });
    if (Array.isArray(res)) return res;
    if (res && "data" in res && Array.isArray(res.data)) return res.data;
    return [];
  } catch (err) {
    console.warn("Failed to fetch all users for export:", err);
    return [];
  }
}

export function useAdminSidebarCounts() {
  return useApiData<{ pendingOrders: number; pendingTransactions: number; openTickets: number }>(async () => {
    const res = await api.get<{ success: boolean; data: { pendingOrders: number; pendingTransactions: number; openTickets: number } }>(
      "/api/admin/sidebar-counts",
      { requiresAdmin: true },
    );
    return res.data ?? { pendingOrders: 0, pendingTransactions: 0, openTickets: 0 };
  }, [], { realtimeCollections: ["orders", "deposits", "withdrawals", "supportTickets"] });
}

export interface SuperAdminAlert {
  id: string;
  type: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
  source: string;
  timestamp: string;
  acknowledged?: boolean;
}

export interface SuperAdminMetricsData {
  users: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  sellers: {
    total: number;
    active: number;
    pending: number;
  };
  wallet: {
    totalBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    pendingWithdrawals: number;
    pendingDeposits: number;
    completedDeposits?: number;
    rejectedWithdrawals?: number;
  };
  orders: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
  };
  support: {
    openTickets: number;
    totalTickets: number;
    avgResponseTime: number;
    satisfaction: number;
  };
  marketplace: Record<string, { activeSessions: number; completedToday: number; revenue: number }>;
  seoServices: {
    active: number;
    completed: number;
    revenue: number;
  };
  performance: {
    avgApiLatency: number;
    errorRate: number;
    uptime: number;
    firestoreConnected: boolean;
  };
  alerts: SuperAdminAlert[];
}

export function useSuperAdminMetrics() {
  return useApiData<SuperAdminMetricsData>(async () => {
    try {
      const res = await api.get<{ success: boolean; data: SuperAdminMetricsData }>(
        "/api/super-admin/metrics",
        { requiresAdmin: true },
      );
      if (res?.data) return res.data;
    } catch {}
    return null as unknown as SuperAdminMetricsData;
  }, [], {
    realtimeCollections: ["users", "deposits", "withdrawals", "orders", "supportTickets", "settings"],
    pollMs: 15_000,
  });
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface ApiOrder {
  [key: string]: unknown;
  id: string;
  userId: string;
  userName: string;
  platformId: string;
  platformName: string;
  status: string;
  createdAt: string;
  assignedAt?: string;
  completedAt?: string;
  previousAdCodeId?: string;
  movedFromPlatform?: string;
  movedFromPlatformName?: string;
  requestedPlatform?: string;
  requestedPlatformName?: string;
  isDeclinedReassignment?: boolean;
  declinedAt?: string;
  declineReason?: string;
  commissionRate?: number;
  requiredTasks?: number;
  totalTasks?: number;
  updatedAt?: string;
}

export function useOrders(userId?: string) {
  const state = useApiData<ApiOrder[]>(async () => {
    const path = userId ? `/api/orders?userId=${encodeURIComponent(userId)}` : "/api/orders";
    const res = await api.get<{ success: boolean; data: ApiOrder[] }>(path);
    return res.data ?? [];
  }, [userId], { realtimeCollections: ["orders"] });
  return { ...state, data: state.data ?? [] };
}

export function useOrdersPage(pageSize = 25, params: PaginationParams = {}) {
  return usePaginatedApiData<ApiOrder>(
    async cursor => {
      const res = await api.get<PaginatedResponse<ApiOrder>>(`/api/orders${toQueryString({ pageSize, ...params, cursor })}`);
      return { data: res.data ?? [], hasMore: Boolean(res.hasMore), nextCursor: res.nextCursor ?? null };
    },
    [pageSize, JSON.stringify(params)],
    ["orders"],
  );
}

export async function updateOrder(orderId: string, patch: Partial<ApiOrder>): Promise<ApiOrder> {
  const res = await api.put<{ success: boolean; data: ApiOrder }>(`/api/orders/${orderId}`, patch);
  return res.data;
}

export async function createOrder(order: Partial<ApiOrder>): Promise<ApiOrder> {
  const res = await api.post<{ success: boolean; data: ApiOrder[] }>("/api/orders", order);
  return res.data[0];
}

export async function deleteOrder(orderId: string): Promise<void> {
  await api.delete(`/api/orders/${orderId}`);
}

// ─── Deposits ─────────────────────────────────────────────────────────────────

export interface ApiDeposit {
  id: string;
  userId: string;
  userName?: string;
  amount: number;
  bonusAmount?: number;
  bonusType?: string;
  protocol: string;
  walletId?: string;
  walletAddress?: string;
  proofUrl?: string;
  status: string;
  date: string;
  creditedAt?: string;
  creditedAmount?: number;
  createdAt: string;
  updatedAt?: string;
}

export async function compressProofImage(file: File, maxDimension = 1000, quality = 0.75): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        readFileAsDataUrl(file).then(resolve);
        return;
      }
      // Fill canvas with white background (handles transparent PNGs cleanly when converting to JPEG)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      // Always compress to JPEG for optimal size (typically 35-80 KB)
      let result = canvas.toDataURL("image/jpeg", quality);
      
      // Safety guard: if output is still > 300KB, scale down further to ensure instant transfer & safe Firestore bounds
      if (result.length > 300 * 1024) {
        const smallerCanvas = document.createElement("canvas");
        const sWidth = Math.round(width * 0.7);
        const sHeight = Math.round(height * 0.7);
        smallerCanvas.width = sWidth;
        smallerCanvas.height = sHeight;
        const sCtx = smallerCanvas.getContext("2d");
        if (sCtx) {
          sCtx.fillStyle = "#ffffff";
          sCtx.fillRect(0, 0, sWidth, sHeight);
          sCtx.drawImage(canvas, 0, 0, sWidth, sHeight);
          result = smallerCanvas.toDataURL("image/jpeg", 0.65);
        }
      }
      resolve(result);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      readFileAsDataUrl(file).then(resolve);
    };
    img.src = url;
  });
}

export async function uploadDepositProof(file: File, precomputedDataUrl?: string): Promise<{ url: string; path?: string }> {
  const dataUrl = precomputedDataUrl || await compressProofImage(file);
  try {
    const res = await api.post<{ success: boolean; url: string; path?: string }>(
      "/api/deposits/upload-proof",
      {
        dataUrl,
        fileName: file.name.replace(/\.[^/.]+$/, ".jpg"),
        contentType: "image/jpeg",
      },
    );
    if (res?.url) {
      return { url: res.url, path: res.path };
    }
  } catch (err) {
    console.warn("Server proof upload failed, falling back to lightweight dataUrl:", err);
  }
  return { url: dataUrl };
}

export function useDeposits(userId?: string) {
  const state = useApiData<ApiDeposit[]>(async () => {
    const path = userId ? `/api/deposits?userId=${userId}` : "/api/deposits";
    const res = await cachedFetch(`collection:deposits:${userId || "all"}`, () =>
      api.get<{ success: boolean; data: ApiDeposit[] }>(path)
    );
    return res.data ?? [];
  }, [userId], {
    realtimeCollections: ["deposits"],
    ...(userId ? { initialData: [] } : {}),
  });
  return { ...state, data: state.data ?? [] };
}

export function useDepositsPage(pageSize = 25, params: PaginationParams = {}) {
  return usePaginatedApiData<ApiDeposit>(
    async cursor => {
      const res = await api.get<PaginatedResponse<ApiDeposit>>(`/api/deposits${toQueryString({ pageSize, ...params, cursor })}`);
      return { data: res.data ?? [], hasMore: Boolean(res.hasMore), nextCursor: res.nextCursor ?? null };
    },
    [pageSize, JSON.stringify(params)],
    ["deposits"],
  );
}

export async function updateDeposit(depositId: string, patch: Partial<ApiDeposit>): Promise<ApiDeposit> {
  const res = await api.put<{ success: boolean; data: ApiDeposit }>(`/api/deposits/${depositId}`, patch, { requiresAdmin: true });
  return res.data;
}

// ─── Withdrawals ──────────────────────────────────────────────────────────────

export interface ApiWithdrawal {
  id: string;
  userId: string;
  userName?: string;
  amount: number;
  taxAmount?: number;
  taxType?: string;
  finalPayout?: number;
  protocol: string;
  address: string;
  status: string;
  date: string;
  balanceDeductedAtRequest?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export function useWithdrawals(userId?: string) {
  const state = useApiData<ApiWithdrawal[]>(async () => {
    const path = userId ? `/api/withdrawals?userId=${userId}` : "/api/withdrawals";
    const res = await cachedFetch(`collection:withdrawals:${userId || "all"}`, () =>
      api.get<{ success: boolean; data: ApiWithdrawal[] }>(path)
    );
    return res.data ?? [];
  }, [userId], {
    realtimeCollections: ["withdrawals"],
    ...(userId ? { initialData: [] } : {}),
  });
  return { ...state, data: state.data ?? [] };
}

export function useWithdrawalsPage(pageSize = 25, params: PaginationParams = {}) {
  return usePaginatedApiData<ApiWithdrawal>(
    async cursor => {
      const res = await api.get<PaginatedResponse<ApiWithdrawal>>(`/api/withdrawals${toQueryString({ pageSize, ...params, cursor })}`);
      return { data: res.data ?? [], hasMore: Boolean(res.hasMore), nextCursor: res.nextCursor ?? null };
    },
    [pageSize, JSON.stringify(params)],
    ["withdrawals"],
  );
}

export async function updateWithdrawal(withdrawalId: string, patch: Partial<ApiWithdrawal>): Promise<ApiWithdrawal> {
  const res = await api.put<{ success: boolean; data: ApiWithdrawal }>(`/api/withdrawals/${withdrawalId}`, patch, { requiresAdmin: true });
  return res.data;
}

// ─── Support Tickets ──────────────────────────────────────────────────────────

export interface ApiTicket {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  subject: string;
  message: string;
  date: string;
  status: string;
  type?: string;
  reply?: string;
  walletChange?: {
    currentWallet?: string;
    requestedWallet?: string;
    protocol?: string;
    status?: "pending" | "approved" | "rejected";
  };
  is_deleted?: boolean;
  user_deleted?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export function useSupportTickets(userId?: string) {
  const state = useApiData<ApiTicket[]>(async () => {
    try {
      const path = userId
        ? `/api/support-tickets?userId=${encodeURIComponent(userId)}`
        : "/api/support-tickets";
      const res = await api.get<{ success: boolean; data: ApiTicket[] }>(
        path,
        !userId ? { requiresAdmin: true } : undefined,
      );
      return res.data ?? [];
    } catch {
      return [];
    }
  }, [userId], { realtimeCollections: ["supportTickets"] });
  return { ...state, data: state.data ?? [] };
}

export async function updateTicket(ticketId: string, patch: Partial<ApiTicket>): Promise<ApiTicket> {
  const res = await api.put<{ success: boolean; data: ApiTicket }>(`/api/support-tickets/${ticketId}`, patch, { requiresAdmin: true });
  return res.data;
}

export async function deleteTicket(ticketId: string): Promise<void> {
  await api.delete(`/api/support-tickets/${ticketId}`, { requiresAdmin: true });
}

export async function createTicket(ticket: Omit<ApiTicket, "createdAt" | "updatedAt">): Promise<ApiTicket> {
  const res = await api.post<{ success: boolean; data: ApiTicket }>("/api/support-tickets", ticket);
  return res.data;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const SETTINGS_SESSION_KEY = "ds_settings_cache";
const SETTINGS_SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

let publishedSettingsCache: Record<string, unknown> | null = null;

/** Seed the module-level cache from sessionStorage on first import.
 *  On browser reload / hard-refresh, stale cache is purged to guarantee fresh live data. */
(function seedSettingsCacheFromSession() {
  if (typeof window === "undefined") return;
  try {
    const navEntries = typeof performance !== "undefined" ? performance.getEntriesByType("navigation") : [];
    const isReload = navEntries.length > 0 && (navEntries[0] as PerformanceNavigationTiming).type === "reload";
    if (isReload) {
      sessionStorage.removeItem(SETTINGS_SESSION_KEY);
      return;
    }
    const raw = sessionStorage.getItem(SETTINGS_SESSION_KEY);
    if (!raw) return;
    const { data, ts } = JSON.parse(raw) as { data: Record<string, unknown>; ts: number };
    if (Date.now() - ts < SETTINGS_SESSION_TTL_MS && data && typeof data === "object") {
      publishedSettingsCache = data;
      // Pre-seed the response cache so hooks skip the network on first render
      _responseCache.set("settings:platform", { data, ts });
    }
  } catch { /* ignore corrupted session data */ }
})();

export function useSettings<T = Record<string, unknown>>() {
  // Use global cache — settings rarely change, no need to refetch on every page.
  // On first mount the sessionStorage-seeded cache provides instant rendering.
  return useApiData<T>(async () => {
    const data = await cachedFetch<T>("settings:platform", async () => {
      const res = await api.get<{ success: boolean; data: T }>("/api/settings");
      return res.data ?? null as unknown as T;
    });
    if (data && typeof data === "object") {
      publishedSettingsCache = data as Record<string, unknown>;
      // Persist to sessionStorage for next page load / navigation
      try {
        sessionStorage.setItem(SETTINGS_SESSION_KEY, JSON.stringify({ data, ts: Date.now() }));
      } catch { /* quota exceeded — ignore */ }
    }
    return data;
  }, [], {
    realtimeCollections: ["settings"],
    initialData: (publishedSettingsCache ?? {}) as T,
  });
}

export function useAdminSettingsDraft<T = Record<string, unknown>>() {
  return useApiData<T>(async () => {
    const res = await api.get<{ success: boolean; data: T }>("/api/settings/draft", { requiresAdmin: true });
    return res.data ?? null as unknown as T;
  }, [], { realtimeCollections: ["settingsDraft", "settings"] });
}

function logSettingsMutationFailure(action: "save draft" | "publish", endpoint: string, error: unknown) {
  console.error(`[AdminSettings] ${action} failed`, {
    endpoint: apiUrl(endpoint),
    status: error instanceof ApiError ? error.status : undefined,
    message: error instanceof Error ? error.message : "Unknown error",
  });
}

export async function saveSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
  const endpoint = "/api/settings/draft";
  try {
    const res = await api.put<{ success: boolean; data: Record<string, unknown> }>(
      endpoint,
      settings,
      { requiresAdmin: true },
    );
    return res.data ?? settings;
  } catch (error) {
    logSettingsMutationFailure("save draft", endpoint, error);
    throw error;
  }
}

export async function publishSettings(settings: Record<string, unknown>, adminUsername?: string): Promise<Record<string, unknown>> {
  const endpoint = "/api/settings/publish";
  const now = new Date().toISOString();
  const currentVersion = typeof settings.version === "number" ? settings.version : 0;
  const payload = {
      ...settings,
      status: "published",
      updatedAt: now,
      publishedAt: now,
      updatedBy: adminUsername ?? "admin",
      version: currentVersion,
    };
  try {
    const res = await api.put<{ success: boolean; data: Record<string, unknown> }>(
      endpoint,
      payload,
      { requiresAdmin: true },
    );
    const result = res.data ?? payload;
    publishedSettingsCache = result;
    invalidateCache("settings:platform");
    try {
      sessionStorage.setItem(SETTINGS_SESSION_KEY, JSON.stringify({ data: result, ts: Date.now() }));
    } catch {}
    window.dispatchEvent(new CustomEvent("ds:data-changed", { detail: { collection: "settings" } }));
    return result;
  } catch (error) {
    logSettingsMutationFailure("publish", endpoint, error);
    throw error;
  }
}

// ─── Ad Assignments ───────────────────────────────────────────────────────────

export interface ApiAdAssignment {
  userId: string;
  code: string | null;
  assignedTs: string;
  orderId?: string;
  force?: boolean;
  snapshot?: unknown;
  updatedAt: string;
}

export function useAdAssignments() {
  const state = useApiData<ApiAdAssignment[]>(async () => {
    const res = await api.get<{ success: boolean; data: ApiAdAssignment[] }>("/api/ad-assignments");
    return res.data ?? [];
  }, [], { realtimeCollections: ["adAssignments"] });
  return { ...state, data: state.data ?? [] };
}

export async function setAdAssignment(userId: string, assignment: Partial<ApiAdAssignment>): Promise<ApiAdAssignment> {
  const res = await api.put<{ success: boolean; data: ApiAdAssignment }>(`/api/ad-assignments/${userId}`, assignment, { requiresAdmin: true });
  return res.data;
}

export async function deleteAdAssignment(userId: string): Promise<void> {
  await api.delete(`/api/ad-assignments/${userId}`, { requiresAdmin: true });
}

// ─── User-side deposit submit ─────────────────────────────────────────────────

export async function submitDeposit(deposit: Omit<ApiDeposit, "createdAt" | "updatedAt">): Promise<ApiDeposit> {
  const res = await api.post<{ success: boolean; data: ApiDeposit }>("/api/deposits", deposit);
  return res.data;
}

// ─── User-side withdrawal submit ──────────────────────────────────────────────

export async function submitWithdrawal(withdrawal: Omit<ApiWithdrawal, "createdAt" | "updatedAt">): Promise<ApiWithdrawal> {
  const res = await api.post<{ success: boolean; data: ApiWithdrawal }>("/api/user/withdrawals", withdrawal);
  return res.data;
}

export async function saveWithdrawWallet(
  userId: string,
  payload: { address: string; protocol: string },
): Promise<ApiUser> {
  const wallet = payload.address.trim();
  const protocol = payload.protocol.trim() || "TRC20";
  const user = await updateUser(userId, {
    withdrawalWallet: wallet,
    withdrawalWalletProtocol: protocol,
    withdrawalWalletLocked: true,
  } as Partial<ApiUser>);
  invalidateCachePrefix("collection:users");
  invalidateCache(`doc:users:${userId}`);
  window.dispatchEvent(new CustomEvent("ds:data-changed", { detail: { collection: "users", id: userId } }));
  return user;
}

// ─── User-side support ticket submit ─────────────────────────────────────────

export async function submitSupportTicket(ticket: Omit<ApiTicket, "createdAt" | "updatedAt">): Promise<ApiTicket> {
  const res = await api.post<{ success: boolean; data: ApiTicket }>("/api/support-tickets", ticket);
  return res.data;
}

export async function deleteUserTicket(ticketId: string): Promise<void> {
  await api.put(`/api/support-tickets/${ticketId}`, { user_deleted: true });
}

// ─── Task Sessions ────────────────────────────────────────────────────────────

export interface ApiTaskSession {
  id: string;
  sessionId?: string;
  userId: string;
  platformId?: string;
  taskCode?: string;
  platformName?: string;
  tasksDone: number;
  currentTaskIndex?: number;
  completedCount?: number;
  completedTaskCount?: number;
  completedTaskIds?: string[];
  totalTasks: number;
  totalTaskCount?: number;
  completed: boolean;
  taskStatus?: string;
  status?: string;
  assignedTs?: string;
  totalEarned: number;
  progressState?: { totalEarned?: number };
  commissionRate?: number;
  createdAt: string;
  updatedAt?: string;
}

export function useTaskSessions(userId?: string) {
  const state = useApiData<ApiTaskSession[]>(async () => {
    const path = userId ? `/api/task-sessions?userId=${userId}` : "/api/task-sessions";
    const res = await api.get<{ success: boolean; data: ApiTaskSession[] }>(path);
    return res.data ?? [];
  }, [userId], {
    realtimeCollections: ["taskSessions"],
    ...(userId ? { initialData: [] } : {}),
  });
  return { ...state, data: state.data ?? [] };
}

export function useActiveTaskSession(userId?: string) {
  return useApiData<{ data: ApiTaskSession | null; requestRequired: boolean }>(async () => {
    if (!userId) return { data: null, requestRequired: false };
    const res = await cachedFetch(`taskSession:${userId}`, () =>
      api.get<{ success: boolean; data: ApiTaskSession | null; requestRequired?: boolean }>(
        `/api/task-sessions/${encodeURIComponent(userId)}`,
      )
    );
    return { data: res.data ?? null, requestRequired: res.requestRequired === true };
  }, [userId], { realtimeCollections: ["taskSessions"] });
}

export function useTaskSessionsPage(pageSize = 25, params: PaginationParams = {}) {
  return usePaginatedApiData<ApiTaskSession>(
    async cursor => {
      const res = await api.get<PaginatedResponse<ApiTaskSession>>(`/api/task-sessions${toQueryString({ pageSize, ...params, cursor })}`);
      return { data: res.data ?? [], hasMore: Boolean(res.hasMore), nextCursor: res.nextCursor ?? null };
    },
    [pageSize, JSON.stringify(params)],
    ["taskSessions"],
  );
}

export async function saveTaskSession(session: Omit<ApiTaskSession, "createdAt" | "updatedAt">): Promise<ApiTaskSession> {
  const res = await api.post<{ success: boolean; data: ApiTaskSession }>("/api/task-sessions", session);
  return res.data;
}

export async function updateTaskSession(sessionId: string, patch: Partial<ApiTaskSession>): Promise<ApiTaskSession> {
  const res = await api.put<{ success: boolean; data: ApiTaskSession }>(`/api/task-sessions/${sessionId}`, patch);
  return res.data;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface ApiNotification {
  [key: string]: unknown;
  id: string;
  userId?: string;
  title: string;
  message: string;
  body?: string;
  type: string;
  broadcast?: boolean;
  target?: string;
  targetName?: string;
  sentAt?: string;
  scheduled?: boolean;
  scheduledFor?: string;
  status?: string;
  read?: boolean;
  is_deleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function useNotifications(userId?: string) {
  const state = useApiData<ApiNotification[]>(async () => {
    // Read from userNotifications (fan-out collection) when userId is provided
    if (userId) {
      const res = await api.get<{ success: boolean; data: ApiNotification[] }>(
        `/api/user-notifications?userId=${encodeURIComponent(userId)}`,
      );
      return res.data ?? [];
    }
    const path = "/api/notifications";
    const res = await api.get<{ success: boolean; data: ApiNotification[] }>(path);
    return res.data ?? [];
  }, [userId], { realtimeCollections: ["userNotifications", "notifications"] });
  return { ...state, data: state.data ?? [] };
}

export function useNotificationsPage(pageSize = 25, params: PaginationParams = {}) {
  const userId = (params as { userId?: string }).userId;
  return usePaginatedApiData<ApiNotification>(
    async cursor => {
      if (userId) {
        const res = await api.get<PaginatedResponse<ApiNotification>>(
          `/api/user-notifications${toQueryString({ pageSize, cursor, userId })}`,
        );
        return { data: res.data ?? [], hasMore: Boolean(res.hasMore), nextCursor: res.nextCursor ?? null };
      }
      const res = await api.get<PaginatedResponse<ApiNotification>>(`/api/notifications${toQueryString({ pageSize, ...params, cursor })}`);
      return { data: res.data ?? [], hasMore: Boolean(res.hasMore), nextCursor: res.nextCursor ?? null };
    },
    [pageSize, JSON.stringify(params)],
    ["userNotifications", "notifications"],
  );
}

/**
 * Shows a toast whenever a new notification for the current user arrives.
 * Tracks the last-seen newest notification id so it only fires on genuinely
 * new items (not on mount or refetch of already-known notifications).
 */
export function useNewNotificationToast(userId: string | null) {
  const { data: notifications = [] } = useNotifications(userId ?? undefined);
  const lastSeenNewestIdRef = useRef<string | null>(null);

  useEffect(() => {
    const visible = (notifications as ApiNotification[])
      .filter(n => !n.is_deleted)
      .sort((a, b) => String(b.sentAt || b.createdAt || "").localeCompare(String(a.sentAt || a.createdAt || "")));
    const newest = visible[0];
    if (!newest) return;
    if (lastSeenNewestIdRef.current === null) {
      // First load: seed the tracker without firing a toast.
      lastSeenNewestIdRef.current = newest.id;
      return;
    }
    if (newest.id !== lastSeenNewestIdRef.current) {
      lastSeenNewestIdRef.current = newest.id;
      if (!newest.read) {
        toast({
          title: newest.title || "New notification",
          description: newest.message || newest.body || undefined,
          variant: "default",
        });
      }
    }
  }, [notifications, userId]);
}

export async function submitNotification(notif: Omit<ApiNotification, "createdAt" | "updatedAt">): Promise<ApiNotification> {
  const res = await api.post<{ success: boolean; data: ApiNotification }>("/api/notifications", notif, { requiresAdmin: true });
  return res.data;
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/api/notifications/${id}`, { requiresAdmin: true });
}

// ─── Withdrawal status ────────────────────────────────────────────────────────

export interface ApiWithdrawalStatus {
  withdrawal_allowed: boolean;
  required_count: number;
  completed_count: number;
  remaining_count: number;
  reason?: string;
  assignment_id?: string;
  assignment_type?: string;
  code?: string | null;
}

export async function getWithdrawalStatus(userId: string): Promise<ApiWithdrawalStatus> {
  const res = await api.get<ApiWithdrawalStatus | { success: boolean; data: ApiWithdrawalStatus }>(
    `/api/user/withdrawal-status?userId=${userId}`,
  );
  return "data" in res ? res.data : res;
}

// ─── Task completions ─────────────────────────────────────────────────────────

export interface ApiTaskCompletion {
  userId: string;
  platformId: string;
  taskIndex: number;
  earned: number;
  completedAt: string;
}

export async function submitTaskCompletion(completion: ApiTaskCompletion): Promise<void> {
  await api.post("/api/user/task-completions", completion);
}

// --- Admin user controls ---

export interface ApiUserWalletAssignment {
  id: string;
  userId: string;
  walletId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiUserPackageControl {
  id: string;
  userId: string;
  codes: { amazon: number; aliexpress: number; alibaba: number };
  isLocked?: boolean;
  unlockRequested?: boolean;
  unlockedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function useUserWalletAssignments() {
  return useFirebaseCollection<ApiUserWalletAssignment>("userWalletAssignments");
}

export function useUserPackageControls() {
  return useFirebaseCollection<ApiUserPackageControl>("userPackageControls");
}

export async function saveUserWalletAssignment(
  userId: string,
  walletId: string,
): Promise<ApiUserWalletAssignment> {
  return saveGenericFirebaseDoc("userWalletAssignments", userId, {
    id: userId,
    userId,
    walletId,
  });
}

export async function saveUserPackageControl(
  userId: string,
  patch: Partial<ApiUserPackageControl>,
): Promise<ApiUserPackageControl> {
  const existing = await getFirebaseDoc<ApiUserPackageControl>("userPackageControls", userId);
  return saveGenericFirebaseDoc("userPackageControls", userId, {
    id: userId,
    userId,
    codes: existing?.codes ?? { amazon: 0, aliexpress: 0, alibaba: 0 },
    isLocked: existing?.isLocked ?? false,
    ...patch,
  });
}
