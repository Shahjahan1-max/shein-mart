import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import AdminLayout from "./AdminLayout";
import {
  Users, ArrowDownToLine, ArrowUpFromLine, Clock, CheckCircle, XCircle,
  HeadphonesIcon, DollarSign, TrendingUp, ArrowDownLeft, ArrowUpRight, Activity,
  LayoutDashboard, BarChart3, Loader2,
} from "lucide-react";
import {
  useSuperAdminMetrics,
  useUsersPage,
  useDepositsPage,
  useWithdrawalsPage,
  useSupportTickets,
} from "../../hooks/useApi";

/* ─── Shared sub-components ─────────────────────────────────── */
function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-slate-900 dark:text-white" />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{value}</p>
      <p className="text-slate-700 dark:text-gray-300 text-sm font-semibold mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 font-medium">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:     "bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800",
    Pending:     "bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800",
    completed:   "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800",
    Complete:    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800",
    approved:    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800",
    Approved:    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800",
    rejected:    "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800",
    Rejected:    "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800",
    active:      "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800",
    suspended:   "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800",
    open:        "bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800",
    in_progress: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800",
    resolved:    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${map[status] || "bg-slate-100 text-slate-700 border-slate-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <div className="py-8 text-center text-slate-500 dark:text-gray-400 text-sm font-medium">{message}</div>;
}

/* ─── Analytics status colors (kept identical to AdminAnalytics) */
const STATUS_COLORS: Record<string, string> = {
  Pending:  "text-amber-600 dark:text-yellow-400",
  Approved: "text-emerald-600 dark:text-green-400",
  Rejected: "text-red-600 dark:text-red-400",
  Complete: "text-blue-600 dark:text-blue-400",
};

/* ─── Tab bar ────────────────────────────────────────────────── */
type Tab = "overview" | "analytics";

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview",  label: "Dashboard", icon: LayoutDashboard },
    { id: "analytics", label: "Analytics",  icon: BarChart3 },
  ];
  return (
    <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-gray-800 rounded-xl p-1 mb-6 self-start border border-slate-300/60 dark:border-gray-700">
      {tabs.map(t => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              isActive
                ? "bg-white dark:bg-gray-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-300"
            }`}
          >
            <Icon className="w-4 h-4" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");

  const { data: metrics, loading: metricsLoading } = useSuperAdminMetrics();
  const { data: recentUsers = [], loading: usersLoading } = useUsersPage(5);
  const { data: recentDeps = [], loading: depsLoading } = useDepositsPage(10);
  const { data: recentWds = [], loading: wdsLoading } = useWithdrawalsPage(10);
  const { data: apiTickets, loading: ticketsLoading } = useSupportTickets();

  const tickets = (apiTickets ?? []).filter(t => !t.is_deleted);
  const loading = (metricsLoading && !metrics) || usersLoading || depsLoading || wdsLoading || ticketsLoading;

  /* ── Analytics state ────────────────────────────────────────── */
  interface AnalyticsStats {
    totalUsers: number;
    totalDeposited: number;
    totalWithdrawn: number;
    totalEarned: number;
    pendingDeposits: number;
    pendingWithdrawals: number;
    recentActivity: Array<{ id: string; type: string; label: string; amount: string; date: string; status: string }>;
  }

  const analytics: AnalyticsStats = {
    totalUsers: metrics?.users?.total ?? 0,
    totalDeposited: metrics?.wallet?.totalDeposits ?? 0,
    totalWithdrawn: metrics?.wallet?.totalWithdrawals ?? 0,
    totalEarned: 0,
    pendingDeposits: metrics?.wallet?.pendingDeposits ?? 0,
    pendingWithdrawals: metrics?.wallet?.pendingWithdrawals ?? 0,
    recentActivity: [
      ...recentDeps.slice(0, 10).map(d => ({
        id: d.id, type: "deposit",
        label: `Deposit${d.userName ? " · " + d.userName : ""}`,
        amount: `+$${d.amount.toFixed(2)}`, date: d.date, status: d.status,
      })),
      ...recentWds.slice(0, 10).map(w => ({
        id: w.id, type: "withdrawal",
        label: `Withdrawal${w.userName ? " · " + w.userName : ""}`,
        amount: `-$${w.amount.toFixed(2)}`, date: w.date, status: w.status,
      })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20),
  };

  /* ── Overview derived values ─────────────────────────────────── */
  const pendingDeps    = metrics?.wallet?.pendingDeposits ?? 0;
  const pendingWds     = metrics?.wallet?.pendingWithdrawals ?? 0;
  const openTickets    = metrics?.support?.openTickets ?? tickets.filter(t => t.status === "open" || t.status === "in_progress").length;
  const totalDeposited = metrics?.wallet?.totalDeposits ?? 0;
  const totalWithdrawn = metrics?.wallet?.totalWithdrawals ?? 0;
  const completedDepositsCount = metrics?.wallet?.completedDeposits ?? recentDeps.filter(d => d.status === "completed" || d.status === "approved").length;
  const rejectedWithdrawalsCount = metrics?.wallet?.rejectedWithdrawals ?? recentWds.filter(w => w.status === "rejected").length;

  const topDeps  = [...recentDeps].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const topWds   = [...recentWds].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const topUsers = [...recentUsers].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 5);
  const openTkts = tickets.filter(t => t.status !== "resolved" && t.status !== "closed").slice(0, 5);

  /* ── Analytics KPI list ─────────────────────────────────────── */
  const analyticsKpis = [
    { label: "Total Users",          value: analytics.totalUsers.toString(),               icon: Users,        color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/20" },
    { label: "Total Deposited",      value: `$${analytics.totalDeposited.toFixed(2)}`,     icon: ArrowDownLeft,color: "text-emerald-600 dark:text-green-400",  bg: "bg-emerald-100 dark:bg-green-900/20" },
    { label: "Total Withdrawn",      value: `$${analytics.totalWithdrawn.toFixed(2)}`,     icon: ArrowUpRight, color: "text-red-600 dark:text-red-400",    bg: "bg-red-100 dark:bg-red-900/20" },
    { label: "Total Earned",         value: `$${analytics.totalEarned.toFixed(2)}`,        icon: TrendingUp,   color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-100 dark:bg-amber-900/20" },
    { label: "Pending Deposits",     value: analytics.pendingDeposits.toString(),           icon: DollarSign,   color: "text-amber-600 dark:text-yellow-400", bg: "bg-amber-100 dark:bg-yellow-900/20" },
    { label: "Pending Withdrawals",  value: analytics.pendingWithdrawals.toString(),        icon: Activity,     color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/20" },
  ];

  return (
    <AdminLayout title="Dashboard Overview">
      {/* ── Tab bar at the top ──────────────────────────────────── */}
      <TabBar active={tab} onChange={setTab} />

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-500 dark:text-gray-400 font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-primary" /> Loading dashboard data…
        </div>
      )}

      {!loading && tab === "overview" && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Total Users"     value={String(analytics.totalUsers)}                 sub={`${analytics.totalUsers} registered`} icon={Users}           color="bg-purple-600" />
            <KpiCard label="Total Deposited" value={`$${totalDeposited.toLocaleString()}`} sub={`${pendingDeps} pending`}    icon={ArrowDownToLine}  color="bg-blue-600" />
            <KpiCard label="Total Withdrawn" value={`$${totalWithdrawn.toLocaleString()}`} sub={`${pendingWds} pending`}     icon={ArrowUpFromLine}  color="bg-emerald-600" />
            <KpiCard label="Open Tickets"    value={String(openTickets)}                  sub="Need response"                icon={HeadphonesIcon}   color="bg-orange-600" />
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-yellow-600/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-700 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-slate-900 dark:text-white font-extrabold text-xl">{pendingDeps + pendingWds}</p>
                <p className="text-slate-600 dark:text-gray-400 text-xs font-semibold">Pending Requests</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-green-600/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-700 dark:text-green-400" />
              </div>
              <div>
                <p className="text-slate-900 dark:text-white font-extrabold text-xl">{completedDepositsCount}</p>
                <p className="text-slate-600 dark:text-gray-400 text-xs font-semibold">Completed Deposits</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-600/20 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-700 dark:text-red-400" />
              </div>
              <div>
                <p className="text-slate-900 dark:text-white font-extrabold text-xl">{rejectedWithdrawalsCount}</p>
                <p className="text-slate-600 dark:text-gray-400 text-xs font-semibold">Rejected Withdrawals</p>
              </div>
            </div>
          </div>

          {/* Recent tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Deposits */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-extrabold text-slate-900 dark:text-white">Recent Deposits</h2>
                <Link href="/admin/transactions" className="text-xs font-bold text-purple-700 dark:text-purple-400 hover:underline">View all →</Link>
              </div>
              {topDeps.length === 0
                ? <EmptyRow message="No deposit requests yet" />
                : <div className="space-y-3">
                    {topDeps.map(d => (
                      <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-gray-800 last:border-0">
                        <div className="min-w-0">
                          <p className="text-slate-900 dark:text-white text-sm font-bold truncate">{d.userName || d.userId || "—"}</p>
                          <p className="text-slate-500 dark:text-gray-400 text-xs font-medium">{d.date} · {d.protocol}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-slate-900 dark:text-white text-sm font-extrabold">${d.amount}</span>
                          <StatusBadge status={d.status} />
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* Recent Withdrawals */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-extrabold text-slate-900 dark:text-white">Recent Withdrawals</h2>
                <Link href="/admin/transactions" className="text-xs font-bold text-purple-700 dark:text-purple-400 hover:underline">View all →</Link>
              </div>
              {topWds.length === 0
                ? <EmptyRow message="No withdrawal requests yet" />
                : <div className="space-y-3">
                    {topWds.map(w => (
                      <div key={w.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-gray-800 last:border-0">
                        <div className="min-w-0">
                          <p className="text-slate-900 dark:text-white text-sm font-bold truncate">{w.userName || w.userId || "—"}</p>
                          <p className="text-slate-500 dark:text-gray-400 text-xs font-medium">{w.date} · {w.protocol}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-slate-900 dark:text-white text-sm font-extrabold">${w.amount}</span>
                          <StatusBadge status={w.status} />
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* Recent Users */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-extrabold text-slate-900 dark:text-white">Recent Users</h2>
                <Link href="/admin/users" className="text-xs font-bold text-purple-700 dark:text-purple-400 hover:underline">View all →</Link>
              </div>
              {topUsers.length === 0
                ? <EmptyRow message="No registered users yet" />
                : <div className="space-y-3">
                    {topUsers.map(u => (
                      <div key={u.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-gray-800 last:border-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(u.name ?? "?")[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-slate-900 dark:text-white text-sm font-bold truncate">{u.name || "—"}</p>
                            <p className="text-slate-500 dark:text-gray-400 text-xs font-medium">{u.country || "—"} · {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* Open Support Tickets */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-extrabold text-slate-900 dark:text-white">Open Support Tickets</h2>
                <Link href="/admin/support" className="text-xs font-bold text-purple-700 dark:text-purple-400 hover:underline">View all →</Link>
              </div>
              {openTkts.length === 0
                ? <EmptyRow message="No open tickets" />
                : <div className="space-y-3">
                    {openTkts.map(t => (
                      <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-gray-800 last:border-0">
                        <div className="min-w-0">
                          <p className="text-slate-900 dark:text-white text-sm font-bold truncate">{t.subject}</p>
                          <p className="text-slate-500 dark:text-gray-400 text-xs font-medium">{t.userName || "—"} · {t.date}</p>
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>
        </>
      )}

      {!loading && tab === "analytics" && (
        <div className="space-y-6">
          {/* KPI grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {analyticsKpis.map(kpi => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-slate-700 dark:text-gray-400 text-xs font-extrabold">{kpi.label}</p>
                    <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${kpi.color}`} />
                    </div>
                  </div>
                  <p className={`text-2xl font-extrabold ${kpi.color}`}>{kpi.value}</p>
                </div>
              );
            })}
          </div>

          {/* Recent activity */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-slate-900 dark:text-white font-extrabold">Recent Activity</h2>
              <p className="text-slate-500 dark:text-gray-400 text-xs mt-0.5 font-medium">All deposits and withdrawals</p>
            </div>
            {analytics.recentActivity.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-gray-400 text-sm font-medium">No activity yet.</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-gray-800">
                {analytics.recentActivity.map(a => (
                  <div key={a.id} className="flex items-center px-5 py-3.5 gap-4 hover:bg-slate-50 dark:hover:bg-gray-800/30 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${a.type === "deposit" ? "bg-emerald-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                      {a.type === "deposit"
                        ? <ArrowDownLeft className="w-4 h-4 text-emerald-700 dark:text-green-400" />
                        : <ArrowUpRight  className="w-4 h-4 text-red-700 dark:text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 dark:text-white text-sm font-bold truncate">{a.label}</p>
                      <p className="text-slate-500 dark:text-gray-400 text-xs font-medium">{a.date}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-extrabold ${a.type === "deposit" ? "text-emerald-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{a.amount}</p>
                      <p className={`text-xs font-bold ${STATUS_COLORS[a.status] ?? "text-slate-500 dark:text-gray-400"}`}>{a.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
