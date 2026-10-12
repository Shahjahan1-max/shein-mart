import { useState } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, SectionCard, StatusBadge, statusToneFor, PermissionGate } from "../../components/super-admin/SuperAdminUi";
import { Bell, Plus, Send, CalendarClock } from "lucide-react";

const TEMPLATES = [
  { id: "nt-1", title: "Welcome Email", channel: "email", trigger: "On registration", status: "active", updated: "2026-07-20" },
  { id: "nt-2", title: "Withdrawal Approved", channel: "email + push", trigger: "On withdrawal approval", status: "active", updated: "2026-07-22" },
  { id: "nt-3", title: "Withdrawal Rejected", channel: "email + push", trigger: "On withdrawal rejection", status: "active", updated: "2026-07-22" },
  { id: "nt-4", title: "Task Session Started", channel: "push", trigger: "On new task session", status: "active", updated: "2026-07-25" },
  { id: "nt-5", title: "Maintenance Notice", channel: "email + push", trigger: "Manual broadcast", status: "draft", updated: "2026-07-30" },
];

export default function SuperAdminNotifications() {
  const [templates] = useState(TEMPLATES);

  return (
    <SuperAdminLayout title="Notification Center">
      <PageHeader
        title="Notification Center"
        description="Manage notification templates and broadcast messages to users."
        icon={<Bell className="w-5 h-5" />}
        actions={
          <PermissionGate permission="notifications.send">
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors">
              <Send className="w-4 h-4" /> Broadcast
            </button>
          </PermissionGate>
        }
      />

      <SectionCard
        title="Templates"
        description="Automated notification templates"
        icon={<Bell className="w-4 h-4" />}
        actions={
          <PermissionGate permission="notifications.view">
            <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold transition-colors">
              <Plus className="w-4 h-4" /> New Template
            </button>
          </PermissionGate>
        }
      >
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
              <span className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center flex-shrink-0">
                {t.channel.includes("email") ? <Send className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t.title}</p>
                <p className="text-xs text-slate-600 dark:text-gray-400 flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {t.trigger}</p>
              </div>
              <span className="hidden sm:block text-xs text-slate-500 dark:text-gray-400 flex-shrink-0">{t.channel}</span>
              <StatusBadge status={t.status} tone={statusToneFor(t.status)} />
            </div>
          ))}
        </div>
      </SectionCard>
    </SuperAdminLayout>
  );
}
