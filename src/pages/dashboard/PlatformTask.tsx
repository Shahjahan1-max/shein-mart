import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, ChevronRight, X, ShoppingCart, Loader2, CheckCircle,
  AlertTriangle, Wallet, Lock, ClipboardList, PlayCircle, Clock,
} from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { LangDropdown, ThemeBtn } from "../../components/DashboardTopBar";
import { SuspensionOverlay } from "../../components/SuspensionOverlay";
import { MaintenanceOverlay } from "../../components/MaintenanceOverlay";
import { PLATFORMS_DATA, type Platform } from "../../data/platformsData";
import { useAuth } from "../../contexts/AuthContext";
import { useSuspensionGuard } from "../../hooks/useSuspensionGuard";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { propagateTeamEarnings } from "../../data/teamUtils";
import { upsertTaskSessionProgress } from "../../lib/taskSessionApi";
import { usePlatformsCatalog, useProductsCatalog } from "../../hooks/useCatalogs";
import { DEFAULT_SETTINGS, type OrderRecord } from "../../data/adminData";
import { createOrder, deleteOrder, saveGenericFirebaseDoc, updateOrder, useActiveTaskSession, useAdAssignments, useFirebaseCollection, useFirebaseDoc, useOrders, useSettings, useUserPackageControls } from "../../hooks/useApi";

const TOTAL_TASKS = 25;

/* ─── Product types ───────────────────────────────────────────── */
interface ProductEntry {
  id: string;
  title: string;
  price: string;
  compare_price?: string;
  image: string;
  product_url?: string;
  platform: string;
  rating?: number;
  reviews?: number;
  description?: string;
}

interface ProductCategory {
  category_name: string;
  products: ProductEntry[];
}

interface PlatformProducts {
  name: string;
  url?: string;
  logo?: string;
  color?: string;
  categories: ProductCategory[];
}

interface ProductsJson {
  platform: string;
  version: string;
  platforms: PlatformProducts[];
}

/* ─── Task state ──────────────────────────────────────────────── */
interface TaskState {
  tasksDone: number;
  completed: boolean;
  totalEarned: number;
}

// Stable fallback — defined outside the component so its reference never
// changes between renders, preventing the useFirebaseDoc infinite loop.
const TASK_STATE_FALLBACK: TaskState = { tasksDone: 0, completed: false, totalEarned: 0 };

function platformProgressId(platformId: string, userId: string): string {
  return `${userId}_${platformId}`;
}

function saveTaskState(platformId: string, userId: string, state: TaskState) {
  return Promise.all([
    saveGenericFirebaseDoc("platformProgress", platformProgressId(platformId, userId), {
      id: platformProgressId(platformId, userId),
      userId,
      platformId,
      ...state,
    }),
    upsertTaskSessionProgress({
      userId,
      taskCode: platformId,
      currentPlatform: platformId as "amazon" | "alibaba" | "aliexpress",
      completedCount: state.tasksDone,
      totalTasks: TOTAL_TASKS,
      totalEarned: state.totalEarned,
      taskStatus: state.completed ? "completed" : "in_progress",
    }),
  ]);
}

/* ─── Flatten products for platform ──────────────────────────── */
function getProductsForPlatform(platformName: string, catalog: ProductsJson): ProductEntry[] {
  const typed = catalog;
  const found = typed.platforms.find(
    pl => pl.name.toLowerCase() === platformName.toLowerCase()
  );
  if (!found) return [];
  const all: ProductEntry[] = [];
  for (const cat of found.categories) {
    for (const prod of cat.products) {
      all.push(prod);
    }
  }
  return all;
}

/* ─── Parse price string ──────────────────────────────────────── */
function parsePriceNum(priceStr: string): number {
  return parseFloat(priceStr.replace(/[^0-9.]/g, "")) || 50;
}


/* ─── Insufficient Balance Screen ────────────────────────────── */
function InsufficientBalanceScreen({
  required, userBalance, commissionEarned, onDeposit,
}: {
  required: number;
  userBalance: number;
  commissionEarned: number;
  onDeposit: () => void;
}) {
  const shortfall = Math.max(0, required - userBalance);
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-red-500 to-orange-500 px-5 py-6 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Wallet className="w-7 h-7 text-slate-900 dark:text-white" />
          </div>
          <p className="text-slate-900 dark:text-white font-extrabold text-lg">Insufficient Balance</p>
          <p className="text-white/80 text-sm mt-1">
            Your account is short by{" "}
            <span className="font-black text-yellow-200">${shortfall.toFixed(2)}</span>
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-gray-400">Order Amount Required</span>
              <span className="font-bold text-red-600">{required.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-gray-400">Your Current Balance</span>
              <span className="font-bold text-gray-900 dark:text-white">{userBalance.toFixed(2)} USDT</span>
            </div>
            <div className="border-t border-red-200 dark:border-red-800 pt-2 flex justify-between text-sm">
              <span className="text-slate-600 dark:text-gray-400 font-semibold">Shortfall</span>
              <span className="font-extrabold text-red-600">-{shortfall.toFixed(2)} USDT</span>
            </div>
            {commissionEarned > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-gray-400">Commission You'll Earn</span>
                <span className="font-bold text-green-600">+{commissionEarned.toFixed(2)} USDT</span>
              </div>
            )}
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Please deposit at least <strong>{shortfall.toFixed(2)} USDT</strong>.
              Your task will unlock automatically once your balance is updated by the admin.
            </p>
          </div>
          <button
            onClick={onDeposit}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-base active:scale-95 transition-transform"
          >
            Deposit Now to Unlock
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Grab modal ──────────────────────────────────────────────── */
interface GrabModalProps {
  product: ProductEntry;
  taskNum: number;
  totalTasks: number;
  commission: number;
  userBalance: number;
  processing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function GrabModal({ product, taskNum, totalTasks, commission, userBalance, processing, onConfirm, onClose }: GrabModalProps) {
  const priceNum = parsePriceNum(product.price);
  const dollarCommission = priceNum > 0 ? ((commission / 100) * priceNum).toFixed(2) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!processing ? onClose : undefined}
      />
      {/* Scrollable modal — max 90vh so button is always reachable */}
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 sm:mx-4 flex flex-col max-h-[90vh]">
        {/* Product Image — fixed, does not scroll */}
        <div className="relative flex-shrink-0 h-52 bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-t-3xl sm:rounded-t-3xl overflow-hidden">
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full"
            style={{ objectFit: "contain" }}
            onError={e => {
              (e.target as HTMLImageElement).src =
                `https://placehold.co/400x300/8A4FFF/white?text=${encodeURIComponent(product.title.slice(0, 10))}`;
            }}
          />
          <div className="absolute top-3 left-3">
            <span className="bg-black/60 text-white text-xs px-2.5 py-1 rounded-full font-medium">
              Task {taskNum} of {totalTasks}
            </span>
          </div>
          {!processing && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          <p className="text-base font-bold text-gray-900 dark:text-white leading-snug">{product.title}</p>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8A4FFF] rounded-full transition-all"
                style={{ width: `${((taskNum - 1) / totalTasks) * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-gray-400 flex-shrink-0">{taskNum - 1}/{totalTasks}</span>
          </div>

          {/* Price + commission */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Order Amount</span>
              <span className="font-bold text-gray-900 dark:text-white">{product.price}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Commission Rate</span>
              <span className="font-bold text-green-600">{commission}%</span>
            </div>
            {dollarCommission !== null && (
              <div className="flex justify-between text-sm border-t border-gray-100 dark:border-gray-700 pt-1.5 mt-1">
                <span className="text-gray-500 dark:text-gray-400">You Earn</span>
                <span className="font-extrabold text-green-600 text-base">+${dollarCommission}</span>
              </div>
            )}
          </div>

          {/* Balance row */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
            <Wallet className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <span>Your balance: <strong className="text-gray-900 dark:text-white">{userBalance.toFixed(2)} USDT</strong></span>
          </div>
        </div>

        {/* Sticky confirm button — always visible at bottom */}
        <div className="flex-shrink-0 p-4 pt-0 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-b-3xl">
          <button
            onClick={onConfirm}
            disabled={processing}
            className="w-full py-3.5 rounded-xl bg-[#8A4FFF] text-white font-bold text-base active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {processing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
            ) : (
              <><ShoppingCart className="w-4 h-4" /> Confirm Order</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Stat cell ──────────────────────────────────────────────── */
function StatCell({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center py-4 px-2 ${highlight ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
      <span className={`text-sm font-bold leading-tight ${highlight ? "text-red-600" : "text-gray-800 dark:text-white"}`}>{value}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center leading-snug">{label}</span>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────── */
function PlatformTaskSkeleton({ platformName, onBack }: { platformName: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 flex flex-col">
      <MaintenanceOverlay />
      <div className="bg-[#8A4FFF]">
        <div className="flex items-center px-3 pt-3 pb-4 gap-2">
          <button onClick={onBack} className="p-1.5 rounded-lg text-white/80 hover:text-white transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold text-slate-900 dark:text-white">{platformName}</h1>
          <div className="w-16 flex-shrink-0" />
        </div>
        <div className="px-5 pb-10 pt-1">
          <div className="h-4 w-28 rounded bg-white/30 animate-pulse" />
          <div className="h-8 w-40 rounded bg-white/40 animate-pulse mt-2" />
        </div>
      </div>
      <div className="px-4 -mt-6 relative z-10 space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-md overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-y divide-gray-100 dark:divide-gray-800">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="h-3 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                <div className="h-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="px-4 pb-4 pt-1">
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 space-y-3">
          <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="h-12 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

interface Props { platformId: string; }

export function PlatformTask({ platformId }: Props) {
  const [, navigate] = useLocation();
  const { user, updateUser } = useAuth();
  const isSuspended = useSuspensionGuard();

  const { data: platformsCatalog, loading: platformsCatalogLoading } = usePlatformsCatalog();
  const { data: productsCatalog, loading: productsCatalogLoading } = useProductsCatalog();
  const { data: platformOverrides = [], loading: platformOverridesLoading } = useFirebaseCollection<Partial<Platform> & { id: string }>("platformOverrides");
  const platform = (platformsCatalog.platforms?.length ? platformsCatalog.platforms : PLATFORMS_DATA)
    .map(p => ({ ...p, ...(platformOverrides.find(o => o.id === p.id) ?? {}) }))
    .find(p => p.id === platformId);
  const products = getProductsForPlatform(platform?.name ?? "", productsCatalog);
  const { data: apiOrders = [], refetch: refetchOrders, loading: ordersLoading } = useOrders(user?.id);
  const { data: activeSessionResult, loading: activeSessionLoading } = useActiveTaskSession(user?.id);
  const assignedSession = activeSessionResult?.data;
  const hasAssignedCodeSession = Boolean(
    assignedSession?.taskCode &&
    !["amazon", "alibaba", "aliexpress"].includes(String(assignedSession.taskCode).toLowerCase()),
  );
  const { data: adAssignments = [], loading: adAssignmentsLoading } = useAdAssignments();
  const { data: apiSettings, loading: settingsLoading } = useSettings<typeof DEFAULT_SETTINGS>();
  const { data: packageControls = [], loading: packageControlsLoading } = useUserPackageControls();
  const settings = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;
  const { data: firebaseTaskState, loading: taskStateLoading } = useFirebaseDoc<TaskState>(
    "platformProgress",
    platformProgressId(platformId, user?.id ?? "guest"),
    TASK_STATE_FALLBACK,
  );

  const [taskState, setTaskState] = useState<TaskState>(TASK_STATE_FALLBACK);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  useBodyScrollLock(showModal);

  useEffect(() => {
    setTaskState(firebaseTaskState ?? TASK_STATE_FALLBACK);
  }, [firebaseTaskState, platformId, user?.id]);

  useEffect(() => {
    if (hasAssignedCodeSession) {
      navigate("/dashboard/ad-task");
    }
  }, [hasAssignedCodeSession, navigate]);

  /* ── Order status (controlled task execution) ─────────────── */
  const [orderRecord, setOrderRecord] = useState<OrderRecord | null>(null);
  const orderRef = useRef(orderRecord);
  orderRef.current = orderRecord;

  /* ── Task moved to another platform by admin ──────────────── */
  const [movedOrder, setMovedOrder] = useState<OrderRecord | null>(null);

  /* ── Active task on a different platform (cross-platform block) */
  const [crossOrder, setCrossOrder] = useState<OrderRecord | null>(null);

  useEffect(() => {
    function syncOrder() {
      if (!user) return;
      const latest = (apiOrders.find(
        o => o.userId === user.id && o.platformId === platformId && o.status !== "completed"
      ) as OrderRecord | undefined) ?? null;
      if (JSON.stringify(latest) !== JSON.stringify(orderRef.current)) {
        setOrderRecord(latest);
        /* If admin approved a re-assignment, the order flips to "assigned".
           Reset the task state from Firebase so the user can start fresh. */
        if (latest?.status === "assigned" && orderRef.current?.status === "reassignment_requested") {
          setTaskState(firebaseTaskState ?? TASK_STATE_FALLBACK);
        }
      }
      /* Sync moved-away and cross-platform state */
      setMovedOrder((apiOrders.find(
        o => o.userId === user.id && o.movedFromPlatform === platformId && o.status !== "completed"
      ) as OrderRecord | undefined) ?? null);
      setCrossOrder((apiOrders.find(
        o => o.userId === user.id && o.platformId !== platformId && ["pending", "assigned", "in_progress", "reassignment_requested"].includes(o.status)
      ) as OrderRecord | undefined) ?? null);
    }
    syncOrder();
    // Reduced from 2s to 5s — event listeners handle instant admin updates
    const timer = undefined;
    window.addEventListener("ds:data-changed", syncOrder);
    window.addEventListener("storage", syncOrder);
    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener("ds:data-changed", syncOrder);
      window.removeEventListener("storage", syncOrder);
    };
  }, [apiOrders, firebaseTaskState, user, platformId]);

  /* ── Commission: locked at assignment time, or current admin setting ─
     Frontend always reads from backend — no hardcoded fallbacks.         */
  const getCommission = () => {
    const override = platformOverrides.find(o => o.id === platformId) as { commission?: number } | undefined;
    if (typeof override?.commission === "number") return override.commission;
    if (platformId === "amazon") return settings.amazonCommissionRate ?? 4;
    if (platformId === "alibaba") return settings.alibabaCommissionRate ?? 8;
    if (platformId === "aliexpress") return settings.aliexpressCommissionRate ?? 12;
    return 4;
  };
  const [commission, setCommission] = useState<number>(() => getCommission());
  useEffect(() => {
    function syncCommission() {
      const locked = orderRef.current?.commissionRate;
      setCommission(locked ?? getCommission());
    }
    syncCommission();
    // Reduced from 2s to 10s — commission rarely changes mid-session
    const timer = setInterval(syncCommission, 10_000);
    window.addEventListener("ds:data-changed", syncCommission);
    window.addEventListener("storage", syncCommission);
    return () => {
      clearInterval(timer);
      window.removeEventListener("ds:data-changed", syncCommission);
      window.removeEventListener("storage", syncCommission);
    };
  }, [platformId, platformOverrides, settings]);

  const balance = user?.balance ?? 0;

  const currentProduct = products.length > 0
    ? products[taskState.tasksDone % products.length]
    : null;

  /* Balance check derived from current product */
  const currentPriceNum = currentProduct ? parsePriceNum(currentProduct.price) : 0;
  const currentCommission = currentPriceNum > 0 ? (commission / 100) * currentPriceNum : 0;
  const canAfford = taskState.completed ? true : (currentProduct ? balance >= currentPriceNum : false);
  const shortfall = !canAfford && currentProduct ? Math.max(0, currentPriceNum - balance) : 0;

  const progressPct = Math.min((taskState.tasksDone / TOTAL_TASKS) * 100, 100);

  const isHydrating =
    !user ||
    platformsCatalogLoading ||
    productsCatalogLoading ||
    platformOverridesLoading ||
    ordersLoading ||
    activeSessionLoading ||
    adAssignmentsLoading ||
    settingsLoading ||
    packageControlsLoading ||
    taskStateLoading;
  const hydrationKey = user?.id ? `${user.id}:${platformId}` : "";
  const waitingForInitialData = isHydrating;
  const hasHydrated = Boolean(hydrationKey) && hydratedUserId === hydrationKey;

  useEffect(() => {
    if (hydrationKey && !waitingForInitialData) {
      setHydratedUserId(hydrationKey);
    }
  }, [hydrationKey, waitingForInitialData]);

  if (!hasHydrated) {
    return (
      <PlatformTaskSkeleton
        platformName={platform?.name ?? "Task"}
        onBack={() => navigate("/dashboard/menu")}
      />
    );
  }

  if (hasAssignedCodeSession) {
    return (
      <PlatformTaskSkeleton
        platformName={platform?.name ?? "Task"}
        onBack={() => navigate("/dashboard/menu")}
      />
    );
  }

  if (!platform) {
    return (
      <DashboardLayout showBack title="Platform Tasks" backTo="/dashboard/menu">
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Platform not found.</p>
          <button
            onClick={() => navigate("/dashboard/menu")}
            className="text-purple-600 font-semibold underline"
          >
            Back to Menu
          </button>
        </div>
      </DashboardLayout>
    );
  }

  /* ── Platform access guard — blocks URL-based bypass of lock ── */
  const activePlatformId = !settings.bandSwitchingEnabled
    ? "amazon"
    : balance >= (settings.aliexpressBandMin ?? 900)
      ? "aliexpress"
      : balance >= (settings.alibabaBandMin ?? 500)
        ? "alibaba"
        : "amazon";
  const packageControl = packageControls.find(item => item.userId === user?.id);
  const platformUnlocked = platformId === activePlatformId || Boolean(packageControl?.codes && platformId in packageControl.codes);

  if (!platformUnlocked) {
    return (
      <DashboardLayout showBack title={`${platform.name} (Locked)`} backTo="/dashboard/menu">
        <div className="flex flex-col items-center justify-center py-16 gap-4 px-6 text-center max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Lock className="w-8 h-8 text-slate-500 dark:text-gray-400" />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-lg font-bold text-gray-900 dark:text-white">{platform.name} is Locked</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
              Increase your balance or commission rate to unlock this platform.
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard/menu")}
            className="px-6 py-2.5 rounded-xl bg-[#8A4FFF] text-white font-semibold text-sm active:scale-95 transition-transform"
          >
            Back to Menu
          </button>
        </div>
      </DashboardLayout>
    );
  }

  /* ── Task moved to another platform — full-page redirect ──────── */
  if (movedOrder) {
    return (
      <DashboardLayout showBack title={platform.name} backTo="/dashboard/menu">
        {isSuspended && <SuspensionOverlay />}
        <MaintenanceOverlay />
        <div className="flex flex-col items-center justify-center py-16 px-6 gap-5 max-w-sm mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shadow-sm">
            <ArrowRight className="w-8 h-8 text-blue-600 dark:text-blue-300" />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-lg font-bold text-gray-900 dark:text-white">Task Moved</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
              👉 This task is now available in{" "}
              <strong className="text-blue-600 dark:text-blue-400">{movedOrder.platformName}</strong>.
              Please continue there.
            </p>
          </div>
          <button
            onClick={() => navigate(`/dashboard/menu/${movedOrder.platformId}`)}
            className="w-full max-w-xs py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            Continue on {movedOrder.platformName}
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/dashboard/menu")}
            className="w-full max-w-xs py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm font-medium"
          >
            Back to Menu
          </button>
        </div>
      </DashboardLayout>
    );
  }

  /* ── Active task on a different platform — full-page redirect ──── */
  if (crossOrder) {
    return (
      <DashboardLayout showBack title={platform.name} backTo="/dashboard/menu">
        {isSuspended && <SuspensionOverlay />}
        <MaintenanceOverlay />
        <div className="flex flex-col items-center justify-center py-16 px-6 gap-5 max-w-sm mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shadow-sm">
            <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-300" />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              Task Available on {crossOrder.platformName}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
              👉 This task is available in{" "}
              <strong className="text-amber-600 dark:text-amber-400">{crossOrder.platformName}</strong>.
              Please continue there.
            </p>
          </div>
          <button
            onClick={() => navigate(`/dashboard/menu/${crossOrder.platformId}`)}
            className="w-full max-w-xs py-3.5 rounded-xl bg-amber-500 text-white font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            Continue on {crossOrder.platformName}
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/dashboard/menu")}
            className="w-full max-w-xs py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm font-medium"
          >
            Back to Menu
          </button>
        </div>
      </DashboardLayout>
    );
  }

  async function handleConfirm() {
    if (!currentProduct || !user) return;
    setProcessing(true);
    try {
      const priceNum = parsePriceNum(currentProduct.price);
      const earned = (commission / 100) * priceNum;
      const newDone = taskState.tasksDone + 1;
      const isCompleted = newDone >= TOTAL_TASKS;
      const next: TaskState = {
        tasksDone: newDone,
        completed: isCompleted,
        totalEarned: taskState.totalEarned + earned,
      };

      setTaskState(next);
      await saveTaskState(platformId, user.id, next);

      /* Mark order as completed when all platform tasks are finished */
      const currentOrder = orderRef.current;
      if (isCompleted && currentOrder && currentOrder.status === "in_progress") {
        await updateOrder(currentOrder.id, { status: "completed", completedAt: new Date().toISOString() });
        refetchOrders();
        setOrderRecord(null);
      }

      await updateUser({ balance: (user.balance ?? 0) + earned, earnings: (user.earnings ?? 0) + earned });
      propagateTeamEarnings(user, earned);
      setShowModal(false);
    } catch (error) {
      console.error("Failed to save task progress:", error);
    } finally {
      setProcessing(false);
    }
  }

  async function handleGrab() {
    if (taskState.completed) return;
    /* Cross-platform execution blocked — UI already shows the redirect message */
    if (crossOrder) return;

    const order = orderRef.current;

    /* ── Admin has already assigned this order ─────────────────
       Priority: show the task. Balance gate deferred to deposit. */
    if (order?.status === "assigned") {
      if (!canAfford) {
        sessionStorage.setItem("ds_deposit_return_path", `/dashboard/menu/${platformId}`);
        navigate("/dashboard/deposit");
        return;
      }
      await updateOrder(order.id, { status: "in_progress" });
      refetchOrders();
      setOrderRecord(prev => prev ? { ...prev, status: "in_progress" } : prev);
      setShowModal(true);
      return;
    }

    /* ── Order already in progress ─────────────────────────── */
    if (order?.status === "in_progress") {
      if (!canAfford) {
        sessionStorage.setItem("ds_deposit_return_path", `/dashboard/menu/${platformId}`);
        navigate("/dashboard/deposit");
        return;
      }
      setShowModal(true);
      return;
    }

    /* ── No active order → balance must be sufficient to request ─ */
    if (!canAfford) {
      sessionStorage.setItem("ds_deposit_return_path", `/dashboard/menu/${platformId}`);
      navigate("/dashboard/deposit");
      return;
    }

    /* No order yet (or previously completed) → create pending */
    if (!order || order.status === "completed") {
      if (user && platform) {
        const newOrder = await createOrder({
          id: `ord-${Date.now()}`,
          userId: user.id,
          userName: user.name,
          platformId,
          platformName: platform.name,
          status: "pending",
          createdAt: new Date().toISOString(),
        });
        setOrderRecord(newOrder as OrderRecord);
        refetchOrders();
      }
      return;
    }

    /* Still pending → do nothing, UI shows spinner */
    if (order.status === "pending") return;
  }

  const stats: Array<{ value: string; label: string; highlight?: boolean }> = [
    { value: `${taskState.tasksDone} / ${TOTAL_TASKS}`,                        label: "Completed"        },
    { value: `$${taskState.totalEarned.toFixed(2)}`,                           label: "Total Earned"     },
    { value: `${commission}%`,                                                 label: "Commission"       },
    { value: currentProduct ? currentProduct.price : "—",                      label: "Task Cost"        },
    { value: currentProduct ? `$${currentCommission.toFixed(2)}` : "—",        label: "Earn This Task"   },
    { value: `${balance.toFixed(2)} USDT`,                                     label: "Your Balance",    highlight: !canAfford && !taskState.completed },
  ];

  return (
    <>
      {isSuspended && <SuspensionOverlay />}
      <MaintenanceOverlay />

      {/* Grab modal — only shown when balance is sufficient and GRAB is clicked */}
      {showModal && !taskState.completed && currentProduct && canAfford && (
        <GrabModal
          product={currentProduct}
          taskNum={taskState.tasksDone + 1}
          totalTasks={TOTAL_TASKS}
          commission={commission}
          userBalance={balance}
          processing={processing}
          onConfirm={handleConfirm}
          onClose={() => !processing && setShowModal(false)}
        />
      )}

      <DashboardLayout showBack title={platform.name} backTo="/dashboard/menu">
        <div className="max-w-2xl mx-auto space-y-4 p-4 md:p-6 pb-8">
          {/* Header Balance Banner */}
          <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 rounded-3xl p-5 text-white shadow-md">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-xs text-white/70 font-medium">Account Balance</p>
                <p className="text-2xl font-bold text-white mt-0.5">{balance.toFixed(2)} USDT</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20 text-white backdrop-blur-md">
                {platform.name}
              </span>
            </div>
            {!canAfford && !taskState.completed && currentProduct && (
              <p className="text-red-200 text-xs mt-2 font-medium flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5" />
                Short by {shortfall.toFixed(2)} USDT — deposit to continue
              </p>
            )}
          </div>

          {/* Stats card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-y divide-gray-100 dark:divide-gray-800">
              {stats.map((stat, i) => (
                <StatCell key={i} value={stat.value} label={stat.label} highlight={stat.highlight} />
              ))}
            </div>

            {/* Progress bar */}
            <div className="px-4 pb-4 pt-2">
              <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400 mb-1.5">
                <span>Platform Progress</span>
                <span>{progressPct.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#8A4FFF] rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            {/* Inline warning when balance is insufficient */}
            {!canAfford && !taskState.completed && currentProduct && (
              <div className="mx-4 mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-3 py-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-red-700 dark:text-red-400 font-semibold">Balance insufficient for this order</p>
                  <p className="text-red-600 dark:text-red-300 mt-0.5">
                    Required: <strong>{currentPriceNum.toFixed(2)} USDT</strong> ·
                    Balance: <strong>{balance.toFixed(2)} USDT</strong> ·
                    Short by: <strong>{shortfall.toFixed(2)} USDT</strong>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action area */}
          {taskState.completed ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-green-200 dark:border-green-800 overflow-hidden shadow-sm">
              <div className="bg-green-50 dark:bg-green-900/20 px-4 py-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="text-lg font-bold text-green-800 dark:text-green-300">Platform Complete!</p>
                <p className="text-green-600 dark:text-green-400 text-sm mt-1">All {TOTAL_TASKS} tasks finished</p>
              </div>
              <div className="p-4 space-y-3">
                {orderRecord?.status === "reassignment_requested" ? (
                  <button
                    disabled
                    className="w-full py-3.5 rounded-2xl bg-yellow-400 text-yellow-900 text-sm font-black flex items-center justify-center gap-2 opacity-90 cursor-not-allowed"
                  >
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    Request Sent — Awaiting Approval
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (!user || !platform) return;
                      const adCode = adAssignments.find(item => item.userId === user.id)?.code ?? null;
                      const req = await createOrder({
                        id: `req-${Date.now()}`,
                        userId: user.id,
                        userName: user.name,
                        platformId,
                        platformName: platform.name,
                        requestedPlatform: platformId,
                        requestedPlatformName: platform.name,
                        status: "reassignment_requested",
                        createdAt: new Date().toISOString(),
                        previousAdCodeId: adCode ?? undefined,
                      });
                      setOrderRecord(req as OrderRecord);
                      refetchOrders();
                    }}
                    className="w-full py-3.5 rounded-2xl bg-[#8A4FFF] hover:bg-purple-700 text-white font-bold text-sm active:scale-95 transition-all shadow-md"
                  >
                    Request New Task
                  </button>
                )}
                <button onClick={() => navigate("/dashboard/menu")} className="w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800">
                  Back to Menu
                </button>
              </div>
            </div>
          ) : orderRecord?.status === "pending" ? (
            <div className="w-full space-y-3">
              <div className="w-full py-3.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center justify-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
                <span className="text-amber-800 dark:text-amber-300 font-semibold text-sm">Awaiting order assignment…</span>
              </div>
              <p className="text-center text-xs text-slate-500 dark:text-gray-400 px-2">
                Your order is being reviewed by the admin. This page updates automatically when assigned.
              </p>
              <button
                onClick={async () => {
                  if (orderRecord) {
                    await deleteOrder(orderRecord.id);
                    setOrderRecord(null);
                    refetchOrders();
                  }
                }}
                className="w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition-all"
              >
                Cancel & Retry Later
              </button>
            </div>
          ) : orderRecord?.status === "assigned" ? (
            <div className="w-full space-y-3">
              <div className="w-full px-4 py-3 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-center gap-3">
                <ClipboardList className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-green-800 dark:text-green-200 text-sm font-semibold">Order Assigned!</p>
                  <p className="text-green-600 dark:text-green-400 text-xs">Your order is ready. Tap Start Work to begin.</p>
                </div>
              </div>
              {!canAfford && currentProduct && (
                <div className="w-full px-4 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Your balance is short by <strong>{shortfall.toFixed(2)} USDT</strong> for the first task.
                    Deposit first, then start.
                  </p>
                </div>
              )}
              <button
                onClick={handleGrab}
                className={`w-full py-4 rounded-2xl font-bold text-base shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-white ${
                  !canAfford && currentProduct
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                <PlayCircle className="w-5 h-5" />
                {!canAfford && currentProduct ? "Deposit to Start" : "Start Work"}
              </button>
            </div>
          ) : !canAfford && currentProduct && !orderRecord ? (
            <InsufficientBalanceScreen
              required={currentPriceNum}
              userBalance={balance}
              commissionEarned={currentCommission}
              onDeposit={() => {
                sessionStorage.setItem("ds_deposit_return_path", `/dashboard/menu/${platformId}`);
                navigate("/dashboard/deposit");
              }}
            />
          ) : (
            <button
              onClick={handleGrab}
              className="w-full py-4 rounded-2xl bg-[#8A4FFF] hover:bg-purple-700 text-white font-bold text-base shadow-lg active:scale-95 transition-transform"
            >
              {orderRecord?.status === "in_progress" ? "Continue Task" : "Grab The Order Immediately"}
            </button>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}
