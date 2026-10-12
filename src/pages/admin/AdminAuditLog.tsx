import { useState, useEffect } from "react";
import AdminLayout from "./AdminLayout";
import type { AdminAuditLog, ImpersonationSession } from "../../data/adminData";
import { useFirebaseCollectionPage } from "../../hooks/useApi";
import { ShieldAlert, ClipboardList, Clock, User, LogIn, LogOut, Activity } from "lucide-react";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function ActionBadge({ action }: { action: AdminAuditLog["action"] }) {
  if (action === "IMPERSONATE_START") return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/50 font-medium">
      <LogIn className="w-3 h-3" /> Start
    </span>
  );
  if (action === "IMPERSONATE_END") return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-300 border border-green-700/50 font-medium">
      <LogOut className="w-3 h-3" /> End
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 border border-blue-700/50 font-medium">
      <Activity className="w-3 h-3" /> Action
    </span>
  );
}

function SessionStatus({ s }: { s: ImpersonationSession }) {
  if (s.revoked || s.endedAt) return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-slate-500 dark:text-gray-400 border border-gray-700">Ended</span>
  );
  if (new Date(s.expiresAt) < new Date()) return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-700/50">Expired</span>
  );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/50 animate-pulse">Active</span>
  );
}

type TabKey = "logs" | "sessions";

export function AuditLogPanel() {
  const [tab, setTab] = useState<TabKey>("logs");
  const [search, setSearch] = useState("");
  const { data: logsRaw = [], hasMore: hasMoreLogs, loadMore: loadMoreLogs, loadingMore: loadingMoreLogs } =
    useFirebaseCollectionPage<AdminAuditLog>("auditLogs", { pageSize: 25, orderField: "timestamp", orderDir: "desc" });
  const { data: sessionsRaw = [], hasMore: hasMoreSessions, loadMore: loadMoreSessions, loadingMore: loadingMoreSessions } =
    useFirebaseCollectionPage<ImpersonationSession>("impersonationSessions", { pageSize: 25, orderField: "startedAt", orderDir: "desc" });
  const logs = [...logsRaw].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  const sessions = [...sessionsRaw].sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));

  const filteredLogs = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.adminUsername.toLowerCase().includes(q) ||
      l.userName.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q)
    );
  });

  const filteredSessions = sessions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.adminUsername.toLowerCase().includes(q) ||
      s.userName.toLowerCase().includes(q) ||
      s.userEmail.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-900/30 border border-red-700/50 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Impersonation Audit Log</h1>
            <p className="text-slate-500 dark:text-gray-400 text-sm">Full record of all admin account access sessions</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Log Entries", value: logs.length, color: "text-blue-400" },
            { label: "Total Sessions", value: sessions.length, color: "text-amber-400" },
            { label: "Active Now", value: sessions.filter(s => !s.revoked && !s.endedAt && new Date(s.expiresAt) > new Date()).length, color: "text-red-400" },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-slate-500 dark:text-gray-400 text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1 border border-gray-700">
          {([
            { key: "logs", label: "Audit Logs", icon: ClipboardList },
            { key: "sessions", label: "Sessions", icon: Clock },
          ] as { key: TabKey; label: string; icon: React.ElementType }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-gray-700 text-slate-900 dark:text-white shadow" : "text-gray-400 hover:text-gray-200"}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by admin, user, or action…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />

        {/* Audit Logs Table */}
        {tab === "logs" && (
          <div className="bg-gray-800/60 border border-gray-700 rounded-2xl overflow-hidden">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600 dark:text-gray-400">
                <ClipboardList className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No audit log entries yet</p>
                <p className="text-xs mt-1">Entries appear when admins start impersonation sessions</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-900/50">
                      {["Timestamp", "Admin", "Target User", "Action", "Meta"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs whitespace-nowrap">{fmtDate(log.timestamp)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-purple-900/50 border border-purple-700/50 flex items-center justify-center">
                              <User className="w-3 h-3 text-purple-400" />
                            </div>
                            <span className="text-slate-900 dark:text-white text-xs font-medium">{log.adminUsername}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-900 dark:text-white text-xs font-medium">{log.userName}</p>
                          <p className="text-slate-600 dark:text-gray-400 text-xs">{log.userId.slice(0, 12)}…</p>
                        </td>
                        <td className="px-4 py-3">
                          <ActionBadge action={log.action} />
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-gray-400 text-xs">
                          {log.meta ? Object.entries(log.meta).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {hasMoreLogs && (
              <div className="flex justify-center py-3 border-t border-gray-700">
                <button
                  onClick={loadMoreLogs}
                  disabled={loadingMoreLogs}
                  className="px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 hover:text-slate-900 dark:text-white text-sm font-medium disabled:opacity-60"
                >
                  {loadingMoreLogs ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sessions Table */}
        {tab === "sessions" && (
          <div className="bg-gray-800/60 border border-gray-700 rounded-2xl overflow-hidden">
            {filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600 dark:text-gray-400">
                <Clock className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No impersonation sessions recorded</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-900/50">
                      {["Started", "Admin", "Target User", "Expires", "Status"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {filteredSessions.map(s => (
                      <tr key={s.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs whitespace-nowrap">{fmtDate(s.startedAt)}</td>
                        <td className="px-4 py-3">
                          <span className="text-slate-900 dark:text-white text-xs font-medium">{s.adminUsername}</span>
                          <p className="text-slate-600 dark:text-gray-400 text-xs">ID: {s.adminId.slice(0, 10)}…</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-900 dark:text-white text-xs font-medium">{s.userName}</p>
                          <p className="text-slate-600 dark:text-gray-400 text-xs">{s.userEmail}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs whitespace-nowrap">
                          {s.endedAt ? fmtDate(s.endedAt) : fmtDate(s.expiresAt)}
                        </td>
                        <td className="px-4 py-3">
                          <SessionStatus s={s} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {hasMoreSessions && (
              <div className="flex justify-center py-3 border-t border-gray-700">
                <button
                  onClick={loadMoreSessions}
                  disabled={loadingMoreSessions}
                  className="px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 hover:text-slate-900 dark:text-white text-sm font-medium disabled:opacity-60"
                >
                  {loadingMoreSessions ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
  );
}

export default function AdminAuditLog() {
  return (
    <AdminLayout title="Audit Log">
      <AuditLogPanel />
    </AdminLayout>
  );
}
