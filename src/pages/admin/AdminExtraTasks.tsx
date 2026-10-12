import { useState, useEffect } from "react";
import AdminLayout from "./AdminLayout";
import {
  Plus, Edit2, UserCheck, X, Check, Search,
  Zap, User, ToggleLeft, ToggleRight, AlertTriangle,
  ClipboardList, Clock, CheckCircle, XCircle, ChevronRight,
} from "lucide-react";
import {
  type ExtraTask,
} from "../../data/adminData";
import {
  type NextTaskRequest,
} from "../../data/nextTaskData";
import {
  saveGenericFirebaseDoc,
  useFirebaseCollection,
  useUsers,
} from "../../hooks/useApi";
import { useAdmin } from "../../contexts/AdminContext";

interface SimpleUser {
  id: string;
  name: string;
  email: string;
}

const EMPTY_FORM = { title: "", description: "", reward: 10, status: "active" as "active" | "inactive", assignedTo: null as string | null };

interface FormState {
  title: string;
  description: string;
  reward: number;
  status: "active" | "inactive";
  assignedTo: string | null;
}

export function ExtraTasksPanel() {
  const { data: firebaseTasks = [], refetch: refetchTasks } = useFirebaseCollection<ExtraTask>("extraTasks");
  const { data: firebaseUsers = [] } = useUsers();
  const [tasks, setTasks] = useState<ExtraTask[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTasks(firebaseTasks);
  }, [firebaseTasks]);

  useEffect(() => {
    setUsers(firebaseUsers.map(u => ({ id: u.id, name: u.name ?? "Unknown", email: u.email ?? "" })));
  }, [firebaseUsers]);

  function handleOpenCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function handleOpenEdit(task: ExtraTask) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description,
      reward: task.reward,
      status: task.status,
      assignedTo: task.assignedTo,
    });
    setShowForm(true);
  }

  function handleSaveForm() {
    if (!form.title.trim()) return;
    const now = new Date().toISOString();
    if (editingId) {
      const existing = tasks.find(t => t.id === editingId);
      void saveGenericFirebaseDoc("extraTasks", editingId, {
        ...(existing ?? {}),
        ...form,
        id: editingId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      } as ExtraTask).then(refetchTasks).catch(console.error);
    } else {
      const id = `extra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      void saveGenericFirebaseDoc("extraTasks", id, {
        ...form,
        id,
        createdAt: now,
        updatedAt: now,
      } as ExtraTask).then(refetchTasks).catch(console.error);
    }
    setShowForm(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === "super_admin" || admin?.role === "superadmin" || admin?.role === "owner";

  function handleAssign(taskId: string) {
    if (!assignUserId) return;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      void saveGenericFirebaseDoc("extraTasks", taskId, {
        ...task,
        assignedTo: assignUserId || null,
        updatedAt: new Date().toISOString(),
      }).then(refetchTasks).catch(console.error);
    }
    setAssignTarget(null);
    setAssignUserId("");
  }

  function handleUnassign(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      void saveGenericFirebaseDoc("extraTasks", taskId, {
        ...task,
        assignedTo: null,
        updatedAt: new Date().toISOString(),
      }).then(refetchTasks).catch(console.error);
    }
  }

  function toggleStatus(task: ExtraTask) {
    void saveGenericFirebaseDoc("extraTasks", task.id, {
      ...task,
      status: task.status === "active" ? "inactive" : "active",
      updatedAt: new Date().toISOString(),
    }).then(refetchTasks).catch(console.error);
  }

  const filtered = tasks.filter(t =>
    !search ||
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  const getUserName = (id: string | null) => {
    if (!id) return null;
    return users.find(u => u.id === id)?.name ?? id;
  };

  return (
    <>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Extra Tasks Management
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Create, edit, assign, and manage bonus tasks for users
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Task
          </button>
        </div>

        {saved && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2.5 text-green-700 dark:text-green-300 text-sm font-semibold">
            <Check className="w-4 h-4" />
            Task saved successfully
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Tasks", value: tasks.length, color: "text-gray-900 dark:text-white" },
            { label: "Active", value: tasks.filter(t => t.status === "active").length, color: "text-green-600 dark:text-green-400" },
            { label: "Assigned", value: tasks.filter(t => t.assignedTo).length, color: "text-purple-600 dark:text-purple-400" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-center">
              <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Task list */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-gray-400">
              <Zap className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No tasks found</p>
            </div>
          )}

          {filtered.map(task => {
            const assignedUser = getUserName(task.assignedTo);
            return (
              <div key={task.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{task.title}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        task.status === "active"
                          ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                          : "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600"
                      }`}>
                        {task.status.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                        +${task.reward} reward
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>
                    {assignedUser && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <User className="w-3 h-3 text-purple-500" />
                        <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Assigned to: {assignedUser}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleStatus(task)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title={task.status === "active" ? "Deactivate" : "Activate"}
                    >
                      {task.status === "active"
                        ? <ToggleRight className="w-5 h-5 text-green-500" />
                        : <ToggleLeft className="w-5 h-5 text-slate-500 dark:text-gray-400" />}
                    </button>
                    <button
                      onClick={() => handleOpenEdit(task)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Assign row */}
                {assignTarget === task.id ? (
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                    <select
                      value={assignUserId}
                      onChange={e => setAssignUserId(e.target.value)}
                      className="flex-1 text-sm px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select a user…</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAssign(task.id)}
                      disabled={!assignUserId}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      Assign
                    </button>
                    <button
                      onClick={() => { setAssignTarget(null); setAssignUserId(""); }}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => { setAssignTarget(task.id); setAssignUserId(task.assignedTo ?? ""); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors font-semibold"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {task.assignedTo ? "Reassign" : "Assign to User"}
                    </button>
                    {task.assignedTo && (
                      <button
                        onClick={() => handleUnassign(task.id)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium"
                      >
                        <X className="w-3 h-3" />
                        Unassign
                      </button>
                    )}
                    <span className="ml-auto text-[10px] text-slate-500 dark:text-gray-400">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {editingId ? "Edit Task" : "Create Extra Task"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-slate-500 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Enter task title…"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the task…"
                  rows={3}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Reward (USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.reward}
                    onChange={e => setForm(f => ({ ...f, reward: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as "active" | "inactive" }))}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Assign to User (optional)
                </label>
                <select
                  value={form.assignedTo ?? ""}
                  onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value || null }))}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveForm}
                disabled={!form.title.trim()}
                className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-sm"
              >
                {editingId ? "Save Changes" : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Next-Task Requests Panel ────────────────────────────────────────── */
const REQ_STATUS_STYLES: Record<string, string> = {
  pending:  "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
  approved: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
  rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
};

function NextTaskRequestsPanel() {
  const { data: reqs = [], refetch } = useFirebaseCollection<NextTaskRequest>("nextTaskRequests");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [assignInputs, setAssignInputs] = useState<Record<string, string>>({});

  function handleApprove(req: NextTaskRequest) {
    const raw = assignInputs[req.id] ?? "";
    const assignedCode = parseInt(raw, 10);
    if (!raw || isNaN(assignedCode) || assignedCode <= 0) {
      alert("Enter a valid next task code (e.g. 302) before approving.");
      return;
    }
    saveGenericFirebaseDoc("nextTaskRequests", req.id, {
      ...req,
      status: "approved",
      assignedCode,
      respondedAt: new Date().toISOString(),
    }).then(refetch).catch(console.error);
    setAssignInputs(prev => { const n = { ...prev }; delete n[req.id]; return n; });
  }

  function handleReject(req: NextTaskRequest) {
    saveGenericFirebaseDoc("nextTaskRequests", req.id, {
      ...req,
      status: "rejected",
      respondedAt: new Date().toISOString(),
    }).then(refetch).catch(console.error);
  }

  const q = search.toLowerCase();
  const filtered = reqs.filter(r => {
    const matchQ = r.userName.toLowerCase().includes(q) || String(r.completedCode).includes(q) || r.userId.includes(q);
    const matchS = statusFilter === "all" || r.status === statusFilter;
    return matchQ && matchS;
  }).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const pending = reqs.filter(r => r.status === "pending").length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-purple-500" />
            New Task Requests
            {pending > 0 && (
              <span className="bg-yellow-500 text-yellow-900 text-xs font-black rounded-full px-2 py-0.5">{pending}</span>
            )}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Review and approve users' requests for the next task assignment
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { label: "Total", value: reqs.length, color: "text-gray-900 dark:text-white" },
          { label: "Pending", value: reqs.filter(r => r.status === "pending").length, color: "text-yellow-600 dark:text-yellow-400" },
          { label: "Approved", value: reqs.filter(r => r.status === "approved").length, color: "text-green-600 dark:text-green-400" },
        ] as const).map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-center">
            <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-gray-400" />
          <input
            type="text"
            placeholder="Search by user or task code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "pending", "approved", "rejected"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                statusFilter === s
                  ? "bg-purple-600 text-white"
                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-slate-900 dark:text-white hover:bg-gray-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Request cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500 dark:text-gray-400">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No requests found</p>
          </div>
        )}
        {filtered.map(req => (
          <div key={req.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{req.userName}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${REQ_STATUS_STYLES[req.status]}`}>
                    {req.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                  <span>Completed Package: <strong className="text-gray-800 dark:text-gray-200">#{req.completedCode}</strong></span>
                  {req.assignedCode && (
                    <span className="flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" />
                      Assigned: <strong className="text-purple-600 dark:text-purple-400">#{req.assignedCode}</strong>
                    </span>
                  )}
                  <span>{new Date(req.requestedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
              {req.status === "pending" && (
                <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              )}
              {req.status === "approved" && (
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              )}
              {req.status === "rejected" && (
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              )}
            </div>

            {/* Actions for pending requests */}
            {req.status === "pending" && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Assign task #</span>
                  <input
                    type="number"
                    min="100"
                    placeholder="e.g. 302"
                    value={assignInputs[req.id] ?? ""}
                    onChange={e => setAssignInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                    className="w-28 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <button
                  onClick={() => handleApprove(req)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Check className="w-3.5 h-3.5" /> Approve
                </button>
                <button
                  onClick={() => handleReject(req)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-xs font-semibold transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            )}

            {/* Approved: show assigned task */}
            {req.status === "approved" && req.assignedCode && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
                  ✓ Assigned Package #{req.assignedCode} to {req.userName}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminExtraTasks() {
  const [tab, setTab] = useState<"tasks" | "requests">("tasks");
  const { data: nextTaskRequests = [] } = useFirebaseCollection<NextTaskRequest>("nextTaskRequests");
  const pendingReqs = nextTaskRequests.filter(req => req.status === "pending").length;

  return (
    <AdminLayout title="Extra Tasks">
      {/* Tab switcher */}
      <div className="px-4 md:px-6 pt-4 flex gap-2">
        <button
          onClick={() => setTab("tasks")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
            tab === "tasks"
              ? "bg-purple-600 text-white"
              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-gray-700"
          }`}
        >
          <Zap className="w-4 h-4" />
          Extra Tasks
        </button>
        <button
          onClick={() => setTab("requests")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
            tab === "requests"
              ? "bg-purple-600 text-white"
              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-gray-700"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          New Task Requests
          {pendingReqs > 0 && (
            <span className="bg-yellow-500 text-yellow-900 text-xs font-black rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
              {pendingReqs}
            </span>
          )}
        </button>
      </div>

      {tab === "tasks" && <ExtraTasksPanel />}
      {tab === "requests" && <NextTaskRequestsPanel />}
    </AdminLayout>
  );
}
