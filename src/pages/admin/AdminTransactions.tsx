import { useState } from "react";
import AdminLayout from "./AdminLayout";
import { TxStatus } from "../../data/adminData";
import {
  Search, CheckCircle, XCircle, Clock, Pencil, Check, X, ArrowDownLeft, ArrowUpRight, Loader2,
  Eye, Image as ImageIcon, Download
} from "lucide-react";
import {
  maybeNotifyDepositApproved,
  maybeNotifyDepositRejected,
  maybeNotifyWithdrawalApproved,
  maybeNotifyWithdrawalRejected,
} from "../../lib/notificationHelpers";
import { useDepositsPage, useWithdrawalsPage, updateDeposit, updateWithdrawal, type ApiDeposit, type ApiWithdrawal } from "../../hooks/useApi";
import { InspectDepositModal } from "../../components/admin/InspectDepositModal";
import { ExportTransactionsModal } from "../../components/admin/ExportTransactionsModal";

type Tab = "all" | "deposits" | "withdrawals";

const STATUS_STYLES: Record<string, string> = {
  Pending:    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800 font-bold",
  Processing: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800 font-bold",
  Approved:   "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 font-bold",
  Rejected:   "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 font-bold",
  Complete:   "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 font-bold",
};

export function TransactionsApprovalPanel() {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const { data: apiDeps, loading: depsLoading, refetch: refetchDeps, hasMore: hasMoreDeps, loadMore: loadMoreDeps, loadingMore: loadingMoreDeps } = useDepositsPage(25, {
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const { data: apiWds, loading: wdsLoading, refetch: refetchWds, hasMore: hasMoreWds, loadMore: loadMoreWds, loadingMore: loadingMoreWds } = useWithdrawalsPage(25, {
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const deps = apiDeps ?? [];
  const wds = apiWds ?? [];
  const loading = depsLoading || wdsLoading;

  const [editId, setEditId] = useState<string | null>(null);
  const [editAmt, setEditAmt] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [inspectingDeposit, setInspectingDeposit] = useState<ApiDeposit | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function triggerToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  async function handleDepStatus(dep: ApiDeposit, status: string) {
    setSaving(dep.id);
    try {
      const patch: Partial<ApiDeposit> = { status };
      if (status === "completed" && !dep.creditedAt) {
        patch.creditedAt = new Date().toISOString();
        patch.creditedAmount = dep.amount + (dep.bonusAmount ?? 0);
        maybeNotifyDepositApproved(dep.userId, dep.amount);
      } else if (status === "rejected") {
        maybeNotifyDepositRejected(dep.userId, dep.amount);
      }
      await updateDeposit(dep.id, patch);
      refetchDeps();
    } catch (err) { console.error(err); }
    finally { setSaving(null); }
  }

  async function handleWdStatus(wd: ApiWithdrawal, status: string) {
    setSaving(wd.id);
    try {
      await updateWithdrawal(wd.id, { status });
      if (status === "completed") maybeNotifyWithdrawalApproved(wd.userId, wd.amount);
      else if (status === "rejected") maybeNotifyWithdrawalRejected(wd.userId, wd.amount);
      refetchWds();
    } catch (err) { console.error(err); }
    finally { setSaving(null); }
  }

  async function saveDepAmount(dep: ApiDeposit) {
    const amt = parseFloat(editAmt);
    if (isNaN(amt) || amt <= 0) return;
    setSaving(dep.id);
    try { await updateDeposit(dep.id, { amount: amt }); refetchDeps(); }
    catch (err) { console.error(err); }
    finally { setSaving(null); setEditId(null); }
  }

  async function saveWdAmount(wd: ApiWithdrawal) {
    const amt = parseFloat(editAmt);
    if (isNaN(amt) || amt <= 0) return;
    setSaving(wd.id);
    try { await updateWithdrawal(wd.id, { amount: amt }); refetchWds(); }
    catch (err) { console.error(err); }
    finally { setSaving(null); setEditId(null); }
  }

  const q = search.toLowerCase();
  const filteredDeps = deps.filter(d =>
    ((d.userName ?? "").toLowerCase().includes(q) || d.userId.toLowerCase().includes(q)) &&
    (statusFilter === "all" || d.status === statusFilter)
  );
  const filteredWds = wds.filter(w =>
    ((w.userName ?? "").toLowerCase().includes(q) || w.userId.toLowerCase().includes(q)) &&
    (statusFilter === "all" || w.status === statusFilter)
  );

  type CombinedRow = { kind: "dep"; row: ApiDeposit } | { kind: "wd"; row: ApiWithdrawal };
  const filteredAll: CombinedRow[] = [
    ...filteredDeps.map(d => ({ kind: "dep" as const, row: d })),
    ...filteredWds.map(w => ({ kind: "wd" as const, row: w })),
  ].sort((a, b) => b.row.date.localeCompare(a.row.date));

  const pendingDeps = deps.filter(d => d.status === "pending").length;
  const pendingWds  = wds.filter(w => w.status === "pending").length;

  const statusStyles: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800 font-bold",
    approved:  "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 font-bold",
    rejected:  "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 font-bold",
    completed: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 font-bold",
  };

  return (
    <>
      {/* Toast message */}
      {toastMessage && (
        <div className="mb-4 bg-emerald-900/30 border border-emerald-700/50 text-emerald-300 text-sm font-semibold px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Tab bar + Export Button */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(["all", "deposits", "withdrawals"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${tab === t ? "bg-purple-600 text-white shadow-xs" : "bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"}`}>
              {t === "deposits" && <ArrowDownLeft className="w-4 h-4" />}
              {t === "withdrawals" && <ArrowUpRight className="w-4 h-4" />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "all" && pendingDeps + pendingWds > 0 && <span className="ml-1 bg-amber-500 text-slate-950 text-xs font-extrabold rounded-full px-1.5 py-0.5">{pendingDeps + pendingWds}</span>}
              {t === "deposits" && pendingDeps > 0 && <span className="ml-1 bg-amber-500 text-slate-950 text-xs font-extrabold rounded-full px-1.5 py-0.5">{pendingDeps}</span>}
              {t === "withdrawals" && pendingWds > 0 && <span className="ml-1 bg-amber-500 text-slate-950 text-xs font-extrabold rounded-full px-1.5 py-0.5">{pendingWds}</span>}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs cursor-pointer ml-auto"
          title="Export total transaction history to CSV / Excel"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user or ID…"
            className="w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white font-medium placeholder-slate-400 dark:placeholder-gray-500 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 shadow-xs" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {["all", "pending", "approved", "rejected", "completed"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-colors flex-shrink-0 touch-manipulation ${statusFilter === s ? "bg-purple-600 text-white shadow-xs" : "bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="flex items-center justify-center py-12 gap-2 text-slate-500 dark:text-gray-400 font-medium"><Loader2 className="w-5 h-5 animate-spin text-primary" /> Loading…</div>}

      {!loading && (
        <>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs">
          <div className="responsive-table-container">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-transparent text-slate-700 dark:text-gray-300 text-xs font-extrabold uppercase tracking-wide">
                  <th className="text-left px-4 py-3">User</th>
                  {tab === "all" && <th className="text-left px-4 py-3">Type</th>}
                  <th className="text-left px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Protocol</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {(tab === "all" ? filteredAll : tab === "deposits"
                  ? filteredDeps.map(d => ({ kind: "dep" as const, row: d }))
                  : filteredWds.map(w => ({ kind: "wd" as const, row: w }))
                ).map(({ kind, row }) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-bold">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{(row as ApiDeposit).userName ?? "User"}</span>
                        {kind === "dep" && (row as ApiDeposit).proofUrl && (
                          <button
                            onClick={() => setInspectingDeposit(row as ApiDeposit)}
                            className="inline-flex items-center gap-1 text-[10px] font-extrabold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-md hover:bg-purple-200 transition-colors"
                            title="Inspect Proof Screenshot"
                          >
                            <ImageIcon className="w-3 h-3 text-purple-600" /> Proof
                          </button>
                        )}
                      </div>
                    </td>
                    {tab === "all" && (
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${kind === "dep" ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" : "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800"}`}>
                          {kind === "dep" ? "Deposit" : "Withdraw"}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {editId === row.id ? (
                        <div className="flex items-center gap-1">
                          <input value={editAmt} onChange={e => setEditAmt(e.target.value)} type="number" min="0.01"
                            className="w-24 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-900 dark:text-white rounded-lg px-2 py-1 text-sm font-bold" />
                          <button onClick={() => kind === "dep" ? saveDepAmount(row as ApiDeposit) : saveWdAmount(row as ApiWithdrawal)} className="text-emerald-700 dark:text-green-400"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditId(null)} className="text-slate-400"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-1">
                          <div>
                            <span className="text-slate-900 dark:text-white font-extrabold">${row.amount.toFixed(2)}</span>
                            {kind === "dep" && (row as ApiDeposit).bonusAmount != null && (row as ApiDeposit).bonusAmount! > 0 && (
                              <p className="text-emerald-700 dark:text-green-400 text-xs font-bold">+ ${(row as ApiDeposit).bonusAmount!.toFixed(2)} bonus</p>
                            )}
                            {kind === "wd" && (row as ApiWithdrawal).taxAmount != null && (row as ApiWithdrawal).taxAmount! > 0 && (
                              <p className="text-red-600 dark:text-red-400 text-xs font-bold">− ${(row as ApiWithdrawal).taxAmount!.toFixed(2)} tax</p>
                            )}
                          </div>
                          <button onClick={() => { setEditId(row.id); setEditAmt(row.amount.toString()); }} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-700 dark:text-gray-300 ml-1 mt-0.5">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-gray-300 font-semibold">{row.protocol}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-gray-400 font-medium">{row.date}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full border ${statusStyles[row.status] ?? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {kind === "dep" && (
                          <button
                            onClick={() => setInspectingDeposit(row as ApiDeposit)}
                            className="flex items-center gap-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg text-xs font-bold transition-colors"
                            title="Inspect Deposit Details & Proof"
                          >
                            <Eye className="w-3.5 h-3.5" /> Inspect
                          </button>
                        )}

                        {saving === row.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        ) : (
                          <>
                            {row.status === "pending" && (
                              <>
                                <button onClick={() => kind === "dep" ? handleDepStatus(row as ApiDeposit, "completed") : handleWdStatus(row as ApiWithdrawal, "completed")}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-green-900/40 dark:hover:bg-green-800/60 dark:text-green-400 rounded-lg text-xs font-bold transition-colors">
                                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button onClick={() => kind === "dep" ? handleDepStatus(row as ApiDeposit, "rejected") : handleWdStatus(row as ApiWithdrawal, "rejected")}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900/40 dark:hover:bg-red-800/60 dark:text-red-400 rounded-lg text-xs font-bold transition-colors">
                                  <XCircle className="w-3.5 h-3.5" /> Reject
                                </button>
                              </>
                            )}
                            {(row.status === "completed" || row.status === "rejected") && (
                              <button onClick={() => kind === "dep" ? handleDepStatus(row as ApiDeposit, "pending") : handleWdStatus(row as ApiWithdrawal, "pending")}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-yellow-900/40 dark:hover:bg-yellow-800/60 dark:text-yellow-400 rounded-lg text-xs font-bold transition-colors">
                                <Clock className="w-3.5 h-3.5" /> Reset
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAll.length === 0 && !loading && <div className="text-center py-12 text-slate-500 dark:text-gray-400 font-medium">No transactions found.</div>}
          </div>
        </div>
        {(hasMoreDeps || hasMoreWds) && (
          <div className="flex justify-center gap-2 py-4">
            {hasMoreDeps && (
              <button
                onClick={loadMoreDeps}
                disabled={loadingMoreDeps}
                className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white text-sm font-bold disabled:opacity-60 shadow-xs"
              >
                {loadingMoreDeps ? "Loading deposits..." : "Load More Deposits"}
              </button>
            )}
            {hasMoreWds && (
              <button
                onClick={loadMoreWds}
                disabled={loadingMoreWds}
                className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white text-sm font-bold disabled:opacity-60 shadow-xs"
              >
                {loadingMoreWds ? "Loading withdrawals..." : "Load More Withdrawals"}
              </button>
            )}
          </div>
        )}
        </>
      )}

      {/* Inspect Deposit Modal */}
      <InspectDepositModal
        deposit={inspectingDeposit}
        isOpen={Boolean(inspectingDeposit)}
        onClose={() => setInspectingDeposit(null)}
        onApprove={async dep => {
          await handleDepStatus(dep, "completed");
          setInspectingDeposit(null);
        }}
        onReject={async dep => {
          await handleDepStatus(dep, "rejected");
          setInspectingDeposit(null);
        }}
        onReset={async dep => {
          await handleDepStatus(dep, "pending");
          setInspectingDeposit(null);
        }}
        isProcessing={saving === inspectingDeposit?.id}
      />

      {/* Export Transactions Modal */}
      <ExportTransactionsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        initialType={tab}
        initialStatus={statusFilter}
        onSuccessToast={triggerToast}
      />
    </>
  );
}

export default function AdminTransactions() {
  return (
    <AdminLayout title="Transactions">
      <TransactionsApprovalPanel />
    </AdminLayout>
  );
}
