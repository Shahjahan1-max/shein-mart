import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, SectionCard, StatusBadge, statusToneFor } from "../../components/super-admin/SuperAdminUi";
import { ALL_ROLES, PERMISSION_GROUPS, ROLE_DEFINITIONS } from "../../data/superAdminData";
import type { SuperAdminRole } from "../../types/super-admin";
import { api } from "../../lib/apiClient";
import { useAdmin } from "../../contexts/AdminContext";
import { useAuth } from "../../contexts/AuthContext";
import { startImpersonationSession } from "../../components/ImpersonationBanner";
import { purgeUserData } from "../../hooks/useApi";
import {
  Users,
  Search,
  UserCheck,
  Trash2,
  ShieldCheck,
  RefreshCw,
  Download,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle,
  Lock,
} from "lucide-react";

const ROLE_DOT: Record<string, string> = {
  purple: "bg-purple-500",
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  orange: "bg-orange-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

interface UserItem {
  id: string;
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  country?: string;
  role?: string;
  status?: string;
  joined?: string;
  createdAt?: string;
  tasksDone?: number;
  completedTasksCount?: number;
  balance?: number;
  earnings?: number;
  referralCode?: string;
  referredBy?: string;
  withdrawWallet?: string;
  withdrawalWallet?: string;
  withdrawWalletProtocol?: string;
  withdrawalWalletProtocol?: string;
  walletLocked?: boolean;
  withdrawalWalletLocked?: boolean;
}

const FALLBACK_USERS: UserItem[] = [
  { id: "usr-1", name: "Ahmed Raza", username: "ahmed", email: "ahmed@example.com", role: "user", status: "active", createdAt: "2026-05-12", tasksDone: 482, balance: 12450, earnings: 1200 },
  { id: "usr-2", name: "Sana Malik", username: "sana", email: "sana@example.com", role: "seller", status: "active", createdAt: "2026-04-02", tasksDone: 120, balance: 89000, earnings: 5400 },
  { id: "usr-3", name: "Bilal Khan", username: "bilal", email: "bilal@example.com", role: "user", status: "suspended", createdAt: "2026-06-20", tasksDone: 210, balance: 0, earnings: 300 },
  { id: "usr-4", name: "Zainab Ali", username: "zainab", email: "zainab@example.com", role: "user", status: "pending", createdAt: "2026-08-01", tasksDone: 0, balance: 500, earnings: 0 },
  { id: "usr-5", name: "Omar Sheikh", username: "omar", email: "omar@example.com", role: "seller", status: "pending", createdAt: "2026-07-28", tasksDone: 0, balance: 0, earnings: 0 },
];

/* ── CSV Export Helpers ──────────────────────────────────────────── */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = String(val).trim();
  if (/^[=+@-]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadUsersCsv(usersToExport: UserItem[]) {
  const headers = [
    "User ID",
    "Full Name",
    "Email",
    "Phone",
    "Country",
    "Role",
    "Status",
    "Balance (USDT)",
    "Earnings (USDT)",
    "Tasks Completed",
    "Referral Code",
    "Referred By",
    "Wallet Address",
    "Wallet Protocol",
    "Wallet Locked",
    "Registration Date",
  ];

  const rows = usersToExport.map(u => {
    const wallet = u.withdrawWallet || u.withdrawalWallet || "";
    const protocol = u.withdrawWalletProtocol || u.withdrawalWalletProtocol || (wallet ? "TRC20" : "");
    const locked = u.walletLocked === true || u.withdrawalWalletLocked === true ? "Yes" : "No";
    const regDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : u.joined || "";

    return [
      escapeCsvValue(u.id),
      escapeCsvValue(u.name || u.username || ""),
      escapeCsvValue(u.email || ""),
      escapeCsvValue(u.phone || ""),
      escapeCsvValue(u.country || ""),
      escapeCsvValue(u.role || "user"),
      escapeCsvValue(u.status || "active"),
      escapeCsvValue((u.balance ?? 0).toFixed(2)),
      escapeCsvValue((u.earnings ?? 0).toFixed(2)),
      escapeCsvValue(u.completedTasksCount ?? u.tasksDone ?? 0),
      escapeCsvValue(u.referralCode || ""),
      escapeCsvValue(u.referredBy || ""),
      escapeCsvValue(wallet),
      escapeCsvValue(protocol),
      escapeCsvValue(locked),
      escapeCsvValue(regDate),
    ].join(",");
  });

  const csvContent = "\ufeff" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `dealxstocks_users_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ── Delete User Data Modal (Granular & Complete Deletion) ───────── */
interface DeleteUserDataModalProps {
  users: UserItem[];
  onClose: () => void;
  onSuccess: (deletedUserIds: string[], isCompleteDelete: boolean) => void;
}

function DeleteUserDataModal({ users: targetUsers, onClose, onSuccess }: DeleteUserDataModalProps) {
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["all"]);
  const [confirmInput, setConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCompleteDelete = selectedScopes.includes("all") || selectedScopes.includes("user");
  const isMultiple = targetUsers.length > 1;

  function toggleScope(scope: string) {
    if (scope === "all") {
      if (selectedScopes.includes("all")) {
        setSelectedScopes([]);
      } else {
        setSelectedScopes(["all", "transactions", "records", "menu", "support"]);
      }
      return;
    }

    let next = selectedScopes.filter(s => s !== "all");
    if (next.includes(scope)) {
      next = next.filter(s => s !== scope);
    } else {
      next.push(scope);
    }
    if (["transactions", "records", "menu", "support"].every(s => next.includes(s))) {
      next = ["all", "transactions", "records", "menu", "support"];
    }
    setSelectedScopes(next);
  }

  async function handleDelete() {
    if (selectedScopes.length === 0) {
      setError("Please select at least one data category to delete.");
      return;
    }
    if (isCompleteDelete && confirmInput.trim().toUpperCase() !== "DELETE") {
      setError("Please type DELETE to confirm permanent account deletion.");
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      const userIds = targetUsers.map(u => u.id);
      const res = await purgeUserData(userIds, selectedScopes);
      if (res.success) {
        onSuccess(userIds, isCompleteDelete);
      } else {
        setError("Failed to delete user data.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred while deleting data.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/50 rounded-2xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-slate-900 dark:text-white font-extrabold text-base sm:text-lg">
                {isMultiple ? `Delete Data for ${targetUsers.length} Users` : `Delete Data — ${targetUsers[0].name || targetUsers[0].username || targetUsers[0].id}`}
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                {isMultiple
                  ? `${targetUsers.slice(0, 3).map(u => u.name || u.username || u.id).join(", ")}${targetUsers.length > 3 ? ` +${targetUsers.length - 3} more` : ""}`
                  : `${targetUsers[0].email || targetUsers[0].phone || targetUsers[0].id}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={isDeleting} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning alert */}
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs leading-relaxed flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div>
            <span className="font-bold">Caution:</span> Deleting user data is permanent and real-time across Firebase and the platform. Select the specific data categories you wish to purge.
          </div>
        </div>

        {/* Scope checkboxes */}
        <div className="space-y-2.5">
          <p className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide font-extrabold">
            Select Data to Delete
          </p>

          {/* All Data / Complete Account Deletion */}
          <div
            onClick={() => toggleScope("all")}
            className={`cursor-pointer rounded-xl p-3 border transition-all flex items-start gap-3 ${
              selectedScopes.includes("all")
                ? "bg-red-50/80 dark:bg-red-950/30 border-red-300 dark:border-red-800"
                : "bg-slate-50/60 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-red-300"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedScopes.includes("all")}
              onChange={() => {}}
              className="mt-1 rounded border-red-400 text-red-600 focus:ring-red-500 w-4 h-4 pointer-events-none"
            />
            <div>
              <p className="text-xs sm:text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                All Data (Complete User Account Wipeout)
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300">
                  Destructive
                </span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                Completely removes the user profile, credentials, preferences, and all associated transactions, tasks, records, and support logs from Firebase & platform.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {/* Transactions */}
            <div
              onClick={() => toggleScope("transactions")}
              className={`cursor-pointer rounded-xl p-3 border transition-all flex items-start gap-2.5 ${
                selectedScopes.includes("transactions") || selectedScopes.includes("all")
                  ? "bg-purple-50/60 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800"
                  : "bg-slate-50/40 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedScopes.includes("transactions") || selectedScopes.includes("all")}
                onChange={() => {}}
                className="mt-0.5 rounded border-purple-400 text-purple-600 focus:ring-purple-500 w-4 h-4 pointer-events-none"
              />
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-gray-200">Transactions</p>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">Deposits & withdrawals history</p>
              </div>
            </div>

            {/* Task Records */}
            <div
              onClick={() => toggleScope("records")}
              className={`cursor-pointer rounded-xl p-3 border transition-all flex items-start gap-2.5 ${
                selectedScopes.includes("records") || selectedScopes.includes("all")
                  ? "bg-purple-50/60 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800"
                  : "bg-slate-50/40 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedScopes.includes("records") || selectedScopes.includes("all")}
                onChange={() => {}}
                className="mt-0.5 rounded border-purple-400 text-purple-600 focus:ring-purple-500 w-4 h-4 pointer-events-none"
              />
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-gray-200">Task Records & Progress</p>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">Orders, task sessions, ad progress & history</p>
              </div>
            </div>

            {/* Menu & Packages */}
            <div
              onClick={() => toggleScope("menu")}
              className={`cursor-pointer rounded-xl p-3 border transition-all flex items-start gap-2.5 ${
                selectedScopes.includes("menu") || selectedScopes.includes("all")
                  ? "bg-purple-50/60 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800"
                  : "bg-slate-50/40 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedScopes.includes("menu") || selectedScopes.includes("all")}
                onChange={() => {}}
                className="mt-0.5 rounded border-purple-400 text-purple-600 focus:ring-purple-500 w-4 h-4 pointer-events-none"
              />
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-gray-200">Menu & Package Controls</p>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">Assigned packages, locks, wallet bindings</p>
              </div>
            </div>

            {/* Support Data */}
            <div
              onClick={() => toggleScope("support")}
              className={`cursor-pointer rounded-xl p-3 border transition-all flex items-start gap-2.5 ${
                selectedScopes.includes("support") || selectedScopes.includes("all")
                  ? "bg-purple-50/60 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800"
                  : "bg-slate-50/40 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedScopes.includes("support") || selectedScopes.includes("all")}
                onChange={() => {}}
                className="mt-0.5 rounded border-purple-400 text-purple-600 focus:ring-purple-500 w-4 h-4 pointer-events-none"
              />
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-gray-200">Support Data</p>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">Support tickets, chat history & RTDB messages</p>
              </div>
            </div>
          </div>
        </div>

        {/* Safeguard input if complete account deletion is selected */}
        {isCompleteDelete && (
          <div className="space-y-1.5 pt-1 border-t border-gray-100 dark:border-gray-800">
            <label className="text-xs font-bold text-red-600 dark:text-red-400 block">
              Type <span className="font-mono bg-red-100 dark:bg-red-900/60 px-1.5 py-0.5 rounded">DELETE</span> to confirm permanent account deletion:
            </label>
            <input
              type="text"
              placeholder="Type DELETE"
              value={confirmInput}
              onChange={e => setConfirmInput(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700/60 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-2.5 font-medium">
            {error}
          </p>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || selectedScopes.length === 0 || (isCompleteDelete && confirmInput.trim().toUpperCase() !== "DELETE")}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 dark:disabled:bg-red-950/40 rounded-xl transition-colors shadow-sm disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting Data...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Confirm Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function SuperAdminUsers() {
  const { admin } = useAdmin();
  const { startImpersonation } = useAuth();
  const [, setLocation] = useLocation();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [selectedRole, setSelectedRole] = useState<SuperAdminRole>("super_admin");

  // Selection, Export, Purge Modal States
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [purgeModalUsers, setPurgeModalUsers] = useState<UserItem[] | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 4000);
  }

  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const selected = ROLE_DEFINITIONS[selectedRole];

  const fetchUsers = useCallback(async (cursor?: string | null, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const url = `/api/super-admin/users?pageSize=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res = await api.get<{ success: boolean; data: UserItem[]; hasMore?: boolean; nextCursor?: string | null; total?: number }>(url, { requiresAdmin: true });
      if (res.success && Array.isArray(res.data)) {
        setUsers(prev => (append ? [...prev, ...res.data] : res.data));
        setHasMore(Boolean(res.hasMore));
        setNextCursor(res.nextCursor ?? null);
        if (typeof res.total === "number") setTotalCount(res.total);
      } else if (!append) {
        setUsers(FALLBACK_USERS);
      }
    } catch {
      if (!append) setUsers(FALLBACK_USERS);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
    const onDataChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ collection?: string }>).detail;
      if (!detail?.collection || detail.collection === "users") {
        void fetchUsers();
      }
    };
    window.addEventListener("ds:data-changed", onDataChanged);
    return () => window.removeEventListener("ds:data-changed", onDataChanged);
  }, [fetchUsers]);

  // Start Audited Impersonation Session
  async function handleStartImpersonation(userItem: UserItem) {
    const targetName = userItem.name || userItem.username || userItem.id;
    const targetEmail = userItem.email || "";

    const adminIdentity = admin || { id: "super_admin", username: "super_admin", role: "super_admin" };
    const ok = await startImpersonation(userItem.id, adminIdentity);
    if (!ok) {
      alert("Unable to load user account portal for impersonation.");
      return;
    }

    try {
      await api.post("/api/super-admin/audit-logs", {
        action: "IMPERSONATION_START",
        targetId: userItem.id,
        details: { targetUserName: targetName, superAdminUsername: admin?.username || "super_admin" },
      }, { requiresAdmin: true }).catch(() => {});
    } catch {}

    startImpersonationSession({
      targetUserId: userItem.id,
      targetUserName: targetName,
      targetUserEmail: targetEmail,
      superAdminUsername: admin?.username || "super_admin",
      startedAt: new Date().toISOString(),
    });

    setLocation("/dashboard");
  }

  const distinctCountries = Array.from(new Set(users.map(u => u.country).filter(Boolean))).sort() as string[];

  const filtered = users.filter(u => {
    const q = query.toLowerCase();
    const text = [
      u.name || "",
      u.email || "",
      u.username || "",
      u.phone || "",
      u.country || "",
      u.withdrawWallet || "",
      u.withdrawalWallet || "",
      u.id || "",
    ].join(" ").toLowerCase();

    const matchesQuery = text.includes(q);
    const matchesStatus = statusFilter === "all" || (u.status || "active") === statusFilter;
    const matchesCountry = countryFilter === "all" || u.country === countryFilter;
    return matchesQuery && matchesStatus && matchesCountry;
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every(u => selectedUserIds.has(u.id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedUserIds(new Set());
    } else {
      const next = new Set(selectedUserIds);
      filtered.forEach(u => next.add(u.id));
      setSelectedUserIds(next);
    }
  }

  function toggleSelectUser(id: string) {
    const next = new Set(selectedUserIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUserIds(next);
  }

  function handleExportCsv(onlySelected = false) {
    setIsExporting(true);
    try {
      let listToExport: UserItem[] = [];
      if (onlySelected && selectedUserIds.size > 0) {
        listToExport = users.filter(u => selectedUserIds.has(u.id));
      } else if (filtered.length > 0) {
        listToExport = filtered;
      } else {
        listToExport = users;
      }

      if (listToExport.length === 0) {
        alert("No users available to export.");
        return;
      }

      downloadUsersCsv(listToExport);
      showToast(`Exported ${listToExport.length} user(s) to CSV.`);
    } catch (err) {
      console.error("Export CSV failed:", err);
      alert("Failed to export users CSV.");
    } finally {
      setIsExporting(false);
    }
  }

  function handlePurgeSuccess(deletedUserIds: string[], isCompleteDelete: boolean) {
    if (isCompleteDelete) {
      setSelectedUserIds(prev => {
        const next = new Set(prev);
        deletedUserIds.forEach(id => next.delete(id));
        return next;
      });
    }
    setPurgeModalUsers(null);
    void fetchUsers();
    showToast(`Successfully processed deletion for ${deletedUserIds.length} user(s).`);
  }

  return (
    <SuperAdminLayout title="Users & Role Governance">
      <PageHeader
        title="Users & Role Governance"
        description="Inspect customer accounts, trigger audited impersonation mode, and review the role permission matrix."
        icon={<Users className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportCsv(false)}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 transition-colors shadow-xs disabled:opacity-60"
              title="Export all users to CSV spreadsheet"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => void fetchUsers()}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              title="Refresh users"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        }
      />

      {/* Bulk Action Bar (When 1+ users selected) */}
      {selectedUserIds.size > 0 && (
        <div className="mb-5 p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-between gap-3 flex-wrap animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-extrabold">
              {selectedUserIds.size}
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">
              user{selectedUserIds.size > 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleExportCsv(true)}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export Selected ({selectedUserIds.size})
            </button>
            <button
              onClick={() => {
                const targetList = users.filter(u => selectedUserIds.has(u.id));
                setPurgeModalUsers(targetList);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedUserIds.size})
            </button>
            <button
              onClick={() => setSelectedUserIds(new Set())}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* User Directory Management */}
      <SectionCard
        title="User Directory"
        description={`${users.length} registered accounts · Complete management & deletion controls`}
        icon={<Users className="w-4 h-4" />}
        actions={
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name, email, phone, country…"
                className="pl-9 pr-3 py-1.5 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-60"
              />
            </div>
            {distinctCountries.length > 0 && (
              <select
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-auto font-medium"
              >
                <option value="all">All Countries</option>
                {distinctCountries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-auto font-medium"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        }
      >
        <div className="responsive-table-container">
          <table className="w-full text-sm min-w-[850px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-transparent">
                <th className="w-10 py-3 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer align-middle"
                    title="Select all on this page"
                  />
                </th>
                <th className="py-2.5 pr-3 font-semibold">User</th>
                <th className="py-2.5 pr-3 font-semibold">Role</th>
                <th className="py-2.5 pr-3 font-semibold">Country</th>
                <th className="py-2.5 pr-3 font-semibold">Wallet</th>
                <th className="py-2.5 pr-3 font-semibold">Status</th>
                <th className="py-2.5 pr-3 font-semibold text-center">Tasks Done</th>
                <th className="py-2.5 pr-3 font-semibold text-right">Balance</th>
                <th className="py-2.5 pr-3 font-semibold text-right">Earnings</th>
                <th className="py-2.5 pr-3 font-semibold">Joined</th>
                <th className="py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400 text-sm">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-500" />
                    Loading user accounts…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400 text-sm font-medium">
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map(u => {
                  const status = u.status || "active";
                  const nameStr = u.name || u.username || "User";
                  const wallet = u.withdrawWallet || u.withdrawalWallet || "";
                  const protocol = u.withdrawWalletProtocol || u.withdrawalWalletProtocol || (wallet ? "TRC20" : "");
                  const isLocked = u.walletLocked === true || u.withdrawalWalletLocked === true;
                  const isSelected = selectedUserIds.has(u.id);

                  return (
                    <tr
                      key={u.id}
                      className={`border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors ${
                        isSelected ? "bg-purple-50/50 dark:bg-purple-950/20" : ""
                      }`}
                    >
                      <td className="w-10 py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(u.id)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer align-middle"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {nameStr.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0 max-w-[180px]">
                            <p className="font-bold text-gray-900 dark:text-white truncate">{nameStr}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email || `@${u.username}`}</p>
                            {u.phone && <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{u.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="capitalize text-gray-700 dark:text-gray-300 text-xs font-semibold">{u.role || "user"}</span>
                      </td>
                      <td className="py-3 pr-3 text-gray-700 dark:text-gray-300 text-xs font-medium">
                        {u.country || "—"}
                      </td>
                      <td className="py-3 pr-3 min-w-[140px] max-w-[190px]">
                        {wallet ? (
                          <div>
                            <p className="text-xs font-mono font-semibold text-gray-800 dark:text-gray-200 truncate" title={wallet}>
                              {wallet}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                              {protocol} {isLocked && <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400"><Lock className="w-2.5 h-2.5" />Locked</span>}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={status} tone={statusToneFor(status)} />
                      </td>
                      <td className="py-3 pr-3 text-center text-gray-700 dark:text-gray-300 font-semibold tabular-nums text-xs">
                        {(u.completedTasksCount ?? u.tasksDone ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 pr-3 text-right font-bold text-gray-900 dark:text-white tabular-nums text-xs">
                        ${(u.balance ?? 0).toFixed(2)}
                      </td>
                      <td className="py-3 pr-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-xs">
                        ${(u.earnings ?? 0).toFixed(2)}
                      </td>
                      <td className="py-3 pr-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : u.joined || "N/A"}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => void handleStartImpersonation(u)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                            title="Audited View as User Session"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">View as User</span>
                          </button>
                          <button
                            onClick={() => setPurgeModalUsers([u])}
                            className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 transition-colors"
                            title="Delete User / Purge Data"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
            <span className="text-xs text-gray-500 font-medium">
              Showing {users.length}{totalCount ? ` of ${totalCount}` : ""} accounts
            </span>
            <button
              onClick={() => void fetchUsers(nextCursor, true)}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-semibold text-xs hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-50"
            >
              {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Load Next 50 Accounts
            </button>
          </div>
        )}
      </SectionCard>

      {/* Role permission matrix */}
      <div className="mt-6">
        <PageHeader
          title="Role & Permission Matrix"
          description="Select a role to review its granted permissions. Least-privilege enforced by default."
          icon={<ShieldCheck className="w-5 h-5" />}
        />

        <div className="grid lg:grid-cols-4 gap-6">
          <SectionCard title="System Roles" padded={false}>
            <div className="p-2 space-y-1">
              {ALL_ROLES.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRole(r.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
                    selectedRole === r.id
                      ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-semibold"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${ROLE_DOT[r.color] ?? "bg-gray-500"} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{r.description}</p>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 flex-shrink-0">L{r.level}</span>
                </button>
              ))}
            </div>
          </SectionCard>

          <div className="lg:col-span-3">
            <SectionCard
              title={selected.name}
              description={selected.description}
              icon={<ShieldCheck className="w-4 h-4" />}
              actions={<StatusBadge status={selected.permissions.length + " permissions"} tone="purple" />}
            >
              <div className="space-y-5">
                {PERMISSION_GROUPS.map(group => {
                  const granted = group.permissions.filter(p => selected.permissions.includes(p.key));
                  if (granted.length === 0) return null;
                  return (
                    <div key={group.label}>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{group.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.permissions.map(p => {
                          const has = selected.permissions.includes(p.key);
                          return (
                            <span
                              key={p.key}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                                has
                                  ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                                  : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500"
                              }`}
                            >
                              {has && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
                              {p.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      {/* ── Granular & Complete Data Purge Modal (Super Admin Exclusive) ── */}
      {purgeModalUsers && (
        <DeleteUserDataModal
          users={purgeModalUsers}
          onClose={() => setPurgeModalUsers(null)}
          onSuccess={handlePurgeSuccess}
        />
      )}

      {/* Feedback Toast */}
      {feedbackToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 animate-fadeIn flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {feedbackToast}
        </div>
      )}
    </SuperAdminLayout>
  );
}
