import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { PLATFORMS_DATA, Platform, VipLevel } from "../../data/platformsData";
import { PlatformLogo } from "../../components/PlatformLogo";
import { Pencil, X, Check, ToggleLeft, ToggleRight, Save, Send, CheckCircle, AlertCircle } from "lucide-react";
import { saveGenericFirebaseDoc, useFirebaseCollection } from "../../hooks/useApi";
import { savePlatformsCatalog, usePlatformsCatalog } from "../../hooks/useCatalogs";
import { useAdmin } from "../../contexts/AdminContext";

type EditState = Omit<Platform, "logo">;

const VIP_BADGE: Record<VipLevel, string> = {
  1: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800",
  2: "bg-purple-900/40 text-purple-400 border-purple-800",
  3: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800",
};

function mergePlatforms(overridesList: (Partial<Platform> & { id?: string })[]): Platform[] {
  const overrides = Object.fromEntries(overridesList.filter(o => o.id).map(o => [o.id, o]));
  return PLATFORMS_DATA.map(p => ({ ...p, ...(overrides[p.id] ?? {}) }));
}

export default function AdminPlatforms() {
  const { data: firebaseOverrides, refetch } = useFirebaseCollection<Partial<Platform> & { id: string }>("platformOverrides");
  const { data: catalog, refetch: refetchCatalog } = usePlatformsCatalog();
  const { admin } = useAdmin();
  const [platforms, setPlatforms] = useState<Platform[]>(PLATFORMS_DATA);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);
  const [platformToast, setPlatformToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showPlatformToast(msg: string, type: "success" | "error" = "success") {
    setPlatformToast({ msg, type });
    setTimeout(() => setPlatformToast(null), 3000);
  }

  useEffect(() => {
    const base = catalog.platforms?.length ? catalog.platforms : PLATFORMS_DATA;
    const overrides = Object.fromEntries((firebaseOverrides ?? []).filter(o => o.id).map(o => [o.id, o]));
    setPlatforms(base.map(p => ({ ...p, ...(overrides[p.id] ?? {}) })));
  }, [catalog, firebaseOverrides]);

  function startEdit(p: Platform) {
    const { logo, ...rest } = p;
    setEditing({ ...rest });
  }

  function cancelEdit() { setEditing(null); }

  function saveEdit() {
    if (!editing) return;
    const updated = platforms.map(p => p.id === editing.id ? { ...p, ...editing } : p);
    setPlatforms(updated);
    const now = new Date().toISOString();
    savePlatformsCatalog(updated)
      .then(() => saveGenericFirebaseDoc("platformOverrides", editing.id, {
        ...editing,
        id: editing.id,
        status: "draft",
        updatedAt: now,
        updatedBy: admin?.username ?? "admin",
      }))
      .then(() => { refetch(); refetchCatalog(); showPlatformToast("Draft saved. Click Publish to make it live."); })
      .catch(() => showPlatformToast("Failed to save draft.", "error"));
    setSaved(editing.id);
    setEditing(null);
    setTimeout(() => setSaved(null), 2000);
  }

  function publishEdit(platformId: string) {
    const platform = platforms.find(p => p.id === platformId);
    if (!platform) return;
    const now = new Date().toISOString();
    savePlatformsCatalog(platforms)
      .then(() => saveGenericFirebaseDoc("platformOverrides", platformId, {
        ...platform,
        id: platformId,
        status: "published",
        updatedAt: now,
        publishedAt: now,
        updatedBy: admin?.username ?? "admin",
      }))
      .then(() => { refetch(); refetchCatalog(); showPlatformToast("Platform published! Users will see updates immediately."); })
      .catch(() => showPlatformToast("Failed to publish platform.", "error"));
    setPublished(platformId);
    setTimeout(() => setPublished(null), 2000);
  }

  function toggleActive(id: string) {
    const updated = platforms.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p);
    setPlatforms(updated);
    const current = updated.find(p => p.id === id);
    const now = new Date().toISOString();
    if (current) {
      savePlatformsCatalog(updated)
        .then(() => saveGenericFirebaseDoc("platformOverrides", id, {
          ...current,
          status: "published",
          updatedAt: now,
          publishedAt: now,
          updatedBy: admin?.username ?? "admin",
        }))
        .then(() => { refetch(); refetchCatalog(); showPlatformToast(`Platform ${current.isActive ? "activated" : "deactivated"} and published.`); })
        .catch(() => showPlatformToast("Failed to update platform.", "error"));
    }
  }

  const editField = <K extends keyof EditState>(key: K, value: EditState[K]) => {
    setEditing(prev => prev ? { ...prev, [key]: value } : prev);
  };

  return (
    <AdminLayout title="Menu Platforms">
      {/* Toast */}
      {platformToast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 text-sm font-medium px-4 py-3 rounded-2xl shadow-xl border ${
          platformToast.type === "error"
            ? "bg-gray-800 border-red-700/60 text-red-400"
            : "bg-gray-800 border-green-700/60 text-green-400"
        }`}>
          {platformToast.type === "error" ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
          {platformToast.msg}
        </div>
      )}
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-slate-900 dark:text-white text-xl font-bold">Menu Button — Platforms</h2>
            <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">
              Control platform cards shown in the user's Menu screen. Edit commission rates, balance ranges, and VIP levels.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2">
            <span className="text-slate-500 dark:text-gray-400 text-sm">{platforms.filter(p => p.isActive).length} active</span>
            <span className="text-gray-700 text-sm">/</span>
            <span className="text-slate-600 dark:text-gray-400 text-sm">{platforms.length} total</span>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-purple-950/50 border border-purple-800/60 rounded-xl px-4 py-3 flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
          <p className="text-purple-300 text-sm leading-relaxed">
            Changes are saved to your browser and reflected immediately in the user's <strong className="text-purple-200">Menu</strong> screen.
            VIP levels control which tab shows the platform (VIP 1 → Amazon tab, VIP 2 → Alibaba tab, VIP 3 → AliExpress tab).
          </p>
        </div>

        {/* Platform Cards */}
        <div className="space-y-4">
          {platforms.map(platform => {
            const isEditing = editing?.id === platform.id;
            const wasSaved = saved === platform.id;

            return (
              <div
                key={platform.id}
                className={`bg-gray-900 border rounded-2xl overflow-hidden transition-colors ${
                  isEditing ? "border-purple-600" : "border-gray-800"
                }`}
              >
                {/* Card header */}
                <div className="flex items-center gap-4 p-5 border-b border-gray-200 dark:border-gray-800">
                  <PlatformLogo logo={platform.logo} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-slate-900 dark:text-white font-bold text-base">{platform.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${VIP_BADGE[platform.vipLevel]}`}>
                        VIP {platform.vipLevel}
                      </span>
                      {wasSaved && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <Check className="w-3.5 h-3.5" /> Saved
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 dark:text-gray-400 text-xs mt-0.5 truncate">{platform.description}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(platform.id)}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${
                        platform.isActive
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800 hover:bg-green-900/50"
                          : "bg-gray-800 text-slate-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-700"
                      }`}
                    >
                      {platform.isActive
                        ? <><ToggleRight className="w-4 h-4" /> Active</>
                        : <><ToggleLeft className="w-4 h-4" /> Inactive</>}
                    </button>
                    {!isEditing ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(platform)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-700 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => publishEdit(platform.id)}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${
                            published === platform.id
                              ? "bg-green-600 border-green-600 text-white"
                              : "bg-purple-600 hover:bg-purple-700 border-purple-600 text-white"
                          }`}
                        >
                          {published === platform.id ? <><Check className="w-3.5 h-3.5" /> Published</> : <><Send className="w-3.5 h-3.5" /> Publish</>}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-slate-900 dark:text-white rounded-xl text-xs font-medium transition-colors">
                          <Save className="w-3.5 h-3.5" /> Save Draft
                        </button>
                        <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:text-slate-900 dark:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit form */}
                {isEditing && editing && (
                  <div className="p-5 bg-gray-900/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Platform Name</label>
                      <input type="text" value={editing.name} onChange={e => editField("name", e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-purple-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">VIP Level</label>
                      <select value={editing.vipLevel} onChange={e => editField("vipLevel", Number(e.target.value) as VipLevel)}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-purple-500">
                        <option value={1}>VIP 1 — Amazon Tab</option>
                        <option value={2}>VIP 2 — Alibaba Tab</option>
                        <option value={3}>VIP 3 — AliExpress Tab</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Min Balance (USDT)</label>
                      <input type="number" value={editing.balanceMin} onChange={e => editField("balanceMin", Number(e.target.value))} min={0}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-purple-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Max Balance (USDT — leave 0 for unlimited)</label>
                      <input type="number" value={editing.balanceMax ?? 0} onChange={e => {
                        const v = Number(e.target.value);
                        editField("balanceMax", v <= 0 ? null : v);
                      }} min={0}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-purple-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">
                        Per-Platform Commission Override (%)
                      </label>
                      <input type="number" value={editing.commission} onChange={e => editField("commission", Number(e.target.value))} min={0} step={0.1}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-purple-500" />
                      <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">Overrides the band default set in Admin Settings. Leave unchanged to keep the platform's default rate.</p>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Description</label>
                      <textarea value={editing.description} onChange={e => editField("description", e.target.value)} rows={2}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-purple-500 resize-none" />
                    </div>
                  </div>
                )}

                {/* Stats row */}
                {!isEditing && (
                  <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-800">
                    <div className="px-5 py-3 text-center">
                      <p className="text-xs text-slate-600 dark:text-gray-400 mb-0.5">Balance Range</p>
                      <p className="text-slate-900 dark:text-white text-sm font-semibold">
                        ${platform.balanceMin.toLocaleString()}
                        {platform.balanceMax ? `–$${platform.balanceMax.toLocaleString()}` : "+"}
                      </p>
                    </div>
                    <div className="px-5 py-3 text-center">
                      <p className="text-xs text-slate-600 dark:text-gray-400 mb-0.5">Commission</p>
                      <p className="text-slate-900 dark:text-white text-sm font-semibold">{platform.commission}%</p>
                    </div>
                    <div className="px-5 py-3 text-center">
                      <p className="text-xs text-slate-600 dark:text-gray-400 mb-0.5">VIP Level</p>
                      <p className="text-slate-900 dark:text-white text-sm font-semibold">VIP {platform.vipLevel}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
