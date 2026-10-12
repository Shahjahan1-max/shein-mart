import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Zap, Lock, Clock, XCircle, CheckCircle,
  Loader2, ShoppingBag, Send,
} from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { MaintenanceOverlay } from "../../components/MaintenanceOverlay";
import { DEFAULT_SETTINGS, type ExtraTaskApproval } from "../../data/adminData";
import { createTicket, saveGenericFirebaseDoc, updateUser, useFirebaseDoc, useSettings } from "../../hooks/useApi";

const EXTRA_TASK_SUBJECT = "Extra Task Access Request";

const TASK_IMAGES = [
  "https://aczmall.netlify.app/201/1.webp",
  "https://aczmall.netlify.app/201/3.webp",
  "https://aczmall.netlify.app/201/5.webp",
  "https://aczmall.netlify.app/201/7.webp",
  "https://aczmall.netlify.app/201/9.webp",
  "https://aczmall.netlify.app/201/11.webp",
  "https://aczmall.netlify.app/201/13.webp",
  "https://aczmall.netlify.app/201/15.webp",
  "https://aczmall.netlify.app/201/17.webp",
  "https://aczmall.netlify.app/201/19.webp",
  "https://aczmall.netlify.app/201/21.webp",
  "https://aczmall.netlify.app/201/23.webp",
  "https://aczmall.netlify.app/201/25.webp",
  "https://aczmall.netlify.app/301/1.webp",
  "https://aczmall.netlify.app/301/3.webp",
  "https://aczmall.netlify.app/301/5.webp",
  "https://aczmall.netlify.app/301/7.webp",
  "https://aczmall.netlify.app/301/9.webp",
  "https://aczmall.netlify.app/301/11.webp",
  "https://aczmall.netlify.app/301/13.webp",
  "https://aczmall.netlify.app/301/15.webp",
  "https://aczmall.netlify.app/301/17.webp",
  "https://aczmall.netlify.app/301/19.webp",
  "https://aczmall.netlify.app/301/21.webp",
  "https://aczmall.netlify.app/301/23.webp",
  "https://aczmall.netlify.app/301/25.webp",
];

const TASK_COMMISSION = 0.20;
const TASK_AMOUNT = 5.00;

// Stable fallback objects — defined outside the component so their references
// never change between renders, preventing the useFirebaseDoc infinite loop.
const APPROVAL_FALLBACK: ExtraTaskApproval = { approved: false, rejected: false, limit: 10 };
const PROGRESS_FALLBACK = { done: 0, date: "" };

export function ExtraTask() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data: apiSettings } = useSettings<typeof DEFAULT_SETTINGS>();
  const settings = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;
  const enabled = settings.extraTaskEnabled ?? false;
  const { data: approvalDoc, refetch: refetchApproval } = useFirebaseDoc<ExtraTaskApproval>("extraTaskApprovals", userId || "guest", APPROVAL_FALLBACK);
  const { data: progressDoc, refetch: refetchProgress } = useFirebaseDoc<typeof PROGRESS_FALLBACK>("extraTaskProgress", userId || "guest", PROGRESS_FALLBACK);

  const approval = approvalDoc ?? APPROVAL_FALLBACK;

  const [tasksDoneToday, setTasksDoneToday] = useState(0);
  const [currentTaskIdx, setCurrentTaskIdx] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [taskDone, setTaskDone] = useState(false);
  const [allDone, setAllDone] = useState(false);

  const [requestSending, setRequestSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const prog = progressDoc ?? PROGRESS_FALLBACK;
    const done = prog.date === today ? prog.done : 0;
    setTasksDoneToday(done);
    setCurrentTaskIdx(done);
    if (done >= approval.limit && approval.limit > 0) setAllDone(true);
  }, [userId, approval.limit, progressDoc]);

  async function handleRequestAccess() {
    if (!user) return;
    setRequestSending(true);
    await new Promise(r => setTimeout(r, 900));
    try {
      await createTicket({
        id: `et-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        subject: EXTRA_TASK_SUBJECT,
        message: "I would like to request access to Extra Tasks. Please review my account and approve my access.",
        date: new Date().toISOString(),
        status: "open",
        type: "extra_task",
      });
      await saveGenericFirebaseDoc("extraTaskApprovals", user.id, {
        ...APPROVAL_FALLBACK,
        ...approval,
        id: user.id,
        userId: user.id,
        requestedAt: new Date().toISOString(),
      });
      refetchApproval();
      setRequestSent(true);
    } catch {}
    setRequestSending(false);
  }

  async function handleCompleteTask() {
    if (submitting || taskDone) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1200));
    const newDone = tasksDoneToday + 1;
    const today = new Date().toISOString().slice(0, 10);
    await saveGenericFirebaseDoc("extraTaskProgress", userId, { id: userId, userId, done: newDone, date: today });
    if (user) await updateUser(user.id, { balance: (user.balance ?? 0) + TASK_COMMISSION, earnings: (user.earnings ?? 0) + TASK_COMMISSION });
    refetchProgress();
    setTasksDoneToday(newDone);
    setCurrentTaskIdx(newDone);
    setTaskDone(true);
    setSubmitting(false);
    if (newDone >= approval.limit) {
      setTimeout(() => setAllDone(true), 800);
    } else {
      setTimeout(() => setTaskDone(false), 1000);
    }
  }

  const taskImage = TASK_IMAGES[currentTaskIdx % TASK_IMAGES.length];
  const remaining = Math.max(0, approval.limit - tasksDoneToday);

  function renderContent() {
    if (!enabled) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-slate-500 dark:text-gray-400" />
          </div>
          <p className="text-base font-bold text-gray-700 dark:text-gray-200">Feature Not Available</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1.5">Extra Tasks are currently unavailable. Check back later.</p>
        </div>
      );
    }

    if (approval.rejected) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
            <XCircle className="w-7 h-7 text-red-500" />
          </div>
          <p className="text-base font-bold text-gray-700 dark:text-gray-200">Access Denied</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1.5 max-w-xs">Your Extra Task request was not approved. Contact support if you have questions.</p>
          <button
            onClick={() => navigate("/dashboard/support")}
            className="mt-5 px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Contact Support
          </button>
        </div>
      );
    }

    if (!approval.approved && !approval.requestedAt && !requestSent) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-5 shadow-lg shadow-orange-200 dark:shadow-orange-900/30">
            <Zap className="w-9 h-9 text-slate-900 dark:text-white" />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">Extra Tasks</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-1">
            Earn additional commissions by completing exclusive bonus tasks. Request access and our team will review your account.
          </p>
          <ul className="text-xs text-gray-400 dark:text-gray-500 space-y-1 mt-4 mb-8 text-left w-full max-w-xs">
            <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /> Admin-approved access only</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /> Custom task limit set per account</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /> Instant USDT commission on each task</li>
          </ul>
          <button
            onClick={handleRequestAccess}
            disabled={requestSending}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-200 dark:shadow-orange-900/30 hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-60"
          >
            {requestSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {requestSending ? "Sending Request..." : "Request Access"}
          </button>
        </div>
      );
    }

    if (!approval.approved) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
            <Clock className="w-7 h-7 text-amber-500" />
          </div>
          <p className="text-base font-bold text-gray-700 dark:text-gray-200">Request Submitted</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1.5 max-w-xs">
            Your access request is under review. You will be notified once approved.
          </p>
          <div className="mt-5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 text-xs text-amber-700 dark:text-amber-400">
            Typical review time: 24–48 hours
          </div>
        </div>
      );
    }

    if (allDone) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-4">
            <CheckCircle className="w-7 h-7 text-green-500" />
          </div>
          <p className="text-base font-bold text-gray-700 dark:text-gray-200">All Extra Tasks Completed!</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1.5">
            You have completed all {approval.limit} extra tasks for today. Come back tomorrow.
          </p>
          <p className="mt-3 text-sm font-bold text-green-600 dark:text-green-400">
            +{(tasksDoneToday * TASK_COMMISSION).toFixed(2)} USDT earned today
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Tasks Done", value: tasksDoneToday, color: "text-purple-700 dark:text-purple-400" },
            { label: "Remaining", value: remaining, color: "text-amber-700 dark:text-amber-400" },
            { label: "Earned Today", value: `+${(tasksDoneToday * TASK_COMMISSION).toFixed(2)}`, color: "text-green-700 dark:text-green-400" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-3 py-2.5 text-center">
              <p className={`text-lg font-extrabold ${s.color} truncate`}>{s.value}</p>
              <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                Extra Task {currentTaskIdx + 1} / {approval.limit}
              </span>
            </div>
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
              +${TASK_COMMISSION.toFixed(2)} USDT
            </span>
          </div>

          <div className="p-4">
            <div className="aspect-square max-w-xs mx-auto mb-4 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-700">
              <img
                src={taskImage}
                alt={`Extra Task ${currentTaskIdx + 1}`}
                className="w-full h-full object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 mb-4 text-xs text-gray-500 dark:text-gray-400 space-y-1.5">
              <div className="flex items-center justify-between">
                <span>Product Amount</span>
                <span className="font-semibold text-gray-900 dark:text-white">${TASK_AMOUNT.toFixed(2)} USDT</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Commission Rate</span>
                <span className="font-semibold text-gray-900 dark:text-white">{(TASK_COMMISSION / TASK_AMOUNT * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-green-600 dark:text-green-400 font-bold">
                <span>You Earn</span>
                <span>+${TASK_COMMISSION.toFixed(2)} USDT</span>
              </div>
            </div>

            <button
              onClick={handleCompleteTask}
              disabled={submitting || taskDone}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all ${
                taskDone
                  ? "bg-green-500 text-white"
                  : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md"
              } disabled:opacity-70`}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : taskDone ? (
                <><CheckCircle className="w-4 h-4" /> Completed!</>
              ) : (
                <><Zap className="w-4 h-4" /> Complete Task</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <MaintenanceOverlay />
    <DashboardLayout showBack title="Extra Tasks" backTo="/dashboard/mine">
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        {renderContent()}
      </div>
    </DashboardLayout>
    </>
  );
}
