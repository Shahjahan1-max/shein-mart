import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import type { AdminUser } from "./AdminContext";
import { apiUrl, getFirebaseDoc, saveFirebaseDoc, storeUserSession, clearUserSession, authHeaders } from "../lib/apiClient";

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  country?: string;
  profileImage?: string;
  referralCode: string;
  referredBy?: string;
  referredByUserId?: string;
  referralCodeUsed?: string;
  balance: number;
  bonusBalance?: number;
  signupBonusApplied?: boolean;
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
  status?: string;
  createdAt: string;
  /* Impersonation metadata â€” present only during admin sessions */
  _impersonated?: boolean;
  _adminId?: string;
  _adminUsername?: string;
  _sessionId?: string;
  _expiresAt?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (partial: Partial<User>) => Promise<void>;
  startImpersonation: (targetUserId: string, admin: AdminUser) => Promise<boolean>;
  exitImpersonation: () => void;
  isImpersonating: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  country?: string;
  referralCode?: string;
}

const STORAGE_KEY = "ds_auth_user";
const ADMIN_BACKUP_KEY = "ds_impersonation_admin_backup";
const IMPERSONATION_TTL_MS = 60 * 60 * 1000;
const AUTH_REQUEST_TIMEOUT_MS = 25_000;
const USER_LOOKUP_TIMEOUT_MS = 12_000;

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function applyAdminOverride(user: User): User {
  return user;
}

function asNumber(value: unknown, fallback: number | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function mergeServerUser(current: User, serverUser: Record<string, unknown>): User {
  return {
    ...current,
    id: String(serverUser.id ?? current.id),
    email: String(serverUser.email ?? current.email ?? ""),
    name: String(serverUser.name ?? current.name ?? ""),
    phone: serverUser.phone ? String(serverUser.phone) : current.phone,
    country: serverUser.country ? String(serverUser.country) : current.country,
    profileImage: serverUser.profileImage ? String(serverUser.profileImage) : current.profileImage,
    referralCode: String(serverUser.referralCode ?? serverUser.referral_code ?? current.referralCode ?? ""),
    referredBy: serverUser.referredBy ? String(serverUser.referredBy) : current.referredBy,
    referredByUserId: serverUser.referredByUserId ? String(serverUser.referredByUserId) : current.referredByUserId,
    referralCodeUsed: serverUser.referralCodeUsed ? String(serverUser.referralCodeUsed) : current.referralCodeUsed,
    balance: asNumber(serverUser.balance, current.balance) ?? 0,
    bonusBalance: asNumber(serverUser.bonusBalance, current.bonusBalance),
    signupBonusApplied: typeof serverUser.signupBonusApplied === "boolean" ? serverUser.signupBonusApplied : current.signupBonusApplied,
    earnings: asNumber(serverUser.earnings, current.earnings),
    withdrawalWallet: String(serverUser.withdrawalWallet ?? serverUser.withdrawWallet ?? current.withdrawalWallet ?? ""),
    withdrawalWalletProtocol: String(serverUser.withdrawalWalletProtocol ?? serverUser.withdrawWalletProtocol ?? current.withdrawalWalletProtocol ?? "TRC20"),
    withdrawalWalletLocked: typeof serverUser.withdrawalWalletLocked === "boolean"
      ? serverUser.withdrawalWalletLocked
      : typeof serverUser.walletLocked === "boolean" ? serverUser.walletLocked : current.withdrawalWalletLocked,
    withdrawalWalletUpdatedAt: serverUser.withdrawalWalletUpdatedAt
      ? String(serverUser.withdrawalWalletUpdatedAt)
      : serverUser.walletUpdatedAt ? String(serverUser.walletUpdatedAt) : current.withdrawalWalletUpdatedAt,
    withdrawalWalletUpdatedBy: serverUser.withdrawalWalletUpdatedBy
      ? String(serverUser.withdrawalWalletUpdatedBy)
      : serverUser.walletUpdatedBy ? String(serverUser.walletUpdatedBy) : current.withdrawalWalletUpdatedBy,
    status: serverUser.status ? String(serverUser.status) : current.status,
    createdAt: String(serverUser.createdAt ?? serverUser.created_at ?? current.createdAt),
  };
}

export function normalizeUserSnapshot(user: User): User {
  return {
    ...user,
    balance: Math.max(0, asNumber(user.balance, 0) ?? 0),
    bonusBalance: Math.max(0, asNumber(user.bonusBalance, 0) ?? 0),
    signupBonusApplied: user.signupBonusApplied === true,
    earnings: Math.max(0, asNumber(user.earnings, 0) ?? 0),
  };
}

async function loadUserFromApi(userId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(apiUrl(`/api/users/${encodeURIComponent(userId)}`), {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      signal: AbortSignal.timeout(USER_LOOKUP_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const entry = await res.json();
    return entry?.id ? entry : null;
  } catch {
    return null;
  }
}

async function loadUserByEmailFromApi(email: string): Promise<Record<string, unknown> | null> {
  const trimmedEmail = String(email || "").trim();
  if (!trimmedEmail) return null;
  try {
    const res = await fetch(apiUrl(`/api/users/by-email?email=${encodeURIComponent(trimmedEmail)}`), {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      signal: AbortSignal.timeout(USER_LOOKUP_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const entry = await res.json();
    return entry?.id ? entry : null;
  } catch {
    return null;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function waitForUserByEmailFromApi(email: string): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const user = await loadUserByEmailFromApi(email);
    if (user?.id) return user;
    await wait(600);
  }
  return null;
}

function sameEmail(a: unknown, b: unknown): boolean {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

export function generateReferralCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function loadUserForImpersonation(userId: string): Promise<User | null> {
  const entry = await loadUserFromApi(userId);
  if (!entry?.id) return null;
  try {
    return {
      id: String(entry.id),
      email: String(entry.email ?? ""),
      name: String(entry.name ?? ""),
      phone: entry.phone ? String(entry.phone) : undefined,
      country: entry.country ? String(entry.country) : undefined,
      profileImage: entry.profileImage ? String(entry.profileImage) : undefined,
      referralCode: String(entry.referralCode ?? ""),
      referredBy: entry.referredBy ? String(entry.referredBy) : undefined,
      balance: asNumber(entry.balance, 0) ?? 0,
      earnings: asNumber(entry.earnings, 0) ?? 0,
      withdrawWallet: entry.withdrawWallet ? String(entry.withdrawWallet) : undefined,
      withdrawWalletProtocol: entry.withdrawWalletProtocol ? String(entry.withdrawWalletProtocol) : undefined,
      walletLocked: typeof entry.walletLocked === "boolean" ? entry.walletLocked : undefined,
      walletUpdatedAt: entry.walletUpdatedAt ? String(entry.walletUpdatedAt) : undefined,
      walletUpdatedBy: entry.walletUpdatedBy ? String(entry.walletUpdatedBy) : undefined,
      withdrawalWallet: entry.withdrawalWallet ? String(entry.withdrawalWallet) : undefined,
      withdrawalWalletProtocol: entry.withdrawalWalletProtocol ? String(entry.withdrawalWalletProtocol) : undefined,
      withdrawalWalletLocked: typeof entry.withdrawalWalletLocked === "boolean" ? entry.withdrawalWalletLocked : undefined,
      withdrawalWalletUpdatedAt: entry.withdrawalWalletUpdatedAt ? String(entry.withdrawalWalletUpdatedAt) : undefined,
      withdrawalWalletUpdatedBy: entry.withdrawalWalletUpdatedBy ? String(entry.withdrawalWalletUpdatedBy) : undefined,
      createdAt: String(entry.createdAt ?? new Date().toISOString()),
    };
  } catch { return null; }
}

interface ImpersonationSessionDoc {
  id: string;
  adminId: string;
  adminUsername: string;
  userId: string;
  userName: string;
  userEmail: string;
  startedAt: string;
  expiresAt: string;
  endedAt?: string | null;
  revoked?: boolean;
}

function createFirebaseImpersonationSession(adminId: string, adminUsername: string, target: User): ImpersonationSessionDoc {
  const now = new Date();
  const session: ImpersonationSessionDoc = {
    id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    adminId,
    adminUsername,
    userId: target.id,
    userName: target.name,
    userEmail: target.email,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + IMPERSONATION_TTL_MS).toISOString(),
    endedAt: null,
    revoked: false,
  };
  void saveFirebaseDoc("impersonationSessions", session.id, session).catch(() => {});
  return session;
}

function saveFirebaseAuditLog(
  adminId: string,
  adminUsername: string,
  userId: string,
  userName: string,
  action: "IMPERSONATE_START" | "IMPERSONATE_END" | "TICKET_DELETE_ADMIN" | "TICKET_DELETE_ON_BEHALF",
  meta?: Record<string, string>,
) {
  const log = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    adminId,
    adminUsername,
    userId,
    userName,
    action,
    meta,
    timestamp: new Date().toISOString(),
  };
  void saveFirebaseDoc("auditLogs", log.id, log).catch(() => {});
}

async function endFirebaseImpersonationSession(sessionId: string) {
  const existing = await getFirebaseDoc<ImpersonationSessionDoc>("impersonationSessions", sessionId);
  if (!existing) return;
  await saveFirebaseDoc("impersonationSessions", sessionId, {
    ...existing,
    endedAt: new Date().toISOString(),
    revoked: true,
  });
}

/** Check if current user session has an active, non-expired impersonation */
function checkImpersonationExpiry(user: User | null): boolean {
  if (!user?._impersonated || !user._sessionId) return false;
  if (!user._expiresAt) return false;
  return new Date(user._expiresAt) > new Date();
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const raw = JSON.parse(stored) as User;
        // Auto-clear expired impersonation sessions on boot
        if (raw._impersonated && raw._expiresAt && new Date(raw._expiresAt) < new Date()) {
          localStorage.removeItem(STORAGE_KEY);
          return { user: null, isLoading: false, isAuthenticated: false };
        }
        const normalized = normalizeUserSnapshot(raw);
        const user = normalized._impersonated ? normalized : applyAdminOverride(normalized);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        return { user, isLoading: true, isAuthenticated: true };
      }
    } catch {}
    return { user: null, isLoading: false, isAuthenticated: false };
  });

  const isImpersonating = !!(state.user?._impersonated && checkImpersonationExpiry(state.user));

  const login = useCallback(async (email: string, password: string) => {
    if (!email || !password) return { success: false, error: "Please fill in all fields." };
    try {
      // â”€â”€ Primary: authenticate via backend API (cross-device) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // This is the production path â€” credentials are stored server-side.
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
        signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
      });

      if (res.ok) {
        const serverUser = await res.json();
        if (serverUser?.id) {
          const user: User = {
            id: serverUser.id,
            email: serverUser.email ?? email,
            name: serverUser.name ?? "",
            phone: serverUser.phone,
            country: serverUser.country,
            profileImage: serverUser.profileImage,
            referralCode: serverUser.referralCode ?? serverUser.referral_code ?? "",
            referredBy: serverUser.referredBy ?? serverUser.referred_by,
            balance: asNumber(serverUser.balance, 0) ?? 0,
            earnings: asNumber(serverUser.earnings, 0) ?? 0,
            withdrawWallet: serverUser.withdrawWallet,
            withdrawWalletProtocol: serverUser.withdrawWalletProtocol,
            walletLocked: serverUser.walletLocked,
            walletUpdatedAt: serverUser.walletUpdatedAt,
            walletUpdatedBy: serverUser.walletUpdatedBy,
            withdrawalWallet: serverUser.withdrawalWallet,
            withdrawalWalletProtocol: serverUser.withdrawalWalletProtocol,
            withdrawalWalletLocked: serverUser.withdrawalWalletLocked,
            withdrawalWalletUpdatedAt: serverUser.withdrawalWalletUpdatedAt,
            withdrawalWalletUpdatedBy: serverUser.withdrawalWalletUpdatedBy,
            status: serverUser.status,
            createdAt: serverUser.createdAt ?? serverUser.created_at ?? new Date().toISOString(),
          };
          const finalUser = applyAdminOverride(user);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(finalUser));
          if (serverUser.sessionToken && serverUser.sessionExpiresAt) {
            storeUserSession(serverUser.sessionToken, serverUser.sessionExpiresAt);
          }
          setState({ user: finalUser, isLoading: false, isAuthenticated: true });
          window.dispatchEvent(new CustomEvent("ds:user-logged-in", { detail: { userId: finalUser.id } }));
          return { success: true };
        }
      }

      if (res.status === 401) {
        const payload = await res.json().catch(() => null);
        return { success: false, error: payload?.error || "Incorrect email or password. Please try again." };
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        return { success: false, error: payload?.error || "Login failed. Please try again." };
      }
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      return {
        success: false,
        error: timedOut
          ? "Login is taking longer than usual. Please try again in a moment."
          : "Unable to reach Firebase backend. Please try again.",
      };
    }
    return { success: false, error: "No account found with this email. Please register first." };
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    if (!data.email || !data.password || !data.name) {
      return { success: false, error: "Please fill in all required fields." };
    }
    try {
      const user: User = {
        id: generateId(),
        email: data.email.toLowerCase().trim(),
        name: data.name,
        phone: data.phone,
        country: data.country,
        referralCode: generateReferralCode(),
        referredBy: data.referralCode?.trim() || undefined,
        balance: 0,
        bonusBalance: 0,
        signupBonusApplied: false,
        createdAt: new Date().toISOString(),
      };

      const completeRegistration = (nextUser: User) => {
        const finalUser = applyAdminOverride(normalizeUserSnapshot(nextUser));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalUser));
        setState({ user: finalUser, isLoading: false, isAuthenticated: true });
        window.dispatchEvent(new CustomEvent("ds:user-logged-in", { detail: { userId: finalUser.id } }));
        window.dispatchEvent(new Event("ds:data-changed"));
        return { success: true };
      };

      // Try to register on the backend first (cross-device persistence)
      try {
        const res = await fetch(apiUrl("/api/auth/register"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            country: user.country,
            referralCode: user.referralCode,
            referredBy: user.referredBy,
            referralCodeUsed: user.referredBy,
            balance: 0,
            bonusBalance: 0,
            signupBonusApplied: false,
            createdAt: user.createdAt,
            password: data.password,
          }),
          signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
        });

        if (res.status === 409) {
          return { success: false, error: "An account with this email already exists. Please log in." };
        }
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          return { success: false, error: payload?.error || "Registration failed on Firebase backend." };
        }
        // If server responded with a user object, use it (server may have adjusted balance etc.)
        const serverUser = await res.json();
        if (serverUser?.id) {
          if (serverUser.sessionToken && serverUser.sessionExpiresAt) {
            storeUserSession(serverUser.sessionToken, serverUser.sessionExpiresAt);
          }
          return completeRegistration(mergeServerUser(user, serverUser));
        }
      } catch (error) {
        const createdUser = await waitForUserByEmailFromApi(user.email);
        if (createdUser?.id) {
          return completeRegistration(mergeServerUser(user, createdUser));
        }
        const timedOut = error instanceof DOMException && error.name === "TimeoutError";
        return {
          success: false,
          error: timedOut
            ? "Registration is taking longer than usual. Please try again in a moment."
            : "Unable to reach Firebase backend. Please try again.",
        };
      }

      return completeRegistration(user);
    } catch {
      return { success: false, error: "Registration failed. Please try again." };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    clearUserSession();
    setState({ user: null, isLoading: false, isAuthenticated: false });
    window.dispatchEvent(new CustomEvent("ds:user-logged-out"));
  }, []);

  const updateUser = useCallback(async (partial: Partial<User>) => {
    let updatedUser: User | null = null;
    let oldBalance: number | undefined;
    setState(prev => {
      if (!prev.user) return prev;
      oldBalance = prev.user.balance;
      const updated = normalizeUserSnapshot({ ...prev.user, ...partial });
      updatedUser = updated;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { ...prev, user: updated };
    });

    const userToSave = updatedUser as User | null;
    if (!userToSave || userToSave._impersonated) return;
    const res = await fetch(apiUrl(`/api/users/${encodeURIComponent(userToSave.id)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(partial),
    });
    if (!res.ok) throw new Error("Failed to save user update.");
    if (partial.balance !== undefined && oldBalance !== partial.balance) {
      window.dispatchEvent(new CustomEvent("ds:balance-changed", {
        detail: { userId: userToSave.id, oldBalance, newBalance: partial.balance },
      }));
    }
    window.dispatchEvent(new Event("ds:data-changed"));
  }, []);

  /** Start impersonating a user â€” call from AdminUsers only */
  const startImpersonation = useCallback(async (targetUserId: string, admin: AdminUser): Promise<boolean> => {
    const adminId = admin.id ?? admin.username;
    const targetUser = await loadUserForImpersonation(targetUserId);
    if (!targetUser) return false;

    // Back up current admin session
    const adminSession = localStorage.getItem("ds_admin_session");
    localStorage.setItem(ADMIN_BACKUP_KEY, JSON.stringify({
      adminSession,
      timestamp: new Date().toISOString(),
    }));

    // Create tracked session
    const session = createFirebaseImpersonationSession(adminId, admin.username, targetUser);

    // Log start
    saveFirebaseAuditLog(adminId, admin.username, targetUser.id, targetUser.name, "IMPERSONATE_START");

    // Build impersonated user object
    const impersonatedUser: User = {
      ...targetUser,
      _impersonated: true,
      _adminId: adminId,
      _adminUsername: admin.username,
      _sessionId: session.id,
      _expiresAt: session.expiresAt,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(impersonatedUser));
    setState({ user: impersonatedUser, isLoading: false, isAuthenticated: true });
    window.dispatchEvent(new CustomEvent("ds:user-logged-in", { detail: { userId: impersonatedUser.id } }));
    return true;
  }, []);

  /** Exit impersonation and return to admin state */
  const exitImpersonation = useCallback(() => {
    const current = state.user;
    if (!current?._impersonated) return;

    // Log end
    saveFirebaseAuditLog(
      current._adminId ?? "",
      current._adminUsername ?? "",
      current.id,
      current.name,
      "IMPERSONATE_END",
    );

    // Mark session ended
    if (current._sessionId) {
      void endFirebaseImpersonationSession(current._sessionId);
    }

    // Clear user session
    localStorage.removeItem(STORAGE_KEY);
    setState({ user: null, isLoading: false, isAuthenticated: false });
    window.dispatchEvent(new CustomEvent("ds:user-logged-out"));

    // Restore admin session
    try {
      const backup = localStorage.getItem(ADMIN_BACKUP_KEY);
      if (backup) {
        const { adminSession } = JSON.parse(backup);
        if (adminSession) localStorage.setItem("ds_admin_session", adminSession);
        localStorage.removeItem(ADMIN_BACKUP_KEY);
      }
    } catch {}
  }, [state.user]);

  // Periodic expiry check â€” auto-exit if session expires
  useEffect(() => {
    if (!isImpersonating) return;
    const check = () => {
      const user = (() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as User | null; } catch { return null; }
      })();
      if (user?._impersonated && user._expiresAt && new Date(user._expiresAt) < new Date()) {
        // Session expired â€” auto exit
        if (user._sessionId) void endFirebaseImpersonationSession(user._sessionId);
        saveFirebaseAuditLog(user._adminId ?? "", user._adminUsername ?? "", user.id, user.name, "IMPERSONATE_END", { reason: "expired" });
        localStorage.removeItem(STORAGE_KEY);
        setState({ user: null, isLoading: false, isAuthenticated: false });
        try {
          const backup = localStorage.getItem(ADMIN_BACKUP_KEY);
          if (backup) {
            const { adminSession } = JSON.parse(backup);
            if (adminSession) localStorage.setItem("ds_admin_session", adminSession);
            localStorage.removeItem(ADMIN_BACKUP_KEY);
          }
        } catch {}
      }
    };
    const interval = setInterval(check, 30000); // check every 30 seconds
    return () => clearInterval(interval);
  }, [isImpersonating]);

  // Re-sync in-memory user whenever ds_auth_user is updated externally
  useEffect(() => {
    function syncFromStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw) as User;
        const normalized = normalizeUserSnapshot(stored);
        setState(prev => {
          if (!prev.user || prev.user.id !== normalized.id) return prev;
          if (JSON.stringify(prev.user) === JSON.stringify(normalized)) return prev;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          return { ...prev, user: normalized };
        });
      } catch {}
    }
    window.addEventListener("storage", syncFromStorage);
    window.addEventListener("ds:data-changed", syncFromStorage);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("ds:data-changed", syncFromStorage);
    };
  }, []);

  // Keep AuthContext fresh when Firebase/API data changes so dashboard balances
  // and profile fields do not stay stuck on the login-time localStorage snapshot.
  useEffect(() => {
    const currentUserId = state.user?.id;
    const currentUserEmail = state.user?.email;
    if (!currentUserId) return;

    let cancelled = false;
    let refreshTimer: number | null = null;
    let inFlight = false;

    const refreshCurrentUser = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(async () => {
        refreshTimer = null;
        if (inFlight) return;
        inFlight = true;
        let serverUser = await loadUserFromApi(currentUserId);
        if (currentUserEmail && serverUser && !sameEmail(serverUser.email, currentUserEmail)) {
          serverUser = await loadUserByEmailFromApi(currentUserEmail);
        } else if (currentUserEmail && !serverUser) {
          serverUser = await loadUserByEmailFromApi(currentUserEmail);
        }
        inFlight = false;
        if (!serverUser || cancelled) {
          if (!cancelled) {
            setState(prev => prev.isLoading ? { ...prev, isLoading: false } : prev);
          }
          return;
        }
        setState(prev => {
          if (!prev.user || prev.user.id !== currentUserId) return prev;
          const updated = mergeServerUser(prev.user, serverUser);
          if (JSON.stringify(prev.user) === JSON.stringify(updated)) {
            return prev.isLoading ? { ...prev, isLoading: false } : prev;
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return { ...prev, user: updated, isLoading: false };
        });
      }, 30);
    };

    refreshCurrentUser();
    
    // Improved event handler with userId filtering
    const handleDataChanged = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      // Refresh user whenever users, deposits, or withdrawals change for this user
      if (
        (detail?.collection === "users" && (!detail?.id || detail?.id === currentUserId)) ||
        ((detail?.collection === "deposits" || detail?.collection === "withdrawals") && (!detail?.userId || detail?.userId === currentUserId))
      ) {
        refreshCurrentUser();
      }
    };
    
    window.addEventListener("ds:data-changed", handleDataChanged);
    // NOTE: "focus" listener intentionally removed — tab focus was causing an API
    // call on every tab switch. The 60s interval below is sufficient since SSE
    // events handle instant user-data updates when admins make changes.
    // Interval: refresh user data every 60s when tab is visible (safety net)
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshCurrentUser();
    }, 60_000);
    return () => {
      cancelled = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      window.removeEventListener("ds:data-changed", handleDataChanged);
      window.clearInterval(interval);
    };
  }, [state.user?.email, state.user?.id]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, updateUser, startImpersonation, exitImpersonation, isImpersonating }}>
      {children}
    </AuthContext.Provider>
  );
}

export { useAuth } from "../hooks/useAuth";

