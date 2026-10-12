import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, ShoppingCart, Loader2, CheckCircle,
  AlertTriangle, Wallet, X, TrendingUp, Lock,
  ChevronLeft, ChevronRight,
  ClipboardList, Clock, Sparkles, Zap, ArrowRight, RefreshCw, ShieldCheck
} from "lucide-react";

import { DashboardLayout } from "./DashboardLayout";
import { SuspensionOverlay } from "../../components/SuspensionOverlay";
import { MaintenanceOverlay } from "../../components/MaintenanceOverlay";
import { useAuth } from "../../contexts/AuthContext";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { propagateTeamEarnings } from "../../data/teamUtils";
import {
  type AdEntry, type AdGroup, type AdRowOverride, type AdTaskProgress, type CustomAdDef,
} from "../../data/adsData";
import { DEFAULT_SETTINGS, type OrderRecord } from "../../data/adminData";
import {
  createOrder,
  confirmAssignedTaskItem,
  deleteOrder,
  useAssignedTaskItemsPage,
  useActiveTaskSession,
  useFirebaseCollection,
  useFirebaseDoc,
  useOrders,
  useSettings,
} from "../../hooks/useApi";
import { useAdGroupsCatalog } from "../../hooks/useCatalogs";

const ADS_PER_SESSION = 25;

function customDefToAdGroup(def: CustomAdDef): AdGroup {
  const commissionRate = def.price > 0 ? def.commission / def.price : 0.04;
  return {
    code: def.code,
    urlPath: def.code,
    label: def.title,
    amount: def.price,
    commissionRate,
    commissionAmount: def.commission,
    afterCommission: def.afterCommission,
    tier: def.tier || "Starter",
    ads: Array.from({ length: 25 }, (_, i) => ({
      adNo: i + 1,
      title: `${def.title} - Task ${i + 1}`,
      contentUrl: def.imageUrl || `https://placehold.co/400x400/8A4FFF/white?text=${def.code}`,
      amount: def.price,
      commissionRate,
      commissionAmount: def.commission,
      afterCommission: def.afterCommission,
    })),
    isActive: true,
  };
}

function applyAdRowOverrides(group: AdGroup, rowOverrides: (AdRowOverride & { code: string; adNo: number })[]): AdGroup {
  return {
    ...group,
    ads: group.ads.map(ad => {
      const ov = rowOverrides.find(item => item.code === group.code && item.adNo === ad.adNo);
      if (!ov) return ad;
      const amount = ov.amount ?? ad.amount;
      const commissionAmount = ov.commissionAmount ?? ad.commissionAmount;
      const afterCommission = ov.afterCommission ?? ad.afterCommission;
      return {
        ...ad,
        title: ov.title ?? ad.title,
        contentUrl: ov.contentUrl ?? ad.contentUrl,
        amount,
        commissionAmount,
        afterCommission,
        commissionRate: amount > 0 ? commissionAmount / amount : ad.commissionRate,
        depositRequired: ov.depositRequired ?? ad.depositRequired,
        requiredDeposit: ov.requiredDeposit ?? ad.requiredDeposit,
      };
    }),
  };
}

interface Props {
  code?: string;
  backTo?: string;
}

interface AssignedTaskItem {
  id: string;
  userId: string;
  code: string;
  adNo: number;
  productId?: string;
  orderId: string;
  title: string;
  contentUrl: string;
  amount: number;
  commissionAmount: number;
  afterCommission: number;
  depositRequired?: boolean;
  requiredDeposit?: number;
  status: "pending" | "completed";
  completedAt?: string;
  assignedTs?: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskSessionDoc {
  sessionId?: string;
  assignedTs?: string;
  createdAt?: string;
  completedCount?: number;
  completedTaskCount?: number;
  currentTaskIndex?: number;
  totalEarned?: number;
  totalTasks?: number;
  totalTaskCount?: number;
  taskCode?: string;
  status?: string;
  taskStatus?: string;
  progressState?: { totalEarned?: number };
  completedTaskIds?: string[];
  currentPlatform?: TaskPlatformId;
}

type ActiveAdEntry = AdEntry & {
  assignedItemId?: string;
  productId?: string;
  orderId?: string;
  status?: "pending" | "completed";
};

function getCompletedAdNos(items: AssignedTaskItem[], session?: TaskSessionDoc | null): Set<number> {
  const completed = new Set<number>();
  for (const item of items) {
    if (item.status === "completed" && Number.isFinite(Number(item.adNo))) {
      completed.add(Number(item.adNo));
    }
  }
  for (const taskId of session?.completedTaskIds ?? []) {
    const match = String(taskId).match(/_(\d+)$/);
    if (match) completed.add(Number(match[1]));
  }
  return completed;
}

function countContiguousTasks(completed: Set<number>, total = ADS_PER_SESSION): number {
  let count = 0;
  for (let adNo = 1; adNo <= total; adNo += 1) {
    if (!completed.has(adNo)) break;
    count = adNo;
  }
  return count;
}

function resolveFirebaseTaskIndex(
  items: AssignedTaskItem[],
  progress?: AdTaskProgress | null,
  session?: TaskSessionDoc | null,
): number {
  const completedAdNos = getCompletedAdNos(items, session);
  const itemCount = countContiguousTasks(completedAdNos);
  const progressCompletedCount = (progress as (AdTaskProgress & { completedCount?: number }) | null | undefined)?.completedCount;
  const progressCount = Number(progress?.taskIndex ?? progressCompletedCount ?? 0);
  const sessionCount = Number(session?.completedTaskCount ?? session?.completedCount ?? session?.currentTaskIndex ?? 0);

  if (
    completedAdNos.size >= ADS_PER_SESSION ||
    progressCount >= ADS_PER_SESSION ||
    sessionCount >= ADS_PER_SESSION ||
    session?.taskStatus === "completed" ||
    session?.status === "completed"
  ) {
    return ADS_PER_SESSION;
  }

  return Math.min(
    ADS_PER_SESSION,
    Math.max(
      itemCount,
      completedAdNos.size,
      Number.isFinite(progressCount) ? progressCount : 0,
      Number.isFinite(sessionCount) ? sessionCount : 0,
    ),
  );
}

function resolveFirebaseTotalEarned(
  items: AssignedTaskItem[],
  progress?: AdTaskProgress | null,
  session?: TaskSessionDoc | null,
): number {
  const completedAdNos = getCompletedAdNos(items, session);
  const itemEarned = items.reduce(
    (sum, item) => sum + (completedAdNos.has(Number(item.adNo)) ? Number(item.commissionAmount || 0) : 0),
    0,
  );
  const progressEarned = Number(progress?.totalEarned ?? 0);
  const sessionEarned = Number(session?.progressState?.totalEarned ?? session?.totalEarned ?? 0);
  return Math.max(
    itemEarned,
    Number.isFinite(progressEarned) ? progressEarned : 0,
    Number.isFinite(sessionEarned) ? sessionEarned : 0,
  );
}

/* ─── Order Modal ─────────────────────────────────────────────── */
function OrderModal({
  ad, adNum, total, processing, onConfirm, onClose,
}: {
  ad: ActiveAdEntry;
  adNum: number;
  total: number;
  processing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const now = new Date().toLocaleString("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm cursor-pointer animate-in fade-in duration-200"
      onClick={!processing ? onClose : undefined}
    >
      {/* Modal card — stopPropagation prevents clicks on modal from closing it */}
      <div
        className="relative w-full max-w-[370px] bg-white dark:bg-gray-900 rounded-3xl shadow-2xl z-10 overflow-hidden border border-gray-200 dark:border-gray-800 cursor-default animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header bar with Task counter + visible Close Button */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[#8A4FFF]/15 text-[#8A4FFF] dark:text-purple-300 font-mono">
              Task {adNum} of {total}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono font-medium">
              {ad.orderId || `ORD-${Date.now().toString().slice(-6)}`}
            </span>
          </div>

          {!processing && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-200/80 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Product image section */}
        <div className="p-4 pb-2">
          <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 h-44 relative border border-gray-100 dark:border-gray-700/50 shadow-inner">
            <img
              src={ad.contentUrl}
              alt={ad.title}
              className="w-full h-full object-cover"
              onError={e => {
                (e.target as HTMLImageElement).src =
                  `https://placehold.co/400x200/8A4FFF/white?text=Task+${adNum}`;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none" />
            <p className="absolute bottom-2.5 left-3 right-3 text-xs font-bold text-white line-clamp-1 drop-shadow-md">
              {ad.title}
            </p>
          </div>
        </div>

        {/* Order Details list */}
        <div className="px-5 py-2.5 space-y-2 text-xs">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Transaction Time:</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">{now}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Order Value:</span>
            <span className="font-bold text-gray-900 dark:text-white text-sm">{ad.amount.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Task Commission:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">+{ad.commissionAmount.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-2.5 text-sm">
            <span className="font-bold text-gray-800 dark:text-gray-200">Expected Total Return:</span>
            <span className="font-black text-[#8A4FFF] dark:text-purple-400 text-base">
              {(ad.amount + ad.commissionAmount).toFixed(2)} USDT
            </span>
          </div>
        </div>

        {/* High-visibility Primary Submit Button */}
        <div className="p-4 pt-2 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-b-3xl">
          <button
            type="button"
            onClick={onConfirm}
            disabled={processing}
            style={{ backgroundColor: "#8A4FFF", color: "#FFFFFF" }}
            className="w-full py-4 rounded-2xl font-extrabold text-base active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2.5 shadow-xl shadow-purple-600/30 cursor-pointer hover:opacity-95"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                <span className="text-white font-bold">Confirming Order…</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5 text-white" />
                <span className="text-white font-bold">Submit Order</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Combo / Required Deposit Modal ─────────────────────────── */
function ComboDepositModal({
  ad,
  adNum,
  total,
  userBalance,
  requiredAmount,
  onClose,
  onDeposit,
}: {
  ad: ActiveAdEntry;
  adNum: number;
  total: number;
  userBalance: number;
  requiredAmount: number;
  onClose: () => void;
  onDeposit: () => void;
}) {
  const shortfall = Math.max(0, requiredAmount - userBalance);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[400px] bg-white dark:bg-gray-900 rounded-3xl shadow-2xl z-10 overflow-hidden border border-red-200 dark:border-red-900/50 cursor-default animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-red-50/80 dark:bg-red-950/30">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white">Combo Order / Deposit Required</h3>
              <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">Task {adNum} of {total}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-200/80 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-all active:scale-90"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product mini showcase */}
        <div className="p-4 bg-gray-50 dark:bg-gray-850 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-200 dark:bg-gray-800 flex-shrink-0 border border-gray-200 dark:border-gray-700">
            <img
              src={ad.contentUrl}
              alt={ad.title}
              className="w-full h-full object-cover"
              onError={e => {
                (e.target as HTMLImageElement).src =
                  `https://placehold.co/100x100/8A4FFF/white?text=Task+${adNum}`;
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{ad.title}</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-extrabold mt-0.5">
              High Commission: +{ad.commissionAmount.toFixed(2)} USDT
            </p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="p-5 space-y-3 text-xs">
          <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
            This task is a high-yield combo assignment. Your current wallet balance is lower than the required amount to grab this order.
          </p>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 space-y-2.5 border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Required Amount:</span>
              <span className="font-bold text-gray-900 dark:text-white">{requiredAmount.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Your Balance:</span>
              <span className="font-bold text-gray-900 dark:text-white">{userBalance.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 font-bold text-sm">
              <span className="text-red-600 dark:text-red-400">Shortfall / Deposit Needed:</span>
              <span className="text-red-600 dark:text-red-400">+{shortfall.toFixed(2)} USDT</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 space-y-2.5">
          <button
            type="button"
            onClick={onDeposit}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-extrabold text-sm active:scale-95 transition-all shadow-xl shadow-purple-600/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Wallet className="w-5 h-5" />
            <span>Deposit {shortfall > 0 ? `+${shortfall.toFixed(2)} USDT` : "Now"} to Continue</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Ad Gallery Lightbox (with prev/next + swipe) ───────────── */
function AdLightbox({
  ads, initialIndex, onClose,
}: {
  ads: AdEntry[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const ad = ads[idx];
  const touchStartX = useRef<number | null>(null);

  const prev = useCallback(() => setIdx(i => (i - 1 + ads.length) % ads.length), [ads.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % ads.length), [ads.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, onClose]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) delta > 0 ? next() : prev();
    touchStartX.current = null;
  }

  if (!ad) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      <button
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div
        className="relative z-10 max-w-sm w-full select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="rounded-3xl overflow-hidden bg-gray-900 shadow-2xl">
          <img
            key={ad.adNo}
            src={ad.contentUrl}
            alt={ad.title}
            className="w-full object-contain max-h-[65vh]"
            onError={e => {
              (e.target as HTMLImageElement).src =
                `https://placehold.co/400x400/8A4FFF/white?text=Ad+${ad.adNo}`;
            }}
          />
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <span className="text-white font-semibold text-sm truncate">{ad.title}</span>
            <span className="text-gray-400 text-xs flex-shrink-0">Task {idx + 1} of {ads.length}</span>
          </div>
        </div>

        {ads.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous ad"
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center shadow-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next ad"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-10 h-10 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center shadow-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Confetti Burst ─────────────────────────────────────────── */
const CONFETTI_COLORS = [
  "#f59e0b", "#10b981", "#8b5cf6", "#ef4444",
  "#3b82f6", "#ec4899", "#facc15", "#06b6d4",
];

function Confetti() {
  const pieces = Array.from({ length: 52 }, (_, i) => {
    const size = 6 + (i * 7919 % 9);
    const left = (i * 1973 % 100);
    const delay = (i * 137 % 80) / 100;
    const duration = 1.3 + (i * 31 % 12) / 10;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const isCircle = i % 3 !== 0;
    const swayDuration = 0.6 + (i * 53 % 6) / 10;
    return { id: i, size, left, delay, duration, color, isCircle, swayDuration };
  });

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 9999 }}
      aria-hidden="true"
    >
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? "50%" : "2px",
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in both,
                        confetti-sway ${p.swayDuration}s ${p.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

function AdTaskSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-3xl bg-gray-200 dark:bg-gray-800" />
      <div className="h-44 rounded-3xl bg-gray-200 dark:bg-gray-800" />
      <div className="h-64 rounded-3xl bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}

/* ─── Platform ID for order requests ─────────────────────────── */
type TaskPlatformId = "amazon" | "alibaba" | "aliexpress";

const TASK_PLATFORM_NAMES: Record<TaskPlatformId, string> = {
  amazon: "Amazon",
  alibaba: "Alibaba",
  aliexpress: "AliExpress",
};

function getTaskPlatformId(balance: number, settings: typeof DEFAULT_SETTINGS): TaskPlatformId {
  if (!(settings.bandSwitchingEnabled ?? true)) return "amazon";
  if (balance >= (settings.aliexpressBandMin ?? 900)) return "aliexpress";
  if (balance >= (settings.alibabaBandMin ?? 500)) return "alibaba";
  return "amazon";
}

/* ─── Main Component ─────────────────────────────────────────── */
export function AdCodeTask({ code, backTo = "/dashboard" }: Props) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const userId = (user as any)?.id ?? "";
  const { data: settings, loading: settingsLoading } = useSettings<typeof DEFAULT_SETTINGS>();
  const { data: activeSessionResult, loading: activeSessionLoading } = useActiveTaskSession(userId);
  const activeSession = activeSessionResult?.data as TaskSessionDoc | null ?? null;
  const requestRequired = activeSessionResult?.requestRequired === true;
  const { data: apiOrders = [], refetch: refetchOrders, loading: ordersLoading } = useOrders(userId);
  const { data: adCatalog, loading: adCatalogLoading } = useAdGroupsCatalog();
  const baseAdGroups = adCatalog.groups || [];
  const { data: customAdDocs = [], loading: customAdDocsLoading } = useFirebaseCollection<CustomAdDef>("customAdCodes");
  const { data: rowOverrideDocs = [], loading: rowOverrideDocsLoading } = useFirebaseCollection<AdRowOverride & { id: string; code: string; adNo: number }>("adRowOverrides");
  const { data: firebaseProgress, loading: firebaseProgressLoading } = useFirebaseDoc<AdTaskProgress | null>("adTaskProgress", userId || "guest", null);
  const [balanceOverride, setBalanceOverride] = useState<number | null>(null);
  const contextBalance = Number((user as any)?.balance ?? 0);
  const userBalance = balanceOverride !== null ? balanceOverride : contextBalance;

  useEffect(() => {
    if (balanceOverride !== null && contextBalance >= balanceOverride) {
      setBalanceOverride(null);
    }
  }, [contextBalance, balanceOverride]);

  const platformSettings = settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS;
  const taskPlatformId = getTaskPlatformId(userBalance, platformSettings);
  const taskPlatformName = TASK_PLATFORM_NAMES[taskPlatformId];

  /* ── Amazon entry gate (admin-controlled min balance) ────────── */
  const amazonGate = {
    required: platformSettings.amazonMinBalanceRequired,
    minBalance: platformSettings.amazonMinTaskBalance,
  };

  /* ── Admin-assigned ad code (source of truth) ─────────────── */
  const [currentCode, setCurrentCode] = useState<string | null>(
    () => activeSession?.taskCode ?? null
  );
  const [currentCodeTs, setCurrentCodeTs] = useState<string>(
    () => activeSession?.assignedTs ?? activeSession?.createdAt ?? ""
  );
  const codeTsRef = useRef(currentCodeTs);
  codeTsRef.current = currentCodeTs;

  const effectiveCode = currentCode;
  const baseGroup: AdGroup | undefined = effectiveCode
    ? baseAdGroups.find(g => g.code === effectiveCode)
      ?? customAdDocs.map(customDefToAdGroup).find(g => g.code === effectiveCode)
    : undefined;
  const group = baseGroup ? applyAdRowOverrides(baseGroup, rowOverrideDocs) : undefined;
  const {
    data: assignedTaskItems = [],
    refetch: refetchAssignedTaskItems,
    loading: assignedTaskItemsLoading,
  } = useAssignedTaskItemsPage<AssignedTaskItem>(userId, effectiveCode ?? "", ADS_PER_SESSION);
  const taskSession = activeSession;

  /* ── Pending order state (request→pending→assigned) ─────────── */
  const [pendingOrder, setPendingOrder] = useState<OrderRecord | null>(null);
  const pendingOrderRef = useRef(pendingOrder);
  pendingOrderRef.current = pendingOrder;

  /* ── Task progress ─────────────────────────────────────────── */
  const [taskIndex, setTaskIndex] = useState<number>(() => {
    const p = firebaseProgress;
    const ts = activeSession?.assignedTs ?? activeSession?.createdAt ?? "";
    if (p && p.code === effectiveCode && (!ts || p.assignedTs === ts)) return p.taskIndex;
    return 0;
  });
  const [totalEarned, setTotalEarned] = useState<number>(() => {
    const p = firebaseProgress;
    const ts = activeSession?.assignedTs ?? activeSession?.createdAt ?? "";
    if (p && p.code === effectiveCode && (!ts || p.assignedTs === ts)) return p.totalEarned;
    return 0;
  });

  /* Modal state */
  const [showModal, setShowModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  useBodyScrollLock(showModal || showDepositModal);
  const [justCompleted, setJustCompleted] = useState(false);

  /* Celebration state */
  const [showConfetti, setShowConfetti] = useState(false);
  const wasNotDoneRef = useRef(taskIndex < ADS_PER_SESSION);

  /* Gallery state */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);

  /* ── Session lock ─────────────────────────────────────────── */
  const sessionActiveRef = useRef(false);
  if (currentCode && taskIndex < ADS_PER_SESSION) {
    sessionActiveRef.current = true;
  }
  if (taskIndex >= ADS_PER_SESSION) {
    sessionActiveRef.current = false;
  }

  /* ── Poll & Sync ───────────────────────────────────────────── */
  useEffect(() => {
    function sync() {
      const newCode = activeSession?.taskCode ?? null;
      const newTs   = activeSession?.assignedTs ?? activeSession?.createdAt ?? "";
      const codeChanged = newCode !== currentCode;
      const tsChanged   = newTs !== codeTsRef.current && newTs !== "";
      const keepCompletedCardOpen =
        newCode === null &&
        firebaseProgress?.code === currentCode &&
        Number(firebaseProgress.taskIndex || 0) >= ADS_PER_SESSION;

      if (codeChanged || (newCode !== null && tsChanged)) {
        if (codeChanged && !keepCompletedCardOpen) setCurrentCode(newCode);
        if (tsChanged) setCurrentCodeTs(newTs);

        if (newCode !== null) {
          const saved = firebaseProgress;
          const progressIsStale =
            !saved ||
            saved.code !== newCode ||
            (newTs !== "" && saved.assignedTs !== newTs);

          if (progressIsStale && assignedTaskItems.length === 0 && !taskSession) {
            setTaskIndex(0);
            setTotalEarned(0);
          } else {
            setTaskIndex(resolveFirebaseTaskIndex(assignedTaskItems, saved, taskSession));
            setTotalEarned(resolveFirebaseTotalEarned(assignedTaskItems, saved, taskSession));
          }
          wasNotDoneRef.current = true;
          setShowConfetti(false);
        }
      }

      if (!newCode && userId) {
        const latest = (apiOrders.find(o =>
          o.userId === userId &&
          o.platformId === taskPlatformId &&
          ["pending", "reassignment_requested"].includes(o.status)
        ) as OrderRecord | undefined) ?? null;
        if (JSON.stringify(latest) !== JSON.stringify(pendingOrderRef.current)) {
          setPendingOrder(latest);
        }
      }
    }

    sync();
  }, [activeSession, apiOrders, assignedTaskItems, currentCode, firebaseProgress, taskPlatformId, taskSession, userId]);

  useEffect(() => {
    if (!effectiveCode) return;
    const saved = firebaseProgress;
    const ts = activeSession?.assignedTs ?? activeSession?.createdAt ?? "";
    const progressMatchesAssignment = saved && saved.code === effectiveCode && (!ts || saved.assignedTs === ts);
    const matchingSession = taskSession?.taskCode === effectiveCode || !taskSession?.taskCode ? taskSession : null;
    const nextIndex = resolveFirebaseTaskIndex(
      assignedTaskItems,
      progressMatchesAssignment ? saved : null,
      matchingSession,
    );
    const nextEarned = resolveFirebaseTotalEarned(
      assignedTaskItems,
      progressMatchesAssignment ? saved : null,
      matchingSession,
    );
    setTaskIndex(prev => (prev === nextIndex ? prev : nextIndex));
    setTotalEarned(prev => (prev === nextEarned ? prev : nextEarned));
  }, [activeSession?.assignedTs, activeSession?.createdAt, assignedTaskItems, effectiveCode, firebaseProgress, taskSession]);

  useEffect(() => {
    if (
      !activeSession &&
      requestRequired &&
      firebaseProgress?.code &&
      firebaseProgress.taskIndex >= ADS_PER_SESSION &&
      currentCode !== firebaseProgress.code
    ) {
      setCurrentCode(firebaseProgress.code);
      setTaskIndex(firebaseProgress.taskIndex);
      setTotalEarned(firebaseProgress.totalEarned);
    }
  }, [activeSession, currentCode, firebaseProgress, requestRequired]);

  /* ── Request task assignment ────────────────────────────────── */
  async function handleRequestTask(requestNext = false) {
    if (!userId || !user || requestSubmitting) return;
    setRequestSubmitting(true);
    try {
      const existing = (apiOrders.find(o =>
        o.userId === userId &&
        o.platformId === taskPlatformId &&
        ["pending", "reassignment_requested"].includes(o.status)
      ) as OrderRecord | undefined) ?? null;

      if (existing) {
        setPendingOrder(existing);
        return;
      }
      const newOrder: OrderRecord = {
        id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId,
        userName: (user as any).name ?? "User",
        platformId: taskPlatformId,
        platformName: taskPlatformName,
        status: requestNext ? "reassignment_requested" : "pending",
        type: "task_request",
        createdAt: new Date().toISOString(),
        ...(requestNext ? {
          requestedPlatform: taskPlatformId,
          requestedPlatformName: taskPlatformName,
          previousAdCodeId: effectiveCode ?? undefined,
        } : {}),
      };
      const savedOrder = await createOrder(newOrder);
      setPendingOrder(savedOrder as OrderRecord);
      refetchOrders();
      window.dispatchEvent(new CustomEvent("ds:data-changed", { detail: { collection: "orders" } }));
    } catch (error) {
      console.error("Failed to request task assignment:", error);
    } finally {
      setRequestSubmitting(false);
    }
  }

  async function handleCancelRequest() {
    if (!pendingOrder) return;
    setRequestSubmitting(true);
    try {
      await deleteOrder(pendingOrder.id);
      refetchOrders();
      setPendingOrder(null);
      window.dispatchEvent(new CustomEvent("ds:data-changed", { detail: { collection: "orders" } }));
    } catch (error) {
      console.error("Failed to cancel task request:", error);
    } finally {
      setRequestSubmitting(false);
    }
  }

  /* Derived */
  const ads = group?.ads ?? [];
  const assignedTaskItemsByAdNo = new Map(assignedTaskItems.map(item => [Number(item.adNo), item]));
  const currentAssignedItem = assignedTaskItemsByAdNo.get(taskIndex + 1);
  const fallbackAd = ads[taskIndex] || ads[taskIndex % (ads.length || 1)] || ads[0];

  const currentAd: ActiveAdEntry | undefined = currentAssignedItem
    ? {
        adNo: currentAssignedItem.adNo,
        title: currentAssignedItem.title,
        contentUrl: currentAssignedItem.contentUrl,
        amount: currentAssignedItem.amount,
        commissionAmount: currentAssignedItem.commissionAmount,
        afterCommission: currentAssignedItem.afterCommission,
        commissionRate: currentAssignedItem.amount > 0 ? currentAssignedItem.commissionAmount / currentAssignedItem.amount : (fallbackAd?.commissionRate ?? 0.04),
        depositRequired: currentAssignedItem.depositRequired,
        requiredDeposit: currentAssignedItem.requiredDeposit,
        assignedItemId: currentAssignedItem.id,
        productId: currentAssignedItem.productId,
        orderId: currentAssignedItem.orderId,
        status: currentAssignedItem.status,
      }
    : fallbackAd
      ? {
          adNo: fallbackAd.adNo || (taskIndex + 1),
          title: fallbackAd.title || `Task ${taskIndex + 1}`,
          contentUrl: fallbackAd.contentUrl || `https://placehold.co/400x400/8A4FFF/white?text=Task+${taskIndex + 1}`,
          amount: fallbackAd.amount || 20,
          commissionAmount: fallbackAd.commissionAmount || 0.8,
          afterCommission: fallbackAd.afterCommission || ((fallbackAd.amount || 20) + (fallbackAd.commissionAmount || 0.8)),
          commissionRate: fallbackAd.commissionRate || 0.04,
          depositRequired: fallbackAd.depositRequired,
          requiredDeposit: fallbackAd.requiredDeposit,
          assignedItemId: userId && effectiveCode ? `${userId}_${effectiveCode}_${taskIndex + 1}` : undefined,
          orderId: `ORD-${effectiveCode || "TSK"}-${taskIndex + 1}-${Date.now().toString().slice(-4)}`,
          status: "pending",
        }
      : undefined;

  // isAllDone: purely based on taskIndex — do NOT require assignedTaskItems to be loaded.
  // If taskIndex is >= 25 (from Firebase progress or session), we are done.
  // This prevents the Task 26 of 25 bug where items haven't loaded yet.
  const isAllDone = taskIndex >= ADS_PER_SESSION;

  const depositRestricted = !!(currentAd?.depositRequired && (currentAd.requiredDeposit ?? 0) > 0);
  const requiredAmount = depositRestricted
    ? (currentAd?.requiredDeposit ?? 0)
    : (currentAd?.amount ?? 0);
  const canAfford = currentAd
    ? userBalance >= requiredAmount
    : false;

  /* Confetti on complete */
  useEffect(() => {
    if (isAllDone && wasNotDoneRef.current) {
      wasNotDoneRef.current = false;
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let confettiTimer: ReturnType<typeof setTimeout> | undefined;
      if (!prefersReduced) {
        setShowConfetti(true);
        confettiTimer = setTimeout(() => setShowConfetti(false), 3500);
      }
      return () => {
        if (confettiTimer !== undefined) clearTimeout(confettiTimer);
      };
    }
    return undefined;
  }, [isAllDone]);

  /* Confirm order */
  async function handleConfirm() {
    if (!currentAd || !user || processing) return;

    // Check balance / shortfall for combo order
    if (!canAfford) {
      setShowModal(false);
      setShowDepositModal(true);
      return;
    }

    setProcessing(true);
    const commission = Number(currentAd.commissionAmount || 0);
    const nextIdx = Math.min(ADS_PER_SESSION, taskIndex + 1);
    const nextEarned = totalEarned + commission;
    const completedAdNo = currentAd.adNo || (taskIndex + 1);
    const itemId = currentAd.assignedItemId || (userId && effectiveCode ? `${userId}_${effectiveCode}_${completedAdNo}` : undefined);

    try {
      if (itemId) {
        // confirmAssignedTaskItem handles balance & earnings on the backend atomically.
        // We do NOT call updateUser({balance, earnings}) here — that would fail with 403
        // because balance/earnings are admin-only PATCH fields.
        const result = await confirmAssignedTaskItem(itemId);
        const serverIdx = Number(result.progress?.taskIndex ?? result.progress?.completedCount ?? nextIdx);
        const serverEarned = Number(result.progress?.totalEarned ?? nextEarned);
        const serverBalance = result.user?.balance !== undefined ? Number(result.user.balance) : undefined;

        // Immediately update balance synchronously with taskIndex to prevent combo shortfall glitch
        if (serverBalance !== undefined) {
          setBalanceOverride(serverBalance);
          try {
            const raw = localStorage.getItem("ds_auth_user");
            if (raw) {
              const u = JSON.parse(raw);
              u.balance = serverBalance;
              if (result.user?.earnings !== undefined) u.earnings = Number(result.user.earnings);
              localStorage.setItem("ds_auth_user", JSON.stringify(u));
            }
          } catch {}
        }

        setTaskIndex(serverIdx);
        setTotalEarned(serverEarned);

        // Trigger AuthContext to re-fetch the user from the server so UI balance updates globally
        window.dispatchEvent(new CustomEvent("ds:data-changed", {
          detail: { collection: "users", id: userId },
        }));
      } else {
        setTaskIndex(nextIdx);
        setTotalEarned(nextEarned);
      }

      // Propagate team earnings in background (fire-and-forget)
      propagateTeamEarnings(user, commission);

      setShowModal(false);
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 2200);
    } catch (apiErr: any) {
      console.error("Task confirmation error:", apiErr);
      const errMsg = String(apiErr?.message || "Failed to confirm task. Please try again.");
      if (errMsg.toLowerCase().includes("balance") || errMsg.toLowerCase().includes("deposit")) {
        setShowModal(false);
        setShowDepositModal(true);
      } else {
        alert(errMsg);
      }
    } finally {
      setProcessing(false);
      refetchAssignedTaskItems();
      refetchOrders();
    }
  }

  const progressPct = Math.min((taskIndex / ADS_PER_SESSION) * 100, 100);
  const waitingForInitialData =
    !userId ||
    settingsLoading ||
    activeSessionLoading ||
    ordersLoading ||
    adCatalogLoading ||
    customAdDocsLoading ||
    rowOverrideDocsLoading ||
    firebaseProgressLoading;
  const hasHydrated = Boolean(userId) && hydratedUserId === userId;

  useEffect(() => {
    if (userId && !waitingForInitialData) {
      setHydratedUserId(userId);
    }
  }, [userId, waitingForInitialData]);

  const isHydrating = !hasHydrated;

  /* ── Header Summary Card (Universal at top of all states) ── */
  const renderHeaderBanner = () => (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white p-5 sm:p-6 shadow-xl border border-white/10">
      {/* Decorative ambient orbs */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Platform & Session Tag */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {taskPlatformName} Official
            </span>
            {effectiveCode && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/30 text-purple-200 text-xs font-mono font-bold border border-purple-400/20">
                Code {effectiveCode}
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {taskPlatformName} Task Workspace
          </h2>
        </div>

        {/* Right: Account Balance & Quick Link */}
        <div className="flex items-center gap-3 bg-white/10 border border-white/15 px-4 py-2.5 rounded-2xl backdrop-blur-md self-start sm:self-auto">
          <div className="w-10 h-10 rounded-xl bg-purple-500/30 flex items-center justify-center text-purple-200">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-white/70 font-medium">Account Balance</p>
            <p className="text-lg font-black text-white tracking-tight">
              {userBalance.toFixed(2)} <span className="text-xs font-semibold text-purple-200">USDT</span>
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar in banner when session active */}
      {effectiveCode && !isAllDone && (
        <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-white/80">Batch Progress</span>
            <span className="text-amber-300 font-mono">{Math.min(taskIndex, ADS_PER_SESSION)} / {ADS_PER_SESSION} completed</span>
          </div>
          <div className="h-2.5 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-purple-400 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/70">
            <span>Session Earnings: <strong className="text-emerald-400 font-bold">+{totalEarned.toFixed(2)} USDT</strong></span>
            <span>Target: 25 Tasks</span>
          </div>
        </div>
      )}
    </div>
  );

  /* ── Content Router for internal states ── */
  const renderBody = () => {
    if (isHydrating) {
      return <AdTaskSkeleton />;
    }

    /* Priority State: Pending / In-Review Request */
    if (pendingOrder && ["pending", "reassignment_requested"].includes(pendingOrder.status)) {
      return (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden p-6 space-y-5">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">Awaiting Task Assignment</h3>
                <span className="flex-shrink-0 text-[10px] font-extrabold uppercase tracking-wide bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> In Review
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                Your request has been submitted to the admin dispatch queue. Your 25 curated tasks will activate automatically the moment approval is granted.
              </p>
            </div>
          </div>

          {/* Request Summary Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: "Request ID", value: pendingOrder.id.slice(-8).toUpperCase(), mono: true },
              { label: "Platform", value: taskPlatformName },
              { label: "Queue Status", value: pendingOrder.status.replace(/_/g, " "), highlight: true },
              { label: "Date", value: new Date(pendingOrder.createdAt).toLocaleDateString() },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 dark:bg-gray-800/70 rounded-2xl p-3 border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">{item.label}</p>
                <p className={`text-xs font-bold truncate ${
                  item.highlight ? "text-amber-600 dark:text-amber-400 capitalize" :
                  item.mono ? "font-mono text-gray-800 dark:text-gray-200" :
                  "text-gray-800 dark:text-gray-200"
                }`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Auto refresh note */}
          <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-2xl p-3.5 text-xs text-blue-700 dark:text-blue-300">
            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
            <span>Real-time listener connected. No need to reload this screen.</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              onClick={handleCancelRequest}
              disabled={requestSubmitting}
              className="flex-1 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-60"
            >
              {requestSubmitting ? "Cancelling..." : "Cancel Request"}
            </button>
            <button
              onClick={() => navigate(backTo)}
              className="flex-1 py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
            >
              Back to Menu
            </button>
          </div>
        </div>
      );
    }

    /* State 1: No assigned code */
    if (!effectiveCode || (!group && assignedTaskItems.length === 0)) {
      if (sessionActiveRef.current) {
        return <AdTaskSkeleton />;
      }

      /* Substate B: No Active Request (Request Package Form) */
      return (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
          {/* Visual Header */}
          <div className="text-center max-w-md mx-auto space-y-2">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-purple-600/30 text-white mb-4">
              <TrendingUp className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
              No Active Task Package
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              You are currently ready on <span className="font-bold text-gray-900 dark:text-white">{taskPlatformName}</span>. Submit a one-click request below to receive your 25 high-yielding assignments from Admin dispatch.
            </p>
          </div>

          {/* Platform Tier Privilege & Psychological Perks Banner */}
          <div className="max-w-xl mx-auto rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-pink-500/10 border border-purple-200/60 dark:border-purple-800/50 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                {taskPlatformId === "aliexpress" ? "👑 AliExpress Elite Tier Perks" : taskPlatformId === "alibaba" ? "🚀 Alibaba Wholesale Tier Perks" : "⭐ Amazon Foundation Tier Perks"}
              </span>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-600 text-white shadow-sm">
                {taskPlatformId === "aliexpress" ? "12% – 20% Max Commission" : taskPlatformId === "alibaba" ? "8% – 12% Elevated Commission" : "4% – 8% Commission"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
              {taskPlatformId === "aliexpress" ? (
                <>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>High-Ticket Orders:</strong> Luxury & tech products with maximum USDT commission payouts.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Peak Multiplier:</strong> Highest earning potential per grab across all platforms.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>VIP Priority Queue:</strong> Rapid admin approval and instant wallet payouts.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Top Tier Status:</strong> Maximum profit margin on all 25 daily task submissions.</span>
                  </div>
                </>
              ) : taskPlatformId === "alibaba" ? (
                <>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Wholesale Bulk Orders:</strong> Higher ticket value producing 2x commission returns.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Doubled Profit Base:</strong> 8% to 12% commission on each completed grab.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Scale Wallet Fast:</strong> Reach $900 balance to unlock AliExpress Elite max tier!</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Verified Suppliers:</strong> High-reliability product rating assignments.</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>25 Curated Retail Deals:</strong> Easy & quick consumer product rating tasks.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Instant Task Credit:</strong> Commission credited straight to your balance.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Next Milestone:</strong> Reach $500 balance to unlock Alibaba Wholesale 2x profit!</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Reputation Builder:</strong> Build completed task history for VIP unlocks.</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 4-Step Interactive Guide */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
            {[
              { num: "01", title: "Request Package", desc: `Submit your ${taskPlatformName} assignment request instantly.` },
              { num: "02", title: "Admin Dispatch", desc: "Admin assigns Code 201, 301, or custom high-yield package." },
              { num: "03", title: "25 Curated Tasks", desc: "High-value tasks load automatically onto your dashboard." },
              { num: "04", title: "Earn Commission", desc: "Submit each order to earn immediate USDT rewards." },
            ].map(step => (
              <div key={step.num} className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-3.5 border border-gray-100 dark:border-gray-700">
                <span className="w-7 h-7 rounded-xl bg-purple-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 shadow-sm">
                  {step.num}
                </span>
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{step.title}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="max-w-md mx-auto space-y-2.5 pt-2">
            <button
              onClick={() => handleRequestTask()}
              disabled={requestSubmitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-base active:scale-95 transition-all shadow-xl shadow-purple-600/25 flex items-center justify-center gap-2.5 disabled:opacity-60"
            >
              {requestSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ClipboardList className="w-5 h-5" />}
              <span>{requestSubmitting ? "Submitting Request..." : "Request New Task Package"}</span>
            </button>
            <button
              onClick={() => navigate(backTo)}
              className="w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition-all"
            >
              Back to Menu
            </button>
          </div>
        </div>
      );
    }

    /* State 2: Amazon Gate / Minimum Balance Restriction */
    if (amazonGate.required && userBalance < amazonGate.minBalance) {
      return (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-amber-200 dark:border-amber-800/40 p-6 sm:p-8 text-center space-y-5 max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-md">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Minimum Deposit Required</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              A minimum balance of ${amazonGate.minBalance.toFixed(2)} USDT is required to operate {taskPlatformName} tasks.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 space-y-2 border border-gray-100 dark:border-gray-700 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Required Balance:</span>
              <span className="font-bold text-gray-900 dark:text-white">${amazonGate.minBalance.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Current Balance:</span>
              <span className="font-bold text-gray-900 dark:text-white">${userBalance.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 font-bold">
              <span className="text-red-500">Shortfall:</span>
              <span className="text-red-500">-${(amazonGate.minBalance - userBalance).toFixed(2)} USDT</span>
            </div>
          </div>

          <button
            onClick={() => {
              sessionStorage.setItem("ds_deposit_return_path", "/dashboard/ad-task");
              navigate("/dashboard/deposit");
            }}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-sm active:scale-95 transition-all shadow-lg shadow-amber-500/20"
          >
            Deposit Now to Unlock
          </button>
        </div>
      );
    }

    /* State 3: All Tasks Finished Celebration */
    if (isAllDone) {
      return (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 text-center space-y-5 max-w-md mx-auto shadow-sm animate-in zoom-in-95 duration-300">
          {showConfetti && <Confetti />}
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/20">
            <CheckCircle className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white">All 25 Tasks Completed!</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              You have completed all assignments for Code {group?.code ?? effectiveCode}.
            </p>
          </div>
          <div className="inline-block bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-5 py-2.5 rounded-2xl">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Total Profit Earned</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-300">+{totalEarned.toFixed(2)} USDT</p>
          </div>
          <div className="space-y-2 pt-2">
            <button
              onClick={() => handleRequestTask(true)}
              disabled={requestSubmitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-sm active:scale-95 transition-all shadow-lg"
            >
              {requestSubmitting ? "Requesting Next..." : "Request Next Task Package"}
            </button>
            <button
              onClick={() => navigate(backTo)}
              className="w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }

    /* State 4: Active Task Showcase ("Grab Order") */
    return (
      <div className="space-y-4">
        {/* Analytics 6-Card Matrix */}
        {currentAd && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-3 border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tasks Completed</p>
                <p className="text-base font-black text-gray-900 dark:text-white mt-0.5">
                  {Math.min(taskIndex, ADS_PER_SESSION)} <span className="text-xs font-normal text-gray-400">/{ADS_PER_SESSION}</span>
                </p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-3 border border-emerald-100 dark:border-emerald-800/40">
                <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Total Earned</p>
                <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  +{totalEarned.toFixed(2)} USDT
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-3 border border-purple-100 dark:border-purple-800/40">
                <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Task Commission</p>
                <p className="text-base font-black text-purple-600 dark:text-purple-400 mt-0.5">
                  +{currentAd.commissionAmount.toFixed(2)} USDT
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-3 border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Order Cost</p>
                <p className="text-base font-black text-gray-900 dark:text-white mt-0.5">
                  {currentAd.amount.toFixed(2)} USDT
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-3 border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Required Amount</p>
                <p className="text-base font-black text-gray-900 dark:text-white mt-0.5">
                  {requiredAmount.toFixed(2)} USDT
                </p>
              </div>
              <div className={`rounded-2xl p-3 border ${canAfford ? "bg-gray-50 dark:bg-gray-800/60 border-gray-100 dark:border-gray-700" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${canAfford ? "text-gray-500 dark:text-gray-400" : "text-red-500"}`}>Your Balance</p>
                <p className={`text-base font-black mt-0.5 ${canAfford ? "text-gray-900 dark:text-white" : "text-red-600"}`}>
                  {userBalance.toFixed(2)} USDT
                </p>
              </div>
            </div>

            {!canAfford && (
              <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-2xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span>Deposit required to grab this order (Short by <strong>${Math.max(0, requiredAmount - userBalance).toFixed(2)}</strong>).</span>
                </div>
                <button
                  onClick={() => navigate("/dashboard/deposit")}
                  className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold shadow-sm flex-shrink-0 hover:bg-red-700"
                >
                  Deposit
                </button>
              </div>
            )}
          </div>
        )}

        {/* Grab Order Product Card */}
        {currentAd && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-md overflow-hidden max-w-lg mx-auto">
            {justCompleted && (
              <div className="bg-emerald-50 dark:bg-emerald-900/30 border-b border-emerald-200 dark:border-emerald-800 px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Task Submitted! Profit added to your balance.</span>
              </div>
            )}

            {/* Product Image Section */}
            <div className="relative h-56 bg-gray-100 dark:bg-gray-800 overflow-hidden group">
              <img
                src={currentAd.contentUrl}
                alt={currentAd.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={e => {
                  (e.target as HTMLImageElement).src =
                    `https://placehold.co/400x200/8A4FFF/white?text=Task+${taskIndex + 1}`;
                }}
              />
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="bg-black/70 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full font-bold">
                  Task #{taskIndex + 1} of {ADS_PER_SESSION}
                </span>
                <span className="bg-purple-600/90 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-full font-semibold uppercase">
                  {taskPlatformName}
                </span>
              </div>
            </div>

            {/* Product Info & Action */}
            <div className="p-5 sm:p-6 space-y-4">
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug">
                  {currentAd.title}
                </h4>
              </div>

              <div className="flex items-center justify-between py-2 border-y border-gray-100 dark:border-gray-800 text-xs">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Order Amount</span>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{currentAd.amount.toFixed(2)} USDT</p>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 dark:text-gray-400">Your Commission</span>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">+{currentAd.commissionAmount.toFixed(2)} USDT</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!canAfford) {
                    setShowDepositModal(true);
                  } else {
                    setShowModal(true);
                  }
                }}
                disabled={processing}
                style={{ backgroundColor: canAfford ? "#8A4FFF" : "#dc2626", color: "#FFFFFF" }}
                className={`w-full py-4 rounded-2xl font-extrabold text-base active:scale-95 transition-all flex items-center justify-center gap-2.5 shadow-xl ${
                  canAfford
                    ? "bg-[#8A4FFF] hover:bg-purple-700 text-white shadow-purple-600/25 cursor-pointer"
                    : "bg-red-600 hover:bg-red-700 text-white shadow-red-600/25 cursor-pointer"
                }`}
              >
                {canAfford ? (
                  <>
                    <ShoppingCart className="w-5 h-5 text-white" />
                    <span className="text-white font-bold">Grab The Order</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-white" />
                    <span className="text-white font-bold">
                      {depositRestricted ? "Combo Order — Deposit Required" : "Deposit Required to Grab Order"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <SuspensionOverlay />
      <MaintenanceOverlay />
      <DashboardLayout showBack title={`${taskPlatformName} Tasks`} backTo={backTo}>
        <div className="max-w-3xl mx-auto px-4 py-4 md:py-6 space-y-4">
          {renderHeaderBanner()}
          {renderBody()}
        </div>
      </DashboardLayout>

      {/* Order Confirmation Modal */}
      {showModal && currentAd && (
        <OrderModal
          ad={currentAd}
          adNum={taskIndex + 1}
          total={ADS_PER_SESSION}
          processing={processing}
          onConfirm={handleConfirm}
          onClose={() => !processing && setShowModal(false)}
        />
      )}

      {/* Combo / Required Deposit Modal */}
      {showDepositModal && currentAd && (
        <ComboDepositModal
          ad={currentAd}
          adNum={taskIndex + 1}
          total={ADS_PER_SESSION}
          userBalance={userBalance}
          requiredAmount={requiredAmount}
          onClose={() => setShowDepositModal(false)}
          onDeposit={() => {
            sessionStorage.setItem("ds_deposit_return_path", "/dashboard/ad-task");
            navigate("/dashboard/deposit");
          }}
        />
      )}

      {/* Gallery Lightbox */}
      {lightboxIndex !== null && (
        <AdLightbox ads={ads} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  );
}
