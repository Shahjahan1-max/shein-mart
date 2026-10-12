import { ReactNode, useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Monitor, Smartphone, Sun, Moon, ChevronDown, Check } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import { useViewMode } from "../../hooks/useViewMode";
import { useTheme } from "../../hooks/useTheme";
import { useSettings, useNewNotificationToast } from "../../hooks/useApi";
import { DEFAULT_SETTINGS } from "../../data/adminData";
import { MobileBottomNav } from "../../components/MobileBottomNav";
import { DesktopSidebar } from "../../components/DesktopSidebar";
import { NotificationBell } from "../../components/NotificationBell";
import { Toaster } from "../../components/ui/toaster";
import { ImpersonationBanner } from "../../components/ImpersonationBanner";
import { LANGUAGES, type LangCode } from "../../contexts/LangContext";
import { LanguageFlag } from "../../components/LanguageFlag";
import { ThemeToggle } from "../../components/ThemeToggle";

function LangDropdown() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Change language"
      >
        <LanguageFlag code={current.code} className="w-4 h-4 rounded-sm object-cover" />
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden py-1">
          {LANGUAGES.map(item => (
            <button
              key={item.code}
              onClick={() => {
                setLang(item.code);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors ${
                lang === item.code
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-foreground hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <LanguageFlag code={item.code} className="w-4 h-4 rounded-sm object-cover" />
                <span>{item.native}</span>
              </div>
              {lang === item.code && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}



function ViewModeBtn() {
  const { viewMode, toggleViewMode } = useViewMode();
  return (
    <button
      onClick={toggleViewMode}
      aria-label={viewMode === "mobile" ? "Switch to desktop view" : "Switch to mobile view"}
      title={viewMode === "mobile" ? "Desktop view" : "Mobile view"}
      className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      {viewMode === "mobile" ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
    </button>
  );
}

/* ─── main layout ─────────────────────────────────────────────── */
export interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
  showBack?: boolean;
  backTo?: string;
  fullHeight?: boolean;
}

/* Pages that are top-level nav destinations (no auto back button) */
const TOP_LEVEL_PATHS = ["/dashboard", "/dashboard/menu", "/dashboard/records", "/dashboard/mine", "/dashboard/support"];

export function DashboardLayout({ children, title, actions, showBack, backTo, fullHeight = false }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { viewMode } = useViewMode();
  const { setPanelType } = useTheme();
  const { data: apiSettings } = useSettings<typeof DEFAULT_SETTINGS>();
  const settings = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;
  const site = { siteName: settings.siteName || "DealX Stocks", companyLogo: settings.companyLogo || "" };
  const mainRef = useRef<HTMLElement>(null);

  const [panelTheme, setPanelTheme] = useState(settings.panelTheme ?? "default");

  useEffect(() => {
    const adminDef = settings.adminDefaultTheme === "dark" || settings.adminDefaultTheme === "light" ? settings.adminDefaultTheme : undefined;
    const userDef = settings.userDefaultTheme === "dark" || settings.userDefaultTheme === "light" ? settings.userDefaultTheme : undefined;
    setPanelType("user", adminDef, userDef);
  }, [setPanelType, settings.adminDefaultTheme, settings.userDefaultTheme]);

  useEffect(() => {
    setPanelTheme(settings.panelTheme ?? "default");
  }, [settings.panelTheme]);

  // Auto-update browser favicon when published settings change
  useEffect(() => {
    if (settings.siteFavicon) {
      try {
        const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (link && link.href !== settings.siteFavicon) {
          link.href = `${settings.siteFavicon}?v=${Date.now()}`;
        }
      } catch {}
    }
  }, [settings.siteFavicon]);

  /* Scroll content area to top whenever the route changes */
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [location]);

  // Auto-show back button on sub-screens unless explicitly disabled
  const isTopLevel = TOP_LEVEL_PATHS.includes(location);
  const shouldShowBack = showBack ?? !isTopLevel;

  const { isImpersonating } = useAuth();

  const bannerVisible = settings.showImpersonationBanner === true;

  const showBannerOffset = isImpersonating && bannerVisible;
  const initials = (user?.name ?? "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  useNewNotificationToast(user?.id ?? null);

  function handleBack() {
    if (backTo) navigate(backTo);
    else window.history.back();
  }

  const brandName = site.siteName || "DealX Stocks";
  const [brandFirst, ...brandRest] = brandName.split(" ");

  const isDesktopMode = viewMode === "desktop";

  return (
    <div
      className="flex [height:100dvh] overflow-hidden bg-gray-50 dark:bg-gray-950"
      {...(panelTheme && panelTheme !== "default" ? { "data-ds-theme": panelTheme } : {})}
    >
      {/* Desktop Professional Sidebar (Shown on Desktop mode or lg screens) */}
      <DesktopSidebar />

      {/* Main Content Area Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <header className={`flex items-center gap-1 px-2 sm:gap-1.5 sm:px-3 h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 sticky z-40 ${showBannerOffset ? "top-[42px]" : "top-0"}`}>
          {/* Left: back button or logo */}
          {shouldShowBack ? (
            <button
              onClick={handleBack}
              className="p-1.5 sm:p-2 -ml-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0 touch-manipulation"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="lg:hidden flex items-center">
              {site.companyLogo ? (
                <img src={site.companyLogo} alt={brandName} className="h-7 w-auto max-w-28 object-contain rounded flex-shrink-0" />
              ) : (
                <span className="font-bold text-gray-900 dark:text-white text-sm">DX</span>
              )}
            </div>
          )}

          {/* Center: title or brand */}
          <div className="flex-1 min-w-0 px-1">
            {title ? (
              <h1 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">{title}</h1>
            ) : (
              <span className="block text-sm sm:text-base font-extrabold text-gray-900 dark:text-white tracking-tight truncate lg:hidden">
                {brandFirst}<span className="text-purple-600">{brandRest.length > 0 ? ` ${brandRest.join(" ")}` : ""}</span>
              </span>
            )}
          </div>

          {/* Right: actions + lang + notifications + theme + profile */}
          {actions && <div className="flex items-center gap-1 min-w-0 flex-shrink-0">{actions}</div>}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            <LangDropdown />
            <ThemeToggle />
            <NotificationBell />
            <button
              onClick={() => navigate("/dashboard/mine")}
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold ml-0.5 sm:ml-1 flex-shrink-0 overflow-hidden shadow-sm touch-manipulation active:scale-95 transition-transform"
              aria-label="Open profile"
            >
              {user?.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : initials}
            </button>
          </div>
        </header>

        {/* Scrollable or full-height content wrapper */}
        <main
          ref={mainRef}
          className={`flex-1 relative min-h-0 ${
            fullHeight
              ? "overflow-hidden flex flex-col"
              : "overflow-y-auto overscroll-contain pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8"
          } w-full`}
        >
          {children}
        </main>

        {/* Mobile Bottom Navigation (Hidden on Desktop screens) */}
        <div className="lg:hidden">
          <MobileBottomNav />
        </div>
      </div>

      <Toaster />
    </div>
  );
}
