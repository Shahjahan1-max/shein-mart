import { useState } from "react";
import { Bell, MessageSquare, CheckCircle2, AlertCircle, DollarSign, Info, Trash2, Check, X, CheckCheck } from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useLang } from "../../contexts/LangContext";
import { useAuth } from "../../contexts/AuthContext";
import { saveGenericFirebaseDoc, useNotificationsPage, type ApiNotification } from "../../hooks/useApi";

type NotifType = "message" | "system" | "payment" | "alert" | "info";
type Filter = "all" | "unread" | "payments";

interface Notif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  readAt?: string;
  from?: string;
  source: ApiNotification;
}

const TYPE_CONFIG: Record<NotifType, { icon: typeof Bell; color: string; bg: string; label: string }> = {
  message: { icon: MessageSquare, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", label: "Message" },
  system: { icon: Info, color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-700", label: "System" },
  payment: { icon: DollarSign, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20", label: "Payment" },
  alert: { icon: AlertCircle, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/20", label: "Alert" },
  info: { icon: CheckCircle2, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20", label: "Info" },
};

function normalizeType(value?: string): NotifType {
  return value === "message" || value === "system" || value === "payment" || value === "alert" ? value : "info";
}

function toNotif(n: ApiNotification): Notif {
  const timestamp = n.sentAt || n.createdAt || n.updatedAt || "";
  return {
    id: n.id,
    type: normalizeType(n.type),
    title: n.title,
    body: n.message,
    time: timestamp ? new Date(timestamp).toLocaleString() : "",
    read: n.read ?? false,
    readAt: (n as { readAt?: string }).readAt,
    from: n.targetName,
    source: n,
  };
}

function NotifDetailModal({ notif, onClose }: { notif: Notif; onClose: () => void }) {
  const cfg = TYPE_CONFIG[notif.type];
  const Icon = cfg.icon;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 overflow-hidden">
        <div className={`px-5 py-5 flex items-start gap-4 ${cfg.bg}`}>
          <Icon className={`w-6 h-6 ${cfg.color} flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</p>
            <h2 className="text-base font-bold text-gray-900 dark:text-white mt-1 leading-snug">{notif.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{notif.body}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{notif.time}</p>
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-colors active:scale-95">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function Notifications() {
  const { t } = useLang();
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Notif | null>(null);
  const { data: apiNotifications = [], refetch, hasMore, loadMore, loadingMore } = useNotificationsPage(20, {
    userId: user?.id,
  });

  const items = apiNotifications
    .filter(n => !n.is_deleted)
    .map(toNotif)
    .sort((a, b) => (Date.parse(b.source.createdAt || b.source.updatedAt || "") || 0) - (Date.parse(a.source.createdAt || a.source.updatedAt || "") || 0));

  async function saveNotif(id: string, patch: Partial<ApiNotification>) {
    const existing = apiNotifications.find(n => n.id === id);
    if (!existing) return;
    // Save to userNotifications (fan-out collection) — id is already the per-user notif id
    await saveGenericFirebaseDoc("userNotifications", id, { ...existing, ...patch });
    refetch();
  }

  async function markRead(id: string) {
    await saveNotif(id, { read: true, readAt: new Date().toISOString() } as Partial<ApiNotification>);
  }

  async function markAllRead() {
    await Promise.all(items.filter(n => !n.read).map(n => saveNotif(n.id, { read: true, readAt: new Date().toISOString() } as Partial<ApiNotification>)));
    refetch();
  }

  async function remove(id: string) {
    await saveNotif(id, { is_deleted: true });
    if (selected?.id === id) setSelected(null);
  }

  function handleClickNotif(notif: Notif) {
    if (!notif.read) void markRead(notif.id);
    setSelected(notif);
  }

  const unreadCount = items.filter(n => !n.read).length;
  const displayed = items.filter(n => filter === "unread" ? !n.read : filter === "payments" ? n.type === "payment" : true);
  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("filterAll") || "All", count: items.length },
    { key: "unread", label: t("filterUnread") || "Unread", count: unreadCount },
    { key: "payments", label: t("filterPayments") || "Payments", count: items.filter(n => n.type === "payment").length },
  ];

  return (
    <DashboardLayout showBack title={t("notifications") || "Notifications"} backTo="/dashboard">
      {selected && <NotifDetailModal notif={selected} onClose={() => setSelected(null)} />}
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-gray-50 dark:border-gray-800">
            <div className="flex gap-1.5 flex-wrap">
              {filters.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === f.key ? "bg-purple-600 text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}>
                  {f.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === f.key ? "bg-white/20 text-slate-900 dark:text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}>{f.count}</span>
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="sm:ml-auto flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors">
                <CheckCheck className="h-3.5 w-3.5" />
                {t("markAllRead") || "Mark all read"}
              </button>
            )}
          </div>

          {displayed.length === 0 ? (
            <div className="py-20 text-center">
              <Bell className="h-12 w-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-400 dark:text-gray-500">{t("noNotifications") || "No notifications"}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {displayed.map(notif => {
                const cfg = TYPE_CONFIG[notif.type];
                const Icon = cfg.icon;
                return (
                  <div key={notif.id} onClick={() => handleClickNotif(notif)}
                    className={`flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!notif.read ? "bg-purple-50/40 dark:bg-purple-900/10" : ""}`}>
                    <div className={`p-2.5 rounded-xl flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-semibold truncate ${notif.read ? "text-gray-700 dark:text-gray-300" : "text-gray-900 dark:text-white"}`}>{notif.title}</p>
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          {!notif.read && (
                            <button onClick={() => markRead(notif.id)} title="Mark as read" className="p-1 rounded-lg text-gray-300 hover:text-purple-500 dark:text-gray-600 dark:hover:text-purple-400 transition-colors">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => remove(notif.id)} title="Delete" className="p-1 rounded-lg text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">{notif.body}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">{notif.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {hasMore && (
            <div className="flex justify-center py-4 border-t border-gray-50 dark:border-gray-800">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-300 text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
