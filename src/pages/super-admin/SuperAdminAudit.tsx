import { useState, useEffect, useCallback } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, SectionCard, StatusBadge } from "../../components/super-admin/SuperAdminUi";
import { api } from "../../lib/apiClient";
import { FileText, Search, Download, RefreshCw, ShieldAlert, CheckCircle2 } from "lucide-react";

const SEVERITY_TONE: Record<string, "gray" | "blue" | "amber" | "red"> = {
  info: "blue",
  warning: "amber",
  error: "red",
  critical: "red",
};

interface AuditLogItem {
  id: string;
  timestamp?: string;
  createdAt?: string;
  actorId?: string;
  actorName?: string;
  actorUsername?: string;
  adminUsername?: string;
  adminId?: string;
  actorRole?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  targetId?: string;
  userId?: string;
  userName?: string;
  details?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  severity?: "info" | "warning" | "error" | "critical";
  category?: string;
}

function getLogActor(log: AuditLogItem): string {
  return log.actorName || log.actorUsername || log.adminUsername || "System";
}

function getLogRole(log: AuditLogItem): string {
  return log.actorRole || (log.adminUsername ? "super_admin" : "system");
}

function getLogTarget(log: AuditLogItem): string {
  if (log.userName && log.userId) return `${log.userName} (${log.userId})`;
  if (log.userName) return log.userName;
  if (log.entityName) return log.entityName;
  if (log.targetId) return log.targetId;
  if (log.userId) return log.userId;
  if (log.entityId) return log.entityId;
  return "System / Platform";
}

function getLogSeverity(log: AuditLogItem): "info" | "warning" | "error" | "critical" {
  if (log.severity) return log.severity;
  const act = (log.action || "").toUpperCase();
  if (act.includes("PURGE") || act.includes("USER_DELETE") || act.includes("LOCK_ACCOUNT")) {
    return "critical";
  }
  if (act.includes("DELETE") || act.includes("UPDATE") || act.includes("PERMISSIONS") || act.includes("STATUS") || act.includes("SETTINGS")) {
    return "warning";
  }
  if (act.includes("FAIL") || act.includes("ERROR") || act.includes("REJECT")) {
    return "error";
  }
  return "info";
}

export default function SuperAdminAudit() {
  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: AuditLogItem[] }>(
        "/api/super-admin/audit-logs",
        { requiresAdmin: true }
      );
      if (res && res.success && Array.isArray(res.data)) {
        setLogs(res.data);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.warn("[SuperAdminAudit] Failed to fetch real audit logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
    const onDataChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ collection?: string }>).detail;
      if (!detail?.collection || detail.collection === "auditLogs") {
        void fetchLogs();
      }
    };
    window.addEventListener("ds:data-changed", onDataChanged);
    return () => window.removeEventListener("ds:data-changed", onDataChanged);
  }, [fetchLogs]);

  function exportCsv() {
    if (logs.length === 0) return;
    const headers = ["ID", "Timestamp", "Actor", "Role", "Action", "Target / Entity", "Severity", "Details / Meta"];
    const rows = logs.map(l => [
      l.id,
      l.timestamp || l.createdAt || "",
      getLogActor(l),
      getLogRole(l),
      l.action,
      getLogTarget(l),
      getLogSeverity(l),
      JSON.stringify(l.details || l.meta || {}),
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const filtered = logs.filter(l => {
    const actor = getLogActor(l).toLowerCase();
    const role = getLogRole(l).toLowerCase();
    const action = (l.action || "").toLowerCase();
    const target = getLogTarget(l).toLowerCase();
    const details = JSON.stringify(l.details || l.meta || {}).toLowerCase();
    const q = query.toLowerCase();
    return actor.includes(q) || role.includes(q) || action.includes(q) || target.includes(q) || details.includes(q);
  });

  return (
    <SuperAdminLayout title="System Audit Trail & Governance Logs">
      <PageHeader
        title="System Audit Trail & Governance Logs"
        description="Immutable, real-time log of administrative actions, user governance, impersonations, and security events."
        icon={<FileText className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchLogs()}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              title="Refresh audit trail"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={exportCsv}
              disabled={logs.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-200 text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        }
      />

      <SectionCard
        title="Audit Events Log"
        description={`${filtered.length} real audit records`}
        icon={<FileText className="w-4 h-4" />}
        actions={
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search actor, action, target…"
              className="pl-9 pr-3 py-1.5 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-64"
            />
          </div>
        }
      >
        <div className="responsive-table-container">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="py-2.5 pr-4 font-semibold">Timestamp</th>
                <th className="py-2.5 pr-4 font-semibold">Actor</th>
                <th className="py-2.5 pr-4 font-semibold">Action</th>
                <th className="py-2.5 pr-4 font-semibold">Target / Entity</th>
                <th className="py-2.5 pr-4 font-semibold">Details</th>
                <th className="py-2.5 font-semibold">Severity</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-500" />
                    Loading audit events…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                    {logs.length === 0 ? (
                      <div className="space-y-1">
                        <CheckCircle2 className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <p className="font-semibold text-slate-700 dark:text-gray-300">No audit events recorded yet.</p>
                        <p className="text-xs text-gray-500">Administrative and security actions will be logged here in real time.</p>
                      </div>
                    ) : (
                      "No matching audit events for this search."
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map(log => {
                  const severity = getLogSeverity(log);
                  const actor = getLogActor(log);
                  const role = getLogRole(log);
                  const target = getLogTarget(log);
                  const rawTime = log.timestamp || log.createdAt;
                  const details = log.details || log.meta;

                  return (
                    <tr
                      key={log.id}
                      className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="py-3 pr-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums font-mono">
                        {rawTime ? new Date(rawTime).toLocaleString() : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900 dark:text-white">{actor}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 capitalize">{role.replace(/_/g, " ")}</p>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                        {log.action}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-gray-700 dark:text-gray-200 text-xs font-medium">{target}</p>
                      </td>
                      <td className="py-3 pr-4 max-w-xs">
                        {details && Object.keys(details).length > 0 ? (
                          <pre className="text-[10px] font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 overflow-x-auto max-h-16">
                            {JSON.stringify(details, null, 1)}
                          </pre>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={severity} tone={SEVERITY_TONE[severity] ?? "gray"} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </SuperAdminLayout>
  );
}
