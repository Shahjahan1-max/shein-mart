import { useState, useEffect, useCallback } from "react";
import AdminLayout from "./AdminLayout";
import {
  type OrderRecord,
  type OrderStatus,
} from "../../data/adminData";
import { TIERS, type CustomAdDef } from "../../data/adsData";
import { notifyUserTaskReassigned, notifyUserReassignmentDeclined } from "../../lib/notificationHelpers";
import {
  ClipboardList, CheckCircle, Loader2, Clock, PlayCircle,
  RefreshCw, Search, User, Tag, RotateCcw, XCircle, X, Ban, ArrowRightLeft,
} from "lucide-react";
import { setAdAssignment, useAdAssignments, useFirebaseCollection, useOrdersPage, updateOrder, type ApiOrder } from "../../hooks/useApi";
import { useAdGroupsCatalog } from "../../hooks/useCatalogs";

const PLATFORM_OPTIONS = [
  { id: "amazon",     name: "Amazon"     },
  { id: "alibaba",    name: "Alibaba"    },
  { id: "aliexpress", name: "AliExpress" },
] as const;

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending:                  { label: "Pending",          color: "text-yellow-400",  bg: "bg-yellow-900/30 border-yellow-800" },
  assigned:                 { label: "Assigned",         color: "text-blue-400",    bg: "bg-blue-900/30 border-blue-800" },
  in_progress:              { label: "In Progress",      color: "text-purple-400",  bg: "bg-purple-900/30 border-purple-800" },
  completed:                { label: "Completed",        color: "text-green-400",   bg: "bg-green-900/30 border-green-800" },
  reassignment_requested:   { label: "Re-assign Request", color: "text-orange-400", bg: "bg-orange-900/30 border-orange-800" },
};

function fmt(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

/* ─── Inline code-select state for an order ──────────────────── */
interface CodeSelectState {
  orderId: string;
  userId: string;
  selectedCode: string;
}

export function OrdersPanel() {
  const { data: adAssignments = [], refetch: refetchAssignments } = useAdAssignments();
  const { data: customAdDefs = [] } = useFirebaseCollection<CustomAdDef>("customAdCodes");
  const { data: adCatalog } = useAdGroupsCatalog();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const { data: apiOrders, loading, refetch, hasMore, loadMore, loadingMore } = useOrdersPage(25, {
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const orders: OrderRecord[] = (apiOrders ?? []).map(o => ({
    id: o.id,
    userId: o.userId,
    userName: o.userName,
    platformId: o.platformId,
    platformName: o.platformName,
    status: o.status as OrderStatus,
    createdAt: o.createdAt,
    assignedAt: o.assignedAt,
    completedAt: o.completedAt,
    previousAdCodeId: o.previousAdCodeId,
    isDeclinedReassignment: o.isDeclinedReassignment,
    declinedAt: o.declinedAt,
    declineReason: o.declineReason,
    movedFromPlatform: o.movedFromPlatform,
    movedFromPlatformName: o.movedFromPlatformName,
    requestedPlatform: o.requestedPlatform,
    requestedPlatformName: o.requestedPlatformName,
    commissionRate: o.commissionRate,
    requiredTasks: o.requiredTasks,
    totalTasks: o.totalTasks,
  }));

  const [assigning, setAssigning] = useState<string | null>(null);
  const [codeSelect, setCodeSelect] = useState<CodeSelectState | null>(null);
  const [reassignCodeSelect, setReassignCodeSelect] = useState<CodeSelectState | null>(null);
  const [declineTarget, setDeclineTarget] = useState<OrderRecord | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [tab, setTab] = useState<"orders" | "declined">("orders");
  const [declineSearch, setDeclineSearch] = useState("");
  const [moveTarget, setMoveTarget] = useState<OrderRecord | null>(null);
  const [moveToPlatform, setMoveToPlatform] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);

  const refresh = refetch;

  /* All available codes (Firebase catalog + custom) */
  const allCodes = [
    ...(adCatalog.groups ?? []).map(g => ({ code: g.code, label: `${g.code} — ${g.label}`, tier: g.tier })),
    ...customAdDefs.map(d => ({ code: d.code, label: `${d.code} - ${d.title} (custom)`, tier: d.tier })),
  ];

  /* Open inline code picker */
  function handleOpenCodeSelect(order: OrderRecord) {
    setCodeSelect({ orderId: order.id, userId: order.userId, selectedCode: "" });
  }

  /* Confirm: assign code to user AND mark order as assigned via API */
  async function handleConfirmAssign(force = false) {
    if (!codeSelect || !codeSelect.selectedCode) return;
    setAssigning(codeSelect.orderId);
    setAssignError(null);
    try {
      await setAdAssignment(codeSelect.userId, {
        userId: codeSelect.userId,
        code: codeSelect.selectedCode,
        assignedTs: new Date().toISOString(),
        orderId: codeSelect.orderId,
        ...(force ? { force: true } : {}),
      } as Parameters<typeof setAdAssignment>[1]);
      refetchAssignments();
      refetch();
      setCodeSelect(null);
    } catch (err: unknown) {
      const apiErr = err as { message?: string; status?: number };
      const msg = apiErr?.message || "Assignment failed. Please try again.";
      setAssignError(msg);
    } finally {
      setAssigning(null);
    }
  }

  /* Legacy fast-assign (no code picker) */
  async function handleFastAssign(orderId: string) {
    setAssigning(orderId);
    try {
      await updateOrder(orderId, { status: "assigned", assignedAt: new Date().toISOString() });
      refetch();
    } catch (err) { console.error("Failed to fast-assign:", err); }
    setAssigning(null);
  }

  function handleApproveReassignment(order: OrderRecord) {
    const existingCode = order.previousAdCodeId ?? adAssignments.find(item => item.userId === order.userId)?.code ?? "";
    setReassignCodeSelect({ orderId: order.id, userId: order.userId, selectedCode: existingCode });
  }

  async function handleConfirmReassign() {
    if (!reassignCodeSelect || !reassignCodeSelect.selectedCode) return;
    setAssigning(reassignCodeSelect.orderId);
    setAssignError(null);
    try {
      const order = orders.find(item => item.id === reassignCodeSelect.orderId);
      await setAdAssignment(reassignCodeSelect.userId, {
        userId: reassignCodeSelect.userId,
        code: reassignCodeSelect.selectedCode,
        assignedTs: new Date().toISOString(),
        orderId: reassignCodeSelect.orderId,
        force: true,
      });
      refetchAssignments();
      if (order) notifyUserTaskReassigned(order.userId, order.platformName);
      refetch();
      setReassignCodeSelect(null);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setAssignError(apiErr?.message || "Re-assignment failed. Please try again.");
    } finally {
      setAssigning(null);
    }
  }

  /* Decline a re-assignment request */
  async function handleConfirmDecline() {
    if (!declineTarget) return;
    setAssigning(declineTarget.id);
    try {
      await updateOrder(declineTarget.id, {
        status: "completed",
        completedAt: new Date().toISOString(),
        isDeclinedReassignment: true,
        declinedAt: new Date().toISOString(),
        declineReason: declineReason.trim() || undefined,
      } as Partial<ApiOrder>);
      notifyUserReassignmentDeclined(declineTarget.userId, declineTarget.platformName, declineReason.trim() || undefined);
      refetch();
    } catch (err) { console.error("Failed to decline:", err); }
    setDeclineTarget(null);
    setDeclineReason("");
    setAssigning(null);
  }

  const q = search.toLowerCase();
  const filtered = orders.filter(o => {
    if ((o as Record<string, unknown>).isDeclinedReassignment) return false;
    const matchSearch =
      o.userName.toLowerCase().includes(q) ||
      o.platformName.toLowerCase().includes(q) ||
      o.userId.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    pending:                orders.filter(o => o.status === "pending").length,
    assigned:               orders.filter(o => o.status === "assigned").length,
    in_progress:            orders.filter(o => o.status === "in_progress").length,
    completed:              orders.filter(o => o.status === "completed" && !(o as Record<string, unknown>).isDeclinedReassignment).length,
    reassignment_requested: orders.filter(o => o.status === "reassignment_requested").length,
    declined:               orders.filter(o => (o as Record<string, unknown>).isDeclinedReassignment === true).length,
  };

  const dq = declineSearch.toLowerCase();
  const declinedOrders = orders
    .filter(o => (o as Record<string, unknown>).isDeclinedReassignment === true)
    .filter(o =>
      !dq ||
      o.userName.toLowerCase().includes(dq) ||
      o.platformName.toLowerCase().includes(dq) ||
      ((o as Record<string, unknown>).declineReason as string ?? "").toLowerCase().includes(dq)
    )
    .sort((a, b) => ((b as Record<string, unknown>).declinedAt as string ?? "").localeCompare((a as Record<string, unknown>).declinedAt as string ?? ""));

  return (
    <>
      {/* Move Platform modal */}
      {moveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setMoveTarget(null); setMoveToPlatform(""); }} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900 dark:text-white font-bold text-base flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                Move Platform
              </h3>
              <button onClick={() => { setMoveTarget(null); setMoveToPlatform(""); }} className="text-gray-400 hover:text-slate-900 dark:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-700 dark:text-gray-300 text-sm mb-1">
              Moving task for <span className="font-semibold text-slate-900 dark:text-white">{moveTarget.userName}</span>
              {" "}from <span className="text-orange-300">{moveTarget.platformName}</span>
            </p>
            <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">
              The user will see a "Task moved" notice on the old platform and can continue on the new one.
            </p>
            <label className="block text-xs text-slate-500 dark:text-gray-400 font-medium mb-1.5">Move to Platform</label>
            <select
              value={moveToPlatform}
              onChange={e => setMoveToPlatform(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white font-medium text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 mb-4"
            >
              <option value="">— select platform —</option>
              {PLATFORM_OPTIONS.filter(p => p.id !== moveTarget.platformId).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const target = PLATFORM_OPTIONS.find(p => p.id === moveToPlatform);
                  if (!target) return;
                  try {
                    await updateOrder(moveTarget.id, {
                      platformId: target.id,
                      platformName: target.name,
                    } as Partial<ApiOrder>);
                    refetch();
                  } catch (err) { console.error("Failed to move order:", err); }
                  setMoveTarget(null);
                  setMoveToPlatform("");
                }}
                disabled={!moveToPlatform}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 disabled:text-indigo-500 text-white rounded-xl text-sm font-bold transition-colors"
              >
                <ArrowRightLeft className="w-4 h-4" /> Confirm Move
              </button>
              <button
                onClick={() => { setMoveTarget(null); setMoveToPlatform(""); }}
                className="px-4 py-2.5 border border-gray-700 text-gray-400 hover:text-slate-900 dark:text-white rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline reason modal */}
      {declineTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setDeclineTarget(null); setDeclineReason(""); }} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900 dark:text-white font-bold text-base flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                Decline Re-assignment
              </h3>
              <button onClick={() => { setDeclineTarget(null); setDeclineReason(""); }} className="text-gray-400 hover:text-slate-900 dark:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-700 dark:text-gray-300 text-sm mb-1">
              Declining request for <span className="font-semibold text-slate-900 dark:text-white">{declineTarget.userName}</span> — <span className="text-orange-300">{declineTarget.platformName}</span>
            </p>
            <p className="text-slate-600 dark:text-gray-400 text-xs mb-3">The user will be notified and can submit a new request.</p>
            <label className="block text-xs text-slate-500 dark:text-gray-400 font-medium mb-1.5">Reason (optional)</label>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="e.g. Outstanding balance, account issue…"
              rows={3}
              className="w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white font-medium text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-red-500 placeholder-gray-600 resize-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleConfirmDecline}
                disabled={assigning === declineTarget.id}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:text-red-500 text-white rounded-xl text-sm font-bold transition-colors"
              >
                {assigning === declineTarget.id ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Declining…</>
                ) : (
                  <><XCircle className="w-4 h-4" /> Confirm Decline</>
                )}
              </button>
              <button
                onClick={() => { setDeclineTarget(null); setDeclineReason(""); }}
                className="px-4 py-2.5 border border-gray-700 text-gray-400 hover:text-slate-900 dark:text-white rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign code picker modal */}
      {reassignCodeSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReassignCodeSelect(null)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900 dark:text-white font-bold text-base flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-orange-400" />
                Approve Re-assignment
              </h3>
              <button onClick={() => setReassignCodeSelect(null)} className="text-gray-400 hover:text-slate-900 dark:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-700 dark:text-gray-300 text-sm mb-1">
              Assigning new code for <span className="font-semibold text-slate-900 dark:text-white">
                {orders.find(o => o.id === reassignCodeSelect.orderId)?.userName}
              </span>
            </p>
            <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">
              Select the same or a different ad code package. The user's task will reset with the selected code.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 font-medium mb-1.5">
              <Tag className="w-3.5 h-3.5" /> Select Ad Code Package
            </div>
            <select
              value={reassignCodeSelect.selectedCode}
              onChange={e => setReassignCodeSelect({ ...reassignCodeSelect, selectedCode: e.target.value })}
              className="w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white font-medium text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500 mb-4"
            >
              <option value="">- choose a code -</option>
              {TIERS.map(tier => {
                const codes = allCodes.filter(c => c.tier === tier);
                if (!codes.length) return null;
                const nums = codes.map(c => c.code).filter(c => c !== "Rank");
                const groupLabel = nums.length ? `${nums[0]} - ${nums[nums.length - 1]}` : codes[0].code;
                return (
                  <optgroup key={tier} label={groupLabel}>
                    {codes.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmReassign}
                disabled={!reassignCodeSelect.selectedCode || assigning === reassignCodeSelect.orderId}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-900 disabled:text-orange-500 text-white rounded-xl text-sm font-bold transition-colors"
              >
                {assigning === reassignCodeSelect.orderId ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Approving...</>
                ) : (
                  <><RotateCcw className="w-4 h-4" /> Confirm Re-assign</>
                )}
              </button>
              <button
                onClick={() => setReassignCodeSelect(null)}
                className="px-4 py-2.5 border border-gray-700 text-gray-400 hover:text-slate-900 dark:text-white rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <p className="text-yellow-400 text-xl font-bold">{counts.pending}</p>
          <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">Pending</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <p className="text-blue-400 text-xl font-bold">{counts.assigned}</p>
          <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">Assigned</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <p className="text-purple-400 text-xl font-bold">{counts.in_progress}</p>
          <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">In Progress</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <p className="text-green-400 text-xl font-bold">{counts.completed}</p>
          <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">Completed</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800 rounded-2xl p-4">
          <p className="text-orange-400 text-xl font-bold">{counts.reassignment_requested}</p>
          <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">Re-assign Reqs</p>
        </div>
        <div
          className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900 rounded-2xl p-4 cursor-pointer hover:border-red-600 transition-colors"
          onClick={() => setTab("declined")}
        >
          <p className="text-red-400 text-xl font-bold">{counts.declined}</p>
          <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">Declined</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-5 border-b border-gray-800 pb-3">
        <button
          onClick={() => setTab("orders")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === "orders"
              ? "bg-purple-600 text-white"
              : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-slate-900 dark:text-white"
          }`}
        >
          Orders
        </button>
        <button
          onClick={() => setTab("declined")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === "declined"
              ? "bg-red-700 text-white"
              : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-slate-900 dark:text-white"
          }`}
        >
          <Ban className="w-4 h-4" />
          Declined Requests
          {counts.declined > 0 && (
            <span className="ml-0.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">
              {counts.declined}
            </span>
          )}
        </button>
      </div>

      {/* ── DECLINED REQUESTS TAB ── */}
      {tab === "declined" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-gray-400" />
            <input
              type="text"
              placeholder="Search user, platform, or reason…"
              value={declineSearch}
              onChange={e => setDeclineSearch(e.target.value)}
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-gray-900 dark:text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          {declinedOrders.length === 0 ? (
            <div className="text-center py-16 text-slate-600 dark:text-gray-400">
              <Ban className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {counts.declined === 0
                  ? "No re-assignment requests have been declined yet."
                  : "No declined requests match your search."}
              </p>
            </div>
          ) : (
            declinedOrders.map(order => (
              <div
                key={order.id}
                className="bg-white dark:bg-gray-900 border border-red-900/50 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-4"
              >
                {/* Avatar + name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-red-800 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {order.userName[0] ?? <User className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-900 dark:text-white font-semibold text-sm truncate">{order.userName}</p>
                    <p className="text-slate-500 dark:text-gray-400 text-xs">{order.platformName}</p>
                    <p className="text-slate-600 dark:text-gray-400 text-xs mt-0.5">
                      Requested: {fmt(order.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Declined info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    <span className="text-red-400 text-xs font-semibold">Declined</span>
                    <span className="text-slate-600 dark:text-gray-400 text-xs">{fmt((order as Record<string, unknown>).declinedAt as string)}</span>
                  </div>
                  {(order as Record<string, unknown>).declineReason ? (
                    <p className="text-slate-700 dark:text-gray-300 text-sm bg-gray-800 rounded-xl px-3 py-2 mt-1 border border-gray-700">
                      {(order as Record<string, unknown>).declineReason as string}
                    </p>
                  ) : (
                    <p className="text-gray-600 text-xs italic">No reason provided</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── ORDERS TAB ── */}
      {tab === "orders" && <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-gray-400" />
          <input
            type="text"
            placeholder="Search user or platform…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-gray-900 dark:text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {(["all", "pending", "reassignment_requested", "assigned", "in_progress", "completed"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors whitespace-nowrap flex-shrink-0 touch-manipulation ${
                statusFilter === s
                  ? s === "reassignment_requested" ? "bg-orange-600 text-white" : "bg-purple-600 text-white"
                  : s === "reassignment_requested" && counts.reassignment_requested > 0
                    ? "bg-orange-900/30 border border-orange-800 text-orange-400"
                    : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {s === "reassignment_requested" ? "Re-assign" : s.replace(/_/g, " ")}
              {s === "reassignment_requested" && counts.reassignment_requested > 0 && (
                <span className="ml-1 bg-orange-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">
                  {counts.reassignment_requested}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-slate-900 dark:text-white rounded-xl text-xs font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Orders list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-600 dark:text-gray-400">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {orders.length === 0
                ? "No orders yet. Orders appear here when users click 'Grab The Order Immediately'."
                : "No orders match the current filters."}
            </p>
          </div>
        ) : (
          filtered.map(order => (
            <div
              key={order.id}
              className={`rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 ${
                order.status === "reassignment_requested"
                  ? "bg-orange-950/30 border border-orange-800"
                  : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
              }`}
            >
              {/* User info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-purple-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {order.userName[0] ?? <User className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-900 dark:text-white font-semibold text-sm truncate">{order.userName}</p>
                  <p className="text-slate-500 dark:text-gray-400 text-xs">{order.platformName} · {fmt(order.createdAt)}</p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <StatusBadge status={order.status} />

                {/* Status icons for at-a-glance */}
                {order.status === "pending" && (
                  <Clock className="w-4 h-4 text-yellow-400" />
                )}
                {order.status === "assigned" && (
                  <CheckCircle className="w-4 h-4 text-blue-400" />
                )}
                {order.status === "in_progress" && (
                  <PlayCircle className="w-4 h-4 text-purple-400" />
                )}
                {order.status === "completed" && (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                )}
                {order.status === "reassignment_requested" && (
                  <RotateCcw className="w-4 h-4 text-orange-400" />
                )}
              </div>

              {/* Action */}
              <div className="flex-shrink-0 w-full sm:w-auto">
                {order.status === "reassignment_requested" ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveReassignment(order)}
                      disabled={assigning === order.id}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-900 disabled:text-orange-500 text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                      {assigning === order.id ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Approving…</>
                      ) : (
                        <><Tag className="w-4 h-4" /> Assign + Code</>
                      )}
                    </button>
                    <button
                      onClick={() => { setDeclineTarget(order); setDeclineReason(""); }}
                      disabled={assigning === order.id}
                      className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 disabled:bg-red-900 disabled:text-red-500 text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                      <XCircle className="w-4 h-4" /> Decline
                    </button>
                  </div>
                ) : order.status === "pending" ? (
                  codeSelect?.orderId === order.id ? (
                    /* ── Inline code picker ── */
                    <div className="flex flex-col gap-2 min-w-[220px]">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 font-medium mb-0.5">
                        <Tag className="w-3.5 h-3.5" /> Select Ad Code Package
                      </div>
                      {/* Assignment error banner */}
                      {assignError && codeSelect?.orderId === order.id && (
                        <div className="flex flex-col gap-2 bg-red-900/40 border border-red-700 rounded-xl px-3 py-2 text-xs text-red-300">
                          <div className="flex items-start gap-2">
                            <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-400" />
                            <span>{assignError}</span>
                          </div>
                          {(assignError.includes("active task session") || assignError.includes("already completed")) && (
                            <button
                              onClick={() => handleConfirmAssign(true)}
                              disabled={assigning === order.id}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              {assigning === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                              Force Assign (Override)
                            </button>
                          )}
                        </div>
                      )}
                      <select
                        value={codeSelect.selectedCode}
                        onChange={e => { setCodeSelect({ ...codeSelect, selectedCode: e.target.value }); setAssignError(null); }}
                        className="w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white font-medium text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
                      >
                        <option value="">— choose a code —</option>
                        {TIERS.map(tier => {
                          const codes = allCodes.filter(c => c.tier === tier);
                          if (!codes.length) return null;
                          const nums = codes.map(c => c.code).filter(c => c !== "Rank");
                          const groupLabel = nums.length
                            ? `${nums[0]} – ${nums[nums.length - 1]}`
                            : codes[0].code;
                          return (
                            <optgroup key={tier} label={groupLabel}>
                              {codes.map(c => (
                                <option key={c.code} value={c.code}>{c.label}</option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirmAssign()}
                          disabled={!codeSelect.selectedCode || assigning === order.id}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:text-purple-500 text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          {assigning === order.id ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Assigning…</>
                          ) : (
                            <><CheckCircle className="w-3.5 h-3.5" /> Confirm</>
                          )}
                        </button>
                        <button
                          onClick={() => { setCodeSelect(null); setAssignError(null); }}
                          className="px-3 py-2 border border-gray-700 text-gray-400 hover:text-slate-900 dark:text-white rounded-xl text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Initial assign button ── */
                    <button
                      onClick={() => handleOpenCodeSelect(order)}
                      disabled={assigning === order.id}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:text-purple-500 text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                      {assigning === order.id ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Assigning…</>
                      ) : (
                        <><Tag className="w-4 h-4" /> Assign + Code</>
                      )}
                    </button>
                  )
                ) : order.status === "assigned" ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-blue-400 font-medium whitespace-nowrap">
                      Assigned {fmt(order.assignedAt)}
                    </span>
                    <button
                      onClick={() => { setMoveTarget(order); setMoveToPlatform(""); }}
                      className="flex items-center gap-1 px-2 py-1 bg-indigo-900/40 border border-indigo-700 text-indigo-300 hover:text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      <ArrowRightLeft className="w-3 h-3" /> Move
                    </button>
                  </div>
                ) : order.status === "in_progress" ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-purple-400 font-medium whitespace-nowrap">User is working…</span>
                    <button
                      onClick={() => { setMoveTarget(order); setMoveToPlatform(""); }}
                      className="flex items-center gap-1 px-2 py-1 bg-indigo-900/40 border border-indigo-700 text-indigo-300 hover:text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      <ArrowRightLeft className="w-3 h-3" /> Move
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-green-400 font-medium">Done ✓</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-slate-900 dark:text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
      </>}
    </>
  );
}

export default function AdminOrders() {
  return (
    <AdminLayout title="Order Assignment">
      <OrdersPanel />
    </AdminLayout>
  );
}
