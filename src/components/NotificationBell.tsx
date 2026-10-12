import { Bell } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../hooks/useApi";

export function NotificationBell() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: notifications = [] } = useNotifications(user?.id);
  const unreadCount = notifications.filter(n => !n.read && !n.is_deleted).length;

  return (
    <button
      onClick={() => navigate("/dashboard/notifications")}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      className="relative p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-[9px] font-black px-0.5 leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        </span>
      )}
    </button>
  );
}
