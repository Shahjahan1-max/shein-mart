import { useState, useEffect, useMemo, useRef, useDeferredValue } from "react";
import { useLocation } from "wouter";
import {
  ArrowDownLeft, ArrowUpRight, TrendingUp, Clock,
  Gift, Wallet, BarChart3, Activity,
  Users, DollarSign, AlertCircle, CheckCircle2, ExternalLink,
  InboxIcon, ChevronLeft, ChevronRight,
} from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import { type ProductPlatform, useProductsCatalog } from "../../hooks/useCatalogs";
import { GlobalActivityFeed } from "../../components/GlobalActivityFeed";
import { useDeposits, useTaskSessions, useWithdrawals } from "../../hooks/useApi";
import amazonLogo from "@assets/Amazon_Logo_1776687129282.webp";
import alibabaLogo from "@assets/AliBaba_Logo_1776687129281.jfif";
import aliExpressLogo from "@assets/Ali_Express_Logo_1776687129279.webp";
import ebayLogo from "@assets/ebay-logo_1776687129277.jpg";

interface ProductEntry { id: string; title: string; price: string; image: string; platform: string; product_url?: string; }
interface PlatformProductGroup extends ProductPlatform { categories: { category_name: string; products: ProductEntry[] }[]; }
type RequestStatus = "Pending" | "Approved" | "Rejected" | "Complete";
interface ActivityEntry { id: string; type: "deposit" | "withdraw"; label: string; amount: string; date: string; status: RequestStatus; }
interface LiveStats {
  totalEarned: number; totalRequests: number; teamMembers: number; teamEarnings: number;
  pendingCount: number; totalTasksDone: number; thisMonthDeposits: number;
  depositSuccessPct: number; withdrawRatePct: number; taskCompletionPct: number; recentActivity: ActivityEntry[];
}

function isCurrentMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

interface BrandEntry { name: string; logo: string | null; bg: string; isImg: boolean; }
const BRAND_ITEMS: BrandEntry[] = [
  { name: "Amazon",     logo: amazonLogo,     bg: "#fff", isImg: true },
  { name: "Alibaba",    logo: alibabaLogo,    bg: "#fff", isImg: true },
  { name: "AliExpress", logo: aliExpressLogo, bg: "#fff", isImg: true },
  { name: "eBay",       logo: ebayLogo,       bg: "#fff", isImg: true },
  { name: "Amazon",     logo: amazonLogo,     bg: "#fff", isImg: true },
  { name: "Alibaba",    logo: alibabaLogo,    bg: "#fff", isImg: true },
  { name: "AliExpress", logo: aliExpressLogo, bg: "#fff", isImg: true },
  { name: "eBay",       logo: ebayLogo,       bg: "#fff", isImg: true },
];

function BrandStrip() {
  const { t } = useLang();
  return (
    <div className="overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.5)]">
      <div className="py-3 px-2">
        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-2">{t("partnerPlatforms")}</p>
        <div className="relative overflow-hidden" style={{ perspective: "600px" }}>
          <div style={{ animation: "brand-scroll 20s linear infinite", display: "flex", width: "max-content", gap: "1rem", transform: "rotateX(-6deg)", transformOrigin: "top center" }}>
            {BRAND_ITEMS.map((b, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 sm:w-20">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-sm border overflow-hidden" style={{ background: b.bg, borderColor: "rgba(0,0,0,0.08)" }}>
                  {b.logo && <img src={b.logo} alt={b.name} className="w-full h-full object-contain p-1.5" />}
                </div>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate w-full text-center">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes brand-scroll { 0% { transform: rotateX(-6deg) translateX(0); } 100% { transform: rotateX(-6deg) translateX(-50%); } }`}</style>
    </div>
  );
}

const PAGE_SIZE = 5;
function ProductRow({ platformName, platformId, products }: { platformName: string; platformId: string; products: ProductEntry[] }) {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(0);
  const [sliding, setSliding] = useState<"left" | "right" | null>(null);
  const slidingRef = useRef(false);
  const pageRef = useRef(0);
  const totalPages = Math.ceil(products.length / PAGE_SIZE);
  const visibleProducts = products.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const SLIDE_MS = 300;
  const goTo = (nextPage: number, dir: "left" | "right") => {
    if (slidingRef.current) return;
    const target = ((nextPage % totalPages) + totalPages) % totalPages;
    slidingRef.current = true; setSliding(dir);
    setTimeout(() => { pageRef.current = target; setPage(target); setSliding(null); slidingRef.current = false; }, SLIDE_MS);
  };
  useEffect(() => {
    if (totalPages <= 1) return;
    const timer = setInterval(() => {
      const next = (pageRef.current + 1) % totalPages;
      if (!slidingRef.current) {
        slidingRef.current = true; setSliding("left");
        setTimeout(() => { pageRef.current = next; setPage(next); setSliding(null); slidingRef.current = false; }, SLIDE_MS);
      }
    }, 5000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-[0_16px_40px_-30px_rgba(15,23,42,0.5)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{platformName}</h3>
        <div className="flex items-center gap-2">
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => goTo(i, i > page ? "left" : "right")} className={`rounded-full transition-all ${i === page ? "w-4 h-1.5 bg-purple-500" : "w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600"}`} />
              ))}
            </div>
          )}
          <button onClick={() => navigate(`/dashboard/menu/${platformId}`)} className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline">
            More <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="relative">
        <div className="product-scroll-row">
        <div className="flex flex-nowrap gap-3 p-3" style={{ transform: sliding === "left" ? "translateX(-10%)" : sliding === "right" ? "translateX(10%)" : "translateX(0)", opacity: sliding ? 0.5 : 1, transition: "transform 0.3s ease-in-out, opacity 0.3s ease-in-out" }}>
          {visibleProducts.map(product => (
            <a key={product.id} href={product.product_url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-[calc(20%-9.6px)] min-w-[132px] sm:min-w-[140px] bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 active:scale-95 transition-transform cursor-pointer" style={{ minWidth: "132px" }}>
              <div className="h-24 bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                <img src={product.image} alt={product.title} className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/128x96/8A4FFF/white?text=${encodeURIComponent(product.platform[0])}`; }} />
              </div>
              <div className="p-2">
                <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 leading-tight line-clamp-2">{product.title}</p>
                <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-1">{product.price}</p>
              </div>
            </a>
          ))}
        </div>
        </div>
        {totalPages > 1 && (
          <>
            {page > 0 && (
              <button onClick={() => goTo(page - 1, "right")} className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors z-10" aria-label="Previous"><ChevronLeft className="w-4 h-4" /></button>
            )}
            {page < totalPages - 1 && (
              <button onClick={() => goTo(page + 1, "left")} className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors z-10" aria-label="Next"><ChevronRight className="w-4 h-4" /></button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<RequestStatus, string> = {
  Pending:  "text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400",
  Approved: "text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400",
  Rejected: "text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400",
  Complete: "text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400",
};

export function DashboardHome() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLang();
  const userId = user?.id;
  const { data: apiDeposits = [], loading: depositsLoading } = useDeposits(userId);
  const { data: apiWithdrawals = [], loading: withdrawalsLoading } = useWithdrawals(userId);
  const { data: taskSessions = [], loading: taskSessionsLoading } = useTaskSessions(userId);
  const { data: productsCatalog, loading: productsLoading } = useProductsCatalog();

  // Defer the products catalog to avoid blocking critical data rendering.
  // Critical: user balance, task sessions, deposits/withdrawals (render first)
  // Secondary: product rows (deferred — rendered when browser has idle time)
  const deferredCatalog = useDeferredValue(productsCatalog);

  // Team members: use empty array — loading ALL users is too expensive on dashboard home
  const teamMembers: { earnings?: number }[] = [];

  const live = useMemo<LiveStats>(() => {
    const deposits = apiDeposits.map(d => ({ ...d, status: d.status as RequestStatus }));
    const withdrawals = apiWithdrawals.map(w => ({ ...w, status: w.status as RequestStatus }));
    const totalEarned = taskSessions.reduce((sum, session) => sum + Number(session.progressState?.totalEarned ?? session.totalEarned ?? 0), 0);
    const totalTasksDone = taskSessions.reduce((sum, session) => sum + Number(session.completedCount ?? session.tasksDone ?? 0), 0);
    const isPending = (status: string) => status.toLowerCase() === "pending";
    const isApproved = (status: string) => ["approved", "complete", "completed"].includes(status.toLowerCase());
    const pendingCount = deposits.filter(d => isPending(d.status)).length + withdrawals.filter(w => isPending(w.status)).length;
    const thisMonthDeposits = deposits.filter(d => isApproved(d.status) && isCurrentMonth(d.date)).reduce((sum, d) => sum + d.amount, 0);
    const successDep = deposits.filter(d => isApproved(d.status)).length;
    const successWit = withdrawals.filter(w => isApproved(w.status)).length;
    const depositSuccessPct = deposits.length === 0 ? 0 : Math.round(successDep / deposits.length * 100);
    const withdrawRatePct = withdrawals.length === 0 ? 0 : Math.round(successWit / withdrawals.length * 100);
    const totalTasksAcrossSessions = taskSessions.reduce(
      (sum, session) => sum + Math.max(1, Number(session.totalTasks ?? session.totalTaskCount ?? 25)),
      0,
    );
    const taskCompletionDenominator = totalTasksAcrossSessions > 0 ? totalTasksAcrossSessions : 25;
    const taskCompletionPct = Math.min(100, Math.round(totalTasksDone / taskCompletionDenominator * 100));
    const teamEarnings = teamMembers.reduce((sum, member) => sum + Number(member.earnings ?? 0), 0);
    const getTs = (id: string, date: string): number => {
      const fromId = parseInt(id.split("-").pop() ?? "0") || 0;
      if (fromId > 0) return fromId;
      const fromDate = Date.parse(date);
      return isNaN(fromDate) ? 0 : fromDate;
    };
    const depEntries: ActivityEntry[] = deposits.slice(0, 5).map(d => ({ id: d.id, type: "deposit" as const, label: "USDT Deposit", amount: `+$${d.amount.toFixed(2)}`, date: d.date, status: d.status }));
    const witEntries: ActivityEntry[] = withdrawals.slice(0, 5).map(w => ({ id: w.id, type: "withdraw" as const, label: "Withdrawal", amount: `-$${w.amount.toFixed(2)}`, date: w.date, status: w.status }));
    const recentActivity = [...depEntries, ...witEntries].sort((a, b) => getTs(b.id, b.date) - getTs(a.id, a.date)).slice(0, 5);
    return { totalEarned, totalRequests: deposits.length + withdrawals.length, teamMembers: teamMembers.length, teamEarnings, pendingCount, totalTasksDone, thisMonthDeposits, depositSuccessPct, withdrawRatePct, taskCompletionPct, recentActivity };
  }, [apiDeposits, apiWithdrawals, taskSessions, teamMembers]);

  const STATS = [
    { key: "balance",   label: t("balance"),     value: (user?.balance ?? 0).toFixed(2),                   suffix: "USDT", icon: Wallet,      color: "bg-primary text-primary-foreground" },
    { key: "earnings",  label: t("earnings"),    value: (user?.earnings ?? live.totalEarned).toFixed(2),    suffix: "USD",  icon: DollarSign,  color: "bg-accent text-accent-foreground" },
    { key: "requests",  label: t("requests"),    value: live.totalRequests.toString(),                       suffix: "",     icon: Activity,    color: "bg-secondary text-secondary-foreground" },
    { key: "team",      label: t("teamMembers"), value: live.teamMembers.toString(),                         suffix: "",     icon: Users,       color: "bg-primary/90 text-primary-foreground" },
  ];

  const MINI_STATS = [
    { label: t("pendingItems"),    value: live.pendingCount.toString(),              icon: AlertCircle,  color: "text-amber-600 bg-amber-50" },
    { label: t("completedTasks"),  value: live.totalTasksDone.toString(),            icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
    { label: t("teamBonus"),       value: `$${live.teamEarnings.toFixed(0)}`,        icon: Gift,         color: "text-accent bg-accent/10" },
    { label: t("thisMonth"),       value: `$${live.thisMonthDeposits.toFixed(0)}`,   icon: TrendingUp,   color: "text-primary bg-primary/10" },
  ];

  const PERFORMANCE = [
    { label: t("depositSuccess"),  value: live.depositSuccessPct,  color: "bg-emerald-600"  },
    { label: t("withdrawRate"),    value: live.withdrawRatePct,     color: "bg-accent"   },
    { label: t("taskCompletion"),  value: live.taskCompletionPct,   color: "bg-primary" },
  ];

  // Use deferred catalog for product rows — avoids blocking critical stats rendering
  const typed = deferredCatalog as { platform: string; version: string; platforms: PlatformProductGroup[] };
  const platformRows = typed?.platforms?.map(pl => {
    const products: ProductEntry[] = [];
    for (const cat of pl.categories) { for (const p of cat.products) { products.push(p); if (products.length >= 15) break; } if (products.length >= 15) break; }
    const platformId = pl.name.toLowerCase().replace(/\s+/g, "");
    return { name: pl.name, platformId, products };
  }) ?? [];
  // Critical data gate — only block render on auth + financial data
  // Products catalog is deferred via useDeferredValue and does NOT block render
  const isHydrating =
    authLoading ||
    !user ||
    depositsLoading ||
    withdrawalsLoading ||
    taskSessionsLoading;

  if (isHydrating) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-5 relative w-full">
        {/* Welcome + balance hero */}
        <div className="bg-gradient-to-r from-[#1B365D] via-[#254C73] to-[#32608F] rounded-3xl p-5 sm:p-6 shadow-xl text-white">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-blue-100 text-sm">{t("welcome")},</p>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{user?.name ?? "Guest"} 👋</h2>
            </div>
            <div className="text-left sm:text-right min-w-0">
              <p className="text-blue-100 text-xs uppercase tracking-widest">{t("balance")}</p>
              <p className="text-slate-900 dark:text-white text-2xl font-black tabular-nums leading-snug break-all">{(user?.balance ?? 0).toFixed(2)}</p>
              <p className="text-purple-300 text-[10px] font-semibold">USDT</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-lg">
            <button onClick={() => navigate("/dashboard/deposit")} className="flex items-center justify-center gap-2 min-h-12 px-3 sm:px-4 py-3.5 rounded-xl bg-white text-purple-700 font-extrabold text-sm shadow-sm active:scale-95 transition-all hover:shadow-md">
              <ArrowDownLeft className="h-5 w-5 flex-shrink-0" /> <span className="truncate">{t("deposit")}</span>
            </button>
            <button onClick={() => navigate("/dashboard/withdraw")} className="flex items-center justify-center gap-2 min-h-12 px-3 sm:px-4 py-3.5 rounded-xl bg-white/15 border border-white/25 text-slate-900 dark:text-white font-extrabold text-sm active:scale-95 transition-all hover:bg-white/20 hover:shadow-md">
              <ArrowUpRight className="h-5 w-5 flex-shrink-0" /> <span className="truncate">{t("withdraw")}</span>
            </button>
          </div>
        </div>

        {/* Brand strip */}
        <BrandStrip />

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-4 gap-2.5 sm:gap-4">
          {STATS.map(stat => (
            <div key={stat.key} className={`rounded-2xl p-3 sm:p-4 bg-gradient-to-br ${stat.color} shadow-[0_16px_36px_-26px_rgba(15,23,42,0.7)] hover:-translate-y-0.5 transition-transform min-w-0`}>
              <div className="flex items-start justify-between mb-2">
                <div className="p-1.5 rounded-xl bg-white/20"><stat.icon className="h-4 w-4" /></div>
              </div>
              <p className="text-lg sm:text-xl font-extrabold mb-0.5 break-words">
                {stat.value}{stat.suffix ? <span className="text-xs font-medium opacity-80 ml-1">{stat.suffix}</span> : null}
              </p>
              <p className="text-xs opacity-80">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Mini stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-4 gap-2.5 sm:gap-4">
          {MINI_STATS.map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3 flex items-center gap-2.5 sm:gap-3 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.45)] min-w-0">
              <div className={`p-2 rounded-xl flex-shrink-0 ${s.color}`}><s.icon className="h-4 w-4" /></div>
              <div className="min-w-0">
                <p className="text-base font-extrabold text-gray-900 dark:text-white truncate">{s.value}</p>
                <p className="text-xs text-slate-500 dark:text-gray-400 leading-tight">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Performance bars */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.5)]">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-purple-600" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t("performance")}</h3>
          </div>
          <div className="space-y-3">
            {PERFORMANCE.map(p => (
              <div key={p.label}>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>{p.label}</span><span className="font-semibold">{p.value}%</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full ${p.color} rounded-full transition-all duration-500`} style={{ width: `${p.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        {live.recentActivity.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-[0_16px_40px_-30px_rgba(15,23,42,0.5)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t("recentActivity")}</h3>
              <button onClick={() => navigate("/dashboard/records")} className="text-xs text-purple-600 dark:text-purple-400 font-medium hover:underline">{t("viewAll")}</button>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {live.recentActivity.map(act => (
                <div key={act.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`p-2 rounded-xl flex-shrink-0 ${act.type === "withdraw" ? "bg-red-50 dark:bg-red-900/20" : "bg-green-50 dark:bg-green-900/20"}`}>
                    {act.type === "withdraw" ? <ArrowUpRight className="h-3.5 w-3.5 text-red-500" /> : <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{act.label}</p>
                    <p className="text-[10px] text-slate-500 dark:text-gray-400">{act.date}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-bold tabular-nums ${act.amount.startsWith("+") ? "text-green-600" : "text-red-500"}`}>{act.amount}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[act.status]}`}>{act.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform product rows */}
        {platformRows.map(row => (
          <ProductRow key={row.platformId} platformName={row.name} platformId={row.platformId} products={row.products} />
        ))}

        {/* Global Activity Feed */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-[0_16px_40px_-30px_rgba(15,23,42,0.5)]">
          <div className="px-4 py-3 border-b border-gray-50 dark:border-gray-800 flex items-center gap-2">
            <InboxIcon className="h-4 w-4 text-purple-600" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t("recentActivity")}</h3>
          </div>
          <GlobalActivityFeed />
        </div>
      </div>
    </DashboardLayout>
  );
}
