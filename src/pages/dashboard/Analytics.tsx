import { useMemo } from "react";
import {
  TrendingUp, CheckCircle2, ArrowDownLeft,
  ArrowUpRight, Users, DollarSign, ListChecks,
} from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useDeposits, useTaskSessions, useTeamMembers, useWithdrawals } from "../../hooks/useApi";


interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  iconBg: string;
  iconColor: string;
}

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wide truncate">{label}</p>
        <p className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

interface RecentRow {
  id: string;
  label: string;
  amount: string;
  date: string;
  status: string;
  isPositive: boolean;
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    Pending: "text-yellow-600 dark:text-yellow-400",
    Approved: "text-blue-600 dark:text-blue-400",
    Complete: "text-green-600 dark:text-green-400",
    Rejected: "text-red-600 dark:text-red-400",
  };
  return map[s] ?? "text-slate-600 dark:text-gray-400";
}

export function Analytics() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data: deposits = [] } = useDeposits(userId);
  const { data: withdrawals = [] } = useWithdrawals(userId);
  const { data: taskSessions = [] } = useTaskSessions(userId);
  const { data: users = [] } = useTeamMembers(userId, user?.referralCode);
  const teamCount = useMemo(() => {
    return users.filter(item => item.referredByUserId === userId || item.referredBy === user?.referralCode).length;
  }, [users, userId, user?.referralCode]);

  const totalDeposited = deposits
    .filter(d => d.status === "Approved" || d.status === "Complete")
    .reduce((s, d) => s + d.amount, 0);

  const totalWithdrawn = withdrawals
    .filter(w => w.status === "Complete" || w.status === "Approved")
    .reduce((s, w) => s + w.amount, 0);

  const sessionsDone = taskSessions.filter(session => session.completed || session.taskStatus === "completed").length;
  const totalTasksDone = taskSessions.reduce((s, session) => s + Number(session.completedCount ?? session.tasksDone ?? 0), 0);
  const totalTaskEarned = taskSessions.reduce((s, session) => s + Number(session.progressState?.totalEarned ?? session.totalEarned ?? 0), 0);

  const recentRows: RecentRow[] = [
    ...deposits.slice(0, 5).map(d => ({
      id: d.id,
      label: "Deposit",
      amount: `+${d.amount.toFixed(2)}`,
      date: d.date,
      status: d.status,
      isPositive: true,
    })),
    ...withdrawals.slice(0, 5).map(w => ({
      id: w.id,
      label: "Withdrawal",
      amount: `-${w.amount.toFixed(2)}`,
      date: w.date,
      status: w.status,
      isPositive: false,
    })),
    ...taskSessions.slice(0, 5).map(session => ({
      id: session.id ?? session.sessionId ?? `${session.userId}-${session.createdAt}`,
      label: `${session.taskCode ?? session.platformId ?? "Task"} - ${Number(session.completedCount ?? session.tasksDone ?? 0)} tasks`,
      amount: `+${Number(session.progressState?.totalEarned ?? session.totalEarned ?? 0).toFixed(2)}`,
      date: session.updatedAt ?? session.createdAt,
      status: "Complete",
      isPositive: true,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  const hasActivity = recentRows.length > 0;

  return (
    <DashboardLayout showBack title="Activity">
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">

        {/* Title */}
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight">Activity</h1>
          <p className="text-xs text-slate-500 dark:text-gray-400">Your earnings &amp; transaction history</p>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatCard
            icon={TrendingUp}
            label="Total Earned (Tasks)"
            value={`$${totalTaskEarned.toFixed(2)}`}
            sub={`${totalTasksDone} task${totalTasksDone !== 1 ? "s" : ""} done`}
            iconBg="bg-purple-50 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
          />
          <StatCard
            icon={ListChecks}
            label="Sessions Completed"
            value={String(sessionsDone)}
            sub={`${totalTasksDone} individual tasks`}
            iconBg="bg-indigo-50 dark:bg-indigo-900/30"
            iconColor="text-indigo-600 dark:text-indigo-400"
          />
          <StatCard
            icon={ArrowDownLeft}
            label="Total Deposited"
            value={`$${totalDeposited.toFixed(2)}`}
            sub={`${deposits.length} request${deposits.length !== 1 ? "s" : ""}`}
            iconBg="bg-green-50 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
          />
          <StatCard
            icon={ArrowUpRight}
            label="Total Withdrawn"
            value={`$${totalWithdrawn.toFixed(2)}`}
            sub={`${withdrawals.length} request${withdrawals.length !== 1 ? "s" : ""}`}
            iconBg="bg-rose-50 dark:bg-rose-900/30"
            iconColor="text-rose-600 dark:text-rose-400"
          />
          <StatCard
            icon={DollarSign}
            label="Current Balance"
            value={`$${(user?.balance ?? 0).toFixed(2)}`}
            sub="USDT"
            iconBg="bg-amber-50 dark:bg-amber-900/30"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <StatCard
            icon={Users}
            label="Team Members"
            value={String(teamCount)}
            sub="in your team"
            iconBg="bg-blue-50 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
          />
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Recent Activity</h2>
          {hasActivity ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
              {recentRows.map(row => (
                <div key={row.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      row.isPositive
                        ? "bg-green-50 dark:bg-green-900/20"
                        : "bg-red-50 dark:bg-red-900/20"
                    }`}
                  >
                    {row.isPositive ? (
                      <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-red-500 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{row.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">{row.date}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${row.isPositive ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                      {row.amount}
                    </p>
                    <p className={`text-[10px] font-medium ${statusColor(row.status)}`}>{row.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No activity yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Complete tasks or make a deposit to see your activity here.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
