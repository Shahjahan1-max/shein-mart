import { useState } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, SectionCard, StatusBadge, statusToneFor, PermissionGate } from "../../components/super-admin/SuperAdminUi";
import { HEALTH_SERVICES, SYSTEM_METRICS } from "../../data/superAdminData";
import { Activity, Server, Database, RefreshCcw, HardDriveDownload } from "lucide-react";

const BACKUPS = [
  { id: "bk-1", label: "Automated daily", created: "2026-08-02T03:00:00Z", size: "2.4 GB", status: "healthy" },
  { id: "bk-2", label: "Pre-release snapshot", created: "2026-08-01T09:00:00Z", size: "2.3 GB", status: "healthy" },
  { id: "bk-3", label: "Weekly archive", created: "2026-07-27T03:00:00Z", size: "2.2 GB", status: "healthy" },
];

export default function SuperAdminHealth() {
  const [services, setServices] = useState(HEALTH_SERVICES);
  const [refreshing, setRefreshing] = useState(false);
  const m = SYSTEM_METRICS.performance;

  function refresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }

  const healthy = services.filter(s => s.status === "healthy").length;

  return (
    <SuperAdminLayout title="System Health">
      <PageHeader
        title="System Health"
        description="Live service status, performance metrics, and backup management."
        icon={<Activity className="w-5 h-5" />}
        actions={
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
          >
            <RefreshCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Services Healthy</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{healthy}/{services.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg API Latency</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{m.avgApiLatency}ms</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Error Rate</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{m.errorRate}%</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Uptime (30d)</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">{m.uptime}%</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard title="Service Status" description="Infrastructure health checks" icon={<Server className="w-4 h-4" />}>
          <div className="space-y-2.5">
            {services.map(s => (
              <div key={s.service} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status === "healthy" ? "bg-emerald-500" : s.status === "degraded" ? "bg-amber-500" : "bg-rose-500"}`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{s.service}</span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-xs text-slate-500 dark:text-gray-400 tabular-nums hidden sm:inline">{s.latency}ms</span>
                  <span className="text-xs text-slate-500 dark:text-gray-400 tabular-nums hidden sm:inline">{s.uptime}%</span>
                  <StatusBadge status={s.status} tone={statusToneFor(s.status)} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Backups" description="Automated snapshot management" icon={<HardDriveDownload className="w-4 h-4" />} actions={<StatusBadge status="auto" tone="green" />}>
            <div className="space-y-2.5">
              {BACKUPS.map(b => (
                <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{b.label}</p>
                    <p className="text-xs text-slate-600 dark:text-gray-400">{new Date(b.created).toLocaleString()} · {b.size}</p>
                  </div>
                  <StatusBadge status={b.status} tone="green" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <PermissionGate permission="system.backup">
                <button className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold transition-colors">
                  <Database className="w-4 h-4" /> Run Backup Now
                </button>
              </PermissionGate>
              <PermissionGate permission="system.restore">
                <button className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold transition-colors">
                  <RefreshCcw className="w-4 h-4" /> Restore
                </button>
              </PermissionGate>
            </div>
          </SectionCard>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
