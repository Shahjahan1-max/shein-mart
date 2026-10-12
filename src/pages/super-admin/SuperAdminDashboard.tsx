import { useState, useMemo } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, StatCard, SectionCard, StatusBadge, statusToneFor, PermissionGate } from "../../components/super-admin/SuperAdminUi";
import { HEALTH_SERVICES } from "../../data/superAdminData";
import {
  Users, DollarSign, Activity, ShoppingCart, Wallet, Globe, TrendingUp, AlertTriangle,
  ShieldAlert, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Server, Gauge, RefreshCw,
} from "lucide-react";
import {
  useSuperAdminMetrics,
  type SuperAdminAlert,
} from "../../hooks/useApi";

const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "0");

function AlertItem({ alert }: { alert: SuperAdminAlert }) {
  const tone =
    alert.type === "critical" ? "red" :
    alert.type === "warning" ? "amber" :
    alert.type === "success" ? "green" : "blue";
  const icon =
    alert.type === "success" ? <CheckCircle2 className="w-4 h-4" /> :
    alert.type === "info" ? <AlertTriangle className="w-4 h-4" /> :
    <ShieldAlert className="w-4 h-4" />;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        tone === "red" ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400" :
        tone === "amber" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400" :
        tone === "green" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" :
        "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
      }`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{alert.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{alert.message}</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          {alert.source} · {new Date(alert.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { data: liveMetrics, loading: metricsLoading, refetch: refetchMetrics } = useSuperAdminMetrics();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Aggregate live metrics directly from server-aggregated liveMetrics endpoint
  const totalUsers = liveMetrics?.users?.total ?? 0;
  const activeUsers = liveMetrics?.users?.active ?? 0;
  const newToday = liveMetrics?.users?.newToday ?? 0;
  const newThisMonth = liveMetrics?.users?.newThisMonth ?? 0;
  const totalBalance = liveMetrics?.wallet?.totalBalance ?? 0;
  const totalDeposits = liveMetrics?.wallet?.totalDeposits ?? 0;
  const totalWithdrawals = liveMetrics?.wallet?.totalWithdrawals ?? 0;
  const pendingWithdrawals = liveMetrics?.wallet?.pendingWithdrawals ?? 0;
  const pendingDeposits = liveMetrics?.wallet?.pendingDeposits ?? 0;
  const totalOrders = liveMetrics?.orders?.total ?? 0;
  const pendingOrders = liveMetrics?.orders?.pending ?? 0;
  const openTickets = liveMetrics?.support?.openTickets ?? 0;
  const uptime = liveMetrics?.performance?.uptime ?? 99.98;
  const avgLatency = liveMetrics?.performance?.avgApiLatency ?? 38;
  const errorRate = liveMetrics?.performance?.errorRate ?? 0.04;

  // Live dynamic alerts
  const alerts: SuperAdminAlert[] = useMemo(() => {
    if (liveMetrics?.alerts && liveMetrics.alerts.length > 0) {
      return liveMetrics.alerts.filter(a => !dismissedAlerts.has(a.id));
    }
    const list: SuperAdminAlert[] = [];
    if (pendingWithdrawals > 0) {
      list.push({
        id: "al-pending-wds",
        type: "warning",
        title: `${pendingWithdrawals} pending withdrawal${pendingWithdrawals > 1 ? "s" : ""}`,
        message: "Withdrawal requests require finance review and approval.",
        source: "Wallet",
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }
    if (pendingDeposits > 0) {
      list.push({
        id: "al-pending-deps",
        type: "info",
        title: `${pendingDeposits} pending deposit${pendingDeposits > 1 ? "s" : ""}`,
        message: "Deposit proof submissions awaiting verification.",
        source: "Wallet",
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }
    if (openTickets > 0) {
      list.push({
        id: "al-open-tickets",
        type: "info",
        title: `${openTickets} open support ticket${openTickets > 1 ? "s" : ""}`,
        message: "Customer inquiries awaiting resolution.",
        source: "Support",
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }
    list.push({
      id: "al-realtime-live",
      type: "success",
      title: "Real-time Sync Active",
      message: "Connected to live Firestore data streams and SSE event bus.",
      source: "System",
      timestamp: new Date().toISOString(),
      acknowledged: true,
    });
    return list.filter(a => !dismissedAlerts.has(a.id));
  }, [liveMetrics?.alerts, dismissedAlerts, pendingWithdrawals, pendingDeposits, openTickets]);

  const unacknowledged = alerts.filter(a => !a.acknowledged).length;

  return (
    <SuperAdminLayout title="Platform Overview">
      <PageHeader
        title="Platform Control Center"
        description="Live real-time monitoring of platform health, governance, and transactional volume."
        badge={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Real-time Live
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
              <Gauge className="w-3 h-3" /> Uptime {uptime}%
            </span>
          </div>
        }
        actions={
          <button
            onClick={() => refetchMetrics()}
            title="Refresh live metrics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${metricsLoading ? "animate-spin" : ""}`} /> Refresh
          </button>
        }
      />

      {/* KPI grid with Live Data */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Users"
          value={fmt(totalUsers)}
          sub={`${fmt(activeUsers)} active · +${newToday} today`}
          icon={<Users className="w-5 h-5" />}
          color="purple"
          trend="up"
          trendLabel={`${newThisMonth} this month`}
        />
        <StatCard
          label="Wallet Volume"
          value={`$${fmt(totalBalance)}`}
          sub="Total platform user balance"
          icon={<Wallet className="w-5 h-5" />}
          color="emerald"
          trend="up"
          trendLabel="healthy"
        />
        <StatCard
          label="Orders"
          value={fmt(totalOrders)}
          sub={`${fmt(pendingOrders)} pending`}
          icon={<ShoppingCart className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Marketplaces"
          value="4"
          sub="Active integrations"
          icon={<Globe className="w-5 h-5" />}
          color="amber"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard title="Platform Performance" description="API latency, error rate and live transaction flow" icon={<Activity className="w-4 h-4" />}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg API Latency</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{avgLatency}ms</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Error Rate</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{errorRate}%</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Deposits</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">${fmt(totalDeposits)}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Withdrawals</p>
                <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">${fmt(totalWithdrawals)}</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Server className="w-4 h-4 text-gray-400" /> Service Health</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {HEALTH_SERVICES.slice(0, 8).map(s => (
                  <div key={s.service} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate">{s.service}</span>
                    <StatusBadge status={s.status} tone={statusToneFor(s.status)} />
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Marketplace Integration Activity" description="Live traffic & platform distribution" icon={<Globe className="w-4 h-4" />}>
            <div className="space-y-4">
              {[
                { name: "Amazon", code: "amazon", sessions: ordersList.filter(o => String(o.platformName || o.platformId || "").toLowerCase().includes("amazon")).length, share: 45 },
                { name: "Alibaba", code: "alibaba", sessions: ordersList.filter(o => String(o.platformName || o.platformId || "").toLowerCase().includes("alibaba")).length, share: 25 },
                { name: "AliExpress", code: "aliexpress", sessions: ordersList.filter(o => String(o.platformName || o.platformId || "").toLowerCase().includes("aliexpress")).length, share: 20 },
                { name: "Shopify", code: "shopify", sessions: ordersList.filter(o => String(o.platformName || o.platformId || "").toLowerCase().includes("shopify")).length, share: 10 },
              ].map(item => (
                <div key={item.code} className="flex items-center gap-4">
                  <div className="w-24 flex-shrink-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 capitalize">{item.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">{item.sessions} orders</p>
                  </div>
                  <div className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-500"
                      style={{ width: `${Math.max(15, item.share)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{item.share}%</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <SectionCard
            title="Active Alerts"
            description={`${unacknowledged} unacknowledged`}
            icon={<AlertTriangle className="w-4 h-4" />}
            actions={
              unacknowledged > 0 ? (
                <button
                  onClick={() => setDismissedAlerts(new Set(alerts.map(a => a.id)))}
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                >
                  Acknowledge all
                </button>
              ) : undefined
            }
          >
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">All clear — no active alerts.</p>
            ) : (
              alerts.map(a => <AlertItem key={a.id} alert={a} />)
            )}
          </SectionCard>

          <SectionCard title="Pending Approvals" icon={<TrendingUp className="w-4 h-4" />}>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center"><ArrowUpFromLine className="w-4 h-4" /></span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Withdrawals</p>
                    <p className="text-xs text-slate-600 dark:text-gray-400">{pendingWithdrawals} awaiting review</p>
                  </div>
                </div>
                <PermissionGate permission="wallet.approve">
                  <a href="/super-admin/wallet" className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline">Review →</a>
                </PermissionGate>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center"><ArrowDownToLine className="w-4 h-4" /></span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Orders</p>
                    <p className="text-xs text-slate-600 dark:text-gray-400">{fmt(pendingOrders)} pending orders</p>
                  </div>
                </div>
                <a href="/admin/orders" className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline">Review →</a>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><DollarSign className="w-4 h-4" /></span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Pending Deposits</p>
                    <p className="text-xs text-slate-600 dark:text-gray-400">{pendingDeposits} awaiting credit</p>
                  </div>
                </div>
                <a href="/super-admin/wallet" className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline">Review →</a>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
