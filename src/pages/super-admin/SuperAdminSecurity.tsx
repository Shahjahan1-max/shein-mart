import { useState, useEffect, useMemo } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, SectionCard, StatCard, StatusBadge, PermissionGate } from "../../components/super-admin/SuperAdminUi";
import { useUsers } from "../../hooks/useApi";
import { api } from "../../lib/apiClient";
import { Lock, ShieldCheck, KeyRound, Ban, Eye, MonitorSmartphone, RefreshCcw, ShieldAlert, CheckCircle2 } from "lucide-react";

interface AuditLogItem {
  id: string;
  timestamp: string;
  action: string;
  actorUsername?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  severity?: "info" | "warning" | "error" | "critical";
}

export default function SuperAdminSecurity() {
  const { data: rawUsers } = useUsers();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const users = rawUsers || [];
  const lockedUsers = useMemo(() => users.filter(u => u.status === "suspended"), [users]);

  useEffect(() => {
    let mounted = true;
    async function fetchAudit() {
      try {
        const res = await api.get<{ success: boolean; data: AuditLogItem[] }>("/api/super-admin/audit-logs", { requiresAdmin: true });
        if (mounted && res.success && Array.isArray(res.data)) {
          setLogs(res.data);
        }
      } catch {
      } finally {
        if (mounted) setLoadingLogs(false);
      }
    }
    void fetchAudit();
    return () => { mounted = false; };
  }, []);

  const securityAlerts = useMemo(() => {
    return logs.filter(l => l.severity === "critical" || l.severity === "warning" || String(l.action).includes("FAIL") || String(l.action).includes("IMPERSONATE"));
  }, [logs]);

  return (
    <SuperAdminLayout title="Security Center">
      <PageHeader
        title="Security Center"
        description="Account security, active sessions, and suspicious activity monitoring."
        icon={<Lock className="w-5 h-5" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="MFA & Admin Security" value="Active" sub="High Security Mode" icon={<ShieldCheck className="w-5 h-5" />} color="emerald" />
        <StatCard label="Audit Logged Events" value={logs.length} sub="All actions tracked" icon={<Eye className="w-5 h-5" />} color="purple" />
        <StatCard label="Locked Accounts" value={lockedUsers.length} sub={lockedUsers.length > 0 ? "Requires review" : "No locked users"} icon={<Ban className="w-5 h-5" />} color="rose" />
        <StatCard label="Security Alerts" value={securityAlerts.length} sub={securityAlerts.length > 0 ? "High priority" : "Normal"} icon={<ShieldAlert className="w-5 h-5" />} color="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard title="Security & Audit Activity" icon={<Eye className="w-4 h-4" />}>
          <div className="space-y-3">
            {logs.slice(0, 8).map(a => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                <span className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  a.severity === "critical" ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
                  : a.severity === "warning" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                  : "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                }`}>
                  <ShieldAlert className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{a.action.replace(/_/g, " ")}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">By {a.actorUsername || "System"} · Target: {a.targetId || "Platform"}</p>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">{new Date(a.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No recent security events recorded.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Locked Accounts" icon={<Ban className="w-4 h-4" />} actions={<StatusBadge status={`${lockedUsers.length} locked`} tone={lockedUsers.length > 0 ? "red" : "green"} />}>
          <div className="space-y-3">
            {lockedUsers.slice(0, 6).map(u => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                <span className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {(u.name || u.email || "U").slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{u.name || u.email}</p>
                  <p className="text-xs text-slate-600 dark:text-gray-400">{u.email} · ID: {u.id}</p>
                  <p className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold">Account Suspended</p>
                </div>
              </div>
            ))}
            {lockedUsers.length === 0 && (
              <div className="text-center py-6 text-emerald-600 dark:text-emerald-400 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 opacity-80" />
                <p className="text-xs font-semibold">All customer accounts are in good standing.</p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Security Policies" icon={<KeyRound className="w-4 h-4" />}>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: "Password min length", value: "8 characters" },
              { label: "Password complexity", value: "Upper + Lower + Number" },
              { label: "MFA for admins", value: "Required" },
              { label: "MFA for users", value: "Optional" },
              { label: "Session timeout", value: "30 minutes" },
              { label: "Audit retention", value: "90 days" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                <span className="text-sm text-gray-600 dark:text-gray-300">{item.label}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </SuperAdminLayout>
  );
}
