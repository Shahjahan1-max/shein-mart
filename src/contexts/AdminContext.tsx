import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { apiUrl } from "../lib/apiClient";

export interface AdminUser {
  id?: string;
  username: string;
  email?: string;
  role: string;
  authProvider?: string;
  firebaseIdToken?: string;
  firebaseRefreshToken?: string;
  sessionToken?: string;
  sessionExpiresAt?: string;
}

interface AdminContextValue {
  admin: AdminUser | null;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; admin?: AdminUser }>;
  logout: () => void;
  updateAdminSession: (admin: AdminUser) => void;
}

const STORAGE_KEY = "ds_admin_session";

// Refresh token when less than 1 day remaining (out of 7 days)
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;
// Check every 30 minutes
const REFRESH_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export const AdminContext = createContext<AdminContextValue | null>(null);

type ValidAdminSession = AdminUser & { sessionToken: string; sessionExpiresAt: string };

function hasValidAdminSession(admin: AdminUser | null): admin is ValidAdminSession {
  if (!admin?.sessionToken || !admin.sessionExpiresAt) return false;
  const expiresAt = new Date(admin.sessionExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function readStoredAdminSession(): AdminUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as AdminUser;
    if (hasValidAdminSession(parsed)) return parsed;
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(() => readStoredAdminSession());

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string; admin?: AdminUser }> => {
    const trimmedUsername = username.trim();
    try {
      const res = await fetch(apiUrl("/api/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmedUsername, password }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        const u: AdminUser = data.admin;
        if (!hasValidAdminSession(u)) {
          localStorage.removeItem(STORAGE_KEY);
          setAdmin(null);
          return { success: false, error: "Admin session token was not returned. Please sign in again." };
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
        setAdmin(u);
        return { success: true, admin: u };
      }
      if (res.status === 401) {
        return { success: false, error: "Invalid username or password." };
      }
    } catch {
      return { success: false, error: "Cannot connect to server. Please check your connection." };
    }
    return { success: false, error: "Invalid username or password." };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAdmin(null);
  }, []);

  const updateAdminSession = useCallback((nextAdmin: AdminUser) => {
    if (!hasValidAdminSession(nextAdmin)) {
      localStorage.removeItem(STORAGE_KEY);
      setAdmin(null);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAdmin));
    setAdmin(nextAdmin);
  }, []);

  // Auto-refresh session token before it expires
  useEffect(() => {
    async function tryRefresh(currentAdmin: AdminUser) {
      if (!hasValidAdminSession(currentAdmin)) {
        localStorage.removeItem(STORAGE_KEY);
        setAdmin(null);
        return;
      }
      try {
        const res = await fetch(apiUrl("/api/admin/refresh"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentAdmin.sessionToken}`,
          },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          const refreshed: AdminUser = data.admin;
          if (hasValidAdminSession(refreshed)) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(refreshed));
            setAdmin(refreshed);
          } else {
            localStorage.removeItem(STORAGE_KEY);
            setAdmin(null);
          }
        }
        if (res.status === 401) {
          localStorage.removeItem(STORAGE_KEY);
          setAdmin(null);
        }
      } catch {
        // Silently ignore refresh failures — user will be prompted on next action
      }
    }

    function checkAndRefresh(force = false) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      try {
        const current: AdminUser = JSON.parse(stored);
        if (!hasValidAdminSession(current)) {
          localStorage.removeItem(STORAGE_KEY);
          setAdmin(null);
          return;
        }
        const expiresAt = new Date(current.sessionExpiresAt).getTime();
        const timeLeft = expiresAt - Date.now();
        if (force || (timeLeft > 0 && timeLeft < REFRESH_THRESHOLD_MS)) {
          void tryRefresh(current);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setAdmin(null);
      }
    }

    // Validate immediately on mount so stale localStorage cannot pass as admin.
    checkAndRefresh(true);

    // Then check periodically
    const interval = window.setInterval(() => checkAndRefresh(), REFRESH_CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <AdminContext.Provider value={{ admin, isAdmin: hasValidAdminSession(admin), login, logout, updateAdminSession }}>
      {children}
    </AdminContext.Provider>
  );
}

export { useAdmin } from "../hooks/useAdmin";

