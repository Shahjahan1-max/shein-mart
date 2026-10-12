import { useState, useEffect, useCallback } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, SectionCard, StatusBadge, statusToneFor } from "../../components/super-admin/SuperAdminUi";
import { DISCOVERED_ADMIN_PAGES, ROLE_DEFINITIONS, ALL_ROLES, type AdminPageDefinition } from "../../data/superAdminData";
import type { SuperAdminRole } from "../../types/super-admin";
import { api } from "../../lib/apiClient";
import {
  ShieldCheck, Plus, KeyRound, Ban, CheckCircle2, Trash2, Edit, CheckSquare,
  Square, RefreshCw, Users, ShieldAlert, X, Eye, FileText, Lock
} from "lucide-react";

export interface AdminAccountItem {
  id: string;
  username: string;
  name?: string;
  email?: string;
  role: SuperAdminRole;
  status: "active" | "disabled" | "suspended";
  assignedPages?: string[];
  permissions?: string[];
  maxDevices?: number;
  managedUsersCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function SuperAdminAdmins() {
  const [admins, setAdmins] = useState<AdminAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminAccountItem | null>(null);
  const [assigningPagesAdmin, setAssigningPagesAdmin] = useState<AdminAccountItem | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<AdminAccountItem | null>(null);
  const [viewingActivityAdmin, setViewingActivityAdmin] = useState<AdminAccountItem | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    username: "",
    name: "",
    email: "",
    password: "",
    role: "platform_admin" as SuperAdminRole,
    maxDevices: 5,
    assignedPages: ["dashboard", "users", "orders"] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Page assignment checklist state
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [savingPages, setSavingPages] = useState(false);

  // Admin activity logs
  const [activityLogs, setActivityLogs] = useState<Array<{ id: string; action: string; timestamp: string; details?: Record<string, unknown> }>>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success: boolean; data: AdminAccountItem[] }>("/api/super-admin/admins", { requiresAdmin: true });
      if (res.success && Array.isArray(res.data)) {
        setAdmins(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAdmins();

    function onDataChanged(e: Event) {
      const detail = (e as CustomEvent)?.detail;
      if (!detail?.collection || detail.collection === "adminAccounts") {
        void fetchAdmins();
      }
    }
    window.addEventListener("ds:data-changed", onDataChanged);
    return () => {
      window.removeEventListener("ds:data-changed", onDataChanged);
    };
  }, [fetchAdmins]);

  // Create Admin Submit
  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      const res = await api.post<{ success: boolean; data: AdminAccountItem }>("/api/super-admin/admins", formData, { requiresAdmin: true });
      if (res.success) {
        setShowCreateModal(false);
        setFormData({ username: "", name: "", email: "", password: "", role: "platform_admin", maxDevices: 5, assignedPages: ["dashboard", "users", "orders"] });
        await fetchAdmins();
      }
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to create admin account.");
    } finally {
      setSaving(false);
    }
  }

  // Update Admin Submit
  async function handleUpdateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAdmin) return;
    setSaving(true);
    setModalError(null);
    try {
      const res = await api.put<{ success: boolean; data: AdminAccountItem }>(`/api/super-admin/admins/${encodeURIComponent(editingAdmin.id)}`, {
        username: formData.username.trim(),
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        maxDevices: formData.maxDevices,
        password: formData.password ? formData.password.trim() : undefined,
      }, { requiresAdmin: true });
      if (res.success) {
        setEditingAdmin(null);
        await fetchAdmins();
      }
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to update admin account.");
    } finally {
      setSaving(false);
    }
  }

  // Toggle Admin Status
  async function handleToggleStatus(adminItem: AdminAccountItem) {
    const nextStatus = adminItem.status === "active" ? "disabled" : "active";
    try {
      const res = await api.patch<{ success: boolean; data: AdminAccountItem }>(`/api/super-admin/admins/${encodeURIComponent(adminItem.id)}/status`, {
        status: nextStatus,
      }, { requiresAdmin: true });
      if (res.success) {
        await fetchAdmins();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update admin status.");
    }
  }

  // Save Page Assignments
  async function handleSavePageAssignments() {
    if (!assigningPagesAdmin) return;
    setSavingPages(true);
    try {
      const res = await api.put<{ success: boolean; data: AdminAccountItem }>(`/api/super-admin/admins/${encodeURIComponent(assigningPagesAdmin.id)}/permissions`, {
        assignedPages: selectedPages,
      }, { requiresAdmin: true });
      if (res.success) {
        setAssigningPagesAdmin(null);
        await fetchAdmins();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update assigned pages.");
    } finally {
      setSavingPages(false);
    }
  }

  // Delete Admin
  async function handleDeleteAdmin() {
    if (!deletingAdmin) return;
    try {
      const res = await api.delete<{ success: boolean; message: string }>(`/api/super-admin/admins/${encodeURIComponent(deletingAdmin.id)}`, { requiresAdmin: true });
      if (res.success) {
        setDeletingAdmin(null);
        await fetchAdmins();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete admin.");
    }
  }

  // Open Page Assignment Modal
  function openAssignPagesModal(adminItem: AdminAccountItem) {
    setAssigningPagesAdmin(adminItem);
    setSelectedPages(adminItem.assignedPages ?? []);
  }

  // Toggle Single Page Selection
  function togglePageSelection(pageKey: string) {
    setSelectedPages(prev =>
      prev.includes(pageKey) ? prev.filter(p => p !== pageKey) : [...prev, pageKey]
    );
  }

  // Select All Pages
  function selectAllPages() {
    setSelectedPages(DISCOVERED_ADMIN_PAGES.map(p => p.key));
  }

  // Clear All Pages
  function clearAllPages() {
    setSelectedPages([]);
  }

  // View Activity
  async function openActivityDrawer(adminItem: AdminAccountItem) {
    setViewingActivityAdmin(adminItem);
    setLoadingActivity(true);
    try {
      const res = await api.get<{ success: boolean; data: Array<{ id: string; action: string; timestamp: string; details?: Record<string, unknown> }> }>("/api/super-admin/audit-logs", { requiresAdmin: true });
      if (res.success && Array.isArray(res.data)) {
        const filtered = res.data.filter(l => (l as { actorId?: string; actorUsername?: string }).actorId === adminItem.id || (l as { actorUsername?: string }).actorUsername === adminItem.username);
        setActivityLogs(filtered);
      }
    } catch {
      setActivityLogs([]);
    } finally {
      setLoadingActivity(false);
    }
  }

  const filteredAdmins = admins.filter(a => {
    const q = search.toLowerCase();
    return (
      a.username.toLowerCase().includes(q) ||
      (a.name && a.name.toLowerCase().includes(q)) ||
      (a.email && a.email.toLowerCase().includes(q)) ||
      a.role.toLowerCase().includes(q)
    );
  });

  return (
    <SuperAdminLayout title="Admin Management & Governance">
      <PageHeader
        title="Admin Management & Governance"
        description="Create admins, manage access, and dynamically assign individual Admin Pages."
        icon={<ShieldCheck className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchAdmins()}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              title="Refresh admins"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => {
                setModalError(null);
                setFormData({ username: "", name: "", email: "", password: "", role: "platform_admin", maxDevices: 5, assignedPages: ["dashboard", "users", "orders"] });
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Create Admin
            </button>
          </div>
        }
      />

      {/* Filter / Search Bar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or username…"
          className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Showing {filteredAdmins.length} of {admins.length} administrators
        </span>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Admin List Table */}
      <SectionCard title="Administrators Directory" description="All registered platform admins and their page assignment status." icon={<Users className="w-4 h-4" />}>
        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading admin accounts…</div>
        ) : filteredAdmins.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No administrator accounts found.</div>
        ) : (
          <div className="responsive-table-container">
            <table className="w-full text-sm min-w-[750px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="py-3 pr-4 font-semibold">Admin Identity</th>
                  <th className="py-3 pr-4 font-semibold">Role</th>
                  <th className="py-3 pr-4 font-semibold">Assigned Pages ({DISCOVERED_ADMIN_PAGES.length})</th>
                  <th className="py-3 pr-4 font-semibold">Managed Users</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map(a => {
                  const roleDef = ROLE_DEFINITIONS[a.role];
                  const assignedCount = a.assignedPages?.length ?? 0;
                  const isSuper = a.role === "super_admin";

                  return (
                    <tr key={a.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <span className={`w-9 h-9 rounded-full ${isSuper ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300" : "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                            {(a.name || a.username).slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                              {a.name || a.username}
                              {isSuper && <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-mono">SUPER</span>}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{a.email || `@${a.username}`}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-gray-900 dark:text-gray-200 font-medium">{roleDef?.name ?? a.role}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">Level {roleDef?.level ?? 2}</span>
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded font-mono font-bold">
                            {a.maxDevices === 0 ? "Unlimited Devs" : `${a.maxDevices || 5} Dev Max`}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {isSuper ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">All Pages Granted</span>
                          ) : assignedCount === 0 ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">No specific pages</span>
                          ) : (
                            a.assignedPages?.slice(0, 3).map(p => (
                              <span key={p} className="text-[11px] px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                                {p}
                              </span>
                            ))
                          )}
                          {!isSuper && assignedCount > 3 && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">+{assignedCount - 3} more</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{a.managedUsersCount ?? 0} users</span>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={a.status} tone={statusToneFor(a.status)} />
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openAssignPagesModal(a)}
                            className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                            title="Assign Pages & Permissions"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingAdmin(a);
                              setFormData({
                                username: a.username,
                                name: a.name || a.username,
                                email: a.email || "",
                                password: "",
                                role: a.role,
                                maxDevices: a.maxDevices ?? 5,
                                assignedPages: a.assignedPages || [],
                              });
                            }}
                            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            title="Edit Admin"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void openActivityDrawer(a)}
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="View Activity Log"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void handleToggleStatus(a)}
                            className={`p-1.5 rounded-lg transition-colors ${a.status === "active" ? "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30" : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"}`}
                            title={a.status === "active" ? "Disable Admin" : "Enable Admin"}
                          >
                            {a.status === "active" ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setDeletingAdmin(a)}
                            className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                            title="Delete Admin"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* CREATE ADMIN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" /> Create Administrator Account
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateAdmin} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    required
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as SuperAdminRole })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white"
                  >
                    {ALL_ROLES.map(r => (
                      <option key={r.id} value={r.id}>{r.name} (Level {r.level})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Max Concurrent Devices</label>
                  <select
                    value={formData.maxDevices}
                    onChange={e => setFormData({ ...formData, maxDevices: Number(e.target.value) })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white"
                  >
                    <option value={1}>1 Device (Single Device Only)</option>
                    <option value={2}>2 Devices</option>
                    <option value={3}>3 Devices</option>
                    <option value={5}>5 Devices (Default)</option>
                    <option value={10}>10 Devices</option>
                    <option value={0}>Unlimited Devices</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold disabled:opacity-50">
                  {saving ? "Creating…" : "Create Admin Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ADMIN MODAL */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" /> Edit Admin Profile
              </h3>
              <button onClick={() => setEditingAdmin(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleUpdateAdmin} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    required
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as SuperAdminRole })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                  >
                    {ALL_ROLES.map(r => (
                      <option key={r.id} value={r.id}>{r.name} (Level {r.level})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Max Concurrent Devices</label>
                <select
                  value={formData.maxDevices}
                  onChange={e => setFormData({ ...formData, maxDevices: Number(e.target.value) })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value={1}>1 Device (Single Device Only)</option>
                  <option value={2}>2 Devices</option>
                  <option value={3}>3 Devices</option>
                  <option value={5}>5 Devices (Default)</option>
                  <option value={10}>10 Devices</option>
                  <option value={0}>Unlimited Devices</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Change Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter new password (min 6 characters)"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setEditingAdmin(null)} className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                  {saving ? "Saving Changes…" : "Save Changes (Real-time)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAGE ASSIGNMENT MODAL (Checklist of all 20 Discovered Admin Pages) */}
      {assigningPagesAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-purple-600" /> Assign Admin Pages & Access
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Select which of the 20 Admin Pages <strong className="text-purple-600">{assigningPagesAdmin.username}</strong> can access.
                </p>
              </div>
              <button onClick={() => setAssigningPagesAdmin(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl border border-purple-100 dark:border-purple-800">
              <span className="text-xs text-purple-800 dark:text-purple-300 font-medium">
                {selectedPages.length} of {DISCOVERED_ADMIN_PAGES.length} pages selected
              </span>
              <div className="flex gap-2 text-xs">
                <button onClick={selectAllPages} className="px-2.5 py-1 rounded bg-purple-600 text-white font-medium hover:bg-purple-700">Select All</button>
                <button onClick={clearAllPages} className="px-2.5 py-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300">Clear All</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {DISCOVERED_ADMIN_PAGES.map(page => {
                const isSelected = selectedPages.includes(page.key);
                return (
                  <div
                    key={page.key}
                    onClick={() => togglePageSelection(page.key)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? "bg-purple-50/70 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 shadow-sm"
                        : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/60 hover:border-purple-300"
                    }`}
                  >
                    <div className="mt-0.5">
                      {isSelected ? <CheckSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" /> : <Square className="w-5 h-5 text-gray-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white leading-snug">{page.label}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">{page.route}</p>
                      <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1 leading-normal">{page.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setAssigningPagesAdmin(null)} className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm">
                Cancel
              </button>
              <button
                onClick={() => void handleSavePageAssignments()}
                disabled={savingPages}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm disabled:opacity-50"
              >
                {savingPages ? "Saving Assignments…" : "Save Page Assignments"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-lg font-bold">Delete Administrator</h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to permanently remove administrator <strong className="text-gray-900 dark:text-white">{deletingAdmin.username}</strong>?
            </p>

            <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
              This will revoke all administrative credentials and page access. Audit log records will be preserved for governance compliance.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setDeletingAdmin(null)} className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm">
                Cancel
              </button>
              <button onClick={() => void handleDeleteAdmin()} className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm">
                Permanently Delete Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN ACTIVITY DRAWER / MODAL */}
      {viewingActivityAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 h-full border-l border-gray-200 dark:border-gray-800 p-6 flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Activity Log</h3>
                <p className="text-xs text-gray-500">Actions for @{viewingActivityAdmin.username}</p>
              </div>
              <button onClick={() => setViewingActivityAdmin(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {loadingActivity ? (
                <p className="text-center py-8 text-xs text-gray-400">Loading activity trail…</p>
              ) : activityLogs.length === 0 ? (
                <p className="text-center py-8 text-xs text-gray-400">No recorded audit actions for this administrator.</p>
              ) : (
                activityLogs.map(log => (
                  <div key={log.id} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">{log.action}</span>
                      <span className="text-[10px] text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    {log.details && (
                      <pre className="text-[10px] font-mono text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 p-1.5 rounded overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
}
