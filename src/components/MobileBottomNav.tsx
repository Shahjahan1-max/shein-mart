import { useLocation } from "wouter";
import { Home, HeadphonesIcon, LayoutGrid, FileText, User } from "lucide-react";
import { useLang } from "../contexts/LangContext";

export function MobileBottomNav() {
  const [location, navigate] = useLocation();
  const { t } = useLang();

  const NAV_ITEMS = [
    { label: t("home"),    icon: Home,           path: "/dashboard" },
    { label: t("support"), icon: HeadphonesIcon, path: "/dashboard/support" },
    { label: t("menu"),    icon: LayoutGrid,     path: "/dashboard/menu" },
    { label: t("records"), icon: FileText,       path: "/dashboard/records" },
    { label: t("mine"),    icon: User,           path: "/dashboard/mine" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar dark:bg-sidebar border-t border-sidebar-border flex items-start justify-around h-[calc(4rem+env(safe-area-inset-bottom))] px-1.5 sm:px-2 pt-1.5 pb-[env(safe-area-inset-bottom)] shadow-lg">
      {NAV_ITEMS.map(item => {
        const active = item.path === "/dashboard"
          ? location === "/dashboard"
          : location.startsWith(item.path);
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 flex-1 py-1 active:scale-95 transition-transform touch-manipulation"
          >
            <Icon
              className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`}
              strokeWidth={active ? 2.5 : 1.8}
            />
            <span className={`max-w-full truncate px-0.5 text-[10px] sm:text-[11px] font-medium leading-tight ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
