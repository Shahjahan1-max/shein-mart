import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, RefreshCw, CheckCircle, Lock, ShoppingCart, X,
  Loader2, Clock, TrendingUp, AlertTriangle, Wallet,
} from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { SuspensionOverlay } from "../../components/SuspensionOverlay";
import { MaintenanceOverlay } from "../../components/MaintenanceOverlay";
import { getPackageByCode, isKillMode } from "../../data/packagesData";
import type { PackageTask as PkgTask } from "../../data/packagesData";
import { usePackagesCatalog } from "../../hooks/useCatalogs";
import { useAuth } from "../../contexts/AuthContext";
import { useSuspensionGuard } from "../../hooks/useSuspensionGuard";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { propagateTeamEarnings } from "../../data/teamUtils";
import { upsertTaskSessionProgress } from "../../lib/taskSessionApi";
import { type NextTaskRequest } from "../../data/nextTaskData";
import {
  saveGenericFirebaseDoc,
  saveUserPackageControl,
  useFirebaseCollection,
  useFirebaseDoc,
  useUserPackageControls,
  type ApiUserPackageControl,
} from "../../hooks/useApi";

interface Props {
  code: string;
  backTo?: string;
}

function stableOrderId(userId: string, code: string, taskId: string, taskNum: number): string {
  const raw = `${userId}:${code}:${taskId}:${taskNum}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  const token = Math.abs(hash).toString(36).toUpperCase().padStart(7, "0");
  return `${token.slice(0, 5)}-${taskId.replace(/[^a-zA-Z0-9]/g, "")}-${token.slice(-3)}`;
}

/* ── Lock point computation ─────────────────────────────────────── */
function computeLockPoints(code: number): number[] {
  const suffix = code % 10;
  if (suffix === 4) return []; // Kill mode: no locks

  const prefix = Math.floor(code / 100); // 3, 4, 5, 6, 7
  if (prefix <= 5) {
    const lockAt = 17 + (code % 6);
    return [lockAt];
  }
  return [5, 12, 20];
}

/* ── Platform mapping ───────────────────────────────────────────── */
/**
 * Derive the platform for a package code using the admin-assigned code mapping
 * stored in ds_admin_user_codes_{userId}. Falls back to numeric prefix ranges
 * only when no admin assignment exists.
 * Spec fix: use admin-assigned codes, not hardcoded numeric ranges.
 */
function getPlatformForCode(
  code: number,
  codes?: ApiUserPackageControl["codes"],
): "amazon" | "aliexpress" | "alibaba" {
  if (codes) {
    if (codes.amazon === code) return "amazon";
    if (codes.aliexpress === code) return "aliexpress";
    if (codes.alibaba === code) return "alibaba";
  }
  /* Fallback: numeric prefix ranges aligned with commission band tiers
     2xx-4xx  Starter/Bronze/Silver → Amazon   (4% commission band)
     5xx-6xx  Gold/Diamond          → Alibaba  (8% commission band)
     7xx+     Elite/Platinum/Royal  → AliExpress (12% commission band) */
  const n = Math.floor(code / 100);
  if (n <= 4) return "amazon";
  if (n <= 6) return "alibaba";
  return "aliexpress";
}

/* ── State persistence ──────────────────────────────────────────── */
interface PkgState {
  taskIndex: number;
  totalEarned: number;
  isLocked: boolean;
  lockPoints: number[];
  locksTriggered: number;
  loopCount: number;
  packageId: number;
  completedTaskCount: number;
  completedTaskIds: string[];
  taskStatus: "in_progress" | "locked" | "completed";
}

function getProgressId(code: string, userId: string): string {
  return `${userId}_${code}`;
}

function createInitialState(code: string): PkgState {
  const codeNum = parseInt(code, 10);
  return {
    taskIndex: 0,
    totalEarned: 0,
    isLocked: false,
    lockPoints: computeLockPoints(codeNum),
    locksTriggered: 0,
    loopCount: 0,
    packageId: codeNum,
    completedTaskCount: 0,
    completedTaskIds: [],
    taskStatus: "in_progress",
  };
}

function saveState(code: string, userId: string, s: PkgState) {
  const codeNum = parseInt(code, 10);
  const pkg = getPackageByCode(codeNum);
  return Promise.all([
    saveGenericFirebaseDoc("packageProgress", getProgressId(code, userId), {
    id: getProgressId(code, userId),
    userId,
    code,
    ...s,
    }),
    upsertTaskSessionProgress({
      userId,
      taskCode: code,
      currentPlatform: getPlatformForCode(codeNum),
      completedCount: s.completedTaskCount,
      totalTasks: pkg && isKillMode(pkg) ? Math.max(s.completedTaskCount, s.taskIndex, 25) : (pkg?.taskCount || 25),
      totalEarned: s.totalEarned,
      completedTaskIds: s.completedTaskIds,
      taskStatus: s.taskStatus,
    }),
  ]);
}

/* ── Insufficient Balance Modal ─────────────────────────────────── */
interface InsufficientBalanceModalProps {
  required: number;
  userBalance: number;
  onDeposit: () => void;
  onClose: () => void;
}

function InsufficientBalanceModal({ required, userBalance, onDeposit, onClose }: InsufficientBalanceModalProps) {
  const shortfall = Math.max(0, required - userBalance);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden z-10">
        <div className="bg-gradient-to-br from-red-500 to-orange-500 px-5 py-6 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Wallet className="w-7 h-7 text-slate-900 dark:text-white" />
          </div>
          <p className="text-slate-900 dark:text-white font-extrabold text-lg">Insufficient Balance</p>
          <p className="text-white/80 text-sm mt-1">
            Your account balance is short by{" "}
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
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Please deposit at least <strong>{shortfall.toFixed(2)} USDT</strong> to continue.
              Your task will unlock automatically once your balance is updated.
            </p>
          </div>

          <button
            onClick={onDeposit}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-base active:scale-95 transition-transform"
          >
            Deposit Now to Unlock
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Order Modal ────────────────────────────────────────────────── */
interface OrderModalProps {
  task: PkgTask;
  taskNum: number;
  totalTasks: number;
  killMode: boolean;
  orderId: string;
  processing: boolean;
  userBalance: number;
  onConfirm: () => void;
  onClose: () => void;
}

function OrderModal({ task, taskNum, totalTasks, killMode, orderId, processing, userBalance, onConfirm, onClose }: OrderModalProps) {
  const now = new Date().toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!processing ? onClose : undefined} />
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 sm:mx-4">
        {/* Product Image */}
        <div className="relative h-56 bg-gray-100 dark:bg-gray-800">
          <img
            src={task.image}
            alt={task.title}
            className="w-full h-full object-cover"
            onError={e => {
              (e.target as HTMLImageElement).src =
                `https://placehold.co/400x300/8A4FFF/white?text=${encodeURIComponent(task.title)}`;
            }}
          />
          <div className="absolute top-3 left-3">
            <span className="bg-black/60 text-white text-xs px-2.5 py-1 rounded-full font-medium">
              Task {taskNum} of {killMode ? "∞" : totalTasks}
            </span>
          </div>
          {!processing && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-gray-400">Order ID</span>
            <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{orderId}</span>
          </div>

          <div>
            <p className="text-base font-bold text-gray-900 dark:text-white leading-tight">{task.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-gray-400">
              <Clock className="w-3 h-3" /><span>{now}</span>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-gray-400">Order Amount</span>
              <span className="font-bold text-gray-900 dark:text-white">{task.orderAmount.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-gray-400">Commission</span>
              <span className="font-bold text-green-600">+{task.commission.toFixed(2)} USDT</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between text-sm">
              <span className="text-slate-600 dark:text-gray-400">Expected Income</span>
              <span className="font-bold text-[#8A4FFF]">{task.expectedIncome.toFixed(2)} USDT</span>
            </div>
          </div>

          {/* Balance row */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
            <Wallet className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <span>Your balance: <strong className="text-gray-900 dark:text-white">{userBalance.toFixed(2)} USDT</strong></span>
          </div>

          <button
            onClick={onConfirm}
            disabled={processing}
            className="w-full py-3.5 rounded-xl bg-[#8A4FFF] text-white font-bold text-base active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {processing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing Order…</>
            ) : (
              <><ShoppingCart className="w-4 h-4" /> Confirm Order</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Lock Modal ─────────────────────────────────────────────────── */
interface LockModalProps {
  task: PkgTask;
  lockNum: number;
  totalLocks: number;
  onDeposit: () => void;
}

function LockModal({ task, lockNum, totalLocks, onDeposit }: LockModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden z-10">
        <div className="bg-gradient-to-br from-red-500 to-orange-500 px-5 py-6 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7 text-slate-900 dark:text-white" />
          </div>
          <p className="text-slate-900 dark:text-white font-extrabold text-lg">Task Locked</p>
          {totalLocks > 1 && (
            <p className="text-white/80 text-xs mt-0.5">Lock {lockNum} of {totalLocks}</p>
          )}
        </div>

        <div className="p-5 space-y-4">
          <p className="text-gray-700 dark:text-gray-300 text-center text-sm leading-relaxed">
            Your account balance is insufficient to complete this task. Please deposit{" "}
            <span className="font-extrabold text-red-600">{task.orderAmount.toFixed(2)} USDT</span>{" "}
            to continue.
          </p>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-gray-400">Required Deposit</span>
              <span className="font-bold text-red-600">{task.orderAmount.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-gray-400">Commission (after)</span>
              <span className="font-bold text-green-600">+{task.commission.toFixed(2)} USDT</span>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700 dark:text-yellow-400">
              Contact support or deposit to unlock. Admin can also manually release your task.
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

/* ── Main Component ─────────────────────────────────────────────── */
export function PackageTask({ code, backTo = "/dashboard/packages" }: Props) {
  const [, navigate] = useLocation();
  const { user, updateUser } = useAuth();
  const isSuspended = useSuspensionGuard();
  const { data: packageCatalog, loading: packageCatalogLoading } = usePackagesCatalog();
  const pkg = packageCatalog.packages?.find(p => String(p.code) === String(code)) ?? getPackageByCode(code);
  const userId = user?.id ?? "guest";
  const codeNum = parseInt(code, 10);
  const killMode = pkg ? isKillMode(pkg) : false;
  const packageTasks = pkg?.tasks ?? [];
  const packageTaskCount = pkg?.taskCount ?? packageTasks.length;
  const progressId = getProgressId(code, userId);
  const initialState = createInitialState(code);
  const { data: firebaseState, loading: firebaseStateLoading } = useFirebaseDoc<PkgState>("packageProgress", progressId, initialState);
  const { data: packageControls = [], refetch: refetchPackageControls, loading: packageControlsLoading } = useUserPackageControls();
  const packageControl = packageControls.find(item => item.userId === userId);
  const { data: nextTaskRequests = [], refetch: refetchNextTaskRequests, loading: nextTaskRequestsLoading } = useFirebaseCollection<NextTaskRequest>("nextTaskRequests", [userId, codeNum]);

  const [state, setState] = useState<PkgState>(initialState);
  const [showModal, setShowModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [nextReq, setNextReq] = useState<NextTaskRequest | null>(null);
  useBodyScrollLock(showModal || showBalanceModal);
  const [backPath] = useState<string>(() => {
    const stored = sessionStorage.getItem("ds_pkg_back");
    if (stored) { sessionStorage.removeItem("ds_pkg_back"); return stored; }
    return backTo;
  });

  const userBalance = user?.balance ?? 0;

  /* Reload saved state whenever user/package changes (prevents cross-package state bleed). */
  useEffect(() => {
    setState(firebaseState ?? createInitialState(code));
  }, [firebaseState, code, userId, packageTaskCount, killMode]);

  /* Admin unlock polling */
  useEffect(() => {
    const userId = user?.id ?? "guest";
    function checkUnlock() {
      const v = packageControl?.isLocked === false ? "true" : "";
      if (v === "true" && state.isLocked) {
        if (packageControl?.unlockRequested) {
          void saveUserPackageControl(userId, { unlockRequested: false }).then(() => refetchPackageControls());
        }
        setState(prev => {
          const next = { ...prev, isLocked: false, taskStatus: "in_progress" as const };
          saveState(code, userId, next);
          return next;
        });
      }
    }
    checkUnlock();
    // Reduced from 3s to 10s — event listeners handle instant admin unlock
    const t = setInterval(checkUnlock, 10_000);
    return () => clearInterval(t);
  }, [code, packageControl, refetchPackageControls, state.isLocked, user, userId]);

  /* Next-task request sync */
  useEffect(() => {
    if (!user) return;
    function syncReq() {
      if (user) {
        const matches = nextTaskRequests
          .filter(req => req.userId === user.id && req.completedCode === codeNum)
          .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
        setNextReq(matches.at(-1) ?? null);
      }
    }
    syncReq();
    // Reduced from 4s to 10s — event listeners handle instant updates
    const t = setInterval(syncReq, 10_000);
    window.addEventListener("ds:data-changed", syncReq);
    return () => { clearInterval(t); window.removeEventListener("ds:data-changed", syncReq); };
  }, [user, codeNum, nextTaskRequests]);

  function handleRequestNewTask() {
    if (!user) return;
    const req: NextTaskRequest = {
      id: `ntr-${Date.now()}`,
      userId: user.id,
      userName: user.name ?? "User",
      completedCode: codeNum,
      requestedAt: new Date().toISOString(),
      status: "pending",
    };
    setNextReq(req);
    saveGenericFirebaseDoc("nextTaskRequests", req.id, req)
      .then(refetchNextTaskRequests)
      .catch(console.error);
  }

  const isHydrating =
    !user ||
    packageCatalogLoading ||
    firebaseStateLoading ||
    packageControlsLoading ||
    nextTaskRequestsLoading;

  if (isHydrating) {
    return (
      <DashboardLayout showBack title={`Package #${code}`} backTo={backPath}>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!pkg) {
    return (
      <DashboardLayout showBack title={`Package #${code}`} backTo={backPath}>
        <div className="flex items-center justify-center py-20 text-center px-6">
          <div>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Package not found.</p>
            <button onClick={() => navigate(backPath)} className="text-purple-600 font-semibold underline">Go Back</button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const tasks = pkg.tasks;
  const completedCount = killMode ? state.taskIndex : Math.min(state.completedTaskCount, pkg.taskCount);
  const progressPct = killMode
    ? ((state.taskIndex % pkg.taskCount) / pkg.taskCount) * 100
    : Math.min((completedCount / pkg.taskCount) * 100, 100);
  const isAllDone = !killMode && completedCount >= pkg.taskCount;
  const currentTask = tasks[state.taskIndex % tasks.length];
  const totalLocks = state.lockPoints.length;

  /* Balance check for current task */
  const canAfford = !isAllDone && currentTask ? userBalance >= currentTask.orderAmount : false;
  const shortfall = !isAllDone && currentTask ? Math.max(0, currentTask.orderAmount - userBalance) : 0;

  function handleGrab(e: React.MouseEvent) {
    e.preventDefault();
    if (isAllDone) return;
    // Lock check MUST come first — a locked task always shows LockModal regardless of balance
    if (state.isLocked) return;
    if (!canAfford) {
      setShowBalanceModal(true);
      return;
    }
    setShowModal(true);
  }

  async function handleConfirmOrder() {
    if (!currentTask || !user) return;
    setProcessing(true);
    try {
      await new Promise(r => setTimeout(r, 600));

      const pkgTaskCount = pkg!.taskCount;
      const earnedAmount = currentTask.commission;
      const newIdx = state.taskIndex + 1;
      const completedTaskNum = newIdx;
      const nextLockIdx = state.locksTriggered;
      const shouldLock = !killMode && state.lockPoints[nextLockIdx] === completedTaskNum;
      const loopReset = killMode && newIdx >= tasks.length;

      const next: PkgState = {
        ...state,
        taskIndex: loopReset ? 0 : newIdx,
        totalEarned: state.totalEarned + earnedAmount,
        isLocked: shouldLock,
        locksTriggered: shouldLock ? state.locksTriggered + 1 : state.locksTriggered,
        loopCount: loopReset ? state.loopCount + 1 : state.loopCount,
        packageId: codeNum,
        completedTaskCount: killMode
          ? newIdx
          : Math.min(state.completedTaskCount + 1, pkgTaskCount),
        completedTaskIds: killMode
          ? state.completedTaskIds
          : state.completedTaskIds.includes(currentTask.id)
            ? state.completedTaskIds
            : [...state.completedTaskIds, currentTask.id],
        taskStatus: shouldLock
          ? "locked"
          : (!killMode && newIdx >= pkgTaskCount)
            ? "completed"
            : "in_progress",
      };
      const writes: Promise<unknown>[] = [saveState(code, userId, next)];
      if (!killMode && newIdx >= pkgTaskCount) {
        const platform = getPlatformForCode(codeNum, packageControl?.codes);
        writes.push(saveGenericFirebaseDoc("platformProgress", `${userId}_${platform}`, {
          id: `${userId}_${platform}`, userId, platformId: platform, completed: true, tasksDone: pkgTaskCount, totalEarned: next.totalEarned,
        }));
      }
      await Promise.all(writes);
      await updateUser({ balance: userBalance + earnedAmount, earnings: (user.earnings ?? 0) + earnedAmount });
      propagateTeamEarnings(user, earnedAmount);
      setState(next);
      setShowModal(false);
    } catch (error) { console.error(error); } finally { setProcessing(false); }
  }

  return (
    <>
      {isSuspended && <SuspensionOverlay />}
      <MaintenanceOverlay />

      {/* Insufficient Balance Modal */}
      {showBalanceModal && !isAllDone && currentTask && (
        <InsufficientBalanceModal
          required={currentTask.orderAmount}
          userBalance={userBalance}
          onDeposit={() => {
            setShowBalanceModal(false);
            sessionStorage.setItem("ds_deposit_return_path", `/dashboard/packages/${code}`);
            navigate("/dashboard/deposit");
          }}
          onClose={() => setShowBalanceModal(false)}
        />
      )}

      {/* Order Modal */}
      {showModal && !state.isLocked && canAfford && (
        <OrderModal
          task={currentTask}
          taskNum={completedCount + 1}
          totalTasks={pkg.taskCount}
          killMode={killMode}
          orderId={stableOrderId(user?.id ?? "guest", code, currentTask.id, completedCount + 1)}
          processing={processing}
          userBalance={userBalance}
          onConfirm={handleConfirmOrder}
          onClose={() => !processing && setShowModal(false)}
        />
      )}

      {/* Lock Modal — persistent when at a lock point */}
      {state.isLocked && (
        <LockModal
          task={currentTask}
          lockNum={state.locksTriggered}
          totalLocks={totalLocks}
          onDeposit={() => {
            sessionStorage.setItem("ds_deposit_return_path", `/dashboard/packages/${code}`);
            navigate("/dashboard/deposit");
          }}
        />
      )}

      <DashboardLayout showBack title={`${killMode ? "∞ " : ""}Package #${pkg.code}`} backTo={backPath}>
        <div className="max-w-2xl mx-auto space-y-4 p-4 md:p-6 pb-8">
          {/* Header Card / Balance Banner */}
          <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 rounded-3xl p-5 text-white shadow-md">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-xs text-white/70 font-medium">Account Balance</p>
                <p className="text-xl font-bold text-white mt-0.5">{userBalance.toFixed(2)} USDT</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {killMode && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/20 text-red-200 border border-red-400/20 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Unlimited
                  </span>
                )}
                {state.isLocked && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-200 border border-yellow-400/20 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
                {!canAfford && !isAllDone && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-200 border border-orange-400/20 flex items-center gap-1">
                    <Wallet className="w-3 h-3" /> Short by {shortfall.toFixed(2)} USDT
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 dark:divide-gray-800">
              {[
                { label: "Task Progress", value: isAllDone ? "✓ Complete" : `${completedCount} / ${pkg.taskCount}` },
                { label: "Total Earned", value: `+${state.totalEarned.toFixed(2)} USDT`, green: true },
                { label: "Order Amount", value: `${currentTask.orderAmount.toFixed(2)} USDT` },
                { label: "Commission", value: `+${currentTask.commission.toFixed(2)} USDT`, green: true },
                { label: "Your Balance", value: `${userBalance.toFixed(2)} USDT`, highlight: !canAfford && !isAllDone },
                { label: killMode ? `Loop #${state.loopCount + 1}` : "Package", value: `#${pkg.code}` },
              ].map((s, i) => (
                <div key={i} className={`flex flex-col items-center py-3 px-2 ${s.highlight ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                  <span className={`text-sm font-bold ${s.green ? "text-green-600" : s.highlight ? "text-red-600" : "text-gray-800 dark:text-white"}`}>
                    {s.value}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 text-center">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="px-4 pb-4 pt-2">
              <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400 mb-1">
                <span>{killMode ? "Loop Progress" : "Progress"}</span>
                <span>{progressPct.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#8A4FFF] rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            {/* Multi-lock progress dots */}
            {totalLocks > 1 && (
              <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 dark:text-gray-400">Locks:</span>
                {state.lockPoints.map((pt, i) => (
                  <span key={i} className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    state.locksTriggered > i
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : state.isLocked && state.locksTriggered === i
                        ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-gray-100 text-slate-600 dark:text-gray-400 dark:bg-gray-800"
                  }`}>
                    {state.locksTriggered > i ? "✓" : <Lock className="w-2.5 h-2.5" />}
                    {" "}T{pt}
                  </span>
                ))}
              </div>
            )}

            {/* Insufficient balance inline warning */}
            {!canAfford && !isAllDone && !state.isLocked && currentTask && (
              <div className="mx-4 mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-red-700 dark:text-red-400 font-semibold">
                    Balance insufficient for this order
                  </p>
                  <p className="text-red-600 dark:text-red-300 mt-0.5">
                    Required: <strong>{currentTask.orderAmount.toFixed(2)} USDT</strong> ·
                    Your balance: <strong>{userBalance.toFixed(2)} USDT</strong> ·
                    Short by: <strong>{shortfall.toFixed(2)} USDT</strong>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Action Area ── */}
          <div className="mt-5 space-y-3">
            {isAllDone ? (
              <div className="bg-white dark:bg-gray-900 rounded-3xl border border-green-200 dark:border-green-800 overflow-hidden shadow-sm">
                <div className="bg-green-50 dark:bg-green-900/20 px-4 py-6 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <p className="text-lg font-bold text-green-800 dark:text-green-300">Package Complete!</p>
                  <p className="text-green-600 dark:text-green-400 text-sm mt-1">All {pkg.taskCount} tasks finished</p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 text-center">
                    <p className="text-xs text-slate-600 dark:text-gray-400 mb-1">Total Commission Earned</p>
                    <p className="text-2xl font-black text-[#8A4FFF]">+{state.totalEarned.toFixed(2)} USDT</p>
                  </div>

                  {/* Next-task request status */}
                  {nextReq?.status === "approved" && nextReq.assignedCode ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-3 text-center">
                      <p className="text-xs text-green-700 dark:text-green-400 font-semibold mb-2">
                        ✓ Next task approved — Package #{nextReq.assignedCode} assigned
                      </p>
                      <button
                        onClick={() => navigate(`/dashboard/packages/${nextReq.assignedCode}`)}
                        className="w-full py-2.5 rounded-xl bg-[#8A4FFF] text-white font-bold text-sm"
                      >
                        Go to Package #{nextReq.assignedCode}
                      </button>
                    </div>
                  ) : nextReq?.status === "rejected" ? (
                    <div className="space-y-2">
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-3 py-2 text-center">
                        <p className="text-xs text-red-600 dark:text-red-400 font-semibold">
                          Request was declined. You may submit a new request.
                        </p>
                      </div>
                      <button
                        onClick={handleRequestNewTask}
                        className="w-full py-3.5 rounded-2xl bg-[#8A4FFF] hover:bg-purple-700 text-white font-bold transition-colors"
                      >
                        Request New Task
                      </button>
                    </div>
                  ) : nextReq?.status === "pending" ? (
                    <button
                      disabled
                      className="w-full py-3.5 rounded-2xl bg-yellow-500 text-white font-bold flex items-center justify-center gap-2 opacity-80 cursor-not-allowed"
                    >
                      <Clock className="w-4 h-4" />
                      Request Pending…
                    </button>
                  ) : (
                    <button
                      onClick={handleRequestNewTask}
                      className="w-full py-3.5 rounded-2xl bg-[#8A4FFF] hover:bg-purple-700 text-white font-bold transition-colors"
                    >
                      Request New Task
                    </button>
                  )}

                  <button
                    onClick={() => navigate(backPath)}
                    className="w-full py-3.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold transition-colors"
                  >
                    Completed
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={handleGrab}
                  disabled={state.isLocked}
                  className={`w-full py-4 rounded-2xl font-bold text-base shadow-lg active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed ${
                    !canAfford
                      ? "bg-orange-500 text-white"
                      : "bg-[#8A4FFF] text-white"
                  }`}
                >
                  {state.isLocked
                    ? "🔒 Task Locked — Deposit Required"
                    : !canAfford
                      ? `⚠️ Deposit ${shortfall.toFixed(2)} USDT to Continue`
                      : "Grab The Order Immediately"}
                </button>

                {/* Kill mode: growing commission + withdraw locked */}
                {killMode && (
                  <>
                    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">Commission Balance</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{state.totalEarned.toFixed(2)} USDT</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Keep grabbing orders to grow your balance</p>
                    </div>
                    <button
                      disabled
                      className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-600 text-sm font-medium cursor-not-allowed"
                    >
                      🔒 Withdrawal — Account Verification Required
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
