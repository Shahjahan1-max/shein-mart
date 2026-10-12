import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Bell, CalendarClock, CheckCircle, Loader2, Search, Send, User, Users } from "lucide-react";
import { submitNotification, useNotificationsPage, useUsersPage, type ApiNotification } from "../../hooks/useApi";
import { useAdmin } from "../../contexts/AdminContext";

type NoticeType = "info" | "success" | "warning" | "alert";

const TYPE_COLORS: Record<NoticeType, string> = {
  info: "bg-blue-900/30 border-blue-800 text-blue-400",
  success: "bg-green-900/30 border-green-800 text-green-400",
  warning: "bg-yellow-900/30 border-yellow-800 text-yellow-400",
  alert: "bg-red-900/30 border-red-800 text-red-400",
};

function localDatetimeString(d: Date): string {
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultScheduleTime(): string {
  return localDatetimeString(new Date(Date.now() + 60_000));
}

function nowInputValue(): string {
  return localDatetimeString(new Date());
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-800 border border-green-700/60 text-green-400 text-sm font-medium px-4 py-3 rounded-2xl shadow-xl">
      <CheckCircle className="w-4 h-4 flex-shrink-0" />
      {message}
    </div>
  );
}

export function NotificationsPanel() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<"all" | string>("all");
  const [type, setType] = useState<NoticeType>("info");
  const [userSearch, setUserSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | NoticeType>("all");
  const [filterTarget, setFilterTarget] = useState<"all" | "broadcast" | "individual">("all");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: users = [], loading: usersLoading, hasMore: hasMoreUsers, loadMore: loadMoreUsers, loadingMore: loadingMoreUsers } = useUsersPage(25);
  const { data: notifications = [], loading: notifsLoading, refetch, hasMore, loadMore, loadingMore } = useNotificationsPage(25, {
    type: filterType === "all" ? undefined : filterType,
    target: filterTarget === "all" ? undefined : filterTarget,
  });

  const visibleNotifications = useMemo(
    () => notifications
      .filter(n => !n.is_deleted)
      .filter(n => filterType === "all" || n.type === filterType)
      .filter(n => filterTarget === "all" || (filterTarget === "broadcast" ? n.broadcast || !n.userId : n.userId))
      .sort((a, b) => String(b.createdAt || b.sentAt || "").localeCompare(String(a.createdAt || a.sentAt || ""))),
    [filterTarget, filterType, notifications],
  );

  const filteredUsers = users.filter(user => {
    const q = userSearch.toLowerCase();
    return !q || user.name.toLowerCase().includes(q) || (user.email ?? "").toLowerCase().includes(q);
  });

  async function handleSend() {
    if (!title.trim() || !message.trim()) return;
    const user = users.find(item => item.id === target);
    const scheduledFor = scheduleEnabled ? scheduleTime : undefined;
    if (scheduleEnabled && (!scheduleTime || new Date(scheduleTime).getTime() <= Date.now())) {
      setToastMsg("Pick a future date/time");
      return;
    }
    setBusy(true);
    try {
      await submitNotification({
        id: `notif-${Date.now()}`,
        title: title.trim(),
        message: message.trim(),
        type,
        target,
        targetName: target === "all" ? "All Users" : user?.name,
        userId: target === "all" ? undefined : target,
        broadcast: target === "all",
        scheduled: scheduleEnabled,
        scheduledFor,
        status: scheduleEnabled ? "pending" : "sent",
        sentAt: scheduleEnabled ? scheduledFor : new Date().toLocaleString(),
        read: false,
      } as ApiNotification);
      setTitle("");
      setMessage("");
      setTarget("all");
      setType("info");
      setUserSearch("");
      setScheduleEnabled(false);
      setScheduleTime("");
      setToastMsg(scheduleEnabled ? "Notification scheduled in Firebase." : "Notification sent from Firebase.");
      refetch();
    } finally {
      setBusy(false);
    }
  }

  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === "super_admin" || admin?.role === "superadmin" || admin?.role === "owner";

  const loading = usersLoading || notifsLoading;

  return (
    <>
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 sticky top-0">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-400" />
              Send Notification
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Send To</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 dark:text-gray-400 pointer-events-none" />
                  <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users..."
                    className="w-full pl-8 pr-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-slate-900 dark:text-white text-xs placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                </div>
                <select value={target} onChange={e => setTarget(e.target.value as "all" | string)}
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-purple-500">
                  <option value="all">All Users ({users.length})</option>
                  {filteredUsers.map(user => (
                    <option key={user.id} value={user.id}>{user.name}{user.email ? ` - ${user.email}` : ""}</option>
                  ))}
                </select>
                {hasMoreUsers && (
                  <button
                    onClick={loadMoreUsers}
                    disabled={loadingMoreUsers}
                    className="mt-2 text-xs text-purple-400 hover:text-purple-300 disabled:opacity-60"
                  >
                    {loadingMoreUsers ? "Loading users..." : "Load more users"}
                  </button>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["info", "success", "warning", "alert"] as NoticeType[]).map(item => (
                    <button key={item} onClick={() => setType(item)}
                      className={`py-1.5 rounded-lg text-xs font-medium capitalize border transition-colors ${type === item ? TYPE_COLORS[item] : "bg-gray-800 border-gray-700 text-gray-400 hover:text-slate-900 dark:text-white"}`}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title..."
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500" />
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Message</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Write your message..."
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500" />
              </div>

              <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
                <label htmlFor="schedule-toggle" className="flex items-center gap-2 text-sm text-slate-700 dark:text-gray-300 cursor-pointer select-none">
                  <CalendarClock className="w-4 h-4 text-purple-400" />
                  Schedule for later
                </label>
                <button
                  id="schedule-toggle"
                  type="button"
                  role="switch"
                  aria-checked={scheduleEnabled}
                  onClick={() => { setScheduleEnabled(v => !v); setScheduleTime(scheduleEnabled ? "" : defaultScheduleTime()); }}
                  className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${scheduleEnabled ? "bg-purple-600" : "bg-gray-600"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${scheduleEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              {scheduleEnabled && (
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Deliver At</label>
                  <input type="datetime-local" value={scheduleTime} min={nowInputValue()} onChange={e => setScheduleTime(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-purple-500 [color-scheme:dark]" />
                </div>
              )}

              <button onClick={handleSend} disabled={busy || !title.trim() || !message.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-slate-600 dark:text-gray-400 text-white font-semibold transition-colors">
                <Send className="w-4 h-4" />
                {busy ? "Saving..." : scheduleEnabled ? "Schedule Notification" : "Send Notification"}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["all", "info", "success", "warning", "alert"] as const).map(item => (
              <button key={item} onClick={() => setFilterType(item)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filterType === item ? "bg-purple-600 text-white" : "bg-gray-800 text-slate-500 dark:text-gray-400"}`}>
                {item}
              </button>
            ))}
            {(["all", "broadcast", "individual"] as const).map(item => (
              <button key={item} onClick={() => setFilterTarget(item)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filterTarget === item ? "bg-gray-600 text-slate-900 dark:text-white" : "bg-gray-800 text-gray-400"}`}>
                {item}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-500 dark:text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading notifications...
            </div>
          )}

          {!loading && visibleNotifications.map(notif => (
            <div key={notif.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${TYPE_COLORS[(notif.type as NoticeType) || "info"] ?? TYPE_COLORS.info}`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{notif.title}</p>
                    {notif.scheduled && <span className="text-xs text-purple-400">scheduled</span>}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-gray-400 mb-3">{notif.message}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">{notif.broadcast || !notif.userId ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}{notif.targetName || "All Users"}</span>
                    <span>{notif.scheduledFor ? new Date(notif.scheduledFor).toLocaleString() : notif.sentAt}</span>
                    <span>{notif.status || "sent"}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {!loading && hasMore && (
            <div className="flex justify-center py-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-slate-900 dark:text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}

          {!loading && visibleNotifications.length === 0 && (
            <div className="text-center py-16 text-slate-600 dark:text-gray-400">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No notifications found.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminNotifications() {
  return (
    <AdminLayout title="Notifications & Messages">
      <NotificationsPanel />
    </AdminLayout>
  );
}
