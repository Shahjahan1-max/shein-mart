import { useLocation } from "wouter";
import { Home, HeadphonesIcon, LayoutGrid, FileText, User, LogOut, Wallet } from "lucide-react";
import { useLang } from "../contexts/LangContext";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../hooks/useApi";
import { DEFAULT_SETTINGS } from "../data/adminData";

export function DesktopSidebar() {
  const [location, navigate] = useLocation();
  const { t } = useLang();
  const { user, logout } = useAuth();
  const { data: apiSettings } = useSettings<typeof DEFAULT_SETTINGS>();
  const settings = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;
  const siteName = settings.siteName || "DealX Stocks";
  const companyLogo = settings.companyLogo;

  const NAV_ITEMS = [
    { label: t("home"),    icon: Home,           path: "/dashboard" },
    { label: t("support"), icon: HeadphonesIcon, path: "/dashboard/support" },
    { label: t("menu"),    icon: LayoutGrid,     path: "/dashboard/menu" },
    { label: t("records"), icon: FileText,       path: "/dashboard/records" },
    { label: t("mine"),    icon: User,           path: "/dashboard/mine" },
  ];

  const initials = (user?.name ?? "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  const [brandFirst, ...brandRest] = siteName.split(" ");

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-sidebar dark:bg-sidebar border-r border-sidebar-border h-screen sticky top-0 flex-shrink-0 z-30 select-none shadow-sm">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border">
        {companyLogo ? (
          <img src={companyLogo} alt={siteName} className="h-8 w-auto max-w-32 object-contain rounded" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shadow-md">
              DX
            </div>
            <span className="block text-base font-extrabold text-foreground tracking-tight truncate">
              {brandFirst}<span className="text-primary">{brandRest.length > 0 ? ` ${brandRest.join(" ")}` : ""}</span>
            </span>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Main Navigation
        </div>

        {NAV_ITEMS.map(item => {
          const active = item.path === "/dashboard"
            ? location === "/dashboard"
            : location.startsWith(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-primary-foreground" : "text-muted-foreground"}`} />
              <span className="truncate">{item.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground shadow-sm" />}
            </button>
          );
        })}
      </div>

      {/* Footer User Profile Card */}
      <div className="p-3 border-t border-sidebar-border bg-muted/30">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-card border border-card-border shadow-sm">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0 overflow-hidden">
            {user?.profileImage ? (
              <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
            ) : initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground truncate">{user?.name || "User Account"}</p>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium truncate">
              <Wallet className="w-3 h-3 text-accent flex-shrink-0" />
              <span>${Number(user?.balance || 0).toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={() => logout()}
            title="Sign Out"
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
