import { useState, useEffect, ReactNode, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAdmin } from "../../contexts/AdminContext";
import {
  LayoutDashboard, Users, FileText, Bell, HeadphonesIcon,
  Settings, Menu, X, ChevronRight, ChevronDown, LogOut, ShieldCheck,
  CreditCard, ImagePlay, UsersRound, BarChart3,
  Smartphone, Monitor, Moon, Sun, Send, CheckCircle, ClipboardList, Zap, ShieldAlert, Globe, Layers, KeyRound, ListChecks,
} from "lucide-react";
import { useViewMode } from "../../contexts/ViewModeContext";
import { useTheme, ThemeChoice, ThemeToggle } from "../../components/ThemeToggle";
import { useAdminSidebarCounts, useSettings } from "../../hooks/useApi";

interface NavChild {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  href: string;
  label: string;
  icon: React.ElementType;
  children?: NavChild[];
}

function useSidebarBadges(): Record<string, number> {
  const { data: counts } = useAdminSidebarCounts();

  return {
    "/admin/transactions": counts?.pendingTransactions ?? 0,
    "/admin/records":      counts?.pendingOrders ?? 0,
    "/admin/support":      counts?.openTickets ?? 0,
    "/admin/notifications": 0,
    "/admin/extra-tasks":  0,
  };
}

const ROUTE_TO_PAGE_KEY: Record<string, string> = {
  "/admin": "dashboard",
  "/admin/users": "users",
  "/admin/teams": "teams",
  "/admin/platforms": "platforms",
  "/admin/packages": "packages",
  "/admin/transactions": "transactions",
  "/admin/extra-tasks": "extra-tasks",
  "/admin/audit-log": "audit-log",
  "/admin/orders": "orders",
  "/admin/records": "records",
  "/admin/analytics": "analytics",
  "/admin/notifications": "notifications",
  "/admin/support": "support",
  "/admin/settings": "settings",
  "/admin/ads": "ads",
  "/admin/landing-page": "landing-page",
  "/admin/backgrounds": "backgrounds",
  "/admin/leads": "leads",
  "/admin/password-reset": "password-reset",
  "/admin/assigned-tasks": "assigned-tasks",
};

function canAdminAccessRoute(adminObj: unknown, href: string): boolean {
  if (!adminObj || typeof adminObj !== "object") return false;
  const a = adminObj as { role?: string; assignedPages?: string[] };
  const role = String(a.role || "").toLowerCase();
  if (role === "super_admin" || role === "superadmin" || role === "owner") return true;
  if (!a.assignedPages || !Array.isArray(a.assignedPages) || a.assignedPages.length === 0) {
    return true; // Default open for unassigned legacy accounts
  }
  const pageKey = ROUTE_TO_PAGE_KEY[href] || href.replace("/admin/", "");
  return a.assignedPages.includes(pageKey) || a.assignedPages.includes("all");
}

const NAV_GROUPS: NavGroup[] = [
  { href: "/admin",              label: "Dashboard",    icon: LayoutDashboard },
  { href: "/admin/users",        label: "Users & Teams", icon: UsersRound },
  {
    href: "/admin/ads",
    label: "Menu",
    icon: ImagePlay,
    children: [
      { href: "/admin/extra-tasks", label: "Extra Tasks", icon: Zap },
      { href: "/admin/assigned-tasks", label: "User Task Management", icon: ListChecks },
    ],
  },
  { href: "/admin/transactions",  label: "Transactions",  icon: CreditCard },
  { href: "/admin/records",        label: "Records",       icon: FileText },
  { href: "/admin/notifications",  label: "Notifications", icon: Bell },
  { href: "/admin/support",        label: "Support",       icon: HeadphonesIcon },
  { href: "/admin/password-reset", label: "Password Reset", icon: KeyRound },
  { href: "/admin/settings",      label: "Settings",      icon: Settings },
];

function BadgePill({ count, active }: { count: number; active: boolean }) {
  if (!count) return null;
  return (
    <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none tabular-nums ${
      active ? "bg-white/25 text-white" : "bg-red-500 text-white"
    }`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function AdminLayout({ children, title }: { children: ReactNode; title: string }) {
  const { admin, logout } = useAdmin();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { viewMode, toggleViewMode } = useViewMode();
  const { theme, toggle: toggleTheme, setPanelType } = useTheme();
  const [published, setPublished] = useState(false);
  const badges = useSidebarBadges();
  const { data: platformSettings } = useSettings<{ maintenanceMode?: boolean; adminDefaultTheme?: string; userDefaultTheme?: string; siteFavicon?: string; companyLogo?: string }>();
  const maintenanceOn = Boolean(platformSettings?.maintenanceMode);

  useEffect(() => {
    if (!platformSettings) return;
    setPanelType(
      "admin",
      platformSettings.adminDefaultTheme as ThemeChoice,
      platformSettings.userDefaultTheme as ThemeChoice,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformSettings]);

  // Auto-update favicon when settings change
  useEffect(() => {
    if (platformSettings?.siteFavicon) {
      try {
        const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (link) link.href = `${platformSettings.siteFavicon}?v=${Date.now()}`;
      } catch {}
    }
  }, [platformSettings?.siteFavicon]);
  function groupBadge(group: NavGroup): number {
    const childSum = (group.children ?? []).reduce((sum, c) => sum + (badges[c.href] ?? 0), 0);
    return (badges[group.href] ?? 0) + childSum;
  }

  function isGroupActive(group: NavGroup): boolean {
    if (group.href === "/admin") {
      if (location === "/admin") return true;
    } else {
      if (location.startsWith(group.href)) return true;
    }
    return group.children?.some(c => location.startsWith(c.href)) ?? false;
  }

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    let saved: Record<string, boolean> | null = null;
    try {
      const raw = localStorage.getItem("ds_admin_sidebar_open");
      if (raw) saved = JSON.parse(raw);
    } catch {}
    const init: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) {
      if (g.children && g.children.length > 0) {
        init[g.href] = saved && g.href in saved ? saved[g.href] : isGroupActive(g);
      }
    }
    return init;
  });

  const handleMasterPublish = useCallback(() => {
    window.dispatchEvent(new Event("ds:data-changed"));
    setPublished(true);
    setTimeout(() => setPublished(false), 2500);
  }, []);

  function handleLogout() {
    logout();
    setLocation("/admin/login");
  }

  function isActive(href: string) {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  }

  function toggleGroup(href: string) {
    setOpenGroups(prev => {
      const next = { ...prev, [href]: !prev[href] };
      try { localStorage.setItem("ds_admin_sidebar_open", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-800">
        <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-slate-900 dark:text-white" />
        </div>
        <div>
          <p className="text-gray-900 dark:text-white font-bold text-sm leading-none">DealX Stocks</p>
          <p className="text-purple-600 dark:text-purple-400 text-xs mt-0.5">Admin Panel</p>
        </div>
      </div>

      {maintenanceOn && (
        <div className="mx-3 mt-3 flex items-center gap-2 bg-amber-900/30 border border-amber-700/50 rounded-xl px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
          <span className="text-amber-300 text-xs font-semibold">Maintenance ON</span>
          <Link href="/admin/settings" onClick={() => setSidebarOpen(false)} className="ml-auto text-amber-400 hover:text-amber-200 text-xs underline">
            Turn off
          </Link>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_GROUPS.filter(g => canAdminAccessRoute(admin, g.href)).map(group => {
          const Icon = group.icon;
          const hasChildren = group.children && group.children.length > 0;
          const groupActive = isGroupActive(group);
          const parentActive = isActive(group.href);
          const expanded = hasChildren ? (openGroups[group.href] ?? groupActive) : false;

          return (
            <div key={group.href}>
              <div className="flex items-center gap-0.5">
                <Link
                  href={group.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    parentActive
                      ? "bg-purple-600 text-white"
                      : groupActive
                      ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-slate-900 dark:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1">{group.label}</span>
                  {(!expanded && hasChildren)
                    ? <BadgePill count={groupBadge(group)} active={parentActive} />
                    : <BadgePill count={badges[group.href] ?? 0} active={parentActive} />
                  }
                  {parentActive && !hasChildren && <ChevronRight className="w-4 h-4 opacity-60" />}
                </Link>
                {hasChildren && (
                  <button
                    onClick={() => toggleGroup(group.href)}
                    className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                      groupActive
                        ? "text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                        : "text-slate-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                    aria-label={expanded ? "Collapse" : "Expand"}
                  >
                    {expanded
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {hasChildren && expanded && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 dark:border-gray-800 pl-3">
                  {group.children!.map(child => {
                    const ChildIcon = child.icon;
                    const childActive = isActive(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          childActive
                            ? "bg-purple-600 text-white"
                            : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-slate-900 dark:text-white"
                        }`}
                      >
                        <ChildIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">{child.label}</span>
                        <BadgePill count={badges[child.href] ?? 0} active={childActive} />
                        {childActive && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-purple-700 flex items-center justify-center text-white text-sm font-bold">
            {admin?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 dark:text-white text-sm font-medium truncate">{admin?.username}</p>
            <p className="text-purple-600 dark:text-purple-400 text-xs capitalize">{admin?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  const totalBadge = NAV_GROUPS.reduce((sum, g) => sum + groupBadge(g), 0);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white overflow-hidden">
      <aside className="hidden md:flex flex-col w-60 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-60 bg-white dark:bg-gray-900 h-full z-10">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-slate-900 dark:text-white">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 sm:gap-4 px-3.5 sm:px-6 py-3 sm:py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 shadow-sm dark:shadow-none">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden relative p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white touch-manipulation">
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            {totalBadge > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none tabular-nums">
                {totalBadge > 99 ? "99+" : totalBadge}
              </span>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <ThemeToggle />
            <button
              onClick={handleMasterPublish}
              title="Publish all changes to the platform"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ml-1 ${
                published
                  ? "bg-emerald-600 text-white"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              }`}
            >
              {published ? (
                <><CheckCircle className="w-3.5 h-3.5" /> Published!</>
              ) : (
                <><Send className="w-3.5 h-3.5" /><span className="hidden sm:inline">Publish</span></>
              )}
            </button>
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-full px-3 py-1 ml-1">
              <ShieldCheck className="w-3 h-3" />
              {admin?.role === "superadmin" ? "Super Admin" : "Admin"}
            </span>
            {admin?.role === "superadmin" && (
              <Link
                href="/super-admin"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-full px-3 py-1 ml-1 transition-colors"
                title="Open Super Admin Platform"
              >
                <ShieldCheck className="w-3 h-3" />
                Governance
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-950">
          <div className={viewMode === "mobile" ? "max-w-2xl mx-auto" : ""}>
            {canAdminAccessRoute(admin, location) ? (
              children
            ) : (
              <div className="min-h-[50vh] flex items-center justify-center">
                <div className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 max-w-md text-center shadow-lg space-y-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Page Access Restricted</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    You do not have permission to access this page. Page assignment is managed by Super Admin governance.
                  </p>
                  <Link href="/admin" className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-colors">
                    Return to Admin Dashboard
                  </Link>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
