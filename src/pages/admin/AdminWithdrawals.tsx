import AdminLayout from "./AdminLayout";
import { TxStatus } from "../../data/adminData";
import { Search, CheckCircle, XCircle, Clock, Pencil, Check, X, Loader2 } from "lucide-react";
import { maybeNotifyWithdrawalApproved, maybeNotifyWithdrawalRejected } from "../../lib/notificationHelpers";
import { useWithdrawalsPage, updateWithdrawal, type ApiWithdrawal } from "../../hooks/useApi";
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

function getWithdrawalNote(withdrawal: ApiWithdrawal): string {
  const record = withdrawal as unknown as Record<string, unknown>;
  return typeof record.note === "string" ? record.note : "";
}

function RejectModal({ onConfirm, onClose }: { onConfirm: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-900 dark:text-white font-semibold">Reject Withdrawal</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-slate-900 dark:text-white" /></button>
        </div>
        <p className="text-slate-500 dark:text-gray-400 text-sm mb-4">Provide a reason for rejection (optional):</p>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="e.g. Suspicious activity…"
          className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm resize-none focus:outline-none focus:border-red-500 mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-700 text-slate-900 dark:text-white rounded-xl py-2.5 text-sm">Cancel</button>
          <button onClick={() => { onConfirm(note); onClose(); }} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm">Confirm Reject</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminWithdrawals() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const { data: withdrawals, loading, error, refetch, hasMore, loadMore, loadingMore } = useWithdrawalsPage(25, {
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const list = withdrawals ?? [];

  const filtered = list.filter(w => {
    const q = search.toLowerCase();
    const match = (w.userName ?? "").toLowerCase().includes(q) || (w.address ?? "").toLowerCase().includes(q) || (w.userId ?? "").toLowerCase().includes(q);
    return match && (statusFilter === "all" || w.status === statusFilter);
  });

  async function handleStatusChange(withdrawal: ApiWithdrawal, newStatus: string, note?: string) {
    setSaving(withdrawal.id);
    try {
      const patch: Partial<ApiWithdrawal> = { status: newStatus };
      if (note !== undefined) (patch as Record<string, unknown>).note = note;
      await updateWithdrawal(withdrawal.id, patch);
      if (newStatus === "completed") {
        maybeNotifyWithdrawalApproved(withdrawal.userId, withdrawal.amount);
      } else if (newStatus === "rejected") {
        maybeNotifyWithdrawalRejected(withdrawal.userId, withdrawal.amount, note);
      }
      refetch();
    } catch (err) {
      console.error("Failed to update withdrawal:", err);
    } finally {
      setSaving(null);
    }
  }

  async function saveAmountEdit(withdrawal: ApiWithdrawal) {
    const val = parseFloat(editingAmount);
    if (!isNaN(val) && val > 0) {
      setSaving(withdrawal.id);
      try {
        await updateWithdrawal(withdrawal.id, { amount: val });
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
    <AdminLayout title="Withdrawal Requests">
      {rejectingId && (
        <RejectModal
          onConfirm={(note) => handleStatusChange(list.find(w => w.id === rejectingId)!, "rejected", note)}
          onClose={() => setRejectingId(null)}
        />
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {(["pending", "approved", "completed", "rejected"] as const).map(s => {
          const count = list.filter(w => w.status === s).length;
          const total = list.filter(w => w.status === s).reduce((acc, w) => acc + w.amount, 0);
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
          <input type="text" placeholder="Search user or wallet address…" value={search} onChange={e => setSearch(e.target.value)}
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
            <Loader2 className="w-5 h-5 animate-spin" /> Loading withdrawals…
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
                  <th className="text-left text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Wallet Address</th>
                  <th className="text-left text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Date</th>
                  <th className="text-center text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Status</th>
                  <th className="text-center text-xs font-medium text-slate-600 dark:text-gray-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filtered.map(w => (
                  <tr key={w.id} className="hover:bg-gray-100 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-slate-900 dark:text-white text-sm font-medium">{w.userName ?? "User"}</p>
                      <p className="text-slate-600 dark:text-gray-400 text-xs">{w.userId}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === w.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-500 dark:text-gray-400 text-xs">$</span>
                          <input type="number" value={editingAmount} onChange={e => setEditingAmount(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveAmountEdit(w); if (e.key === "Escape") setEditingId(null); }}
                            autoFocus className="w-20 bg-gray-100 dark:bg-gray-800 border border-purple-500 rounded-lg px-2 py-1 text-slate-900 dark:text-white text-sm text-right focus:outline-none" />
                          <button onClick={() => saveAmountEdit(w)} className="p-1 text-green-400 hover:text-green-300"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <div>
                            <p className="text-slate-900 dark:text-white font-semibold text-sm">${w.amount.toFixed(2)}</p>
                            {w.taxAmount != null && w.taxAmount > 0 && <p className="text-red-400 text-xs">− ${w.taxAmount.toFixed(2)} tax</p>}
                            {w.finalPayout != null && w.taxAmount != null && w.taxAmount > 0 && <p className="text-green-400 text-xs font-semibold">= ${w.finalPayout.toFixed(2)} payout</p>}
                          </div>
                          {w.status !== "completed" && w.status !== "rejected" && (
                            <button onClick={() => { setEditingId(w.id); setEditingAmount(String(w.amount)); }}
                              className="p-1 text-slate-600 dark:text-gray-400 hover:text-purple-400 transition-colors"><Pencil className="w-3 h-3" /></button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 px-2 py-0.5 rounded-md">{w.protocol}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700 dark:text-gray-300 text-xs font-mono truncate max-w-[140px]">{w.address}</p>
                      {getWithdrawalNote(w) && (
                        <p className="text-red-400 text-xs mt-0.5 truncate max-w-[140px]">Note: {getWithdrawalNote(w)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs">{w.date}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={w.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {saving === w.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-500 dark:text-gray-400" />
                        ) : (
                          <>
                            {(w.status === "pending" || w.status === "approved") && (
                              <>
                                <button onClick={() => handleStatusChange(w, "completed")}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-green-900/30 hover:bg-green-900/60 text-green-400 rounded-lg text-xs transition-colors">
                                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button onClick={() => setRejectingId(w.id)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/60 text-red-400 rounded-lg text-xs transition-colors">
                                  <XCircle className="w-3.5 h-3.5" /> Reject
                                </button>
                              </>
                            )}
                            {(w.status === "completed" || w.status === "rejected") && (
                              <button onClick={() => handleStatusChange(w, "pending")}
                                className="flex items-center gap-1 px-3 py-1.5 bg-yellow-900/30 hover:bg-yellow-900/60 text-yellow-400 rounded-lg text-xs transition-colors">
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
            {filtered.length === 0 && <div className="text-center py-12 text-slate-600 dark:text-gray-400">No withdrawals found.</div>}
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
    </AdminLayout>
  );
}
