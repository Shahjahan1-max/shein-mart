import { useState, useEffect, useMemo } from "react";
import {
  Search, CheckCircle2, Clock, AlertCircle, Download, ListChecks,
  TrendingUp, ArrowDownLeft, ArrowUpRight, Users, DollarSign, Activity,
  ShoppingCart,
} from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useLang } from "../../contexts/LangContext";
import { useAuth } from "../../contexts/AuthContext";
import { type AdTaskHistoryEntry, type AdTaskProgress } from "../../data/adsData";
import { useDeposits, useFirebaseCollection, useUserCollection, useFirebaseDoc, useTeamMembers, useWithdrawals } from "../../hooks/useApi";

type RecordStatus = "completed" | "pending" | "incomplete" | "failed";
type RecordType = "deposit" | "withdraw" | "earning" | "bonus" | "request";

interface TxRecord {
  id: string;
  type: RecordType;
  title: string;
  amount: string;
  currency: string;
  date: string;
  sortTs: number;
  status: RecordStatus;
  note?: string;
  ref?: string;
}

interface DepositRequest { id: string; userId: string; amount: number; status: string; date: string; }
interface WithdrawRequest { id: string; userId: string; amount: number; status: string; date: string; }

function mapTransactionStatus(s: string): RecordStatus {
  const status = String(s || "").trim().toLowerCase();
  if (status === "approved" || status === "complete" || status === "completed") return "completed";
  if (status === "pending" || status === "processing") return "pending";
  if (status === "rejected" || status === "failed") return "failed";
  return "incomplete";
}

function getTransactionTs(record: { id?: string; date?: string; createdAt?: string; updatedAt?: string }): number {
  const updatedTs = Date.parse(record.updatedAt || "");
  if (!Number.isNaN(updatedTs)) return updatedTs;
  const createdTs = Date.parse(record.createdAt || "");
  if (!Number.isNaN(createdTs)) return createdTs;
  const dateTs = Date.parse(record.date || "");
  if (!Number.isNaN(dateTs)) return dateTs;
  const idTs = Number(String(record.id || "").match(/\d{10,}/)?.[0] || 0);
  return Number.isFinite(idTs) ? idTs : 0;
}

const STATUS_CONFIG: Record<RecordStatus, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  completed: { label: "Completed", icon: CheckCircle2, color: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
  pending: { label: "Pending", icon: Clock, color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
  incomplete: { label: "Incomplete", icon: AlertCircle, color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20" },
  failed: { label: "Failed", icon: AlertCircle, color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
};

const TYPE_COLOR: Record<RecordType, string> = {
  deposit: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  withdraw: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  earning: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
  bonus: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300",
  request: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
};

type PageTab = "transactions" | "analytics" | "activity";
type TxTab = "all" | "completed" | "pending" | "incomplete";

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso; }
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    Pending: "text-yellow-600 dark:text-yellow-400",
    Approved: "text-blue-600 dark:text-blue-400",
    Complete: "text-green-600 dark:text-green-400",
    Rejected: "text-red-600 dark:text-red-400",
    Processing: "text-orange-600 dark:text-orange-400",
  };
  return map[s] ?? "text-slate-600 dark:text-gray-400";
}

/* ─── Analytics Panel ────────────────────────────────────── */
function AnalyticsPanel({ userId }: { userId: string }) {
  const { user } = useAuth();
  const { data: depositsData } = useDeposits(userId);
  const { data: withdrawalsData } = useWithdrawals(userId);
  const { data: adHistory = [] } = useUserCollection<AdTaskHistoryEntry & { userId?: string }>("adTaskHistory", userId);
  const { data: adProgressDoc } = useFirebaseDoc<AdTaskProgress | null>("adTaskProgress", userId || "guest", null);
  const { data: users = [] } = useTeamMembers(userId, user?.referralCode);
  const adProgress = { totalEarned: adProgressDoc?.totalEarned ?? 0, taskIndex: adProgressDoc?.taskIndex ?? 0 };
  const teamCount = users.filter(item => item.referredByUserId === userId || item.referredBy === user?.referralCode).length;

  const deposits = useMemo<DepositRequest[]>(() =>
    (depositsData ?? []).map(d => ({ id: d.id, userId: d.userId, amount: d.amount, status: d.status, date: d.date })),
    [depositsData],
  );
  const withdrawals = useMemo<WithdrawRequest[]>(() =>
    (withdrawalsData ?? []).map(w => ({ id: w.id, userId: w.userId, amount: w.amount, status: w.status, date: w.date })),
    [withdrawalsData],
  );

  const totalDeposited = deposits.filter(d => mapTransactionStatus(d.status) === "completed").reduce((s, d) => s + d.amount, 0);
  const totalWithdrawn = withdrawals.filter(w => mapTransactionStatus(w.status) === "completed").reduce((s, w) => s + w.amount, 0);
  const sessionsDone = adHistory.length;
  const totalTasksDone = adHistory.reduce((s, h) => s + h.tasksCompleted, 0);

  interface StatCard { icon: React.ElementType; label: string; value: string; sub?: string; iconBg: string; iconColor: string; }
  const STATS: StatCard[] = [
    { icon: TrendingUp, label: "Total Earned (Tasks)", value: `$${adProgress.totalEarned.toFixed(2)}`, sub: `${totalTasksDone} task${totalTasksDone !== 1 ? "s" : ""} done`, iconBg: "bg-purple-50 dark:bg-purple-900/30", iconColor: "text-purple-600 dark:text-purple-400" },
    { icon: ListChecks, label: "Sessions Completed", value: String(sessionsDone), sub: `${totalTasksDone} individual tasks`, iconBg: "bg-indigo-50 dark:bg-indigo-900/30", iconColor: "text-indigo-600 dark:text-indigo-400" },
    { icon: ArrowDownLeft, label: "Total Deposited", value: `$${totalDeposited.toFixed(2)}`, sub: `${deposits.length} request${deposits.length !== 1 ? "s" : ""}`, iconBg: "bg-green-50 dark:bg-green-900/30", iconColor: "text-green-600 dark:text-green-400" },
    { icon: ArrowUpRight, label: "Total Withdrawn", value: `$${totalWithdrawn.toFixed(2)}`, sub: `${withdrawals.length} request${withdrawals.length !== 1 ? "s" : ""}`, iconBg: "bg-rose-50 dark:bg-rose-900/30", iconColor: "text-rose-600 dark:text-rose-400" },
    { icon: DollarSign, label: "Current Balance", value: `$${(user?.balance ?? 0).toFixed(2)}`, sub: "USDT", iconBg: "bg-amber-50 dark:bg-amber-900/30", iconColor: "text-amber-600 dark:text-amber-400" },
    { icon: Users, label: "Team Members", value: String(teamCount), sub: "in your team", iconBg: "bg-blue-50 dark:bg-blue-900/30", iconColor: "text-blue-600 dark:text-blue-400" },
  ];

  return (
    <div className="space-y-5">
      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {STATS.map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
              <s.icon className={`w-5 h-5 ${s.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wide truncate">{s.label}</p>
              <p className="text-lg font-extrabold text-gray-900 dark:text-white leading-tight truncate">{s.value}</p>
              {s.sub && <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">{s.sub}</p>}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

/* ─── Activity Feed Panel ────────────────────────────────── */
interface ActivityEvent {
  id: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  amount?: string;
  amountColor?: string;
  date: string;
  rawDate: string;
}

function ActivityPanel({ userId }: { userId: string }) {
  const { data: depositsData } = useDeposits(userId);
  const { data: withdrawalsData } = useWithdrawals(userId);
  const { data: adHistory = [] } = useUserCollection<AdTaskHistoryEntry & { userId?: string }>("adTaskHistory", userId);
  const { data: platformProgress = [] } = useUserCollection<{ userId?: string; platformId: string; tasksDone: number; completed: boolean; totalEarned?: number }>("platformProgress", userId);

  const events = useMemo<ActivityEvent[]>(() => {
    if (!userId) return [];
    const list: ActivityEvent[] = [];

    // Deposits from API
    for (const d of (depositsData ?? [])) {
      list.push({
        id: `dep-${d.id}`,
        icon: ArrowDownLeft,
        iconBg: "bg-green-50 dark:bg-green-900/20",
        iconColor: "text-green-600 dark:text-green-400",
        title: "Deposit Request",
        subtitle: d.status,
        amount: `+${d.amount.toFixed(2)} USDT`,
        amountColor: "text-green-600",
        date: formatDate(d.date),
        rawDate: d.date,
      });
    }

    // Withdrawals from API
    for (const w of (withdrawalsData ?? [])) {
      list.push({
        id: `wd-${w.id}`,
        icon: ArrowUpRight,
        iconBg: "bg-red-50 dark:bg-red-900/20",
        iconColor: "text-red-600 dark:text-red-400",
        title: "Withdrawal Request",
        subtitle: w.status,
        amount: `-${w.amount.toFixed(2)} USDT`,
        amountColor: "text-red-500",
        date: formatDate(w.date),
        rawDate: w.date,
      });
    }

    // Ad task sessions from Firebase
    for (const h of adHistory.filter(item => item.userId === userId)) {
      list.push({
        id: `task-${h.id}`,
        icon: ShoppingCart,
        iconBg: "bg-purple-50 dark:bg-purple-900/20",
        iconColor: "text-purple-600 dark:text-purple-400",
        title: `Task Session — ${h.code}`,
        subtitle: `${h.tasksCompleted} tasks completed`,
        amount: `+${h.earnings.toFixed(2)} USDT`,
        amountColor: "text-green-600",
        date: formatDate(h.date),
        rawDate: h.date,
      });
    }

    // Platform progress from Firebase
    for (const state of platformProgress.filter(item => item.userId === userId)) {
      const platformId = state.platformId;
      if (state.tasksDone > 0) {
        list.push({
          id: `plat-${platformId}`,
          icon: ShoppingCart,
          iconBg: "bg-indigo-50 dark:bg-indigo-900/20",
          iconColor: "text-indigo-600 dark:text-indigo-400",
          title: `${platformId.charAt(0).toUpperCase() + platformId.slice(1)} Tasks`,
          subtitle: `${state.tasksDone}/25 tasks · ${state.completed ? "Completed" : "In progress"}`,
          amount: (state.totalEarned ?? 0) > 0 ? `+${(state.totalEarned ?? 0).toFixed(2)} USDT` : undefined,
          amountColor: "text-green-600",
          date: "Ongoing",
          rawDate: new Date().toISOString(),
        });
      }
    }

    list.sort((a, b) => b.rawDate.localeCompare(a.rawDate));
    return list;
  }, [userId, depositsData, withdrawalsData, adHistory, platformProgress]);

  if (events.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 py-20 text-center">
        <Activity className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No activity yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Your tasks, deposits, and withdrawals will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Recent Activity</p>
        <span className="text-xs text-slate-500 dark:text-gray-400">{events.length} events</span>
      </div>
      <div className="divide-y divide-gray-50 dark:divide-gray-700">
        {events.map(ev => {
          const Icon = ev.icon;
          return (
            <div key={ev.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <div className={`p-2.5 rounded-xl flex-shrink-0 ${ev.iconBg}`}>
                <Icon className={`h-4 w-4 ${ev.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{ev.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-500 dark:text-gray-400 truncate">{ev.subtitle}</p>
                  <span className="text-[10px] text-gray-300 dark:text-gray-600 flex-shrink-0">· {ev.date}</span>
                </div>
              </div>
              {ev.amount && (
                <p className={`text-sm font-bold flex-shrink-0 ${ev.amountColor}`}>{ev.amount}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export function Records() {
  const { t } = useLang();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [pageTab, setPageTab] = useState<PageTab>("transactions");
  const [tab, setTab] = useState<TxTab>("all");
  const [search, setSearch] = useState("");

  const { data: depositsData, loading: depsLoading } = useDeposits(userId);
  const { data: withdrawalsData, loading: wdsLoading } = useWithdrawals(userId);

  const allRecords = useMemo<TxRecord[]>(() => {
    const records: TxRecord[] = [];
    for (const d of (depositsData ?? [])) {
      const status = mapTransactionStatus(d.status);
      records.push({
        id: d.id, type: "deposit", title: "USDT Deposit",
        amount: `+${d.amount.toFixed(2)}`, currency: "USDT", date: d.date,
        sortTs: getTransactionTs(d),
        status, ref: d.id,
        note: status === "pending" ? "Awaiting admin approval" : undefined,
      });
    }
    for (const w of (withdrawalsData ?? [])) {
      const status = mapTransactionStatus(w.status);
      records.push({
        id: w.id, type: "withdraw", title: "USDT Withdrawal",
        amount: `-${w.amount.toFixed(2)}`, currency: "USDT", date: w.date,
        sortTs: getTransactionTs(w),
        status, ref: w.id,
        note: status === "pending" ? "Under review" : undefined,
      });
    }
    return records.sort((a, b) => b.sortTs - a.sortTs);
  }, [depositsData, withdrawalsData]);

  const TABS: { key: TxTab; label: string; count: number }[] = [
    { key: "all", label: t("allRecords"), count: allRecords.length },
    { key: "completed", label: t("completed"), count: allRecords.filter(r => r.status === "completed").length },
    { key: "pending", label: t("pending"), count: allRecords.filter(r => r.status === "pending").length },
    { key: "incomplete", label: t("incomplete"), count: allRecords.filter(r => r.status === "incomplete" || r.status === "failed").length },
  ];

  const filtered = allRecords.filter(r => {
    const matchTab = tab === "all" ? true : tab === "incomplete" ? (r.status === "incomplete" || r.status === "failed") : r.status === tab;
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || (r.ref ?? "").toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const isLoading = depsLoading || wdsLoading;

  const PAGE_TABS = [
    { key: "transactions" as PageTab, label: t("transactions") },
    { key: "analytics" as PageTab,    label: t("analytics")    },
    { key: "activity" as PageTab,     label: t("myActivity")   },
  ];

  return (
    <DashboardLayout
      showBack
      title={t("records")}
      backTo="/dashboard"
      actions={
        pageTab === "transactions" ? (
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
            <Download className="h-3.5 w-3.5" /> {t("export")}
          </button>
        ) : undefined
      }
    >
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
        {/* Page-level tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
          {PAGE_TABS.map(pt => (
            <button
              key={pt.key}
              onClick={() => setPageTab(pt.key)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 touch-manipulation active:scale-95 ${
                pageTab === pt.key
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {pt.label}
            </button>
          ))}
        </div>

        {pageTab === "analytics" ? (
          <AnalyticsPanel userId={userId} />
        ) : pageTab === "activity" ? (
          <ActivityPanel userId={userId} />
        ) : (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
              {[
                { label: t("totalRecords"), value: allRecords.length, color: "text-gray-900 dark:text-white" },
                { label: t("completed"), value: allRecords.filter(r => r.status === "completed").length, color: "text-green-700 dark:text-green-400" },
                { label: t("pending"), value: allRecords.filter(r => r.status === "pending").length, color: "text-yellow-700 dark:text-yellow-400" },
                { label: t("incomplete"), value: allRecords.filter(r => r.status === "incomplete" || r.status === "failed").length, color: "text-orange-700 dark:text-orange-400" },
              ].map(s => (
                <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-3.5 py-3">
                  <p className={`text-xl sm:text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Tabs + search */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-gray-50 dark:border-gray-700">
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5 -mx-1 px-1">
                  {TABS.map(tb => (
                    <button key={tb.key} onClick={() => setTab(tb.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 touch-manipulation ${
                        tab === tb.key ? "bg-purple-600 text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}>
                      {tb.label}
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === tb.key ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}>
                        {tb.count}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="relative sm:ml-auto w-full sm:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 dark:text-gray-400 pointer-events-none" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("searchRecords")}
                    className="w-full sm:w-52 pl-8 pr-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all" />
                </div>
              </div>

              {isLoading ? (
                <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">Loading records…</div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">{t("noRecordsFound")}</div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-700">
                  {filtered.map(rec => {
                    const sc = STATUS_CONFIG[rec.status];
                    return (
                      <div key={rec.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <div className={`p-2 rounded-xl flex-shrink-0 ${sc.bg}`}>
                          <sc.icon className={`h-4 w-4 ${sc.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{rec.title}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${TYPE_COLOR[rec.type]}`}>{rec.type}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-slate-500 dark:text-gray-400">{rec.date}</p>
                            {rec.ref && <span className="text-[10px] text-slate-500 dark:text-gray-400">· {rec.ref}</span>}
                            {rec.note && <span className="text-[10px] text-orange-600 dark:text-orange-400 italic">· {rec.note}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${rec.amount.startsWith("+") ? "text-green-600" : "text-red-500"}`}>
                            {rec.amount} {rec.currency}
                          </p>
                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.color} mt-0.5`}>
                            {sc.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </DashboardLayout>
  );
}
