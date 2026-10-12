import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAdmin } from "../../contexts/AdminContext";
import { useSuperAdmin } from "../../hooks/super-admin/useSuperAdmin";
import { ROLE_DEFINITIONS } from "../../data/superAdminData";
import type { Permission } from "../../types/super-admin";
import { ThemeToggle } from "../../components/ThemeToggle";
import {
  LayoutDashboard, Users, ShieldCheck, ShieldAlert, Wallet, Globe, Search, Flag,
  FileText, Activity, BarChart3, Megaphone, Bot, Settings, LogOut, Menu, X,
  ChevronRight, Lock, Building2, HeadphonesIcon, MapPin, Layers,
} from "lucide-react";

/* ─── Navigation configuration ──────────────────────────────────── */

interface NavChild {
  href: string;
  label: string;
  permission?: Permission;
}

interface NavGroup {
  href: string;
  label: string;
  icon: ReactNode;
  permission?: Permission;
  children?: NavChild[];
  divider?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  { href: "/super-admin", label: "Overview", icon: <LayoutDashboard className="w-5 h-5" /> },
  { href: "/super-admin/health", label: "System Health", icon: <Activity className="w-5 h-5" /> },

  { href: "/super-admin/users", label: "Users & Roles", icon: <Users className="w-5 h-5" />, permission: "users.view" },
  { href: "/super-admin/user-intelligence", label: "User Intelligence & Fraud", icon: <ShieldAlert className="w-5 h-5" />, permission: "users.view" },
  { href: "/super-admin/admins", label: "Admin Management", icon: <ShieldCheck className="w-5 h-5" />, permission: "admins.view" },

  { href: "/super-admin/support-chat", label: "Support Workspace", icon: <HeadphonesIcon className="w-5 h-5" /> },

  { href: "/super-admin/landing-page", label: "Landing Page", icon: <Globe className="w-5 h-5" /> },
  { href: "/super-admin/leads", label: "Leads Management", icon: <Users className="w-5 h-5" /> },
  { href: "/super-admin/visitor-locations", label: "Device Location Tracker", icon: <MapPin className="w-5 h-5" /> },

  { href: "/super-admin/wallet", label: "Wallet Governance", icon: <Wallet className="w-5 h-5" />, permission: "wallet.view" },
  { href: "/super-admin/marketplaces", label: "Marketplaces", icon: <Globe className="w-5 h-5" />, permission: "marketplaces.view" },
  { href: "/super-admin/seo-services", label: "SEO Services", icon: <Search className="w-5 h-5" />, permission: "seo_services.view" },

  { href: "/super-admin/feature-flags", label: "Feature Flags", icon: <Flag className="w-5 h-5" />, permission: "feature_flags.view", divider: true },

  { href: "/super-admin/audit", label: "Audit Logs", icon: <FileText className="w-5 h-5" />, permission: "audit.view" },
  { href: "/super-admin/security", label: "Security Center", icon: <Lock className="w-5 h-5" />, permission: "security.view" },
  { href: "/super-admin/analytics", label: "Analytics", icon: <BarChart3 className="w-5 h-5" />, permission: "analytics.view" },

  {
    href: "/super-admin/cms",
    label: "Content & Notifications",
    icon: <Megaphone className="w-5 h-5" />,
    children: [
      { href: "/super-admin/cms", label: "CMS & Pages", permission: "cms.view" },
      { href: "/super-admin/notifications", label: "Notification Center", permission: "notifications.view" },
    ],
  },

  { href: "/super-admin/ai-governance", label: "AI Governance", icon: <Bot className="w-5 h-5" />, permission: "ai_governance.view" },
  { href: "/super-admin/settings", label: "Platform Settings", icon: <Settings className="w-5 h-5" />, permission: "settings.view" },
];

/* ─── Helpers ───────────────────────────────────────────────────── */

function isPermitted(group: NavGroup, can: (p: Permission) => boolean): boolean {
  if (group.permission && !can(group.permission)) {
    const anyChildAllowed = (group.children ?? []).some(c => !c.permission || can(c.permission));
    if (!anyChildAllowed) return false;
  }
  return true;
}

export default function SuperAdminLayout({ children, title }: { children: ReactNode; title: string }) {
  const { admin, logout } = useAdmin();
  const { role, roleDefinition, can } = useSuperAdmin();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => { setSidebarOpen(false); }, [location]);

  function handleLogout() {
    logout();
    setLocation("/super-admin/login");
  }

  function isActive(href: string): boolean {
    if (href === "/super-admin") return location === "/super-admin";
    return location.startsWith(href);
  }

  function isGroupActive(group: NavGroup): boolean {
    if (isActive(group.href)) return true;
    return (group.children ?? []).some(c => location.startsWith(c.href));
  }

  const visibleGroups = NAV_GROUPS.filter(g => isPermitted(g, can));
  const roleName = roleDefinition?.name ?? "Support Manager";
  const roleColor = roleDefinition?.color ?? "slate";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-800">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-slate-900 dark:text-white" />
        </div>
        <div>
          <p className="text-gray-900 dark:text-white font-bold text-sm leading-none">DealXStocks</p>
          <p className="text-purple-600 dark:text-purple-400 text-xs mt-0.5 flex items-center gap-1">
            <Building2 className="w-3 h-3" /> Super Admin
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleGroups.map((group, idx) => {
          const Icon = group.icon;
          const groupActive = isGroupActive(group);
          const parentActive = isActive(group.href);
          const hasChildren = group.children && group.children.length > 0;
          const filteredChildren = (group.children ?? []).filter(c => !c.permission || can(c.permission));

          return (
            <div key={group.href}>
              {group.divider && idx > 0 && <div className="my-2 border-t border-gray-100 dark:border-gray-800" />}
              <Link
                href={group.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  parentActive
                    ? "bg-purple-600 text-white"
                    : groupActive
                    ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-slate-900 dark:text-white"
                }`}
              >
                <span className="flex-shrink-0">{Icon}</span>
                <span className="flex-1">{group.label}</span>
                {parentActive && !hasChildren && <ChevronRight className="w-4 h-4 opacity-60" />}
              </Link>

              {hasChildren && groupActive && filteredChildren.length > 0 && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 dark:border-gray-800 pl-3">
                  {filteredChildren.map(child => {
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
                        <span className="flex-1">{child.label}</span>
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
          <div className="w-9 h-9 rounded-full bg-purple-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {admin?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 dark:text-white text-sm font-medium truncate">{admin?.username}</p>
            <p className={`text-xs capitalize ${roleColor === "purple" ? "text-purple-500" : "text-gray-500 dark:text-gray-400"}`}>{roleName}</p>
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

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white overflow-hidden">
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-white dark:bg-gray-900 h-full z-10">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-slate-900 dark:text-white">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 sm:gap-4 px-3.5 sm:px-6 py-3 sm:py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 shadow-sm dark:shadow-none">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white touch-manipulation">
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <ThemeToggle />
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-full px-3 py-1 ml-1">
              <ShieldCheck className="w-3 h-3" />
              {role === "super_admin" ? "Super Admin" : roleName}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-4 md:p-6 bg-gray-50 dark:bg-gray-950">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
