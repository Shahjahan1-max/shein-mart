import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AdminLayout from "./AdminLayout";
import {
  TIERS, AD_GROUPS,
  type AdRowOverride,
  type AdGroup, type CustomAdDef, type AdEntry,
} from "../../data/adsData";
import {
  ToggleLeft, ToggleRight, Users, Tag, CheckCircle,
  X, Search, Zap, ImageOff, UserCheck,
  CheckSquare, Square, Layers, Plus, Edit2, ExternalLink, Upload,
} from "lucide-react";
import { useLocation as useWouterLocation } from "wouter";
import { ExtraTasksPanel } from "./AdminExtraTasks";
import {
  deleteAdAssignment,
  saveGenericFirebaseDoc,
  setAdAssignment,
  uploadAssetFile,
  useAdAssignments,
  useFirebaseCollection,
  useUsers,
} from "../../hooks/useApi";
import { saveAdGroupsCatalog, useAdGroupsCatalog } from "../../hooks/useCatalogs";
import { useAdmin } from "../../contexts/AdminContext";

/* ─── User loading (mirrors AdminUsers pattern) ──────────────────── */
interface SimpleUser {
  id: string;
  name: string;
  email: string;
  assignedCode: string | null;
}

function customDefToAdGroup(def: CustomAdDef): AdGroup {
  const commissionRate = def.price > 0 ? def.commission / def.price : 0.04;
  return {
    code: def.code,
    urlPath: def.code,
    label: def.title,
    amount: def.price,
    commissionRate,
    commissionAmount: def.commission,
    afterCommission: def.afterCommission,
    tier: def.tier || "Starter",
    ads: Array.from({ length: 25 }, (_, i) => ({
      adNo: i + 1,
      title: `${def.title} - Task ${i + 1}`,
      contentUrl: def.imageUrl || `https://placehold.co/400x400/8A4FFF/white?text=${def.code}`,
      amount: def.price,
      commissionRate,
      commissionAmount: def.commission,
      afterCommission: def.afterCommission,
    })),
    isActive: true,
  };
}

function applyAdOverrides(
  group: AdGroup,
  groupOverride?: { isActive?: boolean; amount?: number },
  rowOverrides: (AdRowOverride & { id: string; code: string; adNo: number })[] = [],
): AdGroup {
  return {
    ...group,
    ...(groupOverride?.isActive !== undefined ? { isActive: groupOverride.isActive } : {}),
    ...(groupOverride?.amount !== undefined ? { amount: groupOverride.amount } : {}),
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

/* ─── Tier badge ─────────────────────────────────────────────────── */
const TIER_COLORS: Record<string, string> = {
  Starter:  "bg-gray-800 text-slate-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  Bronze:   "bg-amber-900/40 text-amber-300 border-amber-700",
  Silver:   "bg-blue-900/40 text-blue-300 border-blue-700",
  Gold:     "bg-yellow-900/40 text-yellow-300 border-yellow-700",
  Diamond:  "bg-purple-900/40 text-purple-300 border-purple-700",
  Elite:    "bg-red-900/40 text-red-300 border-red-700",
  Platinum: "bg-cyan-900/40 text-cyan-300 border-cyan-700",
  Royal:    "bg-pink-900/40 text-pink-300 border-pink-700",
  Supreme:  "bg-orange-900/40 text-orange-300 border-orange-700",
};

function TierBadge({ tier }: { tier: string }) {
  const cls = TIER_COLORS[tier] ?? "bg-gray-800 text-slate-700 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>{tier}</span>
  );
}

/* ─── Code dropdown (shared helper) ─────────────────────────────── */
function CodeSelect({
  value,
  onChange,
  groups = [],
  placeholder = "— Choose code —",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  groups?: AdGroup[];
  placeholder?: string;
  className?: string;
}) {
  const customGroups: CustomAdDef[] = [];
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 ${className}`}
    >
      <option value="">{placeholder}</option>
      {customGroups.length > 0 && (
        <optgroup label="── Custom ──">
          {customGroups.map(g => (
            <option key={g.code} value={g.code}>
              {g.code} — ${g.price.toFixed(2)} · +${g.commission.toFixed(2)} commission
            </option>
          ))}
        </optgroup>
      )}
      {TIERS.map(tier => {
        const tierGroups = groups.filter(g => g.tier === tier);
        if (tierGroups.length === 0) return null;
        return (
          <optgroup key={tier} label={`── ${tier} ──`}>
            {tierGroups.map(g => (
              <option key={g.code} value={g.code}>
                {g.code} — ${g.amount} · +${g.commissionAmount} commission
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

/* ─── Tabs ────────────────────────────────────────────────────────── */
type Tab = "library" | "assign" | "create";

/* ─── Main Component ─────────────────────────────────────────────── */
export default function AdminAds() {
  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === "super_admin" || admin?.role === "superadmin" || admin?.role === "owner";
  const { data: apiUsers = [] } = useUsers();
  const { data: adCatalog, refetch: refetchAdCatalog, loading: adCatalogLoading } = useAdGroupsCatalog();
  const baseAdGroups = adCatalog.groups || [];
  const { data: adAssignments = [], refetch: refetchAssignments } = useAdAssignments();
  const { data: customAdDocs = [], refetch: refetchCustomAds } = useFirebaseCollection<CustomAdDef>("customAdCodes");
  const { data: groupOverrideDocs = [], refetch: refetchGroupOverrides } = useFirebaseCollection<{ id: string; code: string; isActive?: boolean; amount?: number }>("adCodeOverrides");
  const { data: rowOverrideDocs = [], refetch: refetchRowOverrides } = useFirebaseCollection<AdRowOverride & { id: string; code: string; adNo: number }>("adRowOverrides");
  const [pageTab, setPageTab] = useState<"menu" | "extratasks">("menu");
  const [tab, setTab] = useState<Tab>("library");
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [searchUser, setSearchUser] = useState("");

  /* ── Single-assign form state ── */
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  /* ── Bulk-assign state ── */
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkCode, setBulkCode] = useState<string>("");
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  /* ── Create custom ad state ── */
  const [customAds, setCustomAds] = useState<CustomAdDef[]>([]);
  const [editingCode, setEditingCode] = useState<string | null>(null);

  /* ── Library tab — spreadsheet view ── */
  const allCodes = useMemo(() => [
    ...baseAdGroups.map(g => ({ code: g.code, label: g.label, tier: g.tier })),
    ...customAds.map(d => ({ code: d.code, label: d.title, tier: d.tier })),
  ], [baseAdGroups, customAds]);
  const [selectedGroupCode, setSelectedGroupCode] = useState<string>(baseAdGroups[0]?.code || "");
  const [viewGroup, setViewGroup] = useState<AdGroup | undefined>(baseAdGroups[0]);
  const [editingAdKey, setEditingAdKey] = useState<string | null>(null);
  const blankAdEditForm = (ad: AdEntry) => ({
    title: ad.title,
    contentUrl: ad.contentUrl,
    amount: ad.amount,
    commissionAmount: ad.commissionAmount,
    afterCommission: ad.afterCommission,
    depositRequired: ad.depositRequired ?? false,
    requiredDeposit: ad.requiredDeposit ?? 0,
  });
  const [adEditForm, setAdEditForm] = useState<ReturnType<typeof blankAdEditForm>>({
    title: "", contentUrl: "", amount: 0, commissionAmount: 0, afterCommission: 0,
    depositRequired: false, requiredDeposit: 0,
  });
  const [adEditImageUploading, setAdEditImageUploading] = useState(false);
  const adEditImageRef = useRef<HTMLInputElement>(null);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [createImageUploading, setCreateImageUploading] = useState(false);
  const createImageRef = useRef<HTMLInputElement>(null);
  const blankForm = (): Omit<CustomAdDef, "createdAt"> => ({
    code: "", title: "", imageUrl: "", price: 0, commission: 0, afterCommission: 0, tier: "Starter",
  });
  const [createForm, setCreateForm] = useState(blankForm);

  const reload = useCallback(() => {
    setCustomAds(customAdDocs);
    const fresh = apiUsers.map(user => ({
      id: user.id,
      name: user.name ?? "Unknown",
      email: user.email ?? "",
      assignedCode: adAssignments.find(item => item.userId === user.id)?.code ?? null,
    }));
    setUsers(fresh);
    const freshIds = new Set(fresh.map(u => u.id));
    setCheckedIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => { if (freshIds.has(id)) next.add(id); });
      return next;
    });
  }, [adAssignments, apiUsers, customAdDocs]);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener("ds:data-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("ds:data-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, [reload]);

  // Removed auto-save of local AD_GROUPS - admin must import from Firebase
  // useEffect(() => {
  //   if (!adCatalog.groups?.length) {
  //     saveAdGroupsCatalog(AD_GROUPS).then(refetchAdCatalog).catch(console.error);
  //   }
  // }, [adCatalog.groups?.length, refetchAdCatalog]);

  useEffect(() => {
    const base = baseAdGroups.find(g => g.code === selectedGroupCode)
      ?? customAds.map(customDefToAdGroup).find(g => g.code === selectedGroupCode);
    const groupOverride = groupOverrideDocs.find(item => item.code === selectedGroupCode || item.id === selectedGroupCode);
    setViewGroup(base ? applyAdOverrides(base, groupOverride, rowOverrideDocs) : undefined);
    setEditingAdKey(null);
  }, [baseAdGroups, customAds, groupOverrideDocs, rowOverrideDocs, selectedGroupCode]);

  const resolveAssignableGroup = useCallback((code: string): AdGroup | undefined => {
    const base = baseAdGroups.find(g => g.code === code)
      ?? customAds.map(customDefToAdGroup).find(g => g.code === code);
    const groupOverride = groupOverrideDocs.find(item => item.code === code || item.id === code);
    return base ? applyAdOverrides(base, groupOverride, rowOverrideDocs) : undefined;
  }, [baseAdGroups, customAds, groupOverrideDocs, rowOverrideDocs]);

  const buildAssignmentPayload = useCallback((userId: string, code: string) => {
    const assignedTs = new Date().toISOString();
    const group = resolveAssignableGroup(code);
    return {
      userId,
      code,
      assignedTs,
      snapshot: group ? {
        code: group.code,
        label: group.label,
        tier: group.tier,
        amount: group.amount,
        commissionAmount: group.commissionAmount,
        afterCommission: group.afterCommission,
        ads: group.ads,
        updatedAt: assignedTs,
      } : undefined,
    };
  }, [resolveAssignableGroup]);

  /* ─── Ad row edit handlers ──── */
  function handleStartEditAd(ad: AdEntry, code: string) {
    setEditingAdKey(`${code}_${ad.adNo}`);
    setAdEditForm(blankAdEditForm(ad));
  }

  function handleAdEditFormChange(field: keyof typeof adEditForm, value: string | number | boolean) {
    setAdEditForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === "amount") {
        const amt = Number(value) || 0;
        const comm = parseFloat((amt * 0.1).toFixed(2));
        next.commissionAmount = comm;
        next.afterCommission = parseFloat((amt - comm).toFixed(2));
      }
      if (field === "commissionAmount") {
        next.afterCommission = parseFloat((Number(prev.amount) - Number(value)).toFixed(2));
      }
      if (field === "depositRequired" && !value) {
        next.requiredDeposit = 0;
      }
      return next;
    });
  }

  async function handleAdEditImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      setCreateError("Only JPEG, PNG, WebP, GIF, or SVG images are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCreateError("Image must be smaller than 5 MB.");
      e.target.value = "";
      return;
    }
    setAdEditImageUploading(true);
    try {
      const asset = await uploadAssetFile(file, "ad-row-images");
      handleAdEditFormChange("contentUrl", asset.url);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to upload image.");
    } finally {
      setAdEditImageUploading(false);
      e.target.value = "";
    }
  }

  function handleSaveAdEdit(code: string, adNo: number) {
    const id = `${code}_${adNo}`;
    saveGenericFirebaseDoc("adRowOverrides", id, {
      id,
      code,
      adNo,
      title: adEditForm.title.trim() || undefined,
      contentUrl: adEditForm.contentUrl.trim() || undefined,
      amount: adEditForm.amount,
      commissionAmount: adEditForm.commissionAmount,
      afterCommission: adEditForm.afterCommission,
      depositRequired: adEditForm.depositRequired || undefined,
      requiredDeposit: adEditForm.depositRequired && adEditForm.requiredDeposit > 0
        ? adEditForm.requiredDeposit : undefined,
    }).then(refetchRowOverrides).catch(console.error);
    setEditingAdKey(null);
  }

  /* ─── Toggle active ──── */
  function handleToggle(code: string, current: boolean) {
    saveGenericFirebaseDoc("adCodeOverrides", code, { id: code, code, isActive: !current })
      .then(refetchGroupOverrides)
      .catch(console.error);
  }

  /* ─── Single assign ──── */
  function handleAssign() {
    if (!selectedUser || !selectedCode) return;
    setAdAssignment(selectedUser, buildAssignmentPayload(selectedUser, selectedCode))
      .then(refetchAssignments)
      .catch(console.error);
    setUsers(prev => prev.map(u => u.id === selectedUser ? { ...u, assignedCode: selectedCode } : u));
    const user = users.find(u => u.id === selectedUser);
    setAssignSuccess(`Code ${selectedCode} assigned to ${user?.name ?? selectedUser}`);
    setTimeout(() => setAssignSuccess(null), 3000);
  }

  function handleRemoveAssignment(userId: string) {
    deleteAdAssignment(userId).then(refetchAssignments).catch(console.error);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, assignedCode: null } : u));
  }

  /* ─── Bulk assign ──── */
  function handleBulkAssign() {
    if (checkedIds.size === 0 || !bulkCode) return;
    const ids = Array.from(checkedIds);
    Promise.all(ids.map(id => setAdAssignment(id, buildAssignmentPayload(id, bulkCode))))
      .then(refetchAssignments)
      .catch(console.error);
    setUsers(prev => prev.map(u => ids.includes(u.id) ? { ...u, assignedCode: bulkCode } : u));
    setBulkSuccess(`Code ${bulkCode} assigned to ${ids.length} user${ids.length !== 1 ? "s" : ""}`);
    setCheckedIds(new Set());
    setBulkCode("");
    setTimeout(() => setBulkSuccess(null), 4000);
  }

  /* ─── Bulk remove ──── */
  function handleBulkRemove() {
    if (checkedIds.size === 0) return;
    const ids = Array.from(checkedIds);
    Promise.all(ids.map(id => deleteAdAssignment(id))).then(refetchAssignments).catch(console.error);
    setUsers(prev => prev.map(u => ids.includes(u.id) ? { ...u, assignedCode: null } : u));
    setCheckedIds(new Set());
  }

  /* ─── Create / edit custom ad ──── */
  function handleCreateFormChange(field: keyof typeof createForm, value: string | number) {
    setCreateForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === "price") {
        const price = Number(value) || 0;
        const commission = parseFloat((price * 0.1).toFixed(2));
        next.commission = commission;
        next.afterCommission = parseFloat((price - commission).toFixed(2));
      }
      if (field === "commission") {
        next.afterCommission = parseFloat((Number(createForm.price) - Number(value)).toFixed(2));
      }
      return next;
    });
  }

  async function handleCreateImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      setCreateError("Only JPEG, PNG, WebP, GIF, or SVG images are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCreateError("Image must be smaller than 5 MB.");
      e.target.value = "";
      return;
    }
    setCreateImageUploading(true);
    setCreateError("");
    try {
      const asset = await uploadAssetFile(file, "ad-images");
      handleCreateFormChange("imageUrl", asset.url);
      setCreateSuccess("Image uploaded. Save the ad to keep this URL.");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to upload image.");
    } finally {
      setCreateImageUploading(false);
      e.target.value = "";
    }
  }

  function handleSaveCustomAd() {
    setCreateError("");
    const { code, title, price } = createForm;
    if (!code.trim()) return setCreateError("Ad code is required.");
    if (!title.trim()) return setCreateError("Title is required.");
    if (price <= 0) return setCreateError("Price must be greater than 0.");
    const existingBuilt = baseAdGroups.find(g => g.code === code.trim());
    if (existingBuilt && editingCode !== code.trim()) return setCreateError("This code already exists in the library.");
    const existingCustom = customAds.find(d => d.code === code.trim());
    if (existingCustom && editingCode !== code.trim()) return setCreateError("This code already exists in custom ads.");
    const def: CustomAdDef = {
      code: createForm.code.trim(),
      title: createForm.title.trim(),
      imageUrl: createForm.imageUrl.trim(),
      price: Number(createForm.price),
      commission: Number(createForm.commission),
      afterCommission: Number(createForm.afterCommission),
      tier: createForm.tier,
      createdAt: new Date().toISOString(),
    };
    saveGenericFirebaseDoc("customAdCodes", def.code, { ...def, id: def.code })
      .then(refetchCustomAds)
      .catch(console.error);
    setCustomAds(prev => {
      const without = prev.filter(item => item.code !== def.code);
      return [def, ...without];
    });
    setCreateForm(blankForm());
    setEditingCode(null);
    setCreateSuccess(editingCode ? "Ad updated." : "Ad created successfully.");
    setTimeout(() => setCreateSuccess(""), 3000);
  }

  function handleEditCustomAd(def: CustomAdDef) {
    setEditingCode(def.code);
    setCreateForm({
      code: def.code,
      title: def.title,
      imageUrl: def.imageUrl,
      price: def.price,
      commission: def.commission,
      afterCommission: def.afterCommission,
      tier: def.tier,
    });
    setTab("create");
  }

  function handleCancelEdit() {
    setEditingCode(null);
    setCreateForm(blankForm());
    setCreateError("");
  }

  /* ─── Checkbox helpers ──── */
  const filteredUsers = users.filter(u => {
    const q = searchUser.toLowerCase();
    return !q || (u.name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
  });

  const allFilteredChecked = filteredUsers.length > 0 && filteredUsers.every(u => checkedIds.has(u.id));
  const someFilteredChecked = filteredUsers.some(u => checkedIds.has(u.id));

  function toggleSelectAll() {
    if (allFilteredChecked) {
      // deselect all visible
      setCheckedIds(prev => {
        const next = new Set(prev);
        filteredUsers.forEach(u => next.delete(u.id));
        return next;
      });
    } else {
      // select all visible
      setCheckedIds(prev => {
        const next = new Set(prev);
        filteredUsers.forEach(u => next.add(u.id));
        return next;
      });
    }
  }

  function toggleCheck(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const [, navigateTo] = useWouterLocation();

  // Show loading state while Firebase data is loading
  if (adCatalogLoading) {
    return (
      <AdminLayout title="Ad Code Management">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-500 dark:text-gray-400 text-sm">Loading ad groups from Firebase...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Show error if no ad groups loaded
  if (!baseAdGroups.length) {
    return (
      <AdminLayout title="Ad Code Management">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-slate-900 dark:text-white font-semibold">No ad groups found</p>
              <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">Please import ad groups to Firebase first</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Ad Code Management">
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["menu", "extratasks"] as const).map(k => (
          <button key={k} onClick={() => setPageTab(k)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              pageTab === k
                ? "bg-purple-600 text-white"
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-slate-900 dark:text-white"
            }`}>
            {k === "menu" ? "Menu" : "Extra Tasks"}
          </button>
        ))}
      </div>
      {pageTab === "extratasks" && <ExtraTasksPanel />}
      {pageTab === "menu" && (
      <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-slate-900 dark:text-white text-xl font-bold">Ad Code Management</h2>
            <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">
              {baseAdGroups.length} code groups · {baseAdGroups.length * 25} total ads · assign any group to any user in real time
            </p>
          </div>
          <button
            onClick={() => setPageTab("extratasks")}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm flex-shrink-0"
          >
            <Zap className="w-4 h-4" />
            Extra Tasks
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
          {([
            { id: "library", label: "Ad Library" },
            { id: "assign", label: "Assign to Users" },
            { id: "create", label: "Create Ad", icon: <Plus className="w-3.5 h-3.5" /> },
          ] as { id: Tab; label: string; icon?: React.ReactNode }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.id
                  ? "border-purple-500 text-purple-400"
                  : "border-transparent text-slate-600 dark:text-gray-400 hover:text-gray-300"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ═══ AD LIBRARY TAB — Spreadsheet View ═══ */}
        {tab === "library" && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Code group selector */}
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <label className="text-xs text-slate-500 dark:text-gray-400 whitespace-nowrap">Ad Code:</label>
                <select
                  value={selectedGroupCode}
                  onChange={e => setSelectedGroupCode(e.target.value)}
                  className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                >
                  {TIERS.map(tier => {
                    const tierCodes = allCodes.filter(c => c.tier === tier);
                    if (tierCodes.length === 0) return null;
                    return (
                      <optgroup key={tier} label={`── ${tier} ──`}>
                        {tierCodes.map(c => (
                          <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                  {customAds.length > 0 && (
                    <optgroup label="── Custom ──">
                      {customAds.map(d => (
                        <option key={d.code} value={d.code}>{d.code} — {d.title}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Group meta */}
              {viewGroup && (
                <div className="flex items-center gap-3">
                  <TierBadge tier={viewGroup.tier} />
                  <span className="text-slate-500 dark:text-gray-400 text-xs">{viewGroup.ads.length} ads</span>
                  <button
                    onClick={() => handleToggle(viewGroup.code, viewGroup.isActive)}
                    title={viewGroup.isActive ? "Deactivate group" : "Activate group"}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
                    style={viewGroup.isActive
                      ? {background: "rgba(88,28,235,0.15)", borderColor: "#7c3aed", color: "#a78bfa"}
                      : {background: "rgba(55,65,81,0.4)", borderColor: "#374151", color: "#9ca3af"}}
                  >
                    {viewGroup.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    {viewGroup.isActive ? "Active" : "Inactive"}
                  </button>
                </div>
              )}

              {/* + Add Ads */}
              <button
                onClick={() => setTab("create")}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-colors ml-auto"
              >
                <Plus className="w-4 h-4" />
                + Add Ads
              </button>
            </div>

            {/* Spreadsheet table */}
            {viewGroup ? (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                {/* Group summary row */}
                <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-800/40">
                  <span className="text-slate-900 dark:text-white font-bold text-sm">Code {viewGroup.code}</span>
                  <span className="text-gray-400 text-xs">Amount: <strong className="text-slate-900 dark:text-white">${viewGroup.amount.toFixed(2)}</strong></span>
                  <span className="text-slate-500 dark:text-gray-400 text-xs">Commission: <strong className="text-green-400">${viewGroup.commissionAmount.toFixed(2)} (10%)</strong></span>
                  <span className="text-slate-500 dark:text-gray-400 text-xs">After: <strong className="text-gray-300">${viewGroup.afterCommission.toFixed(2)}</strong></span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-slate-600 dark:text-gray-400 uppercase tracking-wide">
                        <th className="text-left px-4 py-3 w-10">#</th>
                        <th className="text-left px-4 py-3">Title</th>
                        <th className="text-left px-4 py-3">Content / Image URL</th>
                        <th className="text-right px-4 py-3">Amount</th>
                        <th className="text-right px-4 py-3">Commission</th>
                        <th className="text-right px-4 py-3">After Comm.</th>
                        <th className="text-center px-4 py-3">Deposit Lock</th>
                        <th className="text-right px-5 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800/60">
                      {viewGroup.ads.map(ad => {
                        const rowKey = `${viewGroup.code}_${ad.adNo}`;
                        const isEditing = editingAdKey === rowKey;
                        return (
                          <tr key={ad.adNo} className={`transition-colors ${isEditing ? "bg-purple-950/20" : "hover:bg-gray-100 dark:hover:bg-gray-800/40"}`}>
                            {isEditing ? (
                              /* ── Inline edit row ── */
                              <>
                                <td className="px-4 py-2 text-slate-600 dark:text-gray-400 text-xs">{ad.adNo}</td>
                                <td className="px-4 py-2">
                                  <input
                                    value={adEditForm.title}
                                    onChange={e => handleAdEditFormChange("title", e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-gray-800 border border-purple-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                                    placeholder="Title"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-2">
                                  <input
                                    value={adEditForm.contentUrl}
                                    onChange={e => handleAdEditFormChange("contentUrl", e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-gray-800 border border-purple-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                                    placeholder="https://…"
                                  />
                                  <input ref={adEditImageRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" onChange={handleAdEditImageUpload} className="hidden" />
                                  <button
                                    type="button"
                                    onClick={() => adEditImageRef.current?.click()}
                                    disabled={adEditImageUploading}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-purple-700 text-purple-300 hover:bg-purple-900/30 disabled:opacity-60"
                                    title="Upload image"
                                  >
                                    <Upload className="w-3 h-3" />
                                  </button>
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    value={adEditForm.amount || ""}
                                    onChange={e => handleAdEditFormChange("amount", parseFloat(e.target.value) || 0)}
                                    className="w-20 bg-gray-100 dark:bg-gray-800 border border-purple-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white text-right focus:outline-none"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    value={adEditForm.commissionAmount || ""}
                                    onChange={e => handleAdEditFormChange("commissionAmount", parseFloat(e.target.value) || 0)}
                                    className="w-20 bg-gray-100 dark:bg-gray-800 border border-purple-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white text-right focus:outline-none"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    readOnly
                                    value={adEditForm.afterCommission.toFixed(2)}
                                    className="w-20 bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs text-slate-500 dark:text-gray-400 text-right cursor-default"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <div className="space-y-1.5 min-w-[160px]">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <button
                                        type="button"
                                        onClick={() => handleAdEditFormChange("depositRequired", !adEditForm.depositRequired)}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${adEditForm.depositRequired ? "bg-orange-500" : "bg-gray-600"}`}
                                      >
                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${adEditForm.depositRequired ? "translate-x-4.5" : "translate-x-0.5"}`} />
                                      </button>
                                      <span className={`text-xs font-semibold ${adEditForm.depositRequired ? "text-orange-400" : "text-slate-600 dark:text-gray-400"}`}>
                                        {adEditForm.depositRequired ? "Required" : "Off"}
                                      </span>
                                    </label>
                                    {adEditForm.depositRequired && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-slate-600 dark:text-gray-400">$</span>
                                        <input
                                          type="number"
                                          min={0}
                                          step={0.01}
                                          value={adEditForm.requiredDeposit || ""}
                                          onChange={e => handleAdEditFormChange("requiredDeposit", parseFloat(e.target.value) || 0)}
                                          placeholder="Min deposit"
                                          className="w-24 bg-gray-100 dark:bg-gray-800 border border-orange-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white text-right focus:outline-none"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-2 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleSaveAdEdit(viewGroup.code, ad.adNo)}
                                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingAdKey(null)}
                                      className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-slate-700 dark:text-gray-300 rounded-lg text-xs transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              /* ── Normal display row ── */
                              <>
                                <td className="px-4 py-2.5 text-slate-600 dark:text-gray-400 text-xs font-mono">{ad.adNo}</td>
                                <td className="px-4 py-2.5 text-slate-900 dark:text-white text-xs">{ad.title}</td>
                                <td className="px-4 py-2.5 max-w-[220px]">
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={ad.contentUrl}
                                      alt=""
                                      className="w-8 h-8 rounded object-cover flex-shrink-0 bg-gray-800"
                                      onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }}
                                    />
                                    <button
                                      onClick={() => setPreviewImg(ad.contentUrl)}
                                      className="text-purple-400 hover:text-purple-300 text-xs font-mono truncate text-left"
                                      title={ad.contentUrl}
                                    >
                                      {ad.contentUrl.replace("https://aczmall.netlify.app/", "…/")}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-900 dark:text-white text-xs font-medium">${ad.amount.toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-right text-green-400 text-xs font-medium">
                                  +${ad.commissionAmount.toFixed(2)}
                                  <span className="text-gray-600 ml-1">({(ad.commissionRate * 100).toFixed(0)}%)</span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-700 dark:text-gray-300 text-xs">${ad.afterCommission.toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-center">
                                  {ad.depositRequired && (ad.requiredDeposit ?? 0) > 0 ? (
                                    <div className="inline-flex flex-col items-center gap-0.5">
                                      <span className="inline-flex items-center gap-1 bg-orange-900/40 text-orange-400 border border-orange-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                        🔒 ${(ad.requiredDeposit ?? 0).toFixed(2)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-700 text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-5 py-2.5 text-right">
                                  <button
                                    onClick={() => handleStartEditAd(ad, viewGroup.code)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-slate-900 dark:text-white rounded-lg text-xs font-medium transition-colors ml-auto"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    Edit
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <p className="text-slate-600 dark:text-gray-400 text-xs">
                    {viewGroup.ads.length} ads · URL base: <code className="text-slate-500 dark:text-gray-400">https://aczmall.netlify.app/{viewGroup.urlPath}/</code>
                  </p>
                  <button
                    onClick={() => setTab("assign")}
                    className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Assign this code to users →
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <Tag className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-gray-400">Select a code group above to view its ads.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ ASSIGN TAB ═══ */}
        {tab === "assign" && (
          <div className="space-y-5">
            {/* Info banner */}
            <div className="bg-purple-950/50 border border-purple-800/60 rounded-xl px-4 py-3 flex items-start gap-3">
              <Users className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <p className="text-purple-300 text-sm">
                Assign a code to one user via the Quick Assign form, or <strong>check multiple users</strong> and use the bulk action bar to assign them all at once.
              </p>
            </div>

            {/* Quick assign form */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
              <h3 className="text-slate-900 dark:text-white font-semibold text-sm">Quick Assign (single user)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* User dropdown */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">Select User</label>
                  <select
                    value={selectedUser}
                    onChange={e => setSelectedUser(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">— Choose user —</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}{u.email ? ` (${u.email})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Code dropdown */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">Select Ad Code</label>
                  <CodeSelect value={selectedCode} onChange={setSelectedCode} groups={baseAdGroups} className="w-full" />
                </div>

                {/* Assign button */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide opacity-0 select-none">Action</label>
                  <button
                    onClick={handleAssign}
                    disabled={!selectedUser || !selectedCode}
                    className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    Assign Now
                  </button>
                </div>
              </div>

              {assignSuccess && (
                <div className="flex items-center gap-2 text-green-400 text-sm bg-green-900/20 border border-green-800/50 rounded-xl px-3 py-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  {assignSuccess}
                </div>
              )}
            </div>

            {/* ── BULK ACTION BAR (appears when rows are checked) ── */}
            {checkedIds.size > 0 && (
              <div className="bg-purple-900/40 border border-purple-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-purple-200 text-sm font-semibold">
                  <Layers className="w-4 h-4" />
                  <span>{checkedIds.size} user{checkedIds.size !== 1 ? "s" : ""} selected</span>
                </div>

                <div className="flex-1 flex flex-wrap items-center gap-2">
                  <CodeSelect
                    value={bulkCode}
                    onChange={setBulkCode}
                    groups={baseAdGroups}
                    placeholder="Pick a code to assign…"
                    className="flex-1 min-w-[180px] py-2"
                  />
                  <button
                    onClick={handleBulkAssign}
                    disabled={!bulkCode}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 flex-shrink-0"
                  >
                    <UserCheck className="w-4 h-4" />
                    Assign to All
                  </button>
                  <button
                    onClick={handleBulkRemove}
                    className="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 text-red-300 border border-red-700 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 flex-shrink-0"
                    title="Remove assignment from all selected users"
                  >
                    <X className="w-4 h-4" />
                    Remove All
                  </button>
                  <button
                    onClick={() => setCheckedIds(new Set())}
                    className="px-3 py-2 text-gray-400 hover:text-slate-900 dark:text-white text-sm transition-colors flex-shrink-0"
                  >
                    Clear
                  </button>
                </div>

                {bulkSuccess && (
                  <div className="w-full flex items-center gap-2 text-green-400 text-sm bg-green-900/20 border border-green-800/50 rounded-xl px-3 py-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    {bulkSuccess}
                  </div>
                )}
              </div>
            )}

            {/* User list */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-slate-900 dark:text-white font-semibold text-sm flex-1">
                  All Users ({users.length})
                  {checkedIds.size > 0 && (
                    <span className="ml-2 text-xs text-purple-400 font-normal">{checkedIds.size} selected</span>
                  )}
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 dark:text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users…"
                    value={searchUser}
                    onChange={e => setSearchUser(e.target.value)}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {users.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl py-12 text-center">
                  <Users className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                  <p className="text-slate-600 dark:text-gray-400 text-sm">No registered users yet.</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        {/* Select-all checkbox */}
                        <th className="pl-4 pr-2 py-3 w-10">
                          <button
                            onClick={toggleSelectAll}
                            title={allFilteredChecked ? "Deselect all" : "Select all visible"}
                            className="text-slate-500 dark:text-gray-400 hover:text-purple-400 transition-colors"
                          >
                            {allFilteredChecked
                              ? <CheckSquare className="w-4 h-4 text-purple-400" />
                              : someFilteredChecked
                                ? <CheckSquare className="w-4 h-4 text-purple-600/60" />
                                : <Square className="w-4 h-4" />}
                          </button>
                        </th>
                        <th className="px-2 py-3 text-left text-xs text-slate-600 dark:text-gray-400 font-medium uppercase tracking-wide">User</th>
                        <th className="px-2 py-3 text-left text-xs text-slate-600 dark:text-gray-400 font-medium uppercase tracking-wide">Assigned Code</th>
                        <th className="px-2 py-3 text-left text-xs text-slate-600 dark:text-gray-400 font-medium uppercase tracking-wide hidden sm:table-cell">Details</th>
                        <th className="px-4 py-3 text-center text-xs text-slate-600 dark:text-gray-400 font-medium uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {filteredUsers.map(u => {
                        const group = u.assignedCode ? baseAdGroups.find(g => g.code === u.assignedCode) : null;
                        const checked = checkedIds.has(u.id);
                        return (
                          <tr
                            key={u.id}
                            className={`transition-colors cursor-pointer ${checked ? "bg-purple-900/20 hover:bg-purple-900/30" : "hover:bg-gray-100 dark:hover:bg-gray-800/40"}`}
                            onClick={() => toggleCheck(u.id)}
                          >
                            {/* Checkbox */}
                            <td className="pl-4 pr-2 py-3 w-10" onClick={e => { e.stopPropagation(); toggleCheck(u.id); }}>
                              {checked
                                ? <CheckSquare className="w-4 h-4 text-purple-400" />
                                : <Square className="w-4 h-4 text-gray-600" />}
                            </td>

                            {/* User info */}
                            <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                              <p className="text-slate-900 dark:text-white font-medium">{u.name}</p>
                              <p className="text-slate-600 dark:text-gray-400 text-xs">{u.email || "—"}</p>
                            </td>

                            {/* Assigned code */}
                            <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                              {u.assignedCode ? (
                                <span className="inline-flex items-center gap-1.5 bg-purple-900/40 text-purple-300 border border-purple-700 px-2.5 py-1 rounded-full text-xs font-bold">
                                  <Zap className="w-3 h-3" />
                                  {u.assignedCode}
                                </span>
                              ) : (
                                <span className="text-gray-600 text-xs italic">None</span>
                              )}
                            </td>

                            {/* Details */}
                            <td className="px-2 py-3 hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                              {group ? (
                                <div className="text-xs text-slate-500 dark:text-gray-400 space-y-0.5">
                                  <TierBadge tier={group.tier} />
                                  <p className="mt-0.5">
                                    ${group.amount} · <span className="text-green-400">+${group.commissionAmount}</span>
                                  </p>
                                </div>
                              ) : (
                                <span className="text-gray-700 text-xs">—</span>
                              )}
                            </td>

                            {/* Per-row actions */}
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-2">
                                <select
                                  defaultValue=""
                                  onChange={e => {
                                    const code = e.target.value;
                                    if (code) {
                                      setAdAssignment(u.id, buildAssignmentPayload(u.id, code))
                                        .then(refetchAssignments)
                                        .catch(console.error);
                                      setUsers(prev => prev.map(p => p.id === u.id ? { ...p, assignedCode: code } : p));
                                      e.target.value = "";
                                    }
                                  }}
                                  className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 max-w-[110px]"
                                >
                                  <option value="">Change…</option>
                                  {TIERS.map(tier => {
                                    const tg = baseAdGroups.filter(g => g.tier === tier);
                                    if (tg.length === 0) return null;
                                    return (
                                      <optgroup key={tier} label={tier}>
                                        {tg.map(g => (
                                          <option key={g.code} value={g.code}>{g.code} — ${g.amount}</option>
                                        ))}
                                      </optgroup>
                                    );
                                  })}
                                </select>
                                {u.assignedCode && (
                                  <button
                                    onClick={() => handleRemoveAssignment(u.id)}
                                    title="Remove assignment"
                                    className="w-7 h-7 rounded-lg bg-red-900/30 hover:bg-red-900/60 text-red-400 flex items-center justify-center transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreviewImg(null)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative z-10 max-w-sm w-full bg-gray-900 rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="relative">
              <img
                src={previewImg}
                alt="Ad preview"
                className="w-full aspect-square object-cover"
                onError={e => {
                  const el = e.target as HTMLImageElement;
                  el.style.display = "none";
                  (el.nextElementSibling as HTMLElement | null)?.classList.remove("hidden");
                }}
              />
              <div className="hidden flex-col items-center justify-center h-48 gap-2 text-gray-600">
                <ImageOff className="w-8 h-8" />
                <span className="text-sm">Image not available</span>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <p className="text-slate-500 dark:text-gray-400 text-xs font-mono truncate flex-1 mr-3">{previewImg}</p>
              <button
                onClick={() => setPreviewImg(null)}
                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-slate-900 dark:text-white flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
        {/* ═══ CREATE AD TAB ═══ */}
        {tab === "create" && (
          <div className="space-y-6">
            {/* Form card */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <h3 className="text-slate-900 dark:text-white font-bold text-base mb-4 flex items-center gap-2">
                {editingCode ? <Edit2 className="w-4 h-4 text-purple-400" /> : <Plus className="w-4 h-4 text-purple-400" />}
                {editingCode ? `Editing: ${editingCode}` : "Create New Ad Code"}
              </h3>

              {createError && (
                <div className="mb-4 bg-red-900/30 border border-red-800 rounded-xl px-4 py-2.5 text-red-400 text-sm">{createError}</div>
              )}
              {createSuccess && (
                <div className="mb-4 bg-green-900/30 border border-green-800 rounded-xl px-4 py-2.5 text-green-400 text-sm">{createSuccess}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Ad Code *</label>
                  <input
                    type="text"
                    value={createForm.code}
                    onChange={e => handleCreateFormChange("code", e.target.value)}
                    disabled={!!editingCode}
                    placeholder="e.g. CUSTOM001"
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Title *</label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={e => handleCreateFormChange("title", e.target.value)}
                    placeholder="Ad group title"
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-xs text-slate-500 dark:text-gray-400 block">Image / Link URL</label>
                    <button
                      type="button"
                      onClick={() => createImageRef.current?.click()}
                      disabled={createImageUploading}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 disabled:opacity-60"
                    >
                      <Upload className="w-3 h-3" />
                      {createImageUploading ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                  <input
                    ref={createImageRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                    onChange={handleCreateImageUpload}
                    className="hidden"
                  />
                  <input
                    type="url"
                    value={createForm.imageUrl}
                    onChange={e => handleCreateFormChange("imageUrl", e.target.value)}
                    placeholder="https://example.com/image.webp"
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Price (USDT) *</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={createForm.price || ""}
                    onChange={e => handleCreateFormChange("price", parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Commission (USDT)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={createForm.commission || ""}
                    onChange={e => handleCreateFormChange("commission", parseFloat(e.target.value) || 0)}
                    placeholder="auto 10%"
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">After Commission</label>
                  <input
                    type="number"
                    readOnly
                    value={createForm.afterCommission.toFixed(2)}
                    className="w-full bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-slate-500 dark:text-gray-400 focus:outline-none cursor-default"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Rank / Tier</label>
                  <select
                    value={createForm.tier}
                    onChange={e => handleCreateFormChange("tier", e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  >
                    {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={handleSaveCustomAd}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {editingCode ? "Update Ad" : "Create Ad"}
                </button>
                {editingCode && (
                  <button
                    onClick={handleCancelEdit}
                    className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-slate-900 dark:text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>

            {/* Custom ads table */}
            {customAds.length > 0 && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <h3 className="text-slate-900 dark:text-white font-semibold text-sm">Custom Ad Codes</h3>
                  <span className="text-slate-600 dark:text-gray-400 text-xs">{customAds.length} code{customAds.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-slate-600 dark:text-gray-400 uppercase tracking-wide">
                        <th className="text-left px-5 py-3">Code</th>
                        <th className="text-left px-4 py-3">Title</th>
                        <th className="text-left px-4 py-3">Tier</th>
                        <th className="text-right px-4 py-3">Price</th>
                        <th className="text-right px-4 py-3">Commission</th>
                        <th className="text-right px-4 py-3">After</th>
                        <th className="text-right px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {customAds.map(def => (
                        <tr key={def.code} className="hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-5 py-3">
                            <span className="font-mono text-purple-400 font-bold">{def.code}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-900 dark:text-white truncate max-w-[120px]">{def.title}</td>
                          <td className="px-4 py-3"><TierBadge tier={def.tier} /></td>
                          <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{def.price.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-green-400">+{def.commission.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-slate-500 dark:text-gray-400">{def.afterCommission.toFixed(2)}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleEditCustomAd(def)}
                                className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-slate-700 dark:text-gray-300"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800">
                  <p className="text-slate-600 dark:text-gray-400 text-xs">
                    Custom codes are available for assignment in the "Assign to Users" tab.
                  </p>
                </div>
              </div>
            )}

            {customAds.length === 0 && !createSuccess && (
              <div className="text-center py-10 text-gray-600">
                <Plus className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No custom ads yet. Fill in the form above to create one.</p>
              </div>
            )}
          </div>
        )}
      </>
      )}
    </AdminLayout>
  );
}
