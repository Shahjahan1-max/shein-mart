import { useState } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, SectionCard, StatCard, StatusBadge, statusToneFor, PermissionGate } from "../../components/super-admin/SuperAdminUi";
import { SYSTEM_METRICS } from "../../data/superAdminData";
import {
  Wallet, ArrowUpFromLine, ArrowDownToLine, CheckCircle2, XCircle, Lock, Search,
  Eye, Image as ImageIcon, Loader2, ArrowDownLeft
} from "lucide-react";
import {
  useDepositsPage, useWithdrawalsPage, useSuperAdminMetrics, updateDeposit, updateWithdrawal,
  type ApiDeposit, type ApiWithdrawal
} from "../../hooks/useApi";
import {
  maybeNotifyDepositApproved, maybeNotifyDepositRejected,
  maybeNotifyWithdrawalApproved, maybeNotifyWithdrawalRejected
} from "../../lib/notificationHelpers";
import { InspectDepositModal } from "../../components/admin/InspectDepositModal";

export default function SuperAdminWallet() {
  const [activeTab, setActiveTab] = useState<"deposits" | "withdrawals">("deposits");
  const [search, setSearch] = useState("");
  const { data: deposits, loading: depsLoading, refetch: refetchDeps } = useDepositsPage(50);
  const { data: withdrawals, loading: wdsLoading, refetch: refetchWds } = useWithdrawalsPage(50);
  const { data: metrics } = useSuperAdminMetrics();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [inspectingDeposit, setInspectingDeposit] = useState<ApiDeposit | null>(null);

  const depsList = deposits ?? [];
  const wdsList = withdrawals ?? [];

  const totalBalance = metrics?.wallet?.totalBalance ?? 0;
  const totalDeposits = depsList
    .filter(d => ["completed", "approved", "complete"].includes(String(d.status || "").toLowerCase()))
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalWithdrawals = wdsList
    .filter(w => ["completed", "approved", "complete"].includes(String(w.status || "").toLowerCase()))
    .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

  const pendingDeps = depsList.filter(d => d.status === "pending");
  const pendingWds = wdsList.filter(w => w.status === "pending");

  const q = search.toLowerCase();
  const filteredDeps = depsList.filter(d =>
    (d.userName ?? "").toLowerCase().includes(q) || (d.userId ?? "").toLowerCase().includes(q)
  );
  const filteredWds = wdsList.filter(w =>
    (w.userName ?? "").toLowerCase().includes(q) || (w.userId ?? "").toLowerCase().includes(q)
  );

  async function handleApproveDeposit(dep: ApiDeposit) {
    setSavingId(dep.id);
    try {
      const patch: Partial<ApiDeposit> = {
        status: "completed",
        creditedAt: new Date().toISOString(),
        creditedAmount: dep.amount + (dep.bonusAmount ?? 0),
      };
      await updateDeposit(dep.id, patch);
      maybeNotifyDepositApproved(dep.userId, dep.amount);
      refetchDeps();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  }

  async function handleRejectDeposit(dep: ApiDeposit) {
    setSavingId(dep.id);
    try {
      await updateDeposit(dep.id, { status: "rejected" });
      maybeNotifyDepositRejected(dep.userId, dep.amount);
      refetchDeps();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  }

  async function handleApproveWithdrawal(wd: ApiWithdrawal) {
    setSavingId(wd.id);
    try {
      await updateWithdrawal(wd.id, { status: "completed" });
      maybeNotifyWithdrawalApproved(wd.userId, wd.amount);
      refetchWds();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  }

  async function handleRejectWithdrawal(wd: ApiWithdrawal) {
    setSavingId(wd.id);
    try {
      await updateWithdrawal(wd.id, { status: "rejected" });
      maybeNotifyWithdrawalRejected(wd.userId, wd.amount);
      refetchWds();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <SuperAdminLayout title="Wallet Governance">
      <PageHeader
        title="Wallet Governance"
        description="Review pending transactions, verify deposit proof screenshots, approve or reject deposits & withdrawals."
        icon={<Wallet className="w-5 h-5" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total User Balance" value={`$${totalBalance.toLocaleString()}`} icon={<Wallet className="w-5 h-5" />} color="purple" />
        <StatCard label="Total Deposits" value={`$${totalDeposits.toLocaleString()}`} icon={<ArrowDownToLine className="w-5 h-5" />} color="emerald" trend="up" trendLabel="healthy" />
        <StatCard label="Total Withdrawals" value={`$${totalWithdrawals.toLocaleString()}`} icon={<ArrowUpFromLine className="w-5 h-5" />} color="amber" />
        <StatCard label="Pending Queue" value={pendingDeps.length + pendingWds.length} sub={`${pendingDeps.length} deps · ${pendingWds.length} wds`} icon={<Lock className="w-5 h-5" />} color="rose" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("deposits")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
            activeTab === "deposits"
              ? "bg-purple-600 text-white shadow-xs"
              : "bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>Deposits</span>
          {pendingDeps.length > 0 && (
            <span className="ml-1 bg-amber-500 text-slate-950 text-xs font-extrabold rounded-full px-2 py-0.5">
              {pendingDeps.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("withdrawals")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
            activeTab === "withdrawals"
              ? "bg-purple-600 text-white shadow-xs"
              : "bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <ArrowUpFromLine className="w-4 h-4" />
          <span>Withdrawals</span>
          {pendingWds.length > 0 && (
            <span className="ml-1 bg-amber-500 text-slate-950 text-xs font-extrabold rounded-full px-2 py-0.5">
              {pendingWds.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "deposits" ? (
        <SectionCard
          title="Deposit Requests & Payment Verification"
          description="Inspect attached payment receipts and approve or reject deposit requests"
          icon={<ArrowDownLeft className="w-4 h-4 text-emerald-500" />}
          actions={
            <div className="relative w-full sm:w-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search user…"
                className="pl-9 pr-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-48"
              />
            </div>
          }
        >
          {depsLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-slate-500 font-medium">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading deposits…
            </div>
          ) : filteredDeps.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No deposit requests found.</p>
          ) : (
            <div className="responsive-table-container">
              <table className="w-full text-sm min-w-[650px]">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="py-2.5 pr-4 font-semibold">User</th>
                    <th className="py-2.5 pr-4 font-semibold text-right">Amount</th>
                    <th className="py-2.5 pr-4 font-semibold">Protocol</th>
                    <th className="py-2.5 pr-4 font-semibold text-center">Proof Screenshot</th>
                    <th className="py-2.5 pr-4 font-semibold">Status</th>
                    <th className="py-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeps.map(d => (
                    <tr key={d.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-slate-50/50 dark:hover:bg-gray-800/30">
                      <td className="py-3 pr-4">
                        <p className="font-bold text-gray-900 dark:text-white">{d.userName || "User"}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400 font-mono">{d.userId}</p>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <p className="font-extrabold text-gray-900 dark:text-white tabular-nums">${d.amount.toFixed(2)}</p>
                        {d.bonusAmount != null && d.bonusAmount > 0 && (
                          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+${d.bonusAmount.toFixed(2)} bonus</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 font-semibold">{d.protocol}</td>
                      <td className="py-3 pr-4 text-center">
                        {d.proofUrl ? (
                          <button
                            onClick={() => setInspectingDeposit(d)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 text-xs font-bold transition-colors"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-purple-600" /> Proof Attached
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={d.status} tone={statusToneFor(d.status)} />
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setInspectingDeposit(d)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 text-xs font-bold transition-colors"
                            title="Inspect Details & Proof"
                          >
                            <Eye className="w-3.5 h-3.5" /> Inspect
                          </button>

                          {(d.status === "pending" || d.status === "approved") && (
                            <PermissionGate permission="wallet.approve">
                              <button
                                onClick={() => handleApproveDeposit(d)}
                                disabled={savingId === d.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors"
                              >
                                {savingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectDeposit(d)}
                                disabled={savingId === d.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-bold transition-colors"
                              >
                                {savingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                Reject
                              </button>
                            </PermissionGate>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title="Pending Withdrawals"
          description="Approve or reject to resolve the queue"
          icon={<ArrowUpFromLine className="w-4 h-4" />}
          actions={
            <div className="relative w-full sm:w-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search user…"
                className="pl-9 pr-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-48"
              />
            </div>
          }
        >
          {wdsLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-slate-500 font-medium">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading withdrawals…
            </div>
          ) : filteredWds.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Withdrawal queue cleared. Nice work.</p>
          ) : (
            <div className="responsive-table-container">
              <table className="w-full text-sm min-w-[650px]">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="py-2.5 pr-4 font-semibold">User</th>
                    <th className="py-2.5 pr-4 font-semibold text-right">Amount</th>
                    <th className="py-2.5 pr-4 font-semibold">Protocol / Address</th>
                    <th className="py-2.5 pr-4 font-semibold">Status</th>
                    <th className="py-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWds.map(w => (
                    <tr key={w.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-slate-50/50 dark:hover:bg-gray-800/30">
                      <td className="py-3 pr-4">
                        <p className="font-bold text-gray-900 dark:text-white">{w.userName || "User"}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400 font-mono">{w.userId}</p>
                      </td>
                      <td className="py-3 pr-4 text-right font-extrabold text-gray-900 dark:text-white tabular-nums">${w.amount.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 font-mono text-xs truncate max-w-xs">{w.protocol} · {w.address}</td>
                      <td className="py-3 pr-4"><StatusBadge status={w.status} tone={statusToneFor(w.status)} /></td>
                      <td className="py-3 text-right">
                        {w.status === "pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            <PermissionGate permission="wallet.approve">
                              <button
                                onClick={() => handleApproveWithdrawal(w)}
                                disabled={savingId === w.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors"
                              >
                                {savingId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Approve
                              </button>
                            </PermissionGate>
                            <PermissionGate permission="wallet.reject">
                              <button
                                onClick={() => handleRejectWithdrawal(w)}
                                disabled={savingId === w.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-xs font-bold transition-colors"
                              >
                                {savingId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                Reject
                              </button>
                            </PermissionGate>
                          </div>
                        ) : (
                          <StatusBadge status={w.status} tone={statusToneFor(w.status)} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* Inspect Deposit Modal */}
      <InspectDepositModal
        deposit={inspectingDeposit}
        isOpen={Boolean(inspectingDeposit)}
        onClose={() => setInspectingDeposit(null)}
        onApprove={async dep => {
          await handleApproveDeposit(dep);
          setInspectingDeposit(null);
        }}
        onReject={async dep => {
          await handleRejectDeposit(dep);
          setInspectingDeposit(null);
        }}
        isProcessing={savingId === inspectingDeposit?.id}
      />
    </SuperAdminLayout>
  );
}
