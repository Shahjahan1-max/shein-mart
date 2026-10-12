import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { ChevronRight, Zap, Clock, Lock, CheckCircle } from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import {
  DEFAULT_SETTINGS,
  type ExtraTaskApproval,
} from "../../data/adminData";
import { type AdTaskProgress } from "../../data/adsData";
import { useActiveTaskSession, useFirebaseCollection, useFirebaseDoc, useOrders, useSettings, useUserPackageControls } from "../../hooks/useApi";
import { patchTaskSession } from "../../lib/taskSessionApi";
import amazonLogo from "@assets/Amazon_Logo_1776687129282.webp";
import aliExpressLogo from "@assets/Ali_Express_Logo_1776687129279.webp";

interface BandSettings {
  enabled: boolean;
  amazonBandMax: number;
  alibabaBandMin: number;
  alibabaBandMax: number;
  aliexpressBandMin: number;
  amazonCommission: number;
  alibabaCommission: number;
  aliexpressCommission: number;
}

function defaultBandSettings(source = DEFAULT_SETTINGS): BandSettings {
  const s = source;
  return {
    enabled: s.bandSwitchingEnabled ?? true,
    amazonBandMax: s.amazonBandMax ?? 499,
    alibabaBandMin: s.alibabaBandMin ?? 500,
    alibabaBandMax: s.alibabaBandMax ?? 899,
    aliexpressBandMin: s.aliexpressBandMin ?? 900,
    amazonCommission: s.amazonCommissionRate ?? 4,
    alibabaCommission: s.alibabaCommissionRate ?? 8,
    aliexpressCommission: s.aliexpressCommissionRate ?? 12,
  };
}

interface PlatformProgress { completed: boolean; tasksDone: number; }
interface ProgressMap { [key: string]: PlatformProgress; }

function mergeAdTaskProgress(base: ProgressMap, adProg: AdTaskProgress | null | undefined, platformId: string): ProgressMap {
  if (!adProg) return base;
  return {
    ...base,
    [platformId]: {
      tasksDone: Math.min(adProg.taskIndex, 25),
      completed: adProg.taskIndex >= 25,
    },
  };
}

interface Platform {
  id: string;
  name: string;
  logo?: string;
  initials?: string;
  initialsColor?: string;
  logoContainerBg: string;
  accentColor: string;
  gradient: string;
  range: string;
  balanceMin: number;
  balanceMax: number | null;
  commissionRange: string;
  tierBadge: string;
  perks: string[];
  unlockNext: string;
  description: string;
}

const PLATFORMS: Platform[] = [
  {
    id: "amazon",
    name: "Amazon",
    logo: amazonLogo,
    logoContainerBg: "#000",
    accentColor: "#FF9900",
    gradient: "from-amber-400 to-orange-500",
    range: "$20 – $499",
    balanceMin: 20,
    balanceMax: 499,
    commissionRange: "4% – 8%",
    tierBadge: "Starter Tier",
    perks: [
      "25 Curated consumer product tasks",
      "Baseline commission rates (4% – 8%)",
      "Fast settlement into your wallet",
    ],
    unlockNext: "Reach $500 to unlock Alibaba Wholesale with 2x higher order tickets & profit!",
    description: "Review Amazon product listings and earn entry-level commissions. Complete 25 tasks to build your balance toward high-yield wholesale tiers.",
  },
  {
    id: "alibaba",
    name: "Alibaba",
    initials: "阿里巴巴",
    initialsColor: "#fff",
    logoContainerBg: "#FF6A00",
    accentColor: "#FF6A00",
    gradient: "from-orange-500 to-red-600",
    range: "$500 – $899",
    balanceMin: 500,
    balanceMax: 899,
    commissionRange: "8% – 12%",
    tierBadge: "Wholesale Tier",
    perks: [
      "Bulk wholesale orders with 2x larger ticket value",
      "Increased commission rates (8% – 12%)",
      "Higher total earnings per 25-task package",
    ],
    unlockNext: "Reach $900 to unlock AliExpress Elite for peak 12% – 20% max-ticket earnings!",
    description: "Rate wholesale listings on Alibaba with larger order tickets and doubled commission payouts. Rapidly scale your wallet toward max-tier AliExpress.",
  },
  {
    id: "aliexpress",
    name: "AliExpress",
    logo: aliExpressLogo,
    logoContainerBg: "#fff",
    accentColor: "#E62B31",
    gradient: "from-red-500 to-rose-600",
    range: "$900 – Max",
    balanceMin: 900,
    balanceMax: null,
    commissionRange: "12% – 20%",
    tierBadge: "Elite Max Tier",
    perks: [
      "High-ticket luxury & electronics orders for maximum profit",
      "Peak commission multiplier (12% – 20%)",
      "VIP priority task queue & largest returns per grab",
    ],
    unlockNext: "You have unlocked the highest earning tier on DealX Stocks!",
    description: "Premium review tasks with the highest earning potential. Experience top-tier commissions and maximum returns on every single grab.",
  },
];

function MenuSkeleton() {
  return (
    <DashboardLayout title="Menu">
      <div className="px-4 pt-4 space-y-4" aria-busy="true">
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 space-y-3">
          <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full w-1/3 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="h-36 bg-gray-100 dark:bg-gray-800 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                <div className="h-10 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

export function Menu() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data: apiSettings, loading: settingsLoading } = useSettings<typeof DEFAULT_SETTINGS>();
  const { data: platformProgressDocs = [], loading: platformProgressLoading } = useFirebaseCollection<Array<PlatformProgress & { userId: string; platformId: string }>[number]>("platformProgress", [userId]);
  const { data: adTaskProgress, loading: adTaskProgressLoading } = useFirebaseDoc<AdTaskProgress | null>("adTaskProgress", userId || "guest", null);
  const { data: firebaseExtraApproval, loading: extraApprovalLoading } = useFirebaseDoc<ExtraTaskApproval>("extraTaskApprovals", userId || "guest", { approved: false, rejected: false, limit: 10 });
  const { data: orders = [], loading: ordersLoading } = useOrders(userId);
  const { data: packageControls = [], loading: packageControlsLoading } = useUserPackageControls();
  // Active task session — used to sync currentPlatform on balance band shift
  const { data: activeSessionResult } = useActiveTaskSession(userId);
  const activeSession = activeSessionResult?.data ?? null;
  const prevPlatformRef = useRef<string | null>(null);

  const s = useMemo(() => apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS, [apiSettings]);
  const balance = user?.balance ?? 0;
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);

  const progressPlatformId = useMemo(() => {
    return !(s.bandSwitchingEnabled ?? true)
      ? "amazon"
      : balance >= (s.aliexpressBandMin ?? 900)
        ? "aliexpress"
        : balance >= (s.alibabaBandMin ?? 500)
          ? "alibaba"
          : "amazon";
  }, [s, balance]);

  const firebaseProgress = useMemo(() => Object.fromEntries(
    platformProgressDocs
      .filter(item => item.userId === userId)
      .map(item => [item.platformId, { completed: item.completed, tasksDone: item.tasksDone }])
  ) as ProgressMap, [platformProgressDocs, userId]);

  const progress = useMemo(() => mergeAdTaskProgress(firebaseProgress, adTaskProgress, progressPlatformId), [firebaseProgress, adTaskProgress, progressPlatformId]);

  const extraTaskEnabled = s.extraTaskEnabled ?? false;
  const extraApproval = firebaseExtraApproval ?? { approved: false, rejected: false, limit: 10 };

  const bandSettings = useMemo<BandSettings>(() => ({
    enabled: s.bandSwitchingEnabled ?? true,
    amazonBandMax: s.amazonBandMax ?? 499,
    alibabaBandMin: s.alibabaBandMin ?? 500,
    alibabaBandMax: s.alibabaBandMax ?? 899,
    aliexpressBandMin: s.aliexpressBandMin ?? 900,
    amazonCommission: s.amazonCommissionRate ?? 4,
    alibabaCommission: s.alibabaCommissionRate ?? 8,
    aliexpressCommission: s.aliexpressCommissionRate ?? 12,
  }), [s]);

  const pendingReassignments = useMemo(() => new Set(orders.filter(o => o.userId === userId && ["reassignment_requested", "pending"].includes(o.status)).map(o => o.platformId)), [orders, userId]);

  // Sync currentPlatform on active session when balance band shifts
  useEffect(() => {
    if (!activeSession || !userId) return;
    const sessionId = (activeSession as { sessionId?: string }).sessionId;
    if (!sessionId) return;
    const bal = user?.balance ?? 0;
    const s = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;
    const aliexpressBandMin = s.aliexpressBandMin ?? 900;
    const alibabaBandMin = s.alibabaBandMin ?? 500;
    const newPlatform = bal >= aliexpressBandMin ? "aliexpress" : bal >= alibabaBandMin ? "alibaba" : "amazon";
    const currentPlatform = (activeSession as { currentPlatform?: string }).currentPlatform ?? "amazon";
    if (newPlatform !== currentPlatform && prevPlatformRef.current !== newPlatform) {
      prevPlatformRef.current = newPlatform;
      // Patch only tier metadata; task completion state remains owned by the task endpoint.
      patchTaskSession(sessionId, {
        currentPlatform: newPlatform,
      }).catch(() => {/* silent */});
    }
  }, [activeSession, user?.balance, apiSettings, userId]);

  /* Active platform based on balance band — used by tier banner */
  const activePlatformId = (() => {
    if (!bandSettings.enabled) return "amazon";
    if (balance >= bandSettings.aliexpressBandMin) return "aliexpress";
    if (balance >= bandSettings.alibabaBandMin) return "alibaba";
    return "amazon";
  })();
  const packageControl = packageControls.find(item => item.userId === userId);
  const isPlatformUnlocked = (platformId: string) => {
    if (!bandSettings.enabled) return platformId === "amazon";
    if (platformId === activePlatformId) return true;
    const codes = packageControl?.codes;
    return Boolean(codes && Number(codes[platformId as keyof typeof codes] || 0) > 0);
  };

  /* Dynamic display helpers */
  function getPlatformRange(platform: Platform): string {
    if (platform.id === "amazon")     return `$0 – $${bandSettings.amazonBandMax}`;
    if (platform.id === "alibaba")    return `$${bandSettings.alibabaBandMin} – $${bandSettings.alibabaBandMax}`;
    if (platform.id === "aliexpress") return `$${bandSettings.aliexpressBandMin}+`;
    return platform.range;
  }

  function getPlatformCommissionDisplay(platform: Platform): string {
    if (platform.id === "amazon")     return `${bandSettings.amazonCommission}%`;
    if (platform.id === "alibaba")    return `${bandSettings.alibabaCommission}%`;
    if (platform.id === "aliexpress") return `${bandSettings.aliexpressCommission}%`;
    return platform.commissionRange;
  }

  /* Tier banner helpers */
  const activePlatform = PLATFORMS.find(p => p.id === activePlatformId) ?? PLATFORMS[0];
  const openPlatformTasks = (_platformId: string) => {
    navigate("/dashboard/ad-task");
  };
  const platformIndex = PLATFORMS.findIndex(p => p.id === activePlatformId);
  const nextPlatform = platformIndex < PLATFORMS.length - 1 ? PLATFORMS[platformIndex + 1] : null;
  const nextThreshold = nextPlatform
    ? nextPlatform.id === "alibaba"
      ? bandSettings.alibabaBandMin
      : bandSettings.aliexpressBandMin
    : null;
  const amountNeeded = nextThreshold !== null ? Math.max(0, nextThreshold - balance) : null;

  const { t } = useLang();
  const waitingForInitialData =
    !user ||
    settingsLoading ||
    platformProgressLoading ||
    adTaskProgressLoading ||
    extraApprovalLoading ||
    ordersLoading ||
    packageControlsLoading;
  const hasHydrated = Boolean(userId) && hydratedUserId === userId;

  useEffect(() => {
    if (userId && !waitingForInitialData) {
      setHydratedUserId(userId);
    }
  }, [userId, waitingForInitialData]);

  if (!hasHydrated) {
    return <MenuSkeleton />;
  }

  const getPlatformDesc = (id: string) => {
    if (id === "amazon") return t("amazonDesc");
    if (id === "alibaba") return t("alibabaDesc");
    if (id === "aliexpress") return t("aliexpressDesc");
    return "";
  };

  return (
    <DashboardLayout title={t("menu")}>
      {/* Tier info banner — only shown when band switching is active */}
      {bandSettings.enabled && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl overflow-hidden shadow-[0_18px_45px_-30px_rgba(15,23,42,0.55)] border bg-white/80 dark:bg-gray-900/80 backdrop-blur" style={{ borderColor: activePlatform.accentColor + "33" }}>
            <div className="px-4 py-3 flex items-start flex-wrap gap-3" style={{ background: activePlatform.accentColor + "18" }}>
              <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: activePlatform.logoContainerBg }}>
                {activePlatform.logo ? (
                  <img src={activePlatform.logo} alt={activePlatform.name} className="w-full h-full object-contain p-0.5" />
                ) : (
                  <span className="font-extrabold text-[9px] text-center leading-tight px-1" style={{ color: activePlatform.initialsColor }}>{activePlatform.initials}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-gray-800 dark:text-gray-100">{activePlatform.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: activePlatform.accentColor + "22", color: activePlatform.accentColor }}>
                    {t("currentTier")}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {amountNeeded !== null && nextPlatform ? (
                    amountNeeded === 0 ? (
                      `${t("upgradeAvailable")} → ${nextPlatform.name}`
                    ) : (
                      <>
                        {t("balanceLabel")} <span className="font-bold text-gray-700 dark:text-gray-200">${balance.toLocaleString()}</span>
                        {" · "}
                        <span className="font-bold" style={{ color: nextPlatform.accentColor }}>${amountNeeded.toLocaleString()}</span>
                        {" "}{t("depositMoreUnlock")} {nextPlatform.name}
                      </>
                    )
                  ) : (
                    <span className="font-semibold text-gray-700 dark:text-gray-200">{t("maxTierReached")} · {t("balanceLabel")} ${balance.toLocaleString()}</span>
                  )}
                </p>
              </div>
              {nextThreshold !== null && (
                <div className="flex-shrink-0 text-right w-full sm:w-auto">
                  <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">${balance.toLocaleString()} / ${nextThreshold.toLocaleString()}</p>
                  <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 mt-1 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (balance / nextThreshold) * 100)}%`, background: activePlatform.accentColor }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Extra Task card — admin-controlled */}
      {extraTaskEnabled && (
        <div className="px-4 pt-4">
          <button onClick={() => navigate("/dashboard/extra-task")} className="w-full text-left active:scale-[0.98] transition-transform">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1B365D] via-[#254C73] to-[#99633F] p-4 shadow-lg">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white" />
                <div className="absolute -bottom-6 -left-4 w-32 h-32 rounded-full bg-white" />
              </div>
              <div className="relative flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-slate-900 dark:text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-slate-900 dark:text-white font-extrabold text-sm leading-tight">{t("extraTasks")}</p>
                    {extraApproval.approved ? (
                      <span className="bg-white/25 text-slate-900 dark:text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">{t("approved").toUpperCase()}</span>
                    ) : extraApproval.rejected ? (
                      <span className="bg-red-900/40 text-red-200 text-[10px] font-black px-2 py-0.5 rounded-full leading-none">{t("rejected").toUpperCase()}</span>
                    ) : extraApproval.requestedAt ? (
                      <span className="bg-white/20 text-white/80 text-[10px] font-black px-2 py-0.5 rounded-full leading-none flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {t("pending").toUpperCase()}
                      </span>
                    ) : (
                      <span className="bg-white/20 text-white/80 text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">{t("requestAccess").toUpperCase()}</span>
                    )}
                  </div>
                  <p className="text-white/80 text-[11px]">
                    {extraApproval.approved ? `Up to ${extraApproval.limit} ${t("extraTasks").toLowerCase()}` : t("exclusiveBonus")}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/70 flex-shrink-0" />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Platform cards */}
      <div className="px-3 sm:px-4 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLATFORMS.map(platform => {
          const prog = progress[platform.id] ?? { completed: false, tasksDone: 0 };
          const isCompleted = prog.completed;
          const isUnlocked = isPlatformUnlocked(platform.id);
          const hasPendingReassignment = pendingReassignments.has(platform.id);
          const isActive = platform.id === activePlatformId;

          return (
            <div
              key={platform.id}
              className={`bg-white dark:bg-gray-900 rounded-2xl border overflow-hidden flex flex-col transition-all duration-300 ${
                isActive
                  ? "border-gray-100 dark:border-gray-800 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.75)] ring-1 ring-white/70 dark:ring-white/10 -translate-y-0.5"
                  : "border-gray-100 dark:border-gray-800 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.45)] hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-30px_rgba(15,23,42,0.6)]"
              }`}
            >
              <div className={`bg-gradient-to-r ${platform.gradient} px-4 py-4 relative transition-opacity duration-300 min-h-[9.5rem] ${!isUnlocked ? "opacity-50" : ""}`}>
                {isCompleted && (
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <span className="inline-flex items-center gap-1 bg-green-500/90 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none shadow">
                      <CheckCircle className="w-2.5 h-2.5 flex-shrink-0" /> {t("completed")}
                    </span>
                  </div>
                )}
                {!isCompleted && hasPendingReassignment && (
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <span className="inline-flex items-center gap-1 bg-yellow-400/90 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-full leading-none shadow">
                      <Clock className="w-2.5 h-2.5 flex-shrink-0" /> {t("requestSent")}
                    </span>
                  </div>
                )}
                {!isUnlocked && (
                  <div className="absolute top-2.5 left-2.5 z-10">
                    <span className="inline-flex items-center gap-1 bg-black/40 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                      <Lock className="w-2.5 h-2.5 flex-shrink-0" /> {t("locked")}
                    </span>
                  </div>
                )}
                {isActive && !isCompleted && (
                  <div className="absolute top-2.5 left-2.5 z-10">
                    <span className="inline-flex items-center gap-1 bg-green-500/90 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                      <Zap className="w-2.5 h-2.5 flex-shrink-0" /> {t("active") || "Active"}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 shadow" style={{ background: platform.logoContainerBg }}>
                    {platform.logo ? (
                      <img src={platform.logo} alt={platform.name} className="w-full h-full object-contain p-0.5" />
                    ) : (
                      <span className="font-extrabold text-[10px] text-center leading-tight px-1" style={{ color: platform.initialsColor }}>{platform.initials}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="bg-white/25 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full flex-shrink-0">
                      {getPlatformCommissionDisplay(platform)} Commission
                    </span>
                    <span className="text-[10px] font-bold text-white/90 bg-black/20 px-2 py-0.5 rounded-full">
                      {platform.tierBadge}
                    </span>
                  </div>
                </div>
                <p className="text-white font-extrabold text-lg leading-tight">{platform.name}</p>
                <p className="text-white/80 text-xs mt-0.5 font-medium">{getPlatformRange(platform)} Balance Band</p>
              </div>

              <div className="p-4 flex flex-col flex-1 gap-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{getPlatformDesc(platform.id) || platform.description}</p>

                {/* Tier Perks & Psychology Highlights */}
                <div className="space-y-1.5 py-2 px-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Tier Privileges</p>
                  {platform.perks.map((perk, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[11px] text-gray-700 dark:text-gray-300">
                      <span className="text-emerald-500 font-bold flex-shrink-0">✓</span>
                      <span className="leading-tight">{perk}</span>
                    </div>
                  ))}
                </div>

                {/* Next Tier Upgrade Milestone */}
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl px-3 py-2 leading-relaxed">
                  💡 {platform.unlockNext}
                </p>

                <div className="mt-auto pt-1">
                {!isUnlocked ? (
                  <div className="w-full min-h-11 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed select-none">
                    <Lock className="w-4 h-4 flex-shrink-0" />
                    <span className="min-w-0 truncate whitespace-nowrap">{t("locked")} (Deposit to Unlock)</span>
                  </div>
                ) : isCompleted ? (
                  <button
                    onClick={() => openPlatformTasks(platform.id)}
                    className={`w-full min-h-11 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all ${
                      hasPendingReassignment
                        ? "bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200"
                        : "bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200/70 dark:hover:bg-gray-700"
                    }`}
                  >
                    {hasPendingReassignment ? (
                      <>
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse flex-shrink-0" />
                        <span className="min-w-0 truncate whitespace-nowrap">Request Pending (In Review)</span>
                      </>
                    ) : (
                      <>
                        <ChevronRight className="w-4 h-4 flex-shrink-0" />
                        <span className="min-w-0 truncate whitespace-nowrap">{t("requestNewTask")}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const target = platform.id === activePlatformId ? platform.id : activePlatformId;
                      openPlatformTasks(target);
                    }}
                    className={`w-full min-h-11 px-4 py-2.5 rounded-xl bg-gradient-to-r ${platform.gradient} text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm hover:shadow-md hover:brightness-105`}
                  >
                    <Zap className="w-4 h-4 flex-shrink-0" />
                    <span className="min-w-0 truncate whitespace-nowrap">
                      {platform.id === activePlatformId ? t("startTasks") : t("continueTasks") || "Continue Tasks"}
                    </span>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  </button>
                )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
