import { useState, useEffect, useCallback } from "react";
import AdminLayout from "./AdminLayout";
import {
  Edit2, Check, X, Loader2, RefreshCw, AlertTriangle, CheckCircle,
} from "lucide-react";
import {
  useUsersPage,
  useAdAssignments,
  useFirebaseCollection,
  useAssignedTaskItemsPage,
  saveGenericFirebaseDoc,
  updateAssignedTaskItem,
} from "../../hooks/useApi";
import { TIERS, type AdGroup, type AdRowOverride, type CustomAdDef } from "../../data/adsData";
import { useAdGroupsCatalog } from "../../hooks/useCatalogs";

/* ─── Types ──────────────────────────────────────────────────────── */
export interface AssignedTaskItem {
  id: string;
  userId: string;
  code: string;
  adNo: number;
  productId?: string;
  orderId: string;
  title: string;
  contentUrl: string;
  amount: number;
  commissionAmount: number;
  afterCommission: number;
  depositRequired?: boolean;
  requiredDeposit?: number;
  status: "pending" | "completed";
  completedAt?: string;
  assignedTs?: string;
  createdAt: string;
  updatedAt: string;
}

/* ─── Helpers ────────────────────────────────────────────────────── */
/**
 * Deterministic orderId — must match backend generateAssignedTaskOrderId (SHA1).
 * Uses the Web Crypto API (SubtleCrypto) which is available in all modern browsers.
 */
async function stableOrderId(userId: string, code: string, adNo: number): Promise<string> {
  const raw = `${userId}:${code}:${adNo}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `${hex.slice(0, 5)}-AD${adNo}-${hex.slice(5, 9)}`;
}

function customDefToAdGroup(def: CustomAdDef): AdGroup {
  const commissionRate = def.price > 0 ? def.commission / def.price : 0.04;
  return {
    code: def.code, urlPath: def.code, label: def.title,
    amount: def.price, commissionRate,
    commissionAmount: def.commission, afterCommission: def.afterCommission,
    tier: def.tier || "Starter", isActive: true,
    ads: Array.from({ length: 25 }, (_, i) => ({
      adNo: i + 1,
      title: `${def.title} - Task ${i + 1}`,
      contentUrl: def.imageUrl || `https://placehold.co/400x400/8A4FFF/white?text=${def.code}`,
      amount: def.price, commissionRate,
      commissionAmount: def.commission, afterCommission: def.afterCommission,
    })),
  };
}

function applyAdRowOverrides(
  group: AdGroup,
  rowOverrides: (AdRowOverride & { id: string; code: string; adNo: number })[] = [],
): AdGroup {
  return {
    ...group,
    ads: group.ads.map(ad => {
      const ov = rowOverrides.find(item => item.code === group.code && item.adNo === ad.adNo);
      if (!ov) return ad;
      const amount = ov.amount ?? ad.amount;
      const commissionAmount = ov.commissionAmount ?? ad.commissionAmount;
      const afterCommission = ov.afterCommission ?? ad.afterCommission;
      return {
        ...ad,
        title: ov.title ?? ad.title,
        contentUrl: ov.contentUrl ?? ad.contentUrl,
        amount,
        commissionAmount,
        afterCommission,
        commissionRate: amount > 0 ? commissionAmount / amount : ad.commissionRate,
        depositRequired: ov.depositRequired ?? ad.depositRequired,
        requiredDeposit: ov.requiredDeposit ?? ad.requiredDeposit,
      };
    }),
  };
}

async function buildSnapshot(userId: string, group: AdGroup, assignedTs?: string): Promise<AssignedTaskItem[]> {
  const now = new Date().toISOString();
  return Promise.all(group.ads.map(async ad => ({
    id: `${userId}_${group.code}_${ad.adNo}`,
    userId, code: group.code, adNo: ad.adNo,
    productId: `${group.code}_${ad.adNo}`,
    orderId: await stableOrderId(userId, group.code, ad.adNo),
    title: ad.title, contentUrl: ad.contentUrl,
    amount: ad.amount, commissionAmount: ad.commissionAmount,
    afterCommission: ad.afterCommission,
    depositRequired: ad.depositRequired,
    requiredDeposit: ad.requiredDeposit,
    status: "pending" as const,
    assignedTs,
    createdAt: now, updatedAt: now,
  })));
}

/* ─── Inline edit form state ─────────────────────────────────────── */
interface EditForm {
  title: string;
  contentUrl: string;
  amount: string;
  commissionAmount: string;
}

function blankForm(item: AssignedTaskItem): EditForm {
  return {
    title: item.title,
    contentUrl: item.contentUrl,
    amount: String(item.amount),
    commissionAmount: String(item.commissionAmount),
  };
}

/* ─── Single task row — matches Ad Library inline edit style ─────── */
function TaskRow({
  item,
  editingId,
  savingId,
  onEdit,
  onCancel,
  onSave,
}: {
  item: AssignedTaskItem;
  editingId: string | null;
  savingId: string | null;
  onEdit: (id: string) => void;
  onCancel: () => void;
  onSave: (item: AssignedTaskItem, form: EditForm) => void;
}) {
  const isEditing  = editingId === item.id;
  const isSaving   = savingId  === item.id;
  const isCompleted = item.status === "completed";
  const [form, setForm] = useState<EditForm>(blankForm(item));

  useEffect(() => {
    if (isEditing) setForm(blankForm(item));
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  function change(field: keyof EditForm, val: string) {
    setForm(prev => {
      const next = { ...prev, [field]: val };
      if (field === "amount") {
        const amt  = parseFloat(val) || 0;
        const rate = item.amount > 0 ? item.commissionAmount / item.amount : 0;
        next.commissionAmount = String(parseFloat((amt * rate).toFixed(2)));
      }
      return next;
    });
  }

  const afterComm = parseFloat(
    ((parseFloat(form.amount) || 0) - (parseFloat(form.commissionAmount) || 0)).toFixed(2)
  );

  /* shared input class — same as Ad Library */
  const inp = "w-full bg-gray-100 dark:bg-gray-800 border border-purple-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none";

  if (!isEditing) {
    return (
      <tr className={`transition-colors ${isCompleted ? "opacity-60" : "hover:bg-gray-100 dark:hover:bg-gray-800/40"}`}>
        <td className="px-4 py-2 text-slate-600 dark:text-gray-400 text-xs text-center">{item.adNo}</td>
        <td className="px-4 py-2 text-xs text-slate-500 dark:text-gray-400 max-w-[200px]">
          <a href={item.contentUrl} target="_blank" rel="noopener noreferrer"
            className="hover:text-purple-400 transition-colors truncate block">{item.contentUrl}</a>
        </td>
        <td className="px-4 py-2 text-right text-xs text-slate-900 dark:text-white">{item.amount.toFixed(2)}</td>
        <td className="px-4 py-2 text-right text-xs text-slate-900 dark:text-white">{item.commissionAmount.toFixed(2)}</td>
        <td className="px-4 py-2 text-right text-xs text-slate-900 dark:text-white">{item.afterCommission.toFixed(2)}</td>
        <td className="px-4 py-2 text-center">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            isCompleted
              ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800"
              : "bg-gray-800 text-slate-500 dark:text-gray-400 border-gray-700"
          }`}>
            {isCompleted ? "completed" : "pending"}
          </span>
        </td>
        <td className="px-5 py-2 text-right">
          <button
            onClick={() => onEdit(item.id)}
            disabled={isCompleted}
            title={isCompleted ? "Completed tasks cannot be edited" : "Edit row"}
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-purple-900/30 text-slate-500 dark:text-gray-400 hover:text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
    );
  }

  /* ── Editing row ── */
  return (
    <tr className="bg-purple-950/20">
      <td className="px-4 py-2 text-slate-600 dark:text-gray-400 text-xs text-center">{item.adNo}</td>
      <td className="px-4 py-2 space-y-1.5">
        <input value={form.title} onChange={e => change("title", e.target.value)}
          placeholder="Title" className={inp} />
        <input value={form.contentUrl} onChange={e => change("contentUrl", e.target.value)}
          placeholder="https://…" className={`${inp} font-mono`} />
      </td>
      <td className="px-4 py-2">
        <input type="number" value={form.amount}
          onChange={e => change("amount", e.target.value)}
          className={`${inp} w-24 text-right`} />
      </td>
      <td className="px-4 py-2">
        <input type="number" value={form.commissionAmount}
          onChange={e => change("commissionAmount", e.target.value)}
          className={`${inp} w-24 text-right`} />
      </td>
      <td className="px-4 py-2">
        <input readOnly value={afterComm.toFixed(2)}
          className="w-24 bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs text-slate-500 dark:text-gray-400 text-right cursor-default" />
      </td>
      <td className="px-4 py-2 text-center">
        <span className="text-[10px] text-slate-600 dark:text-gray-400">editing</span>
      </td>
      <td className="px-5 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onSave(item, form)} disabled={isSaving}
            className="p-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 transition-colors">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onCancel} disabled={isSaving}
            className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-slate-700 dark:text-gray-300 disabled:opacity-50 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function AdminAssignedTasks() {
  const { data: apiUsers = [], hasMore: hasMoreUsers, loadMore: loadMoreUsers, loadingMore: loadingMoreUsers } = useUsersPage(25);
  const { data: adAssignments = [] }   = useAdAssignments();
  const { data: adCatalog, loading: adCatalogLoading }            = useAdGroupsCatalog();
  const { data: customAdDocs = [] }    = useFirebaseCollection<CustomAdDef>("customAdCodes");
  const { data: rowOverrideDocs = [] } = useFirebaseCollection<AdRowOverride & { id: string; code: string; adNo: number }>("adRowOverrides");

  const baseAdGroups = (() => {
    const byCode = new Map<string, AdGroup>();
    // Only use Firebase catalog data, no local AD_GROUPS
    (adCatalog.groups ?? []).forEach(group => byCode.set(group.code, group));
    return [...byCode.values()];
  })();

  /* ── User dropdown ── */
  const [userSearch, setUserSearch]       = useState("");
  const [showDrop, setShowDrop]           = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  /* ── Code selector ── */
  const [viewCode, setViewCode] = useState("");
  const { data: snapshots = [], refetch: refetchSnapshots, loading: snapsLoading, error: snapsError, hasMore, loadMore, loadingMore } =
    useAssignedTaskItemsPage<AssignedTaskItem>(selectedUserId, viewCode, 25);

  /* ── Edit / save ── */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId,  setSavingId]  = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /* ── Seeding ── */
  const [seeding, setSeeding]   = useState(false);
  const [seedKey, setSeedKey]   = useState("");   // tracks which user+code was seeded

  /* Derived */
  const assignment   = adAssignments.find(a => a.userId === selectedUserId);
  const assignedCode = assignment?.code ?? null;
  const selectedUser = apiUsers.find(u => u.id === selectedUserId);

  /* Sync viewCode when user changes */
  useEffect(() => {
    if (assignedCode) setViewCode(assignedCode);
    else setViewCode("");
    setEditingId(null);
  }, [assignedCode, selectedUserId]);

  /* Resolve AdGroup */
  const baseResolvedGroup: AdGroup | undefined = viewCode
    ? (baseAdGroups.find(g => g.code === viewCode)
        ?? customAdDocs.map(customDefToAdGroup).find(g => g.code === viewCode))
    : undefined;
  const resolvedGroup = baseResolvedGroup ? applyAdRowOverrides(baseResolvedGroup, rowOverrideDocs) : undefined;

  const sortedSnapshots = [...snapshots].sort((a, b) => a.adNo - b.adNo);
  const pendingSnapshots = sortedSnapshots.filter(item => item.status !== "completed");
  const snapshotAdNoKey = sortedSnapshots.map(item => Number(item.adNo || 0)).sort((a, b) => a - b).join(",");

  /* Auto-seed: restore missing rows only. Never overwrite user-specific admin edits. */
  const doSeed = useCallback(async (force = false) => {
    if (!selectedUserId || !viewCode || !resolvedGroup) return;
    const existingAdNos = new Set(sortedSnapshots.map(item => Number(item.adNo || 0)));
    const missingAdNos = Array.from({ length: 25 }, (_, index) => index + 1)
      .filter(adNo => !existingAdNos.has(adNo));
    if (missingAdNos.length === 0) return;
    const key = `${selectedUserId}_${viewCode}_${missingAdNos.join("-")}`;
    if (!force && seedKey === key) return;
    setSeedKey(key);
    setSeeding(true);
    try {
      const items = await buildSnapshot(selectedUserId, resolvedGroup, assignment?.assignedTs);
      const missingItems = items.filter(item => missingAdNos.includes(Number(item.adNo)));
      if (missingItems.length === 0) return;
      await Promise.all(
        missingItems.map(it => saveGenericFirebaseDoc("assignedTaskItems", it.id, it))
      );
      await refetchSnapshots();
    } catch (e) {
      console.error("Snapshot seed failed:", e);
      setSeedKey("");
    } finally {
      setSeeding(false);
    }
  }, [selectedUserId, viewCode, resolvedGroup, snapshotAdNoKey, seedKey, refetchSnapshots, assignment?.assignedTs]);

  useEffect(() => {
    if (!snapsLoading) doSeed();
  }, [doSeed, snapsLoading]);

  /* Manual retry */
  function handleRetry() {
    void doSeed(true);
  }

  /* Save handler */
  async function handleSave(item: AssignedTaskItem, form: EditForm) {
    setSavingId(item.id);
    setMsg(null);
    try {
      const amt   = parseFloat(form.amount)  || 0;
      const comm  = parseFloat(form.commissionAmount) || 0;
      const after = parseFloat((amt - comm).toFixed(2));
      await updateAssignedTaskItem<AssignedTaskItem>(item.id, {
        ...item,
        title: form.title.trim() || item.title,
        contentUrl: form.contentUrl.trim() || item.contentUrl,
        amount: amt, commissionAmount: comm, afterCommission: after,
        updatedAt: new Date().toISOString(),
      });
      await refetchSnapshots();
      setEditingId(null);
      setMsg({ ok: true, text: `Task ${item.adNo} updated. Ad Library unchanged.` });
      setTimeout(() => setMsg(null), 3500);
    } catch {
      setMsg({ ok: false, text: "Save failed. Please try again." });
    } finally {
      setSavingId(null);
    }
  }

  /* All codes for Select Set dropdown */
  const allCodes = [
    ...baseAdGroups.map(g => ({ code: g.code, tier: g.tier })),
    ...customAdDocs.map(d => ({ code: d.code, tier: d.tier })),
  ];

  const filteredUsers = apiUsers.filter(u => {
    const q = userSearch.toLowerCase();
    return !q
      || (u.name ?? "").toLowerCase().includes(q)
      || (u.email ?? "").toLowerCase().includes(q)
      || u.id.toLowerCase().includes(q);
  });

  const completedCount = sortedSnapshots.filter(s => s.status === "completed").length;
  const isLoading = snapsLoading || seeding;

  return (
    <AdminLayout title="User Task Management">

      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">

        {/* Select User */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">Select User:</span>
          <div className="relative">
            <button
              onClick={() => setShowDrop(v => !v)}
              className="min-w-[180px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white text-left flex items-center justify-between gap-2 hover:border-purple-500 transition-colors"
            >
              <span className="truncate">
                {selectedUser ? (selectedUser.name || selectedUser.email || selectedUser.id) : "— Select —"}
              </span>
              <svg className="w-3.5 h-3.5 text-slate-500 dark:text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDrop && (
              <div className="absolute z-30 top-full left-0 mt-1 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                  <input
                    autoFocus
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Search user…"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredUsers.length === 0 && (
                    <p className="text-center text-xs text-slate-500 dark:text-gray-400 py-4">No users found</p>
                  )}
                  {filteredUsers.map(u => (
                    <button key={u.id}
                      onClick={() => {
                        setSelectedUserId(u.id);
                        setShowDrop(false);
                        setUserSearch("");
                        setEditingId(null);
                        setSeedKey("");
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        selectedUserId === u.id
                          ? "bg-purple-600 text-white"
                          : "text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <p className="font-medium truncate">{u.name || u.email || u.id}</p>
                      {u.email && u.name && (
                        <p className={`text-xs truncate ${selectedUserId === u.id ? "text-purple-200" : "text-slate-500 dark:text-gray-400"}`}>
                          {u.email}
                        </p>
                      )}
                    </button>
                  ))}
                  {hasMoreUsers && (
                    <button
                      onClick={loadMoreUsers}
                      disabled={loadingMoreUsers}
                      className="w-full text-center px-4 py-2.5 text-xs text-purple-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                    >
                      {loadingMoreUsers ? "Loading..." : "Load more users"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Select Set + Refresh */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">Select Set:</span>
          <select
            value={viewCode}
            onChange={e => { setViewCode(e.target.value); setEditingId(null); setSeedKey(""); }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
          >
            <option value="">— Select —</option>
            {TIERS.map(tier => {
              const codes = allCodes.filter(c => c.tier === tier);
              if (!codes.length) return null;
              return (
                <optgroup key={tier} label={`── ${tier} ──`}>
                  {codes.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </optgroup>
              );
            })}
          </select>
          <button
            onClick={() => { setSeedKey(""); refetchSnapshots(); }}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── User info bar ── */}
      {selectedUser && (
        <div className="flex flex-wrap items-center gap-4 mb-4 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm">
          <div><span className="text-slate-500 dark:text-gray-400 text-xs">User:</span>
            <span className="ml-1.5 font-semibold text-gray-900 dark:text-white">{selectedUser.name || "—"}</span>
          </div>
          <div><span className="text-slate-500 dark:text-gray-400 text-xs">Email:</span>
            <span className="ml-1.5 text-gray-700 dark:text-gray-300">{selectedUser.email || "—"}</span>
          </div>
          <div><span className="text-slate-500 dark:text-gray-400 text-xs">Assigned Code:</span>
            <span className={`ml-1.5 font-bold ${assignedCode ? "text-purple-600 dark:text-purple-400" : "text-gray-400"}`}>
              {assignedCode ?? "None"}
            </span>
          </div>
          {sortedSnapshots.length > 0 && (
            <div className="ml-auto flex items-center gap-3 text-xs">
              <span className="text-green-600 dark:text-green-400 font-semibold">{completedCount} / 25 completed</span>
              <span className="text-gray-500 dark:text-gray-400">{pendingSnapshots.length} pending</span>
            </div>
          )}
        </div>
      )}

      {/* ── Feedback ── */}
      {msg && (
        <div className={`flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl text-sm ${
          msg.ok
            ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
            : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
        }`}>
          {msg.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {msg.text}
        </div>
      )}

      {snapsError && selectedUserId && viewCode && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {snapsError}
        </div>
      )}

      {/* ── Empty states ── */}
      {!selectedUserId && (
        <div className="text-center py-20 text-slate-500 dark:text-gray-400 text-sm">
          Select a user from the dropdown to view their assigned tasks.
        </div>
      )}
      {selectedUserId && !viewCode && (
        <div className="text-center py-20 text-slate-500 dark:text-gray-400 text-sm">
          Select a code set to view tasks.
        </div>
      )}
      {selectedUserId && viewCode && isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading tasks from Firebase…</span>
        </div>
      )}

      {/* ── Task table ── */}
      {selectedUserId && viewCode && !isLoading && pendingSnapshots.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          {/* Group summary row — same as Ad Library */}
          <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-800/40">
            <span className="text-slate-900 dark:text-white font-bold text-sm">Code {viewCode}</span>
            <span className="text-slate-500 dark:text-gray-400 text-xs">
              Pending Total: <strong className="text-slate-900 dark:text-white">${pendingSnapshots.reduce((s, i) => s + i.amount, 0).toFixed(2)}</strong>
            </span>
            <span className="text-slate-500 dark:text-gray-400 text-xs">
              Pending Commission: <strong className="text-green-400">${pendingSnapshots.reduce((s, i) => s + i.commissionAmount, 0).toFixed(2)}</strong>
            </span>
            <span className="text-xs text-amber-400 ml-auto">
              ⚠ Edits apply only to {selectedUser?.name || "this user"} — Ad Library unchanged
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-slate-600 dark:text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 w-10">#</th>
                  <th className="text-left px-4 py-3">Content / Image URL</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">Commission</th>
                  <th className="text-right px-4 py-3">After Comm.</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800/60">
                {pendingSnapshots.map(item => (
                  <TaskRow
                    key={item.id}
                    item={item}
                    editingId={editingId}
                    savingId={savingId}
                    onEdit={id => setEditingId(id)}
                    onCancel={() => setEditingId(null)}
                    onSave={handleSave}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="flex justify-center py-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-slate-900 dark:text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── No snapshot + not loading ── */}
      {selectedUserId && viewCode && !isLoading && sortedSnapshots.length > 0 && pendingSnapshots.length === 0 && (
        <div className="text-center py-16 text-slate-500 dark:text-gray-400">
          <p className="text-sm font-medium text-green-500 mb-1">All 25 tasks completed.</p>
          <p className="text-xs">Completed orders are hidden from this control panel.</p>
        </div>
      )}

      {selectedUserId && viewCode && !isLoading && sortedSnapshots.length === 0 && (
        <div className="text-center py-16 text-slate-500 dark:text-gray-400">
          <p className="text-sm mb-3">No task snapshot found for this user and code.</p>
          <button
            onClick={handleRetry}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Retry Build Snapshot
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
