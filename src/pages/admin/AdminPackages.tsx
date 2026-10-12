import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { PACKAGES, getTierLabel, getTierColor, isKillMode } from "../../data/packagesData";
import type { AdPackage } from "../../data/packagesData";
import { RefreshCw, Zap, ChevronDown, ChevronUp, Pencil, Check, X, ToggleRight, ToggleLeft, Users } from "lucide-react";
import { saveUserPackageControl, useUserPackageControls, useUsers } from "../../hooks/useApi";
import { savePackagesCatalog, usePackagesCatalog } from "../../hooks/useCatalogs";

interface RealUser {
  id: string;
  name: string;
  email: string;
  assignedCode: number | null;
}

type Tab = "packages" | "assign";

export default function AdminPackages() {
  const [tab, setTab] = useState<Tab>("packages");
  const [packages, setPackages] = useState(PACKAGES.map(p => ({ ...p })));
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<AdPackage>>({});
  const [saved, setSaved] = useState<number | null>(null);
  const [users, setUsers] = useState<RealUser[]>([]);
  const [assignSelect, setAssignSelect] = useState<Record<string, string>>({});
  const { data: apiUsers = [] } = useUsers();
  const { data: packageControls = [], refetch: refetchPackageControls } = useUserPackageControls();
  const { data: packageCatalog, refetch: refetchPackageCatalog } = usePackagesCatalog();

  useEffect(() => {
    setPackages((packageCatalog.packages?.length ? packageCatalog.packages : PACKAGES).map(p => ({ ...p })));
  }, [packageCatalog]);

  useEffect(() => {
    setUsers(apiUsers.map(user => {
      const control = packageControls.find(item => item.userId === user.id);
      const assignedCode = control?.codes
        ? control.codes.amazon || control.codes.aliexpress || control.codes.alibaba || null
        : null;
      return { id: user.id, name: user.name, email: user.email ?? "", assignedCode };
    }));
  }, [apiUsers, packageControls]);

  function toggleActive(code: number) {
    const updated = packages.map(p => p.code === code ? { ...p, status: p.status === "active" ? "inactive" : "active" } : p);
    setPackages(updated);
    savePackagesCatalog(updated).then(refetchPackageCatalog).catch(console.error);
  }

  function startEdit(pkg: AdPackage) {
    setEditing(pkg.code);
    setEditValues({ deposit: pkg.deposit, baseReward: pkg.baseReward, taskCount: pkg.taskCount, title: pkg.title });
  }

  function saveEdit(code: number) {
    const updated = packages.map(p => p.code === code ? { ...p, ...editValues } : p);
    setPackages(updated);
    savePackagesCatalog(updated).then(refetchPackageCatalog).catch(console.error);
    setEditing(null);
    setSaved(code);
    setTimeout(() => setSaved(null), 2000);
  }

  function assignPackage(userId: string) {
    const code = Number(assignSelect[userId]);
    if (!code) return;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, assignedCode: code } : u));
    const key = code < 500 ? "amazon" : code < 700 ? "alibaba" : "aliexpress";
    saveUserPackageControl(userId, {
      codes: { amazon: 0, aliexpress: 0, alibaba: 0, [key]: code },
    }).then(refetchPackageControls).catch(console.error);
  }

  const tierGroups: Record<string, typeof packages> = {
    Starter: packages.filter(p => p.code < 400),
    Silver: packages.filter(p => p.code >= 400 && p.code < 500),
    Gold: packages.filter(p => p.code >= 500 && p.code < 600),
    Diamond: packages.filter(p => p.code >= 600 && p.code < 700),
    Elite: packages.filter(p => p.code >= 700),
  };

  return (
    <AdminLayout title="Package Management">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-slate-900 dark:text-white text-xl font-bold">Ads Package Control</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">Manage all 20 package codes, toggle visibility, and assign packages to users.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 pb-0">
          {(["packages", "assign"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors ${
                tab === t ? "border-purple-500 text-purple-400" : "border-transparent text-slate-600 dark:text-gray-400 hover:text-gray-300"
              }`}
            >
              {t === "assign" ? "Assign to Users" : "Package List"}
            </button>
          ))}
        </div>

        {/* ── PACKAGES TAB ── */}
        {tab === "packages" && (
          <div className="space-y-6">
            {Object.entries(tierGroups).map(([tier, pkgs]) => (
              <div key={tier}>
                <h3 className="text-slate-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">{tier} Series</h3>
                <div className="space-y-2">
                  {pkgs.map(pkg => {
                    const kill = isKillMode(pkg);
                    const isActive = pkg.status === "active";
                    const isExp = expanded === pkg.code;
                    const isEdit = editing === pkg.code;
                    const wasSaved = saved === pkg.code;

                    return (
                      <div key={pkg.code} className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${isEdit ? "border-purple-600" : "border-gray-800"}`}>
                        {/* Row */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          {/* Code */}
                          <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${isActive ? "bg-purple-600" : "bg-gray-100 dark:bg-gray-800"}`}>
                            <span className="text-slate-900 dark:text-white font-extrabold text-lg leading-none">#{pkg.code}</span>
                            {kill && <RefreshCw className="w-3 h-3 text-white/70 mt-0.5" />}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-slate-900 dark:text-white font-bold text-sm">{pkg.title}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${getTierColor(pkg.code)}`}>{tier}</span>
                              {kill && <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800 flex items-center gap-1"><Zap className="w-2.5 h-2.5" />∞</span>}
                              {wasSaved && <span className="text-green-400 text-xs flex items-center gap-1"><Check className="w-3 h-3" />Saved</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-gray-400 flex-wrap">
                              <span>Deposit: {pkg.isFree ? "Free" : `${pkg.deposit} USDT`}</span>
                              <span>Tasks: {kill ? "∞" : pkg.taskCount}</span>
                              <span>Reward: {pkg.baseReward} USDT</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => toggleActive(pkg.code)} title={isActive ? "Deactivate" : "Activate"}>
                              {isActive
                                ? <ToggleRight className="w-7 h-7 text-purple-500" />
                                : <ToggleLeft className="w-7 h-7 text-gray-600" />}
                            </button>
                            {!isEdit ? (
                              <button onClick={() => { startEdit(pkg); setExpanded(pkg.code); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg text-xs font-medium">
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button onClick={() => saveEdit(pkg.code)} className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium">
                                  <Check className="w-3 h-3" /> Save
                                </button>
                                <button onClick={() => setEditing(null)} className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 rounded-lg text-xs font-medium">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            <button onClick={() => setExpanded(isExp ? null : pkg.code)}>
                              {isExp ? <ChevronUp className="w-4 h-4 text-slate-600 dark:text-gray-400" /> : <ChevronDown className="w-4 h-4 text-slate-600 dark:text-gray-400" />}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Edit */}
                        {isExp && (
                          <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-800 pt-3">
                            {isEdit ? (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                  { key: "title", label: "Package Title", type: "text" },
                                  { key: "deposit", label: "Min Deposit (USDT)", type: "number" },
                                  { key: "baseReward", label: "Base Reward (USDT)", type: "number" },
                                  { key: "taskCount", label: "Task Count", type: "number" },
                                ].map(field => (
                                  <div key={field.key} className="space-y-1">
                                    <label className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">{field.label}</label>
                                    <input
                                      type={field.type}
                                      value={String(editValues[field.key as keyof typeof editValues] ?? "")}
                                      onChange={e => setEditValues(prev => ({ ...prev, [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value }))}
                                      className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                  { label: "Description", value: pkg.description.substring(0, 60) + "..." },
                                  { label: "Tags", value: pkg.tags.join(", ") },
                                  { label: "Type", value: pkg.type },
                                  { label: "Currency", value: pkg.currency },
                                ].map(item => (
                                  <div key={item.label}>
                                    <p className="text-xs text-slate-600 dark:text-gray-400 uppercase tracking-wide">{item.label}</p>
                                    <p className="text-xs text-slate-700 dark:text-gray-300 mt-0.5">{item.value}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ASSIGN TAB ── */}
        {tab === "assign" && (
          <div className="space-y-4">
            <div className="bg-purple-950/50 border border-purple-800/60 rounded-xl px-4 py-3 flex items-start gap-3">
              <Users className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <p className="text-purple-300 text-sm">
                Assign a specific package code to a user. The user's task dashboard will load ads from the assigned package.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="px-4 py-3 text-left text-slate-500 dark:text-gray-400 font-medium text-xs uppercase tracking-wide">User</th>
                    <th className="px-4 py-3 text-left text-slate-500 dark:text-gray-400 font-medium text-xs uppercase tracking-wide">Current Package</th>
                    <th className="px-4 py-3 text-left text-slate-500 dark:text-gray-400 font-medium text-xs uppercase tracking-wide">Assign New Set</th>
                    <th className="px-4 py-3 text-left text-slate-500 dark:text-gray-400 font-medium text-xs uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-600 dark:text-gray-400 text-sm">
                        No registered users found. Users appear here after they sign up.
                      </td>
                    </tr>
                  )}
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <p className="text-slate-900 dark:text-white font-medium">{u.name}</p>
                        <p className="text-slate-600 dark:text-gray-400 text-xs">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {u.assignedCode
                          ? <span className="bg-purple-900/40 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">#{u.assignedCode}</span>
                          : <span className="text-gray-600 text-xs">None</span>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={assignSelect[u.id] ?? ""}
                          onChange={e => setAssignSelect(prev => ({ ...prev, [u.id]: e.target.value }))}
                          className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500"
                        >
                          <option value="">Select code…</option>
                          {PACKAGES.filter(p => p.status === "active").map(p => (
                            <option key={p.code} value={p.code}>#{p.code} — {p.title}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => assignPackage(u.id)}
                          disabled={!assignSelect[u.id]}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
            <p className="text-gray-600 text-xs text-center">TODO: [BACKEND] POST /api/admin/users/:id/package</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
