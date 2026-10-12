import { lazy, Suspense, useState, useEffect, useRef, type ComponentType } from "react";
import { Router, Route, Switch, Redirect, useLocation } from "wouter";
import { LoaderProvider, useLoader } from "./contexts/LoaderContext";
import { Atom } from "./components/Atom";
import { Header } from "./components/Header";
import { ThemeProvider, useTheme } from "./components/ThemeToggle";
import { ViewModeProvider, useViewMode } from "./contexts/ViewModeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TaskSessionProvider } from "./contexts/TaskSessionContext";
import { LangProvider } from "./contexts/LangContext";
import { AdminProvider, useAdmin } from "./contexts/AdminContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useSuspensionGuard } from "./hooks/useSuspensionGuard";
import { useMaintenanceMode } from "./hooks/useMaintenanceMode";
import { useFavicon } from "./hooks/useFavicon";
import { DashboardLayout } from "./pages/dashboard/DashboardLayout";
import { SUSPENSION_APPEAL_SUBJECT } from "./data/adminData";
import { createTicket } from "./hooks/useApi";
import { RouteMeta } from "./components/seo/RouteMeta";
import { UnifiedConsentBanner } from "./components/UnifiedConsentBanner";
import { initTelemetryCollector } from "./lib/telemetryCollector";
import { CookieLocationModal } from "./components/CookieLocationModal";
import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { FirebaseSuspensionBanner } from "./components/FirebaseSuspensionBanner";
import { trackPageView } from "./lib/analytics";

const CHUNK_RELOAD_KEY = "ds_chunk_reload_attempted";

function isDynamicImportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("ChunkLoadError")
  );
}

function wait(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function lazyWithRetry<T extends { default: ComponentType<any> }>(loader: () => Promise<T>) {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const mod = await loader();
        try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch {}
        return mod;
      } catch (error) {
        lastError = error;
        if (!isDynamicImportError(error)) throw error;
        if (attempt < 2) await wait(350 * (attempt + 1));
      }
    }

    if (isDynamicImportError(lastError) && navigator.onLine !== false) {
      try {
        if (sessionStorage.getItem(CHUNK_RELOAD_KEY) !== "1") {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
          window.location.reload();
          return new Promise<T>(() => {});
        }
      } catch {}
    }

    throw lastError;
  });
}

/* ─── Lazy-loaded pages ───────────────────────────────────────────
   Named-export pages: wrap with .then(m => ({ default: m.X }))
   Default-export pages: lazyWithRetry(() => import(...)) directly           */

const Home            = lazyWithRetry(() => import("./pages/Home").then(m => ({ default: m.Home })));
const Login           = lazyWithRetry(() => import("./pages/auth/Login").then(m => ({ default: m.Login })));
const Register        = lazyWithRetry(() => import("./pages/auth/Register").then(m => ({ default: m.Register })));
const ForgotPassword  = lazyWithRetry(() => import("./pages/auth/ForgotPassword").then(m => ({ default: m.ForgotPassword })));
const ResetPassword   = lazyWithRetry(() => import("./pages/auth/ResetPassword").then(m => ({ default: m.ResetPassword })));

const ServicesOverview   = lazyWithRetry(() => import("./pages/services/ServicesOverview").then(m => ({ default: m.ServicesOverview })));
const InternationalSEO   = lazyWithRetry(() => import("./pages/services/InternationalSEO").then(m => ({ default: m.InternationalSEO })));
const AmazonSEO          = lazyWithRetry(() => import("./pages/services/marketplace-seo/AmazonSEO"));
const AlibabaSEO         = lazyWithRetry(() => import("./pages/services/marketplace-seo/AlibabaSEO"));
const AliExpressSEO      = lazyWithRetry(() => import("./pages/services/marketplace-seo/AliExpressSEO"));
const EbaySEO            = lazyWithRetry(() => import("./pages/services/marketplace-seo/EbaySEO"));
const MarketplacesOverview = lazyWithRetry(() => import("./pages/marketplaces/MarketplacesOverview"));
const IndustriesOverview = lazyWithRetry(() => import("./pages/industries/IndustriesOverview"));
const KnowledgeHubOverview = lazyWithRetry(() => import("./pages/knowledge-hub/KnowledgeHubOverview"));
const ResourcesOverview  = lazyWithRetry(() => import("./pages/resources/ResourcesOverview"));
const AboutUs            = lazyWithRetry(() => import("./pages/about/AboutUs"));
const ContactQuote       = lazyWithRetry(() => import("./pages/contact/ContactQuote"));
const CategoryPage       = lazyWithRetry(() => import("./pages/categories/CategoryPage").then(m => ({ default: m.CategoryPage })));
const CategoriesOverview = lazyWithRetry(() => import("./pages/categories/CategoriesOverview").then(m => ({ default: m.CategoriesOverview })));
const ProductDetail      = lazyWithRetry(() => import("./pages/products/ProductDetail").then(m => ({ default: m.ProductDetail })));
const DealsPage          = lazyWithRetry(() => import("./pages/deals/DealsPage").then(m => ({ default: m.DealsPage })));
const FaqPage            = lazyWithRetry(() => import("./pages/guides/FaqPage").then(m => ({ default: m.FaqPage })));
const GlossaryOverview   = lazyWithRetry(() => import("./pages/glossary/GlossaryOverview").then(m => ({ default: m.GlossaryOverview })));
const GuidesOverview     = lazyWithRetry(() => import("./pages/guides/GuidesOverview").then(m => ({ default: m.GuidesOverview })));
const GuideDetail        = lazyWithRetry(() => import("./pages/guides/GuideDetail").then(m => ({ default: m.GuideDetail })));
const CaseStudiesOverview = lazyWithRetry(() => import("./pages/case-studies/CaseStudiesOverview").then(m => ({ default: m.CaseStudiesOverview })));
const CaseStudyDetail     = lazyWithRetry(() => import("./pages/case-studies/CaseStudyDetail").then(m => ({ default: m.CaseStudyDetail })));
const RoiCalculatorPage   = lazyWithRetry(() => import("./pages/tools/RoiCalculatorPage").then(m => ({ default: m.RoiCalculatorPage })));

// Core Company & Trust Pages
const HowItWorks            = lazyWithRetry(() => import("./pages/about/HowItWorks"));
const Methodology           = lazyWithRetry(() => import("./pages/about/Methodology"));
const EditorialPolicy       = lazyWithRetry(() => import("./pages/about/EditorialPolicy"));
const DataSources           = lazyWithRetry(() => import("./pages/about/DataSources"));
const Trust                 = lazyWithRetry(() => import("./pages/about/Trust"));
const Transparency          = lazyWithRetry(() => import("./pages/about/Transparency"));
const Press                 = lazyWithRetry(() => import("./pages/about/Press"));
const Careers               = lazyWithRetry(() => import("./pages/about/Careers"));

// Marketplace Detail
const MarketplaceDetail     = lazyWithRetry(() => import("./pages/marketplaces/MarketplaceDetail"));

// Support & Issues
const SupportCenterPage     = lazyWithRetry(() => import("./pages/support/SupportCenterPage"));
const ReportIssuePage       = lazyWithRetry(() => import("./pages/support/ReportIssuePage"));
const FeedbackPage          = lazyWithRetry(() => import("./pages/support/FeedbackPage"));

// Products Catalog
const AllProductsPage       = lazyWithRetry(() => import("./pages/products/AllProductsPage"));

// Legal Pages
const PrivacyPolicy         = lazyWithRetry(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfService        = lazyWithRetry(() => import("./pages/legal/TermsOfService"));
const CookiePolicy          = lazyWithRetry(() => import("./pages/legal/CookiePolicy"));
const Disclaimer            = lazyWithRetry(() => import("./pages/legal/Disclaimer"));
const AffiliateDisclosure   = lazyWithRetry(() => import("./pages/legal/AffiliateDisclosure"));
const MarketplaceDisclosure = lazyWithRetry(() => import("./pages/legal/MarketplaceDisclosure"));
const DataAccuracy          = lazyWithRetry(() => import("./pages/legal/DataAccuracy"));

const DashboardHome   = lazyWithRetry(() => import("./pages/dashboard/DashboardHome").then(m => ({ default: m.DashboardHome })));
const Wallet          = lazyWithRetry(() => import("./pages/dashboard/Wallet").then(m => ({ default: m.Wallet })));
const DepositWithdrawal = lazyWithRetry(() => import("./pages/dashboard/DepositWithdrawal").then(m => ({ default: m.DepositWithdrawal })));
const Deposit         = lazyWithRetry(() => import("./pages/dashboard/Deposit").then(m => ({ default: m.Deposit })));
const Withdraw        = lazyWithRetry(() => import("./pages/dashboard/Withdraw").then(m => ({ default: m.Withdraw })));
const Team            = lazyWithRetry(() => import("./pages/dashboard/Team").then(m => ({ default: m.Team })));
const Profile         = lazyWithRetry(() => import("./pages/dashboard/Profile").then(m => ({ default: m.Profile })));
const Records         = lazyWithRetry(() => import("./pages/dashboard/Records").then(m => ({ default: m.Records })));
const Notifications   = lazyWithRetry(() => import("./pages/dashboard/Notifications").then(m => ({ default: m.Notifications })));
const Support         = lazyWithRetry(() => import("./pages/dashboard/Support").then(m => ({ default: m.Support })));
const Settings        = lazyWithRetry(() => import("./pages/dashboard/Settings").then(m => ({ default: m.Settings })));
const Menu            = lazyWithRetry(() => import("./pages/dashboard/Menu").then(m => ({ default: m.Menu })));
const PlatformTask    = lazyWithRetry(() => import("./pages/dashboard/PlatformTask").then(m => ({ default: m.PlatformTask })));
const PackageTask     = lazyWithRetry(() => import("./pages/dashboard/PackageTask").then(m => ({ default: m.PackageTask })));
const Mine            = lazyWithRetry(() => import("./pages/dashboard/Mine").then(m => ({ default: m.Mine })));
const Analytics       = lazyWithRetry(() => import("./pages/dashboard/Analytics").then(m => ({ default: m.Analytics })));
const Invite          = lazyWithRetry(() => import("./pages/dashboard/Invite").then(m => ({ default: m.Invite })));
const AdCodeTask      = lazyWithRetry(() => import("./pages/dashboard/AdCodeTask").then(m => ({ default: m.AdCodeTask })));
const ExtraTask       = lazyWithRetry(() => import("./pages/dashboard/ExtraTask").then(m => ({ default: m.ExtraTask })));

const AdminLogin        = lazyWithRetry(() => import("./pages/admin/AdminLogin").then(m => ({ default: m.AdminLogin })));
const AdminDashboard    = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const AdminUsers        = lazyWithRetry(() => import("./pages/admin/AdminUsers"));
const AdminTeams        = lazyWithRetry(() => import("./pages/admin/AdminTeams"));
const AdminPlatforms    = lazyWithRetry(() => import("./pages/admin/AdminPlatforms"));
const AdminPackages     = lazyWithRetry(() => import("./pages/admin/AdminPackages"));
const AdminTransactions = lazyWithRetry(() => import("./pages/admin/AdminTransactions"));
const AdminExtraTasks   = lazyWithRetry(() => import("./pages/admin/AdminExtraTasks"));
const AdminAuditLog     = lazyWithRetry(() => import("./pages/admin/AdminAuditLog"));
const AdminOrders       = lazyWithRetry(() => import("./pages/admin/AdminOrders"));
const AdminRecords      = lazyWithRetry(() => import("./pages/admin/AdminRecords"));
const AdminAnalytics    = lazyWithRetry(() => import("./pages/admin/AdminAnalytics"));
const AdminNotifications = lazyWithRetry(() => import("./pages/admin/AdminNotifications"));
const AdminSupport      = lazyWithRetry(() => import("./pages/admin/AdminSupport"));
const AdminSettings     = lazyWithRetry(() => import("./pages/admin/AdminSettings"));
const AdminAds          = lazyWithRetry(() => import("./pages/admin/AdminAds"));
const AdminPasswordReset  = lazyWithRetry(() => import("./pages/admin/AdminPasswordReset"));
const AdminAssignedTasks  = lazyWithRetry(() => import("./pages/admin/AdminAssignedTasks"));

const SuperAdminLandingPage       = lazyWithRetry(() => import("./pages/super-admin/SuperAdminLandingPage"));
const SuperAdminLeads             = lazyWithRetry(() => import("./pages/super-admin/SuperAdminLeads"));
const SuperAdminVisitorLocations  = lazyWithRetry(() => import("./pages/super-admin/SuperAdminVisitorLocations"));
const SuperAdminUserIntelligence = lazyWithRetry(() => import("./pages/super-admin/SuperAdminUserIntelligence"));

/* ─── Page-level loading fallback ────────────────────────────────*/
function PageFallback() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
    </div>
  );
}

function DashboardShellFallback() {
  return (
    <DashboardLayout title="">
      <div className="px-4 py-4 space-y-4" aria-busy="true">
        <div className="h-24 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="h-full animate-pulse bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800" />
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 space-y-3">
          <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
          <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="h-11 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ─── Suspended screen ────────────────────────────────────────── */
function SuspendedScreen() {
  const { user, logout } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleContactClick() {
    setShowForm(v => !v);
    if (!showForm) setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 800));
    try {
      await createTicket({
        id: `tkt-${Date.now()}`,
        userId: user?.id ?? "unknown",
        userName: user?.name ?? "Unknown",
        userEmail: user?.email ?? "",
        subject: SUSPENSION_APPEAL_SUBJECT,
        message: message.trim(),
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        status: "open",
      });
    } catch {}
    setSending(false);
    setSent(true);
    setMessage("");
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-red-800 rounded-2xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-red-900/40 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <h1 className="text-white text-xl font-bold mb-2">Account Suspended</h1>
          <p className="text-gray-400 text-sm">
            Your account has been suspended. Contact support if you believe this is a mistake.
          </p>
        </div>

        {showForm && (
          <div className="mb-5 border border-gray-700 rounded-xl p-4 space-y-3">
            <p className="text-gray-300 text-xs font-semibold uppercase tracking-wide">Reach Support</p>
            <div className="grid grid-cols-2 gap-2">
              <a href="https://t.me/customerservice_160" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Telegram
              </a>
              <a href="mailto:support@dealstocks.com"
                className="flex items-center justify-center gap-1.5 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-xs font-medium transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Email
              </a>
            </div>
            {sent ? (
              <div className="flex items-center gap-2 bg-green-900/30 border border-green-800 rounded-lg px-3 py-2.5">
                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <p className="text-green-400 text-xs">Message sent. We'll review your appeal shortly.</p>
              </div>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Describe your situation or reason for appeal…"
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sending}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  {sending ? "Sending…" : "Send Message"}
                </button>
              </>
            )}
          </div>
        )}

        <button
          onClick={handleContactClick}
          className="w-full bg-blue-700 hover:bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium transition-colors mb-3"
        >
          {showForm ? "Hide Support Form" : "Contact Support"}
        </button>
        <button
          onClick={logout}
          className="w-full bg-red-700 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

/* ─── Maintenance screen ──────────────────────────────────────── */
function MaintenanceScreen() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-amber-800/60 rounded-2xl w-full max-w-sm p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-900/30 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.654-4.654m5.65-4.65 4.654-5.654a2.548 2.548 0 0 1 3.586 3.585l-5.654 4.655" />
          </svg>
        </div>
        <h1 className="text-white text-xl font-bold mb-2">Under Maintenance</h1>
        <p className="text-gray-400 text-sm mb-1">
          We're working hard to improve your experience.
        </p>
        <p className="text-gray-500 text-xs mb-6">
          The platform will be back online shortly. Your data and balance remain safe.
        </p>
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3 mb-6">
          <p className="text-amber-300 text-xs font-medium">
            All balances, settings and transaction history are preserved.
          </p>
        </div>
        <button
          onClick={logout}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl py-2.5 text-sm font-medium transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

/* ─── Route guards ────────────────────────────────────────────── */

/**
 * ProtectedRoute — no tick-based polling.
 * Suspension + maintenance are checked by dedicated hooks that own their own
 * intervals and event listeners. Re-renders only when those states change,
 * preventing the entire dashboard tree from re-rendering every 1.5 s.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const isSuspended      = useSuspensionGuard();
  const isMaintenanceOn  = useMaintenanceMode();
  const isDashboardRoute = location.startsWith("/dashboard");

  if (isLoading)         return isDashboardRoute ? <DashboardShellFallback /> : <PageFallback />;
  if (!isAuthenticated)  return <Redirect to="/login" />;
  if (isSuspended)       return <SuspendedScreen />;
  if (isMaintenanceOn)   return <MaintenanceScreen />;
  return <>{children}</>;
}

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAdmin();
  if (!isAdmin) return <Redirect to="/admin/login" />;
  return <>{children}</>;
}

const SuperAdminDashboard    = lazyWithRetry(() => import("./pages/super-admin/SuperAdminDashboard"));
const SuperAdminHealth       = lazyWithRetry(() => import("./pages/super-admin/SuperAdminHealth"));
const SuperAdminUsers        = lazyWithRetry(() => import("./pages/super-admin/SuperAdminUsers"));
const SuperAdminAdmins       = lazyWithRetry(() => import("./pages/super-admin/SuperAdminAdmins"));
const SuperAdminWallet       = lazyWithRetry(() => import("./pages/super-admin/SuperAdminWallet"));
const SuperAdminMarketplaces = lazyWithRetry(() => import("./pages/super-admin/SuperAdminMarketplaces"));
const SuperAdminSeoServices  = lazyWithRetry(() => import("./pages/super-admin/SuperAdminSeoServices"));
const SuperAdminFeatureFlags = lazyWithRetry(() => import("./pages/super-admin/SuperAdminFeatureFlags"));
const SuperAdminAudit        = lazyWithRetry(() => import("./pages/super-admin/SuperAdminAudit"));
const SuperAdminSecurity     = lazyWithRetry(() => import("./pages/super-admin/SuperAdminSecurity"));
const SuperAdminAnalytics    = lazyWithRetry(() => import("./pages/super-admin/SuperAdminAnalytics"));
const SuperAdminCms          = lazyWithRetry(() => import("./pages/super-admin/SuperAdminCms"));
const SuperAdminNotifications = lazyWithRetry(() => import("./pages/super-admin/SuperAdminNotifications"));
const SuperAdminAiGovernance = lazyWithRetry(() => import("./pages/super-admin/SuperAdminAiGovernance"));
const SuperAdminSettings     = lazyWithRetry(() => import("./pages/super-admin/SuperAdminSettings"));
const SuperAdminSupportChat  = lazyWithRetry(() => import("./pages/super-admin/SuperAdminSupportChat"));

function SuperAdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { admin, isAdmin } = useAdmin();
  const isSuper = Boolean(
    admin?.role === "super_admin" ||
    admin?.role === "superadmin" ||
    admin?.role === "owner"
  );

  if (!isAdmin || !isSuper) {
    return <Redirect to="/super-admin/login" />;
  }

  return <>{children}</>;
}

/* ─── Public homepage wrapper ─────────────────────────────────── */
function PublicHomepage() {
  const { theme, toggle } = useTheme();
  const { viewMode } = useViewMode();
  const [search, setSearch] = useState("");
  return (
    <div className={`${theme} ${viewMode === "mobile" ? "max-w-[430px] mx-auto min-h-screen shadow-2xl overflow-hidden bg-white dark:bg-gray-950" : ""}`}>
      <Header search={search} onSearchChange={setSearch} theme={theme} onThemeToggle={toggle} showNotifications={false} />
      <Suspense fallback={<PageFallback />}>
        <Home search={search} />
      </Suspense>
    </div>
  );
}

/* ─── Scroll-to-top on route change ──────────────────────────── */
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);
  return null;
}

/* ─── Route-change loading bar ────────────────────────────────── */
function RouteChangeLoader() {
  const [location] = useLocation();
  const { show, hide } = useLoader();
  const prevRef  = useRef(location);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (location !== prevRef.current) {
      const fromDashboard = prevRef.current.startsWith("/dashboard");
      const toDashboard = location.startsWith("/dashboard");
      prevRef.current = location;
      if (fromDashboard || toDashboard) {
        hide();
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        return;
      }
      show();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(hide, 420);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location, show, hide]);

  return null;
}

/* ─── Global atom loader overlay ─────────────────────────────── */
function GlobalLoader() {
  const { isLoading, settings } = useLoader();
  if (!isLoading || !settings.enabled) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm"
      style={{ animation: "ds-loader-fade-in 0.15s ease-out" }}
    >
      <Atom
        color={settings.color}
        size={settings.size}
        text={settings.text}
        textColor={settings.textColor}
      />
    </div>
  );
}

/* ─── All routes ─────────────────────────────────────────────── */
function AppRoutes() {
  useEffect(() => {
    initTelemetryCollector();
  }, []);
  // Apply admin-configured favicon globally — updates in real time when admin changes it
  useFavicon();
  const [location] = useLocation();
  const suspenseFallback = location.startsWith("/dashboard") ? <DashboardShellFallback /> : <PageFallback />;

  // Phase 6C — consent-safe page-view analytics (admin/dashboard excluded: PII + noise)
  useEffect(() => {
    if (
      location.startsWith("/admin") ||
      location.startsWith("/super-admin") ||
      location.startsWith("/dashboard")
    ) {
      return;
    }
    trackPageView(location);
  }, [location]);

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden">
      <RouteMeta />
      <RouteChangeLoader />
      <GlobalLoader />
      {/* Unified Consent & Security */}
      <UnifiedConsentBanner />
      <ScrollToTop />
      <ErrorBoundary>
        <Suspense fallback={suspenseFallback}>
          <Switch>
            {/* Public */}
            <Route path="/" component={PublicHomepage} />

            {/* Auth */}
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/forgot-password" component={ForgotPassword} />
            <Route path="/reset-password" component={ResetPassword} />

            <Route path="/about" component={AboutUs} />
            <Route path="/how-it-works" component={HowItWorks} />
            <Route path="/methodology" component={Methodology} />
            <Route path="/editorial-policy" component={EditorialPolicy} />
            <Route path="/data-sources" component={DataSources} />
            <Route path="/trust" component={Trust} />
            <Route path="/transparency" component={Transparency} />
            <Route path="/press" component={Press} />
            <Route path="/careers" component={Careers} />
            <Route path="/contact" component={ContactQuote} />
            <Route path="/quote" component={ContactQuote} />

            {/* Marketplace Pages */}
            <Route path="/marketplaces" component={MarketplacesOverview} />
            <Route path="/marketplaces/amazon">
              {() => <MarketplaceDetail marketplaceSlug="amazon" />}
            </Route>
            <Route path="/marketplaces/alibaba">
              {() => <MarketplaceDetail marketplaceSlug="alibaba" />}
            </Route>
            <Route path="/marketplaces/aliexpress">
              {() => <MarketplaceDetail marketplaceSlug="aliexpress" />}
            </Route>
            <Route path="/marketplaces/ebay">
              {() => <MarketplaceDetail marketplaceSlug="ebay" />}
            </Route>

            {/* Support & Community */}
            <Route path="/support" component={SupportCenterPage} />
            <Route path="/help" component={SupportCenterPage} />
            <Route path="/report-issue" component={ReportIssuePage} />
            <Route path="/feedback" component={FeedbackPage} />

            {/* Legal Pages */}
            <Route path="/privacy-policy" component={PrivacyPolicy} />
            <Route path="/terms-of-service" component={TermsOfService} />
            <Route path="/cookie-policy" component={CookiePolicy} />
            <Route path="/disclaimer" component={Disclaimer} />
            <Route path="/affiliate-disclosure" component={AffiliateDisclosure} />
            <Route path="/marketplace-disclosure" component={MarketplaceDisclosure} />
            <Route path="/data-accuracy" component={DataAccuracy} />

            {/* Public Storefront */}
            <Route path="/deals" component={DealsPage} />
            <Route path="/categories" component={CategoriesOverview} />
            <Route path="/categories/:platform/:category" component={CategoryPage} />
            <Route path="/products" component={AllProductsPage} />
            <Route path="/all-products" component={AllProductsPage} />
            <Route path="/products/:slug" component={ProductDetail} />

            {/* SEO Features */}
            <Route path="/faq" component={FaqPage} />
            <Route path="/industries" component={IndustriesOverview} />
            <Route path="/knowledge-hub" component={KnowledgeHubOverview} />
            <Route path="/resources" component={ResourcesOverview} />
            <Route path="/faq" component={FaqPage} />
            <Route path="/glossary" component={GlossaryOverview} />
            <Route path="/guides" component={GuidesOverview} />
            <Route path="/guides/:slug" component={GuideDetail} />
            <Route path="/case-studies" component={CaseStudiesOverview} />
            <Route path="/case-studies/:slug" component={CaseStudyDetail} />
            <Route path="/tools/roi-calculator" component={RoiCalculatorPage} />

            {/* Dashboard — protected */}
            <Route path="/dashboard">
              {() => <ProtectedRoute><DashboardHome /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/wallet">
              {() => <ProtectedRoute><DepositWithdrawal /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/deposit-withdrawal">
              {() => <ProtectedRoute><DepositWithdrawal /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/deposit">
              {() => <ProtectedRoute><Deposit /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/withdraw">
              {() => <ProtectedRoute><Withdraw /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/records">
              {() => <ProtectedRoute><Records /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/notifications">
              {() => <ProtectedRoute><Notifications /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/team">
              {() => <ProtectedRoute><Team /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/support">
              {() => <ProtectedRoute><Support /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/extra-task">
              {() => <ProtectedRoute><ExtraTask /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/settings">
              {() => <ProtectedRoute><Settings /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/profile">
              {() => <ProtectedRoute><Profile /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/mine">
              {() => <ProtectedRoute><Mine /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/analytics">
              {() => <ProtectedRoute><Analytics /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/invite">
              {() => <ProtectedRoute><Invite /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/menu">
              {() => <ProtectedRoute><Menu /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/menu/:platformId">
              {(params) => <ProtectedRoute><PlatformTask platformId={params.platformId} /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/packages/:code">
              {(params) => <ProtectedRoute><PackageTask code={params.code} /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/ad-task/:code">
              {(params) => <ProtectedRoute><AdCodeTask code={params.code} backTo="/dashboard" /></ProtectedRoute>}
            </Route>
            <Route path="/dashboard/ad-task">
              {() => <ProtectedRoute><AdCodeTask backTo="/dashboard" /></ProtectedRoute>}
            </Route>

            {/* Admin — separate auth */}
            <Route path="/admin/login" component={AdminLogin} />
            <Route path="/super-admin/login">
              {() => <AdminLogin isSuperAdminPortal={true} />}
            </Route>
            <Route path="/admin">
              {() => <AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/users">
              {() => <AdminProtectedRoute><AdminUsers /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/teams">
              {() => <AdminProtectedRoute><AdminTeams /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/platforms">
              {() => <AdminProtectedRoute><AdminPlatforms /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/packages">
              {() => <AdminProtectedRoute><AdminPackages /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/deposits">
              {() => <Redirect to="/admin/transactions" />}
            </Route>
            <Route path="/admin/withdrawals">
              {() => <Redirect to="/admin/transactions" />}
            </Route>
            <Route path="/admin/transactions">
              {() => <AdminProtectedRoute><AdminTransactions /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/extra-tasks">
              {() => <AdminProtectedRoute><AdminExtraTasks /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/audit-log">
              {() => <AdminProtectedRoute><AdminAuditLog /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/orders">
              {() => <AdminProtectedRoute><AdminOrders /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/records">
              {() => <AdminProtectedRoute><AdminRecords /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/analytics">
              {() => <AdminProtectedRoute><AdminAnalytics /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/notifications">
              {() => <AdminProtectedRoute><AdminNotifications /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/support">
              {() => <AdminProtectedRoute><AdminSupport /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/settings">
              {() => <AdminProtectedRoute><AdminSettings /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/ads">
              {() => <AdminProtectedRoute><AdminAds /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/landing-page">
              {() => <Redirect to="/super-admin/landing-page" />}
            </Route>
            <Route path="/admin/leads">
              {() => <Redirect to="/super-admin/leads" />}
            </Route>
            <Route path="/admin/password-reset">
              {() => <AdminProtectedRoute><AdminPasswordReset /></AdminProtectedRoute>}
            </Route>
            <Route path="/admin/assigned-tasks">
              {() => <AdminProtectedRoute><AdminAssignedTasks /></AdminProtectedRoute>}
            </Route>

            {/* Super Admin — governance layer (requires admin session) */}
            <Route path="/super-admin">
              {() => <SuperAdminProtectedRoute><SuperAdminDashboard /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/health">
              {() => <SuperAdminProtectedRoute><SuperAdminHealth /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/users">
              {() => <SuperAdminProtectedRoute><SuperAdminUsers /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/user-intelligence">
              {() => <SuperAdminProtectedRoute><SuperAdminUserIntelligence /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/admins">
              {() => <SuperAdminProtectedRoute><SuperAdminAdmins /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/wallet">
              {() => <SuperAdminProtectedRoute><SuperAdminWallet /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/marketplaces">
              {() => <SuperAdminProtectedRoute><SuperAdminMarketplaces /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/seo-services">
              {() => <SuperAdminProtectedRoute><SuperAdminSeoServices /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/feature-flags">
              {() => <SuperAdminProtectedRoute><SuperAdminFeatureFlags /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/audit">
              {() => <SuperAdminProtectedRoute><SuperAdminAudit /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/security">
              {() => <SuperAdminProtectedRoute><SuperAdminSecurity /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/analytics">
              {() => <SuperAdminProtectedRoute><SuperAdminAnalytics /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/cms">
              {() => <SuperAdminProtectedRoute><SuperAdminCms /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/notifications">
              {() => <SuperAdminProtectedRoute><SuperAdminNotifications /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/content">
              {() => <SuperAdminProtectedRoute><SuperAdminCms /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/landing-page">
              {() => <SuperAdminProtectedRoute><SuperAdminLandingPage /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/leads">
              {() => <SuperAdminProtectedRoute><SuperAdminLeads /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/visitor-locations">
              {() => <SuperAdminProtectedRoute><SuperAdminVisitorLocations /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/ai-governance">
              {() => <SuperAdminProtectedRoute><SuperAdminAiGovernance /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/settings">
              {() => <SuperAdminProtectedRoute><SuperAdminSettings /></SuperAdminProtectedRoute>}
            </Route>
            <Route path="/super-admin/support-chat">
              {() => <SuperAdminProtectedRoute><SuperAdminSupportChat /></SuperAdminProtectedRoute>}
            </Route>

            {/* Fallback */}
            <Route>
              <Redirect to="/" />
            </Route>
          </Switch>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

/* ─── Root ────────────────────────────────────────────────────── */
function App() {
  return (
    <ThemeProvider>
      <ViewModeProvider>
        <LangProvider>
          <AuthProvider>
            <TaskSessionProvider>
              <AdminProvider>
                <LoaderProvider>
<Router>
                    <ImpersonationBanner />
                    <FirebaseSuspensionBanner />
                    <AppRoutes />
                    {/* Replaced by UnifiedConsentBanner */}
                  </Router>
                </LoaderProvider>
              </AdminProvider>
            </TaskSessionProvider>
          </AuthProvider>
        </LangProvider>
      </ViewModeProvider>
    </ThemeProvider>
  );
}

export default App;
