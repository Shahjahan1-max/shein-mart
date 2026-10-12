import AdminLayout from "./AdminLayout";
import { TxStatus } from "../../data/adminData";
import { Search, CheckCircle, XCircle, Clock, Pencil, Check, X, Loader2, Eye, Image as ImageIcon } from "lucide-react";
import { maybeNotifyDepositApproved, maybeNotifyDepositRejected } from "../../lib/notificationHelpers";
import { useDepositsPage, updateDeposit, type ApiDeposit } from "../../hooks/useApi";
import { InspectDepositModal } from "../../components/admin/InspectDepositModal";
import { useState } from "react";

type FilterStatus = "all" | TxStatus;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800",
    approved:  "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800",
    rejected:  "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? "bg-gray-800 text-slate-500 dark:text-gray-400 border-gray-700"}`}>
      {status}
    </span>
  );
}

export default function AdminDeposits() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const { data: deposits, loading, error, refetch, hasMore, loadMore, loadingMore } = useDepositsPage(25, {
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [inspectingDeposit, setInspectingDeposit] = useState<ApiDeposit | null>(null);

  const list = deposits ?? [];

  const filtered = list.filter(d => {
    const q = search.toLowerCase();
    const match = (d.userName ?? "").toLowerCase().includes(q) || (d.userId ?? "").toLowerCase().includes(q);
    const statusMatch = statusFilter === "all" || d.status === statusFilter;
    return match && statusMatch;
  });

  async function handleStatusChange(deposit: ApiDeposit, newStatus: string) {
    setSaving(deposit.id);
    try {
      const patch: Partial<ApiDeposit> = { status: newStatus };
      if (newStatus === "completed" && !deposit.creditedAt) {
        const creditTotal = deposit.amount + (deposit.bonusAmount ?? 0);
        patch.creditedAt = new Date().toISOString();
        patch.creditedAmount = creditTotal;
        // Balance is credited server-side when deposit status → "completed"
        maybeNotifyDepositApproved(deposit.userId, deposit.amount);
      } else if (newStatus === "rejected") {
        maybeNotifyDepositRejected(deposit.userId, deposit.amount);
      }
      await updateDeposit(deposit.id, patch);
      refetch();
    } catch (err) {
      console.error("Failed to update deposit:", err);
    } finally {
      setSaving(null);
    }
  }

  async function saveAmountEdit(deposit: ApiDeposit) {
    const val = parseFloat(editingAmount);
    if (!isNaN(val) && val > 0) {
      setSaving(deposit.id);
      try {
        await updateDeposit(deposit.id, { amount: val });
        refetch();
      } catch (err) {
        console.error("Failed to update amount:", err);
      } finally {
        setSaving(null);
      }
    }
    setEditingId(null);
  }

  return (
    <AdminLayout title="Deposit Requests">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {(["pending", "approved", "completed", "rejected"] as const).map(s => {
          const count = list.filter(d => d.status === s).length;
          const total = list.filter(d => d.status === s).reduce((acc, d) => acc + d.amount, 0);
          const colors: Record<string, string> = { pending: "text-yellow-400", approved: "text-blue-400", completed: "text-green-400", rejected: "text-red-400" };
          return (
            <div key={s} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
              <p className={`text-xl font-bold ${colors[s]}`}>{count}</p>
              <p className="text-slate-500 dark:text-gray-400 text-xs capitalize mt-1">{s}</p>
              <p className="text-slate-600 dark:text-gray-400 text-xs mt-0.5">${total.toFixed(2)} USDT</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-gray-400" />
          <input type="text" placeholder="Search user…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "pending", "approved", "completed", "rejected"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-purple-600 text-white" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-slate-500 dark:text-gray-400 hover:text-white"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-500 dark:text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading deposits…
          </div>
        )}
        {error && <div className="text-center py-12 text-red-400">{error}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">User</th>
                  <th className="text-right text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Amount</th>
                  <th className="text-left text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Protocol</th>
                  <th className="text-center text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Proof</th>
                  <th className="text-left text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Date</th>
                  <th className="text-center text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Status</th>
                  <th className="text-center text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-gray-100 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-slate-900 dark:text-white text-sm font-medium">{d.userName ?? "User"}</p>
                      <p className="text-slate-600 dark:text-gray-400 text-xs font-mono">{d.userId}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === d.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-500 dark:text-gray-400 text-xs">$</span>
                          <input type="number" value={editingAmount} onChange={e => setEditingAmount(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveAmountEdit(d); if (e.key === "Escape") setEditingId(null); }}
                            autoFocus className="w-20 bg-gray-100 dark:bg-gray-800 border border-purple-500 rounded-lg px-2 py-1 text-slate-900 dark:text-white text-sm text-right focus:outline-none" />
                          <button onClick={() => saveAmountEdit(d)} className="p-1 text-green-400 hover:text-green-300"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <div>
                            <p className="text-slate-900 dark:text-white font-semibold text-sm">${d.amount.toFixed(2)}</p>
                            {d.bonusAmount != null && d.bonusAmount > 0 && (
                              <p className="text-green-400 text-xs">+ ${d.bonusAmount.toFixed(2)} bonus</p>
                            )}
                            {d.bonusAmount != null && d.bonusAmount > 0 && (
                              <p className="text-green-300 text-xs font-semibold">= ${(d.amount + d.bonusAmount).toFixed(2)} total</p>
                            )}
                          </div>
                          {d.status !== "completed" && d.status !== "rejected" && (
                            <button onClick={() => { setEditingId(d.id); setEditingAmount(String(d.amount)); }}
                              className="p-1 text-slate-600 dark:text-gray-400 hover:text-purple-400 transition-colors"><Pencil className="w-3 h-3" /></button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 px-2 py-0.5 rounded-md font-semibold">{d.protocol}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {d.proofUrl ? (
                        <button
                          onClick={() => setInspectingDeposit(d)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/70 text-xs font-bold transition-colors shadow-2xs"
                          title="Inspect Attached Screenshot"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>Proof</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-gray-500 italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs">{d.date}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => setInspectingDeposit(d)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg text-xs font-bold transition-colors"
                          title="Inspect Details and Proof"
                        >
                          <Eye className="w-3.5 h-3.5" /> Inspect
                        </button>

                        {saving === d.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-500 dark:text-gray-400" />
                        ) : (
                          <>
                            {(d.status === "pending" || d.status === "approved") && (
                              <>
                                <button onClick={() => handleStatusChange(d, "completed")}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/60 text-green-700 dark:text-green-400 rounded-lg text-xs font-bold transition-colors">
                                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button onClick={() => handleStatusChange(d, "rejected")}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/60 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold transition-colors">
                                  <XCircle className="w-3.5 h-3.5" /> Reject
                                </button>
                              </>
                            )}
                            {(d.status === "completed" || d.status === "rejected") && (
                              <button onClick={() => handleStatusChange(d, "pending")}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/60 text-yellow-700 dark:text-yellow-400 rounded-lg text-xs font-bold transition-colors">
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
            {filtered.length === 0 && <div className="text-center py-12 text-slate-600 dark:text-gray-400">No deposits found.</div>}
            {hasMore && (
              <div className="flex justify-center py-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-slate-900 dark:text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inspect Deposit Modal */}
      <InspectDepositModal
        deposit={inspectingDeposit}
        isOpen={Boolean(inspectingDeposit)}
        onClose={() => setInspectingDeposit(null)}
        onApprove={async dep => {
          await handleStatusChange(dep, "completed");
          setInspectingDeposit(null);
        }}
        onReject={async dep => {
          await handleStatusChange(dep, "rejected");
          setInspectingDeposit(null);
        }}
        onReset={async dep => {
          await handleStatusChange(dep, "pending");
          setInspectingDeposit(null);
        }}
        isProcessing={saving === inspectingDeposit?.id}
      />
    </AdminLayout>
  );
}
