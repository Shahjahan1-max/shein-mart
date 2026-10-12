import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { LogOut, Clock, ShieldAlert } from "lucide-react";
import { api } from "../lib/apiClient";
import { useAuth } from "../contexts/AuthContext";

export interface ImpersonationState {
  targetUserId: string;
  targetUserName: string;
  targetUserEmail?: string;
  superAdminUsername: string;
  startedAt: string;
}

const STORAGE_KEY = "ds_impersonation_session";

export function getImpersonationSession(): ImpersonationState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ImpersonationState;
  } catch {
    return null;
  }
}

export function startImpersonationSession(session: ImpersonationState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent("ds:impersonation-changed"));
  } catch {}
}

export function endImpersonationSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("ds:impersonation-changed"));
  } catch {}
}

export function ImpersonationBanner() {
  const [, setLocation] = useLocation();
  const { exitImpersonation } = useAuth();
  const [session, setSession] = useState<ImpersonationState | null>(() => getImpersonationSession());

  useEffect(() => {
    const sync = () => setSession(getImpersonationSession());
    window.addEventListener("ds:impersonation-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ds:impersonation-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!session) return null;

  async function handleExit() {
    try {
      // Send audit log event on server
      await api.post("/api/super-admin/audit-logs", {
        action: "IMPERSONATION_END",
        targetId: session?.targetUserId,
        details: { targetUserName: session?.targetUserName, superAdminUsername: session?.superAdminUsername },
      }, { requiresAdmin: true }).catch(() => {});
    } catch {}
    try {
      exitImpersonation();
    } catch {}
    endImpersonationSession();
    setLocation("/super-admin/users");
  }

  return (
    <div className="w-full flex-shrink-0 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold shadow-lg relative z-[9999]">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-full border border-white/20">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-200" />
          <span>Support / Impersonation Mode</span>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="opacity-80">Viewing on behalf of:</span>
          <span className="bg-white/20 px-2 py-0.5 rounded font-bold">{session.targetUserName} ({session.targetUserEmail || session.targetUserId})</span>
        </div>
        <div className="hidden md:flex items-center gap-1 opacity-80">
          <Clock className="w-3 h-3 ml-2" />
          <span>Started: {new Date(session.startedAt).toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden lg:inline text-white/80">Super Admin: <strong>@{session.superAdminUsername}</strong></span>
        <button
          onClick={() => void handleExit()}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-black text-white font-bold transition-all shadow-md active:scale-95"
        >
          <LogOut className="w-3.5 h-3.5" />
          Exit Impersonation
        </button>
      </div>
    </div>
  );
}

export default ImpersonationBanner;
