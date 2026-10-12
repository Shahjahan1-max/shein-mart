/**
 * apiClient.ts — Centralized API client with auth token management.
 *
 * All API calls go through this module. It:
/**
 * apiClient.ts — Centralized API client with auth token management.
 *
 * All API calls go through this module. It:
 * - Attaches admin session token automatically
 * - Handles JSON serialization/deserialization
 * - Provides typed response helpers
 * - Throws on non-OK responses with a structured error
 */


const ADMIN_SESSION_KEY = "ds_admin_session";
const USER_SESSION_KEY = "ds_user_session";
const DEFAULT_PRODUCTION_API_URL = "https://dealxstock-backend.onrender.com";
const DEFAULT_TIMEOUT_MS = 30_000;

function trimApiBaseUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

function getApiBaseUrl(): string {
  const configured = trimApiBaseUrl(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL);

  if (!import.meta.env.PROD) return configured;
  if (!configured) return DEFAULT_PRODUCTION_API_URL;

  try {
    if (typeof window === "undefined") return configured;
    const url = new URL(configured, window.location.origin);
    if (url.origin === window.location.origin) return DEFAULT_PRODUCTION_API_URL;
    return trimApiBaseUrl(url.toString());
  } catch {
    return DEFAULT_PRODUCTION_API_URL;
  }
}

const API_BASE_URL = getApiBaseUrl();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getAdminToken(): string | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const expiresAt = new Date(session?.sessionExpiresAt || "").getTime();
    if (!session?.sessionToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
    return session.sessionToken;
  } catch {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }
}

function clearAdminSessionAfterAuthFailure(path: string) {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin") && !path.includes("/api/admin/login")) {
    window.location.assign("/admin/login");
  }
}

export function getUserSessionToken(): string | null {
  try {
    const raw = localStorage.getItem(USER_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const expiresAt = new Date(session?.sessionExpiresAt || "").getTime();
    if (!session?.sessionToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      localStorage.removeItem(USER_SESSION_KEY);
      return null;
    }
    return session.sessionToken;
  } catch {
    localStorage.removeItem(USER_SESSION_KEY);
    return null;
  }
}

export function storeUserSession(token: string, expiresAt: string) {
  if (!token) return;
  localStorage.setItem(USER_SESSION_KEY, JSON.stringify({ sessionToken: token, sessionExpiresAt: expiresAt }));
}

export function clearUserSession() {
  localStorage.removeItem(USER_SESSION_KEY);
}

export function userSessionAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getUserSessionToken();
  if (token) headers["x-user-session"] = token;
  try {
    const rawUser = localStorage.getItem("ds_auth_user");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u?.id) headers["x-user-id"] = String(u.id);
    }
  } catch {}
  return headers;
}

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { ...userSessionAuthHeaders() };
  const adminToken = getAdminToken();
  if (adminToken) headers["Authorization"] = `Bearer ${adminToken}`;
  return headers;
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: { requiresAdmin?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...userSessionAuthHeaders(),
  };

  // Attach the admin token whenever one is present — admin pages rely on it for
  // admin-scoped endpoints (e.g. /api/users, /api/orders) even without the
  // requiresAdmin flag. requiresAdmin additionally enables 401 redirect behavior.
  const adminToken = getAdminToken();
  if (adminToken) headers["Authorization"] = `Bearer ${adminToken}`;

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("ds_auth_user") || "null") as
        | { _impersonated?: boolean; _sessionId?: string }
        | null;
    } catch {
      return null;
    }
  })();
  if (storedUser?._impersonated && storedUser._sessionId) {
    headers["x-impersonation-session-id"] = storedUser._sessionId;
  }

  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  let responseBody: unknown;
  try {
    responseBody = await res.json();
  } catch {
    responseBody = null;
  }

  if (!res.ok) {
    const errorValue = (responseBody as { error?: unknown })?.error;
    const message =
      (typeof errorValue === "string" ? errorValue : undefined) ??
      (typeof errorValue === "object" && errorValue !== null ? (errorValue as { message?: string }).message : undefined) ??
      (responseBody as { message?: string })?.message ??
      `HTTP ${res.status}`;
    if (options.requiresAdmin && res.status === 401) {
      clearAdminSessionAfterAuthFailure(path);
    }
    if (
      res.status === 401 &&
      storedUser?._impersonated &&
      ((errorValue as { code?: string } | null)?.code === "IMPERSONATION_INVALID" ||
        (responseBody as { code?: string } | undefined)?.code === "IMPERSONATION_INVALID" ||
        String(message).toLowerCase().includes("impersonation session"))
    ) {
      try {
        const u = JSON.parse(localStorage.getItem("ds_auth_user") || "null");
        if (u && typeof u === "object") {
          delete (u as any)._impersonated;
          delete (u as any)._sessionId;
          localStorage.setItem("ds_auth_user", JSON.stringify(u));
        }
      } catch {}
    }
    throw new ApiError(res.status, message, responseBody);
  }

  return responseBody as T;
}

export const api = {
  get: <T>(path: string, opts?: { requiresAdmin?: boolean; timeoutMs?: number }) =>
    request<T>("GET", path, undefined, opts),

  post: <T>(path: string, body: unknown, opts?: { requiresAdmin?: boolean; timeoutMs?: number }) =>
    request<T>("POST", path, body, opts),

  put: <T>(path: string, body: unknown, opts?: { requiresAdmin?: boolean; timeoutMs?: number }) =>
    request<T>("PUT", path, body, opts),

  patch: <T>(path: string, body: unknown, opts?: { requiresAdmin?: boolean; timeoutMs?: number }) =>
    request<T>("PATCH", path, body, opts),

  delete: <T>(path: string, opts?: { requiresAdmin?: boolean; timeoutMs?: number }) =>
    request<T>("DELETE", path, undefined, opts),
};

function enc(value: string): string {
  return encodeURIComponent(value);
}

const ADMIN_ONLY_FIREBASE_COLLECTIONS = new Set([
  "adminSettings",
  "auditLogs",
  "impersonationSessions",
  "passwordResetLogs",
  "passwordResetRequests",
  "settingsDraft",
  "adAssignments",
  "deposits",
  "orders",
  "supportTickets",
  "taskSessions",
  "teams",
  "withdrawals",
  "telemetryEvents",
  "userIntelligenceProfiles",
  "userDevices",
  "telemetryConsents",
  "classificationAuditLogs",
]);
const ADMIN_WRITE_FIREBASE_COLLECTIONS = new Set([
  "settings",
  "adAssignments",
  "deposits",
  "orders",
  "supportTickets",
  "taskCompletions",
  "taskSessions",
  "teams",
  "withdrawals",
  "adCodeOverrides",
  "adGroupCatalog",
  "adRowOverrides",
  "assignedTaskItems",
  "assignedTaskItemOverrides",
  "assetLibrary",
  "backgroundAssets",
  "catalogs",
  "customAdCodes",
  "extraTasks",
  "landingPage",
  "packageCatalog",
  "platformCatalog",
  "platformLogos",
  "platformOverrides",
  "productCatalog",
  "scheduledNotifications",
  "userWalletAssignments",
]);

function firebaseCollectionOptions(collection: string): { requiresAdmin?: boolean } | undefined {
  return ADMIN_ONLY_FIREBASE_COLLECTIONS.has(collection) ? { requiresAdmin: true } : undefined;
}

function firebaseMutationOptions(collection: string): { requiresAdmin?: boolean } | undefined {
  return ADMIN_ONLY_FIREBASE_COLLECTIONS.has(collection) || ADMIN_WRITE_FIREBASE_COLLECTIONS.has(collection)
    ? { requiresAdmin: true }
    : undefined;
}

export async function listFirebaseDocs<T>(collection: string): Promise<T[]> {
  const res = await api.get<{ success: boolean; data: T[] }>(
    `/api/firebase/${enc(collection)}`,
    firebaseCollectionOptions(collection),
  );
  return res.data ?? [];
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore?: boolean;
  nextCursor?: string | null;
  success?: boolean;
}

export interface PaginationParams {
  pageSize?: number;
  cursor?: string | null;
  orderField?: string;
  orderDir?: "asc" | "desc";
  [key: string]: string | number | boolean | null | undefined;
}

export function toQueryString(params: PaginationParams = {}): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export async function listFirebaseDocsPaginated<T>(
  collection: string,
  params: PaginationParams = {},
): Promise<PaginatedResponse<T>> {
  const res = await api.get<PaginatedResponse<T>>(
    `/api/firebase/${enc(collection)}${toQueryString(params)}`,
    firebaseCollectionOptions(collection),
  );
  return {
    data: res.data ?? [],
    hasMore: Boolean(res.hasMore),
    nextCursor: res.nextCursor ?? null,
  };
}

export async function getFirebaseDoc<T>(collection: string, id: string): Promise<T | null> {
  try {
    const res = await api.get<{ success: boolean; data: T }>(
      `/api/firebase/${enc(collection)}/${enc(id)}`,
      firebaseCollectionOptions(collection),
    );
    return res.data ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function saveFirebaseDoc<T extends { id?: string }>(
  collection: string,
  id: string,
  data: T,
): Promise<T> {
  const res = await api.put<{ success: boolean; data: T }>(
    `/api/firebase/${enc(collection)}/${enc(id)}`,
    data,
    firebaseMutationOptions(collection),
  );
  return res.data;
}

export async function addFirebaseDoc<T extends { id?: string }>(
  collection: string,
  data: T,
): Promise<T> {
  const res = await api.post<{ success: boolean; data: T }>(
    `/api/firebase/${enc(collection)}`,
    data,
    firebaseMutationOptions(collection),
  );
  return res.data;
}

export async function deleteFirebaseDoc(collection: string, id: string): Promise<void> {
  await api.delete(`/api/firebase/${enc(collection)}/${enc(id)}`, firebaseMutationOptions(collection));
}
