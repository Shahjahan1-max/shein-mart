import { useMemo } from "react";
import AdminLayout from "./AdminLayout";
import { Users, DollarSign, TrendingUp, ArrowDownLeft, ArrowUpRight, Activity, Loader2 } from "lucide-react";
import { useDeposits, useTaskSessions, useUsers, useWithdrawals } from "../../hooks/useApi";

interface DepReq { id: string; userId?: string; amount: number; status: string; date: string; }
interface WdReq  { id: string; userId?: string; amount: number; status: string; date: string; }
interface Stats {
  totalUsers: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalEarned: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  approvedDeposits: number;
  approvedWithdrawals: number;
  recentActivity: Array<{ id: string; type: string; label: string; amount: string; date: string; status: string }>;
}

function isApproved(status: string): boolean {
  const s = status.toLowerCase();
  return s === "approved" || s === "complete" || s === "completed";
}

function isPending(status: string): boolean {
  return status.toLowerCase() === "pending";
}

function computeStats(users: { id: string; name: string }[], deps: DepReq[], wds: WdReq[], sessions: { progressState?: { totalEarned?: number }; totalEarned?: number }[]): Stats {
  const totalEarned = sessions.reduce((sum, session) => sum + Number(session.progressState?.totalEarned ?? session.totalEarned ?? 0), 0);

  const approvedDeps = deps.filter(d => isApproved(d.status));
  const approvedWds  = wds.filter(w  => isApproved(w.status));

  const recentActivity = [
    ...deps.slice(-10).reverse().map(d => ({
      id: d.id,
      type: "deposit",
      label: `Deposit${d.userId ? " · " + (users.find(u => u.id === d.userId)?.name ?? d.userId) : ""}`,
      amount: `+$${d.amount.toFixed(2)}`,
      date: d.date,
      status: d.status,
    })),
    ...wds.slice(-10).reverse().map(w => ({
      id: w.id,
      type: "withdrawal",
      label: `Withdrawal${w.userId ? " · " + (users.find(u => u.id === w.userId)?.name ?? w.userId) : ""}`,
      amount: `-$${w.amount.toFixed(2)}`,
      date: w.date,
      status: w.status,
    })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 20);

  return {
    totalUsers: users.length,
    totalDeposited: approvedDeps.reduce((s, d) => s + d.amount, 0),
    totalWithdrawn: approvedWds.reduce((s, w) => s + w.amount, 0),
    totalEarned,
    pendingDeposits: deps.filter(d => isPending(d.status)).length,
    pendingWithdrawals: wds.filter(w => isPending(w.status)).length,
    approvedDeposits: approvedDeps.length,
    approvedWithdrawals: approvedWds.length,
    recentActivity,
  };
}

const STATUS_COLORS: Record<string, string> = {
  Pending:  "text-yellow-400",
  Approved: "text-green-400",
  Rejected: "text-red-400",
  Complete: "text-blue-400",
};

export default function AdminAnalytics() {
  const { data: users = [], loading: usersLoading } = useUsers();
  const { data: deps = [], loading: depsLoading } = useDeposits();
  const { data: wds = [], loading: wdsLoading } = useWithdrawals();
  const { data: sessions = [], loading: sessionsLoading } = useTaskSessions();
  const loading = usersLoading || depsLoading || wdsLoading || sessionsLoading;
  const stats = useMemo(
    () => computeStats(users, deps, wds, sessions),
    [users, deps, wds, sessions],
  );

  const kpis = [
    { label: "Total Users",       value: stats.totalUsers.toString(),             icon: Users,        color: "text-purple-400", bg: "bg-purple-900/20" },
    { label: "Total Deposited",   value: `$${stats.totalDeposited.toFixed(2)}`,   icon: ArrowDownLeft,color: "text-green-400",  bg: "bg-green-900/20" },
    { label: "Total Withdrawn",   value: `$${stats.totalWithdrawn.toFixed(2)}`,   icon: ArrowUpRight, color: "text-red-400",    bg: "bg-red-900/20" },
    { label: "Total Earned",      value: `$${stats.totalEarned.toFixed(2)}`,      icon: TrendingUp,   color: "text-amber-400",  bg: "bg-amber-900/20" },
    { label: "Pending Deposits",  value: stats.pendingDeposits.toString(),         icon: DollarSign,   color: "text-yellow-400", bg: "bg-yellow-900/20" },
    { label: "Pending Withdrawals",value:stats.pendingWithdrawals.toString(),      icon: Activity,     color: "text-orange-400", bg: "bg-orange-900/20" },
  ];

  return (
    <AdminLayout title="Analytics">
      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading analytics data...
        </div>
      )}
      {!loading && (
      <div className="space-y-6">
        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {kpis.map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-slate-500 dark:text-gray-400 text-xs font-medium">{kpi.label}</p>
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
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-slate-900 dark:text-white font-semibold">Recent Activity</h2>
            <p className="text-slate-600 dark:text-gray-400 text-xs mt-0.5">All deposits and withdrawals</p>
          </div>
          {stats.recentActivity.length === 0 ? (
            <div className="text-center py-12 text-slate-600 dark:text-gray-400 text-sm">No activity yet.</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {stats.recentActivity.map(a => (
                <div key={a.id} className="flex items-center px-5 py-3.5 gap-4 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${a.type === "deposit" ? "bg-green-900/30" : "bg-red-900/30"}`}>
                    {a.type === "deposit"
                      ? <ArrowDownLeft className="w-4 h-4 text-green-400" />
                      : <ArrowUpRight  className="w-4 h-4 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 dark:text-white text-sm font-medium truncate">{a.label}</p>
                    <p className="text-slate-600 dark:text-gray-400 text-xs">{a.date}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${a.type === "deposit" ? "text-green-400" : "text-red-400"}`}>{a.amount}</p>
                    <p className={`text-xs ${STATUS_COLORS[a.status] ?? "text-slate-600 dark:text-gray-400"}`}>{a.status}</p>
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
