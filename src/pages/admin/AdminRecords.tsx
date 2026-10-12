import { useState, useMemo } from "react";
import AdminLayout from "./AdminLayout";
import { Search, ListChecks, Loader2 } from "lucide-react";
import { TransactionsApprovalPanel } from "./AdminTransactions";
import { OrdersPanel } from "./AdminOrders";
import { useDepositsPage, useTaskSessionsPage, useWithdrawalsPage, useUsersPage } from "../../hooks/useApi";

type RecordType = "deposit" | "withdrawal" | "earning" | "bonus" | "referral";
type RecordStatus = "completed" | "pending" | "incomplete" | "rejected";

interface AdminRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: RecordType;
  title: string;
  amount: number;
  date: string;
  status: RecordStatus;
}

function mapDepStatus(s?: string): RecordStatus {
  if (!s) return "pending";
  const l = s.toLowerCase();
  if (l === "approved" || l === "completed") return "completed";
  if (l === "rejected" || l === "declined") return "rejected";
  if (l === "incomplete") return "incomplete";
  return "pending";
}

interface FlatAdTaskRecord {
  id: string;
  code: string;
  date: string;
  earnings: number;
  tasksCompleted: number;
  userName: string;
  userEmail: string;
  userId: string;
}

function TypeBadge({ type }: { type: RecordType }) {
  const map: Record<RecordType, string> = {
    deposit: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800",
    withdrawal: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800",
    earning: "bg-purple-900/40 text-purple-400 border-purple-800",
    bonus: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800",
    referral: "bg-emerald-900/40 text-emerald-400 border-emerald-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[type]}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: RecordStatus }) {
  const map: Record<RecordStatus, string> = {
    completed: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800",
    pending: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800",
    incomplete: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800",
    rejected: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status]}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
}

/* ─── Ad Task History Tab ────────────────────────────────── */
function AdTaskHistoryTab() {
  const { data: users = [], loading: usersLoading } = useUsersPage(25);
  const { data: sessions = [], loading: sessionsLoading, hasMore, loadMore, loadingMore } = useTaskSessionsPage(25);
  const [search, setSearch] = useState("");

  const rows = useMemo<FlatAdTaskRecord[]>(() => {
    const byUser = new Map(users.map(user => [user.id, user]));
    return sessions
      .filter(session => Number(session.completedCount ?? session.tasksDone ?? 0) > 0)
      .map(session => {
        const user = byUser.get(session.userId);
        return {
          id: session.id ?? session.sessionId ?? `${session.userId}-${session.createdAt}`,
          code: session.taskCode ?? session.platformId ?? "task",
          date: session.updatedAt ?? session.createdAt,
          earnings: Number(session.progressState?.totalEarned ?? session.totalEarned ?? 0),
          tasksCompleted: Number(session.completedCount ?? session.tasksDone ?? 0),
          userName: user?.name ?? session.userId,
          userEmail: user?.email ?? "",
          userId: session.userId,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, users]);

  const loading = usersLoading || sessionsLoading;

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return (
      r.userName.toLowerCase().includes(q) ||
      r.userEmail.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q)
    );
  });

  const totalEarned = rows.reduce((s, r) => s + r.earnings, 0);
  const totalTasks = rows.reduce((s, r) => s + r.tasksCompleted, 0);

  return (
    <>
      {loading && (
        <div className="flex items-center justify-center py-12 gap-2 text-slate-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading task history...
        </div>
      )}

      {!loading && (
      <>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Sessions", value: rows.length, color: "text-slate-900 dark:text-white" },
          { label: "Tasks Completed", value: totalTasks, color: "text-purple-400" },
          { label: "Total Earned", value: `$${totalEarned.toFixed(2)}`, color: "text-green-400" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-gray-400" />
        <input type="text" placeholder="Search user or ad code…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="text-left text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">User</th>
                <th className="text-left text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Ad Code</th>
                <th className="text-center text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Tasks Done</th>
                <th className="text-right text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Earned</th>
                <th className="text-left text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-100 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-slate-900 dark:text-white text-sm font-medium">{r.userName}</p>
                    <p className="text-slate-600 dark:text-gray-400 text-xs">{r.userEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-purple-900/40 text-purple-400 border-purple-800">
                      Code {r.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-900 dark:text-white text-sm font-semibold">{r.tasksCompleted}</td>
                  <td className="px-4 py-3 text-right text-green-400 font-semibold text-sm">+{r.earnings.toFixed(2)} USDT</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs">{formatDate(r.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-14 text-slate-600 dark:text-gray-400">
              <ListChecks className="w-8 h-8 mx-auto mb-2 text-gray-700" />
              <p className="text-sm">No ad task sessions found.</p>
            </div>
          )}
        </div>
      </div>
      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-slate-900 dark:text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
      </>
      )}
    </>
  );
}

/* ─── Main ───────────────────────────────────────────────── */
type PageTab = "transactions" | "approval" | "orders" | "adtasks";

export default function AdminRecords() {
  const [pageTab, setPageTab] = useState<PageTab>("transactions");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | RecordType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | RecordStatus>("all");
  const { data: users = [], loading: usersLoading } = useUsersPage(25);
  const { data: deposits = [], loading: depositsLoading, hasMore: hasMoreDeposits, loadMore: loadMoreDeposits, loadingMore: loadingMoreDeposits } = useDepositsPage(25);
  const { data: withdrawals = [], loading: withdrawalsLoading, hasMore: hasMoreWithdrawals, loadMore: loadMoreWithdrawals, loadingMore: loadingMoreWithdrawals } = useWithdrawalsPage(25);
  const loading = usersLoading || depositsLoading || withdrawalsLoading;

  const records = useMemo<AdminRecord[]>(() => {
    const byUser = new Map(users.map(user => [user.id, user]));
    const depositRecords: AdminRecord[] = deposits.map(deposit => {
      const user = byUser.get(deposit.userId);
      return {
        id: deposit.id,
        userId: deposit.userId,
        userName: deposit.userName ?? user?.name ?? deposit.userId,
        userEmail: user?.email ?? "",
        type: "deposit",
        title: `${deposit.protocol || "USDT"} deposit`,
        amount: Number(deposit.amount || 0),
        date: deposit.date || formatDate(deposit.createdAt),
        status: mapDepStatus(deposit.status),
      };
    });
    const withdrawalRecords: AdminRecord[] = withdrawals.map(withdrawal => {
      const user = byUser.get(withdrawal.userId);
      return {
        id: withdrawal.id,
        userId: withdrawal.userId,
        userName: withdrawal.userName ?? user?.name ?? withdrawal.userId,
        userEmail: user?.email ?? "",
        type: "withdrawal",
        title: `${withdrawal.protocol || "USDT"} withdrawal`,
        amount: Number(withdrawal.amount || 0),
        date: withdrawal.date || formatDate(withdrawal.createdAt),
        status: mapDepStatus(withdrawal.status),
      };
    });
    return [...depositRecords, ...withdrawalRecords].sort((a, b) => b.date.localeCompare(a.date));
  }, [deposits, users, withdrawals]);

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    const matchQ = r.userName.toLowerCase().includes(q) || r.userEmail.toLowerCase().includes(q) || r.title.toLowerCase().includes(q);
    const matchType = typeFilter === "all" || r.type === typeFilter;
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchQ && matchType && matchStatus;
  });

  return (
    <AdminLayout title="Records Management">
      {/* Page-level tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto flex-nowrap pb-1">
        {([
          { key: "transactions" as PageTab, label: "Transaction History" },
          { key: "approval" as PageTab, label: "Approval Transactions" },
          { key: "orders" as PageTab, label: "Orders" },
          { key: "adtasks" as PageTab, label: "Task History" },
        ]).map(pt => (
          <button
            key={pt.key}
            onClick={() => setPageTab(pt.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              pageTab === pt.key
                ? "bg-purple-600 text-white"
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-slate-900 dark:text-white"
            }`}
          >
            {pt.label}
          </button>
        ))}
      </div>

      {pageTab === "adtasks" && <AdTaskHistoryTab />}
      {pageTab === "approval" && <TransactionsApprovalPanel />}
      {pageTab === "orders" && <OrdersPanel />}
      {pageTab === "transactions" && loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading transaction records...
        </div>
      )}
      {pageTab === "transactions" && !loading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {(["completed", "pending", "incomplete", "rejected"] as RecordStatus[]).map(s => {
              const count = records.filter(r => r.status === s).length;
              const colors: Record<RecordStatus, string> = { completed: "text-green-400", pending: "text-yellow-400", incomplete: "text-red-400", rejected: "text-red-400" };
              return (
                <div key={s} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
                  <p className={`text-xl font-bold ${colors[s]}`}>{count}</p>
                  <p className="text-slate-500 dark:text-gray-400 text-xs capitalize mt-1">{s}</p>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-gray-400" />
              <input type="text" placeholder="Search user, email, title…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["all", "deposit", "withdrawal", "earning", "bonus", "referral"] as const).map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-colors ${typeFilter === t ? "bg-purple-600 text-white" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-slate-500 dark:text-gray-400 hover:text-white"}`}>
                  {t}
                </button>
              ))}
              <div className="w-px bg-gray-800" />
              {(["all", "completed", "pending", "incomplete"] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-gray-600 text-slate-900 dark:text-white" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-slate-900 dark:text-white"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="text-left text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">User</th>
                    <th className="text-left text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Record</th>
                    <th className="text-left text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Type</th>
                    <th className="text-right text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Amount</th>
                    <th className="text-left text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Date</th>
                    <th className="text-center text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-gray-100 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-slate-900 dark:text-white text-sm font-medium">{r.userName}</p>
                        <p className="text-slate-600 dark:text-gray-400 text-xs">{r.userEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-gray-300 text-sm">{r.title}</td>
                      <td className="px-4 py-3"><TypeBadge type={r.type} /></td>
                      <td className="px-4 py-3 text-right text-slate-900 dark:text-white font-semibold text-sm">${r.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs">{r.date}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && records.length === 0 && (
                <div className="text-center py-12 text-slate-600 dark:text-gray-400">
                  <p className="text-sm">No transactions yet. Deposits and withdrawals will appear here once users submit them.</p>
                </div>
              )}
              {filtered.length === 0 && records.length > 0 && (
                <div className="text-center py-12 text-slate-600 dark:text-gray-400">
                  <p className="text-sm">No records match the current filters.</p>
                </div>
              )}
            </div>
          </div>
          {(hasMoreDeposits || hasMoreWithdrawals) && (
            <div className="flex justify-center mt-4 gap-2">
              {hasMoreDeposits && (
                <button
                  onClick={loadMoreDeposits}
                  disabled={loadingMoreDeposits}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-slate-900 dark:text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {loadingMoreDeposits ? "Loading deposits..." : "Load More Deposits"}
                </button>
              )}
              {hasMoreWithdrawals && (
                <button
                  onClick={loadMoreWithdrawals}
                  disabled={loadingMoreWithdrawals}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-slate-900 dark:text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {loadingMoreWithdrawals ? "Loading withdrawals..." : "Load More Withdrawals"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
