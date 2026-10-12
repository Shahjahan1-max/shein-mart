import { useState, useEffect, useCallback } from "react";
import AdminLayout from "./AdminLayout";
import { useAdmin } from "../../contexts/AdminContext";
import {
  getAllUsersForAdmin,
  getLatestRequestForUser,
  loadResetRequests,
  loadResetLogs,
  createResetRequest,
  revokeResetRequest,
  expireStaleRequests,
  buildResetUrl,
  fmtDate,
} from "../../data/passwordResetData";
import type { PasswordResetRequest, PasswordResetLog, ResetStatus } from "../../data/passwordResetData";
import {
  Search, KeyRound, Copy, Check, X, RefreshCw, Clock,
  User, ShieldAlert, History, Send,
} from "lucide-react";

function StatusBadge({ status }: { status: ResetStatus }) {
  const cfg: Record<ResetStatus, { label: string; cls: string }> = {
    pending: { label: "Pending",  cls: "bg-yellow-900/40 text-yellow-300 border-yellow-700/50" },
    sent:    { label: "Active",   cls: "bg-green-900/40 text-green-300 border-green-700/50" },
    used:    { label: "Used",     cls: "bg-blue-900/40 text-blue-300 border-blue-700/50" },
    expired: { label: "Expired",  cls: "bg-gray-800 text-slate-500 dark:text-gray-400 border-gray-700" },
    revoked: { label: "Revoked",  cls: "bg-red-900/40 text-red-400 border-red-700/50" },
  };
  const { label, cls } = cfg[status] ?? { label: status, cls: "bg-gray-800 text-slate-500 dark:text-gray-400 border-gray-700" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

function ActionBadge({ action }: { action: PasswordResetLog["action"] }) {
  const cfg: Record<PasswordResetLog["action"], { label: string; cls: string }> = {
    REQUEST_CREATED:   { label: "Created",  cls: "bg-purple-900/40 text-purple-300 border-purple-700/50" },
    RESET_LINK_SENT:   { label: "Sent",     cls: "bg-green-900/40 text-green-300 border-green-700/50" },
    RESET_LINK_USED:   { label: "Used",     cls: "bg-blue-900/40 text-blue-300 border-blue-700/50" },
    RESET_LINK_EXPIRED:{ label: "Expired",  cls: "bg-gray-800 text-slate-500 dark:text-gray-400 border-gray-700" },
    RESET_LINK_REVOKED:{ label: "Revoked",  cls: "bg-red-900/40 text-red-400 border-red-700/50" },
  };
  const { label, cls } = cfg[action] ?? { label: action, cls: "bg-gray-800 text-slate-500 dark:text-gray-400 border-gray-700" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

interface LinkDialogProps {
  link: string;
  email: string;
  onClose: () => void;
}

function LinkDialog({ link, email, onClose }: LinkDialogProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try { await navigator.clipboard.writeText(link); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-700/50 flex items-center justify-center flex-shrink-0">
            <KeyRound className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 dark:text-white font-semibold text-sm">Reset Link Generated</p>
            <p className="text-slate-500 dark:text-gray-400 text-xs truncate">{email}</p>
          </div>
          <button onClick={onClose} className="text-slate-600 dark:text-gray-400 hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 mb-4">
          <p className="text-amber-300 text-xs font-semibold mb-1">Demo mode — no email server</p>
          <p className="text-amber-400 text-xs leading-relaxed">
            In a live deployment this link would be emailed to the user automatically. Copy it and share it with them manually.
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 mb-4 flex items-start gap-2">
          <p className="flex-1 text-xs text-slate-700 dark:text-gray-300 font-mono break-all leading-relaxed">{link}</p>
          <button
            onClick={copy}
            className="flex-shrink-0 p-1.5 rounded-md bg-purple-700/40 text-purple-400 hover:bg-purple-700/60 transition-colors"
            title="Copy link"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={copy}
            className="flex items-center justify-center gap-1.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={onClose}
            className="py-2.5 bg-gray-800 hover:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>

        <p className="text-center text-xs text-gray-600 mt-3">
          Link expires in 24 hours · Single-use
        </p>
      </div>
    </div>
  );
}

type Tab = "users" | "history";

interface UserRow {
  id: string;
  name: string;
  email: string;
  latest: PasswordResetRequest | null;
}

export default function AdminPasswordReset() {
  const { admin } = useAdmin();
  const adminId = admin?.id ?? admin?.username ?? "admin";

  const [tab, setTab] = useState<Tab>("users");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [logs, setLogs] = useState<PasswordResetLog[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ link: string; email: string } | null>(null);

  const load = useCallback(async () => {
    await expireStaleRequests();
    const allUsers = await getAllUsersForAdmin();
    const allRequests = await loadResetRequests();
    const latestByUser: Record<string, PasswordResetRequest> = {};
    for (const r of allRequests) {
      if (!latestByUser[r.userId]) latestByUser[r.userId] = r;
    }
    setUsers(allUsers.map(u => ({ ...u, latest: latestByUser[u.id] ?? null })));
    setRequests(allRequests);
    setLogs(await loadResetLogs());
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener("ds:data-changed", load);
    return () => window.removeEventListener("ds:data-changed", load);
  }, [load]);

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const filteredLogs = logs.filter(l => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    const name = users.find(u => u.id === l.userId)?.name ?? "";
    const email = users.find(u => u.id === l.userId)?.email ?? "";
    return name.toLowerCase().includes(q) || email.toLowerCase().includes(q) || l.action.toLowerCase().includes(q);
  });

  async function handleSend(user: UserRow) {
    setSending(user.id);
    try {
      const { rawToken } = await createResetRequest(user.id, user.email, "admin", adminId);
      const link = buildResetUrl(rawToken);
      setDialog({ link, email: user.email });
      await load();
    } catch {}
    setSending(null);
  }

  async function handleRevoke(req: PasswordResetRequest) {
    setRevoking(req.id);
    try {
      await revokeResetRequest(req.id, adminId);
      await load();
    } catch {}
    setRevoking(null);
  }

  const isActive = (req: PasswordResetRequest | null): boolean =>
    req !== null && (req.status === "sent" || req.status === "pending");

  return (
    <AdminLayout title="Password Reset">
      {dialog && (
        <LinkDialog
          link={dialog.link}
          email={dialog.email}
          onClose={() => setDialog(null)}
        />
      )}

      <div className="space-y-5">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-700/40 flex items-center justify-center flex-shrink-0 mt-0.5">
              <KeyRound className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-slate-900 dark:text-white font-semibold">Password Reset Management</h2>
              <p className="text-slate-500 dark:text-gray-400 text-sm mt-0.5">
                Generate secure, single-use password reset links for users. Each token is hashed and expires after 24 hours.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {([["users", User, "Users"], ["history", History, "History"]] as [Tab, React.ElementType, string][]).map(
            ([key, Icon, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === key
                    ? "bg-purple-600 text-white"
                    : "text-gray-400 hover:text-slate-900 dark:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            )
          )}
        </div>

        {tab === "users" && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <span className="text-xs text-slate-600 dark:text-gray-400 flex-shrink-0">{filteredUsers.length} users</span>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <User className="w-8 h-8 text-gray-600 mb-2" />
                <p className="text-slate-500 dark:text-gray-400 text-sm">
                  {search ? "No users match your search." : "No registered users yet."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredUsers.map(user => {
                  const active = isActive(user.latest);
                  const isSending = sending === user.id;
                  const isRevoking = user.latest ? revoking === user.latest.id : false;
                  return (
                    <div key={user.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-purple-700/30 flex items-center justify-center flex-shrink-0 text-purple-400 text-sm font-bold">
                          {user.name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                          <p className="text-xs text-slate-500 dark:text-gray-400 truncate">{user.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {user.latest && (
                          <div className="flex items-center gap-2">
                            <StatusBadge status={user.latest.status} />
                            {user.latest.status === "sent" || user.latest.status === "pending" ? (
                              <span className="text-xs text-slate-600 dark:text-gray-400 hidden sm:inline">
                                exp. {new Date(user.latest.expiresAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            ) : null}
                          </div>
                        )}

                        {active && user.latest && (
                          <button
                            onClick={() => handleRevoke(user.latest!)}
                            disabled={isRevoking}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-700/40 text-red-400 hover:bg-red-900/50 text-xs font-medium transition-colors disabled:opacity-50"
                            title="Revoke active link"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Revoke</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleSend(user)}
                          disabled={isSending}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                            active
                              ? "bg-gray-800 border border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-gray-700"
                              : "bg-purple-600 hover:bg-purple-700 text-white"
                          }`}
                        >
                          {isSending ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : active ? (
                            <RefreshCw className="w-3.5 h-3.5" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          {active ? "Resend" : "Send Link"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filter by name, email, or action…"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <span className="text-xs text-slate-600 dark:text-gray-400 flex-shrink-0">{filteredLogs.length} events</span>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <History className="w-8 h-8 text-gray-600 mb-2" />
                  <p className="text-slate-500 dark:text-gray-400 text-sm">No reset activity yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredLogs.map(log => {
                    const user = users.find(u => u.id === log.userId);
                    return (
                      <div key={log.id} className="px-5 py-3.5 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                          {log.action === "RESET_LINK_USED" ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : log.action === "RESET_LINK_REVOKED" ? (
                            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                          ) : log.action === "RESET_LINK_EXPIRED" ? (
                            <Clock className="w-3.5 h-3.5 text-slate-600 dark:text-gray-400" />
                          ) : (
                            <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-slate-800 dark:text-gray-200 font-medium truncate">
                              {user?.name ?? log.userId}
                            </p>
                            <ActionBadge action={log.action} />
                            {log.adminId && (
                              <span className="text-[11px] text-purple-400 bg-purple-900/20 border border-purple-700/30 px-1.5 py-0.5 rounded-full">
                                by {log.adminId}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">
                            {user?.email ?? ""} · {fmtDate(log.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {requests.length > 0 && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">All Reset Requests</h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {requests.map(req => {
                    const user = users.find(u => u.id === req.userId);
                    return (
                      <div key={req.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-slate-800 dark:text-gray-200 font-medium">{user?.name ?? req.userId}</p>
                            <StatusBadge status={req.status} />
                            <span className="text-[11px] text-slate-600 dark:text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
                              {req.createdBy === "admin" ? "via admin" : "self-service"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">
                            {req.email} · Created {fmtDate(req.createdAt)}
                            {req.usedAt ? ` · Used ${fmtDate(req.usedAt)}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-gray-400 flex-shrink-0">
                          <Clock className="w-3 h-3" />
                          Exp. {fmtDate(req.expiresAt)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
