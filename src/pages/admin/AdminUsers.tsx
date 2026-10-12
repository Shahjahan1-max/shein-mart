import { useState } from "react";
import { useLocation } from "wouter";
import AdminLayout from "./AdminLayout";
import { AdminUserRecord, UserStatus, DEFAULT_SETTINGS } from "../../data/adminData";
import type { WalletConfig } from "../../data/adminData";
import { Search, X, Edit2, Ban, CheckCircle, Lock, LockOpen, Package, Users, UserCog, Loader2, Headphones, Download } from "lucide-react";
import { PACKAGES } from "../../data/packagesData";
import { useAuth } from "../../contexts/AuthContext";
import { useAdmin } from "../../contexts/AdminContext";
import { AuditLogPanel } from "./AdminAuditLog";
import {
  useSettings,
  useUserPackageControls,
  useUserWalletAssignments,
  useUsersPage,
  saveUserPackageControl,
  saveUserWalletAssignment,
  updateUser as apiUpdateUser,
  fetchAllUsersForExport,
  type ApiUser,
  type ApiUserPackageControl,
} from "../../hooks/useApi";

function StatusBadge({ status }: { status: UserStatus }) {
  const map: Record<UserStatus, string> = {
    active: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800",
    suspended: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800",
    pending: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${map[status]}`}>
      {status}
    </span>
  );
}

interface PackageCodes { amazon: number; aliexpress: number; alibaba: number; }
const DEFAULT_CODES: PackageCodes = { amazon: 0, aliexpress: 0, alibaba: 0 };
type EditableUserRecord = AdminUserRecord & Partial<ApiUser>;

function getUserCodes(_userId: string): PackageCodes {
  return DEFAULT_CODES;
}
function getUserLocked(_userId: string): boolean {
  return false;
}

function getWithdrawWallet(user: EditableUserRecord): string {
  return String(user.withdrawWallet || user.withdrawalWallet || "").trim();
}

function getWithdrawProtocol(user: EditableUserRecord): string {
  return String(user.withdrawWalletProtocol || user.withdrawalWalletProtocol || "TRC20").trim() || "TRC20";
}

/* ── Edit Modal (Balance + Profile) ──────────────────────────────── */
function EditModal({
  user,
  wallets,
  assignedWalletId: initialAssignedWalletId,
  onClose,
  onSave,
}: {
  user: EditableUserRecord;
  wallets: WalletConfig[];
  assignedWalletId: string;
  onClose: () => void;
  onSave: (u: EditableUserRecord, walletId: string) => Promise<void>;
}) {
  const [balance, setBalance] = useState(String(user.balance));
  const [earnings, setEarnings] = useState(String(user.earnings));
  const [referrals, setReferrals] = useState(String(user.referrals));
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [country, setCountry] = useState(user.country || "");
  const [assignedWalletId, setAssignedWalletId] = useState(initialAssignedWalletId);
  const [withdrawWallet, setWithdrawWallet] = useState(String(user.withdrawWallet || user.withdrawalWallet || ""));
  const [withdrawProtocol, setWithdrawProtocol] = useState(String(user.withdrawWalletProtocol || user.withdrawalWalletProtocol || "TRC20"));
  const [walletLocked, setWalletLocked] = useState(user.walletLocked === true || user.withdrawalWalletLocked === true);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (isSaving) return;
    setIsSaving(true);
    let saved = false;
    try {
      await onSave({
        ...user,
        balance: parseFloat(balance) || 0,
        earnings: parseFloat(earnings) || 0,
        referrals: parseInt(referrals) || 0,
        email: email.trim(),
        phone: phone.trim(),
        country: country.trim(),
        withdrawalWallet: withdrawWallet.trim(),
        withdrawalWalletProtocol: withdrawProtocol.trim() || "TRC20",
        withdrawalWalletLocked: walletLocked,
      }, assignedWalletId);
      saved = true;
      onClose();
    } catch {
      // Parent save handler reports the API error and keeps the modal open.
    } finally {
      if (!saved) setIsSaving(false);
    }
  }

  const inputCls = "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-purple-500 shadow-xs";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-slate-900 dark:text-white font-extrabold text-lg">Edit User — {user.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-900 dark:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          {/* Profile details */}
          <p className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide font-extrabold">Profile Details</p>
          {/* Profile image preview */}
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
            {user.profileImage && typeof user.profileImage === "string" ? (
              <img src={user.profileImage} alt={`${user.name} profile`} className="w-12 h-12 rounded-full object-cover border border-gray-300 dark:border-gray-700" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-purple-700 flex items-center justify-center text-white text-sm font-bold">
                {(user.name ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-slate-900 dark:text-white text-sm font-bold truncate">{user.name}</p>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">{user.profileImage && typeof user.profileImage === "string" ? "Profile image saved" : "Default avatar"}</p>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-gray-300 mb-1 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com"
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-gray-300 mb-1 block">Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000"
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-gray-300 mb-1 block">Country</label>
            <input type="text" value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. United States"
              className={inputCls} />
          </div>
          <hr className="border-slate-200 dark:border-gray-800" />
          {/* Wallet assignment */}
          <p className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide font-extrabold">Deposit Wallet</p>
          {wallets.length === 0 ? (
            <p className="text-xs text-slate-600 dark:text-gray-400 bg-slate-100 dark:bg-gray-800 rounded-xl px-3 py-2 font-medium">
              No wallets configured. Add wallets in Settings → Deposit Wallets first.
            </p>
          ) : (
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-gray-300 mb-1 block">Assigned Deposit Wallet</label>
              <select value={assignedWalletId} onChange={e => setAssignedWalletId(e.target.value)} className={inputCls}>
                <option value="">— Use default (first wallet) —</option>
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.label ? `${w.label} · ` : ""}{w.network} · {w.address.slice(0, 12)}…
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 font-medium">This wallet address will be shown to the user on their deposit page.</p>
            </div>
          )}
          <hr className="border-slate-200 dark:border-gray-800" />
          {/* Withdraw wallet */}
          <p className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide font-extrabold">Withdraw Wallet</p>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-gray-300 mb-1 block">Withdraw Wallet Address</label>
            <input type="text" value={withdrawWallet} onChange={e => setWithdrawWallet(e.target.value)} placeholder="User withdrawal wallet"
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-gray-300 mb-1 block">Withdraw Protocol</label>
            <select value={withdrawProtocol} onChange={e => setWithdrawProtocol(e.target.value)} className={inputCls}>
              <option value="TRC20">TRC20</option>
              <option value="ERC20">ERC20</option>
              <option value="BEP20">BEP20</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-gray-300">
            <input type="checkbox" checked={walletLocked} onChange={e => setWalletLocked(e.target.checked)}
              className="rounded border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800" />
            Lock withdraw wallet for user panel
          </label>
          <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Admins can update this wallet here. Users cannot change it after it is locked.</p>
          <hr className="border-slate-200 dark:border-gray-800" />
          {/* Financial details */}
          <p className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide font-extrabold">Financials</p>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-gray-300 mb-1 block">Balance (USDT)</label>
            <input type="number" value={balance} onChange={e => setBalance(e.target.value)} min="0" step="0.01"
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-gray-300 mb-1 block">Total Earnings (USDT)</label>
            <input type="number" value={earnings} onChange={e => setEarnings(e.target.value)} min="0" step="0.01"
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-gray-300 mb-1 block">Referral Count</label>
            <input type="number" value={referrals} onChange={e => setReferrals(e.target.value)} min="0"
              className={inputCls} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-white font-bold rounded-xl py-2.5 text-sm transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold rounded-xl py-2.5 text-sm transition-colors">{isSaving ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Package Control Modal ─────────────────────────────────────────── */
function PackageControlModal({
  user,
  control,
  onClose,
  onSaveControl,
}: {
  user: AdminUserRecord;
  control?: ApiUserPackageControl;
  onClose: () => void;
  onSaveControl: (patch: Partial<ApiUserPackageControl>) => Promise<void>;
}) {
  const [codes, setCodes] = useState<PackageCodes>(() => control?.codes ?? DEFAULT_CODES);
  const [isLocked, setIsLocked] = useState(() => control?.isLocked ?? false);
  const [unlockSuccess, setUnlockSuccess] = useState(false);
  const [saved, setSaved] = useState(false);

  const platformOptions = [
    { key: "amazon" as const, label: "Amazon", color: "text-orange-500" },
    { key: "aliexpress" as const, label: "AliExpress", color: "text-red-500" },
    { key: "alibaba" as const, label: "Alibaba", color: "text-purple-600" },
  ];

  async function handleManualUnlock() {
    await onSaveControl({ isLocked: false, unlockRequested: true, unlockedAt: new Date().toISOString() });
    setIsLocked(false);
    setUnlockSuccess(true);
    setTimeout(() => setUnlockSuccess(false), 2500);
  }

  async function handleSaveCodes() {
    await onSaveControl({ codes, isLocked });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const activePackages = PACKAGES.filter(p => p.status === "active");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            <h2 className="text-slate-900 dark:text-white font-extrabold text-base">Task & Code Control — {user.name}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-900 dark:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Lock status banner */}
        <div className={`p-4 rounded-xl mb-5 border ${isLocked ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" : "bg-emerald-50 dark:bg-green-950/30 border-emerald-200 dark:border-green-800"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isLocked
                ? <Lock className="w-5 h-5 text-red-600" />
                : <LockOpen className="w-5 h-5 text-emerald-600" />
              }
              <div>
                <p className={`font-extrabold text-sm ${isLocked ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-green-400"}`}>
                  {isLocked ? "Tasks Currently Locked" : "Tasks Unlocked (Free Session)"}
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">
                  {isLocked ? "User must enter all 3 correct codes to unlock." : "User can complete tasks freely without entering codes."}
                </p>
              </div>
            </div>
            {isLocked && (
              <button
                onClick={handleManualUnlock}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 flex-shrink-0"
              >
                <LockOpen className="w-3.5 h-3.5" /> Unlock Now
              </button>
            )}
          </div>
          {unlockSuccess && (
            <p className="text-xs text-emerald-600 dark:text-green-400 font-bold mt-2 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Tasks manually unlocked! User can now continue tasks.
            </p>
          )}
        </div>

        {/* Toggle Lock state */}
        <div className="mb-5 flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700">
          <div>
            <p className="text-slate-900 dark:text-white text-sm font-bold">Lock Tasks for User</p>
            <p className="text-slate-500 dark:text-gray-400 text-xs font-medium">When ON, user gets prompted for special codes</p>
          </div>
          <input
            type="checkbox"
            checked={isLocked}
            onChange={e => setIsLocked(e.target.checked)}
            className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
          />
        </div>

        {/* Assign codes */}
        <p className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide font-extrabold mb-3">
          Required Product Codes (3 digits each)
        </p>
        <div className="space-y-3 mb-6">
          {platformOptions.map(p => (
            <div key={p.key} className="flex items-center justify-between bg-slate-50 dark:bg-gray-800/60 p-3 rounded-xl border border-slate-200 dark:border-gray-700">
              <span className={`text-sm font-bold ${p.color}`}>{p.label}</span>
              <input
                type="number"
                min="0"
                max="999"
                value={codes[p.key] || ""}
                onChange={e => setCodes(prev => ({ ...prev, [p.key]: parseInt(e.target.value) || 0 }))}
                placeholder="e.g. 749"
                className="w-24 bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white text-sm font-bold text-center focus:outline-none focus:border-purple-500"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-white font-bold rounded-xl py-2.5 text-sm transition-colors">Close</button>
          <button
            onClick={handleSaveCodes}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : "Save Codes"}
          </button>
        </div>
      </div>
    </div>
  );
}


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

function downloadUsersCsv(usersList: EditableUserRecord[], allLoadedUsers: EditableUserRecord[]) {
  const headers = [
    "User ID",
    "Full Name",
    "Email",
    "Phone",
    "Country",
    "Status",
    "Balance (USDT)",
    "Earnings (USDT)",
    "Direct Referrals",
    "Team Earnings (USDT)",
    "Referral Code",
    "Referred By",
    "Wallet Address",
    "Wallet Protocol",
    "Wallet Locked",
    "Registration Date",
    "Last Active",
  ];

  const rows = usersList.map(u => {
    const members = allLoadedUsers.filter(item => item.referredByUserId === u.id || (Boolean(u.referralCode) && item.referredBy === u.referralCode));
    const teamEarnings = members.reduce((sum, item) => sum + Number(item.earnings ?? 0), 0);
    const walletAddr = getWithdrawWallet(u);
    const walletProt = getWithdrawProtocol(u);
    const isLocked = u.walletLocked === true || u.withdrawalWalletLocked === true;

    return [
      escapeCsvValue(u.id),
      escapeCsvValue(u.name),
      escapeCsvValue(u.email),
      escapeCsvValue(u.phone),
      escapeCsvValue(u.country),
      escapeCsvValue(u.status),
      escapeCsvValue((u.balance ?? 0).toFixed(2)),
      escapeCsvValue((u.earnings ?? 0).toFixed(2)),
      escapeCsvValue(members.length),
      escapeCsvValue(teamEarnings.toFixed(2)),
      escapeCsvValue(u.referralCode),
      escapeCsvValue(u.referredBy || ""),
      escapeCsvValue(walletAddr || ""),
      escapeCsvValue(walletProt || ""),
      escapeCsvValue(isLocked ? "Locked" : "Unlocked"),
      escapeCsvValue(u.registeredAt || ""),
      escapeCsvValue(u.lastActive || ""),
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute("href", url);
  link.setAttribute("download", `dealxstocks_users_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ── Main Component ─────────────────────────────────────────────── */
export default function AdminUsers() {
  const [, navigate] = useLocation();
  const { startImpersonation } = useAuth();
  const { admin } = useAdmin();
  const [pageTab, setPageTab] = useState<"users" | "auditlog">("users");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const { data: apiUsers, loading, error, refetch, hasMore, loadMore, loadingMore } = useUsersPage(25, {
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const { data: apiSettings } = useSettings<typeof DEFAULT_SETTINGS>();
  const { data: walletAssignments = [], refetch: refetchWalletAssignments } = useUserWalletAssignments();
  const { data: packageControls = [], refetch: refetchPackageControls } = useUserPackageControls();
  const [editUser, setEditUser] = useState<EditableUserRecord | null>(null);
  const [controlUser, setControlUser] = useState<AdminUserRecord | null>(null);
  const [impersonateConfirm, setImpersonateConfirm] = useState<AdminUserRecord | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const settings = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;
  const wallets: WalletConfig[] = Array.isArray(settings.wallets) ? settings.wallets : [];
  const walletByUser = new Map(walletAssignments.map(item => [item.userId, item]));
  const packageControlByUser = new Map(packageControls.map(item => [item.userId, item]));

  // Convert API users to AdminUserRecord format
  const users: EditableUserRecord[] = (apiUsers ?? []).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email ?? "",
    phone: (u as Record<string, unknown>).phone as string ?? "",
    country: (u as Record<string, unknown>).country as string ?? "",
    referralCode: u.referralCode,
    balance: u.balance ?? 0,
    earnings: u.earnings ?? 0,
    referrals: 0,
    status: (u.status as UserStatus) ?? "active",
    withdrawWallet: u.withdrawWallet,
    withdrawalWallet: u.withdrawalWallet,
    withdrawWalletProtocol: u.withdrawWalletProtocol,
    withdrawalWalletProtocol: u.withdrawalWalletProtocol,
    walletLocked: u.walletLocked,
    withdrawalWalletLocked: u.withdrawalWalletLocked,
    walletUpdatedAt: u.walletUpdatedAt,
    walletUpdatedBy: u.walletUpdatedBy,
    registeredAt: (() => {
      try {
        const d = new Date(u.createdAt);
        return isNaN(d.getTime()) ? u.createdAt : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      } catch { return u.createdAt; }
    })(),
    lastActive: u.updatedAt ?? u.createdAt,
  }));

  const isSuperAdmin = admin?.role === "superadmin" || admin?.role === "super_admin";
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 4000);
  }

  async function handleImpersonate(u: AdminUserRecord) {
    if (!admin) return;
    const ok = await startImpersonation(u.id, admin);
    if (ok) navigate("/dashboard");
    else alert("Unable to load this user's data. They may not have logged in yet.");
  }

  const distinctCountries = Array.from(new Set(users.map(u => u.country).filter(Boolean))).sort();

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch =
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.phone ?? "").toLowerCase().includes(q) ||
      (u.country ?? "").toLowerCase().includes(q) ||
      getWithdrawWallet(u).toLowerCase().includes(q) ||
      (u.id ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    const matchCountry = countryFilter === "all" || u.country === countryFilter;
    return matchSearch && matchStatus && matchCountry;
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

  async function handleExportCsv(onlySelected = false) {
    setIsExporting(true);
    try {
      let listToExport: EditableUserRecord[] = [];
      if (onlySelected && selectedUserIds.size > 0) {
        listToExport = users.filter(u => selectedUserIds.has(u.id));
      } else if (filtered.length > 0 && (filtered.length !== users.length || search || countryFilter !== "all" || statusFilter !== "all")) {
        listToExport = filtered;
      } else {
        const allApiUsers = await fetchAllUsersForExport();
        if (allApiUsers.length > 0) {
          listToExport = allApiUsers.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email ?? "",
            phone: (u as Record<string, unknown>).phone as string ?? "",
            country: (u as Record<string, unknown>).country as string ?? "",
            referralCode: u.referralCode,
            referredBy: u.referredBy,
            balance: u.balance ?? 0,
            earnings: u.earnings ?? 0,
            referrals: 0,
            status: (u.status as UserStatus) ?? "active",
            withdrawWallet: u.withdrawWallet,
            withdrawalWallet: u.withdrawalWallet,
            withdrawWalletProtocol: u.withdrawWalletProtocol,
            withdrawalWalletProtocol: u.withdrawalWalletProtocol,
            walletLocked: u.walletLocked,
            withdrawalWalletLocked: u.withdrawalWalletLocked,
            walletUpdatedAt: u.walletUpdatedAt,
            walletUpdatedBy: u.walletUpdatedBy,
            registeredAt: (() => {
              try {
                const d = new Date(u.createdAt);
                return isNaN(d.getTime()) ? u.createdAt : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
              } catch { return u.createdAt; }
            })(),
            lastActive: u.updatedAt ?? u.createdAt,
          }));
        } else {
          listToExport = filtered;
        }
      }

      if (listToExport.length === 0) {
        alert("No users available to export.");
        return;
      }

      downloadUsersCsv(listToExport, users);
      showToast(`Exported ${listToExport.length} user(s) to CSV.`);
    } catch (err) {
      console.error("Export CSV failed:", err);
      alert("Failed to export users CSV.");
    } finally {
      setIsExporting(false);
    }
  }

  async function toggleStatus(id: string) {
    const user = users.find(u => u.id === id);
    if (!user) return;
    const newStatus = user.status === "active" ? "suspended" : "active";
    setSaving(id);
    try {
      await apiUpdateUser(id, { status: newStatus } as Partial<ApiUser>, { requiresAdmin: true });
      refetch();
    } catch (err) {
      console.error("Failed to update status:", err);
      alert(err instanceof Error ? err.message : "Failed to update user status.");
    }
    finally { setSaving(null); }
  }

  async function saveUser(updated: EditableUserRecord, walletId: string) {
    setSaving(updated.id);
    try {
      await apiUpdateUser(updated.id, {
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        country: updated.country,
        balance: updated.balance,
        earnings: updated.earnings,
        withdrawalWallet: updated.withdrawalWallet,
        withdrawalWalletProtocol: updated.withdrawalWalletProtocol,
        withdrawalWalletLocked: updated.withdrawalWalletLocked,
        withdrawalWalletUpdatedBy: admin?.id ?? admin?.username ?? "admin",
      } as Partial<ApiUser>, { requiresAdmin: true });
      await saveUserWalletAssignment(updated.id, walletId);
      // Also update local registry for impersonation support
      refetchWalletAssignments();
      refetch();
    } catch (err) {
      console.error("Failed to save user:", err);
      alert(err instanceof Error ? err.message : "Failed to save user.");
      throw err;
    }
    finally { setSaving(null); }
  }

  async function savePackageControl(userId: string, patch: Partial<ApiUserPackageControl>) {
    setSaving(userId);
    try {
      await saveUserPackageControl(userId, patch);
      refetchPackageControls();
    } catch (err) { console.error("Failed to save package control:", err); }
    finally { setSaving(null); }
  }

  const isEmpty = users.length === 0;

  return (
    <AdminLayout title="User Management">
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["users", "auditlog"] as const).map(k => (
          <button key={k} onClick={() => setPageTab(k)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              pageTab === k
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white"
            }`}>
            {k === "users" ? "Users & Team" : "Audit Log"}
          </button>
        ))}
      </div>
      {pageTab === "auditlog" ? <AuditLogPanel /> : <>
      {editUser && (
        <EditModal
          user={editUser}
          wallets={wallets}
          assignedWalletId={walletByUser.get(editUser.id)?.walletId ?? ""}
          onClose={() => setEditUser(null)}
          onSave={saveUser}
        />
      )}
      {controlUser && (
        <PackageControlModal
          user={controlUser}
          control={packageControlByUser.get(controlUser.id)}
          onClose={() => setControlUser(null)}
          onSaveControl={patch => savePackageControl(controlUser.id, patch)}
        />
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, email, phone, country…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white text-sm font-medium placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-purple-500 shadow-xs"
          />
        </div>
        <select
          value={countryFilter}
          onChange={e => setCountryFilter(e.target.value)}
          className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 min-w-[130px] shadow-xs"
        >
          <option value="all">All Countries</option>
          {distinctCountries.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="flex gap-2 flex-wrap items-center">
          {(["all", "active", "suspended", "pending"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-colors ${statusFilter === s ? "bg-purple-600 text-white shadow-xs" : "bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"}`}>
              {s}
            </button>
          ))}
          <button
            onClick={() => handleExportCsv(false)}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 transition-colors shadow-xs ml-auto disabled:opacity-60"
            title="Export users to CSV spreadsheet"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedUserIds.size > 0 && (
        <div className="mb-4 p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
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
              onClick={() => setSelectedUserIds(new Set())}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <span className="text-slate-600 dark:text-gray-400 text-sm font-bold">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
        {hasMore && <span className="text-slate-500 dark:text-gray-500 text-xs font-medium">Load more to continue browsing</span>}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
        {isEmpty ? (
          <div className="text-center py-16 px-6">
            <Users className="w-10 h-10 text-slate-400 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-slate-700 dark:text-gray-400 text-sm font-bold">No registered users yet</p>
            <p className="text-slate-500 dark:text-gray-500 text-xs mt-1 font-medium">Users will appear here once they sign up on the platform.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-transparent">
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer align-middle"
                      title="Select all on this page"
                    />
                  </th>
                  <th className="text-left text-xs font-extrabold text-slate-700 dark:text-gray-300 px-4 py-3">User</th>
                  <th className="text-left text-xs font-extrabold text-slate-700 dark:text-gray-300 px-4 py-3">Country</th>
                  <th className="text-left text-xs font-extrabold text-slate-700 dark:text-gray-300 px-4 py-3">Wallet</th>
                  <th className="text-right text-xs font-extrabold text-slate-700 dark:text-gray-300 px-4 py-3">Balance</th>
                  <th className="text-right text-xs font-extrabold text-slate-700 dark:text-gray-300 px-4 py-3">Earnings</th>
                  <th className="text-center text-xs font-extrabold text-slate-700 dark:text-gray-300 px-4 py-3">Team</th>
                  <th className="text-center text-xs font-extrabold text-slate-700 dark:text-gray-300 px-4 py-3">Lock</th>
                  <th className="text-center text-xs font-extrabold text-slate-700 dark:text-gray-300 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-extrabold text-slate-700 dark:text-gray-300 px-4 py-3">Registered</th>
                  <th className="text-center text-xs font-extrabold text-slate-700 dark:text-gray-300 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-slate-500 dark:text-gray-400 font-medium">No users match your search.</td>
                  </tr>
                ) : filtered.map(u => {
                  const taskLocked = packageControlByUser.get(u.id)?.isLocked ?? false;
                  const withdrawWallet = getWithdrawWallet(u);
                  const withdrawProtocol = getWithdrawProtocol(u);
                  const withdrawLocked = u.walletLocked === true || u.withdrawalWalletLocked === true;
                  return (
                    <tr key={u.id} className={`hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors ${selectedUserIds.has(u.id) ? "bg-purple-50/40 dark:bg-purple-950/20" : ""}`}>
                      <td className="w-10 px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(u.id)}
                          onChange={() => toggleSelectUser(u.id)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer align-middle"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(u.name ?? "?")[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-slate-900 dark:text-white text-sm font-bold truncate">{u.name || "—"}</p>
                            <p className="text-slate-600 dark:text-gray-400 text-xs font-medium truncate">{u.email || <span className="italic text-slate-400">no email</span>}</p>
                            <p className="text-slate-500 dark:text-gray-500 text-xs font-medium truncate">{u.phone || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-800 dark:text-gray-300 text-sm font-semibold">{u.country || "—"}</td>
                      <td className="px-4 py-3 min-w-[180px]">
                        {withdrawWallet ? (
                          <div className="max-w-[220px]">
                            <p className="truncate text-sm font-bold text-slate-900 dark:text-gray-100" title={withdrawWallet}>
                              {withdrawWallet}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-gray-400">
                              {withdrawProtocol} - {withdrawLocked ? "Locked" : "Saved"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 dark:text-gray-600 font-medium">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900 dark:text-white text-sm font-extrabold">${(u.balance ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 text-sm font-extrabold">${(u.earnings ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const members = users.filter(item => item.referredByUserId === u.id || item.referredBy === u.referralCode);
                          const td = {
                            totalMembers: members.length,
                            teamEarnings: members.reduce((sum, item) => sum + Number(item.earnings ?? 0), 0),
                          };
                          return (
                            <button
                              onClick={() => navigate(`/admin/teams?q=${encodeURIComponent(u.id)}`)}
                              title="View team in Team Management"
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
                                td.totalMembers > 0
                                  ? "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300 hover:bg-purple-200"
                                  : "bg-slate-100 border-slate-300 text-slate-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 hover:bg-slate-200"
                              }`}
                            >
                              <Users className="w-3 h-3" />
                              {td.totalMembers}
                              <span className="text-slate-400 dark:text-gray-400">·</span>
                              ${td.teamEarnings.toFixed(0)}
                            </button>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {taskLocked
                          ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800 font-bold"><Lock className="w-3 h-3" />Locked</span>
                          : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800 font-bold"><LockOpen className="w-3 h-3" />Free</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-400 text-xs font-semibold">{u.registeredAt}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setEditUser(u)} title="Edit Balance" className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 text-purple-700 dark:text-purple-400 flex items-center justify-center transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setControlUser(u)} title="Package & Lock Control" className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 text-blue-700 dark:text-blue-400 flex items-center justify-center transition-colors">
                            <Package className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => toggleStatus(u.id)} title={u.status === "active" ? "Suspend" : "Activate"}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${u.status === "active" ? "bg-red-100 dark:bg-red-900/30 hover:bg-red-200 text-red-700 dark:text-red-400" : "bg-emerald-100 dark:bg-green-900/30 hover:bg-emerald-200 text-emerald-700 dark:text-green-400"}`}>
                            {u.status === "active" ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => navigate(`/admin/support?userId=${encodeURIComponent(u.id)}&userName=${encodeURIComponent(u.name || '')}&userEmail=${encodeURIComponent(u.email || '')}`)}
                            title="Open Support Chat"
                            className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-400 flex items-center justify-center transition-colors"
                          >
                            <Headphones className="w-3.5 h-3.5" />
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => setImpersonateConfirm(u)}
                              title="Manage as User"
                              className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 text-amber-700 dark:text-amber-400 flex items-center justify-center transition-colors"
                            >
                              <UserCog className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Impersonation Confirmation Modal ─────────────────────── */}
      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white text-sm font-bold transition-colors disabled:opacity-60 shadow-xs"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {impersonateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700/60 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 flex items-center justify-center">
                <UserCog className="w-5 h-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-slate-900 dark:text-white font-extrabold text-base">Manage as User</p>
                <p className="text-amber-700 dark:text-amber-400 text-xs font-bold">Auditable · Time-limited · Visible banner</p>
              </div>
            </div>
            <p className="text-slate-700 dark:text-gray-300 text-sm font-medium mb-2">
              You are about to enter an impersonation session for:
            </p>
            <div className="bg-slate-50 dark:bg-gray-800 rounded-xl p-3 mb-4 border border-slate-200 dark:border-gray-700">
              <p className="text-slate-900 dark:text-white font-bold">{impersonateConfirm.name}</p>
              <p className="text-slate-600 dark:text-gray-400 text-xs font-medium">{impersonateConfirm.email}</p>
              <p className="text-amber-700 dark:text-amber-400 text-xs font-bold mt-1">Balance: ${impersonateConfirm.balance.toFixed(2)}</p>
            </div>
            <ul className="text-xs text-slate-600 dark:text-gray-400 space-y-1 mb-5 list-disc list-inside font-medium">
              <li>A <span className="text-red-600 font-bold">visible red banner</span> will always be shown</li>
              <li>Session expires automatically in <span className="text-slate-900 dark:text-white font-bold">60 minutes</span></li>
              <li>All actions are <span className="text-slate-900 dark:text-white font-bold">logged with your admin ID</span></li>
              <li>Only <span className="text-slate-900 dark:text-white font-bold">Super Admins</span> can start impersonation</li>
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setImpersonateConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleImpersonate(impersonateConfirm);
                  setImpersonateConfirm(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <UserCog className="w-4 h-4" />
                Enter Session
              </button>
            </div>
          </div>
        </div>
      )}

      {feedbackToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 animate-fadeIn flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {feedbackToast}
        </div>
      )}
      </>}
    </AdminLayout>
  );
}
