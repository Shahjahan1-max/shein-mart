import { useState, useEffect } from "react";
import { type LucideIcon, Diamond, AlertCircle, CheckCircle2, Clock, XCircle, Check, Save } from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import { MaintenanceOverlay } from "../../components/MaintenanceOverlay";
import { DEFAULT_SETTINGS, computeWithdrawalTax } from "../../data/adminData";
import {
  useUser,
  useWithdrawals,
  submitWithdrawal,
  saveWithdrawWallet,
  useSettings,
  getWithdrawalStatus,
  type ApiWithdrawalStatus,
} from "../../hooks/useApi";
import { normalizeExternalImageUrl } from "../../lib/imageUrl";
import type { PlatformSettings } from "../../data/adminData";

const PROTOCOLS = ["TRC20", "ERC20", "BEP20"];

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  approved:  "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  rejected:  "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800",
  completed: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800",
};

const STATUS_ICONS: Record<string, LucideIcon> = {
  pending: Clock, approved: Check, rejected: XCircle, completed: CheckCircle2,
};

export function Withdraw() {
  const { user, updateUser } = useAuth();
  const { t } = useLang();
  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [protocol, setProtocol] = useState("TRC20");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingWallet, setSavingWallet] = useState(false);
  const [savedWalletOverride, setSavedWalletOverride] = useState<{ wallet: string; protocol: string; locked: boolean } | null>(null);
  const [withdrawalStatus, setWithdrawalStatus] = useState<ApiWithdrawalStatus | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(true);

  const { data: apiSettings } = useSettings<PlatformSettings>();
  const { data: allWithdrawals, refetch: refetchWithdrawals } = useWithdrawals(user?.id);
  const { data: liveUser, refetch: refetchUser } = useUser(user?.id);
  const requests = allWithdrawals ?? [];
  const pendingRequests = requests.filter(req => String(req.status).toLowerCase() === "pending");
  const settings = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;

  const profile = liveUser ?? user;
  const savedWallet = savedWalletOverride?.wallet ?? String(profile?.withdrawWallet || profile?.withdrawalWallet || "");
  const savedProtocol = savedWalletOverride?.protocol ?? String(profile?.withdrawWalletProtocol || profile?.withdrawalWalletProtocol || "TRC20");
  const walletLocked = savedWalletOverride?.locked ?? (profile?.walletLocked === true || profile?.withdrawalWalletLocked === true);
  const available = profile?.balance ?? user?.balance ?? 0;
  const estimated = parseFloat(amount) || 0;
  const taxAmount = computeWithdrawalTax(estimated, settings);
  const finalPayout = Math.max(0, parseFloat((estimated - taxAmount).toFixed(2)));

  // Fetch withdrawal eligibility status
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const refresh = () => {
      setCheckingEligibility(true);
      getWithdrawalStatus(user.id)
        .then(status => { if (!cancelled) setWithdrawalStatus(status); })
        .catch(() => { if (!cancelled) setWithdrawalStatus(null); })
        .finally(() => { if (!cancelled) setCheckingEligibility(false); });
    };
    refresh();
    window.addEventListener("ds:data-changed", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("ds:data-changed", refresh);
    };
  }, [user?.id, requests.length]);

  // Pre-fill wallet address when locked
  useEffect(() => {
    if (!walletLocked || !savedWallet) return;
    setWalletAddress(savedWallet);
    setProtocol(savedProtocol || "TRC20");
  }, [walletLocked, savedWallet, savedProtocol]);

  const completedTasks = withdrawalStatus?.completed_count ?? 0;
  const isEligible = withdrawalStatus?.withdrawal_allowed === true;
  const tasksRemaining = withdrawalStatus?.remaining_count ?? 0;

  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveWallet = async () => {
    setError("");
    setSaveSuccess(false);
    if (!user?.id) {
      setError("Please log in again before saving your wallet.");
      return;
    }
    if (walletLocked) return;
    const trimmedWallet = walletAddress.trim();
    if (!trimmedWallet) {
      setError(t("checkAddress"));
      return;
    }
    const confirmed = window.confirm(
      "Please double-check your wallet address before saving. Once saved, you cannot change it again from your account. To change it later, you will need to request support."
    );
    if (!confirmed) return;

    setSavingWallet(true);
    try {
      const savedUser = await saveWithdrawWallet(user.id, { address: trimmedWallet, protocol });
      const nextWallet = String(savedUser.withdrawWallet || savedUser.withdrawalWallet || trimmedWallet);
      const nextProtocol = String(savedUser.withdrawWalletProtocol || savedUser.withdrawalWalletProtocol || protocol || "TRC20");
      setSavedWalletOverride({ wallet: nextWallet, protocol: nextProtocol, locked: true });
      setWalletAddress(nextWallet);
      setProtocol(nextProtocol);
      setSaveSuccess(true);
      refetchUser();
      window.dispatchEvent(new CustomEvent("ds:data-changed", { detail: { collection: "users", id: user.id } }));
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message || "Failed to save wallet. Please try again.");
    } finally {
      setSavingWallet(false);
    }
  };

  const handleWithdraw = async () => {
    setError("");
    if (checkingEligibility) return;
    if (!isEligible) {
      setError(t("withdrawalRestricted") || `Complete ${tasksRemaining} more tasks to withdraw`);
      return;
    }
    if (!amount || estimated <= 0) { setError(t("enterValidAmount")); return; }
    if (estimated > available) { setError(t("insufficientBalance")); return; }
    const submittedWallet = walletLocked ? savedWallet : walletAddress.trim();
    if (!submittedWallet) { setError(t("checkAddress")); return; }
    if (!walletLocked) {
      const confirmed = window.confirm(
        "Please double-check your wallet address before saving. Once saved, you cannot change it again from your account. To change it later, you will need to request support."
      );
      if (!confirmed) return;
    }
    setLoading(true);
    try {
      await submitWithdrawal({
        id: `WD-${Date.now()}`,
        userId: user?.id ?? "unknown",
        userName: user?.name ?? "User",
        amount: estimated,
        taxAmount: taxAmount > 0 ? taxAmount : undefined,
        taxType: taxAmount > 0 ? settings.withdrawalTaxType : undefined,
        finalPayout: taxAmount > 0 ? finalPayout : undefined,
        protocol,
        address: submittedWallet,
        status: "pending",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        balanceDeductedAtRequest: true,
      });
      if (!walletLocked) {
        setSavedWalletOverride({ wallet: submittedWallet, protocol, locked: true });
      }
      if (user) {
        updateUser({ balance: Math.max(0, available - estimated) });
      }
      refetchWithdrawals();
      refetchUser();
      setAmount("");
      setWalletAddress(submittedWallet);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message || "Failed to submit withdrawal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MaintenanceOverlay />
      <DashboardLayout showBack title={t("withdraw")} backTo="/dashboard">
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── Left column ── */}
            <div className="space-y-5">
              {/* Payment method */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  {t("paymentMethod")}
                </h3>
                <div className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl w-fit text-sm font-semibold">
                  <Diamond className="h-4 w-4" /> USDT
                </div>
              </div>

              {/* Protocol */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  {t("protocol")}
                </h3>
                <div className="flex gap-2">
                  {PROTOCOLS.map(p => (
                    <button
                      key={p}
                      onClick={() => setProtocol(p)}
                      disabled={walletLocked}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-70 disabled:cursor-not-allowed ${
                        protocol === p
                          ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                          : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-purple-400"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount + address */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t("amount")}
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-gray-400">
                      {t("available")}: {available.toFixed(2)} USDT
                    </span>
                  </div>
                  <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-700">
                    <span className="px-4 py-3 text-sm font-semibold text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600">
                      USDT
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*\.?[0-9]*"
                      value={amount}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                        setAmount(v);
                      }}
                      onBlur={e => {
                        // Prevent phantom text from Android keyboard dismiss
                        e.target.value = amount;
                      }}
                      placeholder="0.00"
                      className="flex-1 px-4 py-3 text-base font-semibold bg-transparent text-gray-900 dark:text-white placeholder-gray-300 focus:outline-none"
                    />
                    <button
                      onClick={() => setAmount(String(available))}
                      className="px-4 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    {t("walletAddress")}
                  </label>
                  <input
                    type="text"
                    value={walletLocked ? savedWallet : walletAddress}
                    onChange={e => setWalletAddress(e.target.value)}
                    disabled={walletLocked}
                    placeholder={`${t("walletAddress")} (${protocol})`}
                    className="w-full px-4 py-3 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                  {saveSuccess && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 animate-in fade-in">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>Wallet saved and locked successfully! You can now submit your withdrawal below.</span>
                    </div>
                  )}

                  {!walletLocked ? (
                    <button
                      onClick={handleSaveWallet}
                      disabled={savingWallet || !walletAddress.trim()}
                      className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300 dark:disabled:bg-purple-900"
                    >
                      <Save className="h-4 w-4" />
                      {savingWallet ? "Saving Wallet..." : "Save Wallet"}
                    </button>
                  ) : (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2.5 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                      <span>Wallet saved and locked. Contact support if you need to change it.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="space-y-5">
              {/* Task restriction banner */}
              {!checkingEligibility && !isEligible && (
                <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl px-4 py-3.5">
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-1">
                      {t("withdrawalRestricted") || "Withdrawal Restricted"}
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      {t("completeTasksToWithdraw") || `Complete your current 25 tasks first to unlock withdrawals`}
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      Progress: {completedTasks}/{withdrawalStatus?.required_count || 25} tasks
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3.5 text-sm text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t("summary")}
                </h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{t("requestedAmount")}</span>
                  <span className="font-bold text-gray-900 dark:text-white">{estimated.toFixed(2)} USDT</span>
                </div>
                {settings.withdrawalTaxEnabled && taxAmount > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                      <span>
                        {t("taxDeduction")}
                        {settings.withdrawalTaxType === "percentage" ? ` (${settings.withdrawalTaxValue}%)` : " (fixed)"}
                      </span>
                      <span className="font-bold">− {taxAmount.toFixed(2)} USDT</span>
                    </div>
                    <div className="flex justify-between text-sm pt-1 border-t border-gray-200 dark:border-gray-700">
                      <span className="font-bold text-gray-900 dark:text-white">{t("finalPayout")}</span>
                      <span className="font-extrabold text-green-600 dark:text-green-400">{finalPayout.toFixed(2)} USDT</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400">
                  <span>{t("referenceRate")}</span>
                  <span>1 USDT = 1 USDT</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400">
                  <span>{t("protocol")}</span>
                  <span className="font-semibold">{protocol}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed pt-1 border-t border-gray-200 dark:border-gray-700">
                  {t("paymentConditions")}
                </p>
              </div>

              {/* Address warning */}
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
                    {t("withdrawAddressWarning")} {protocol}.
                  </p>
                </div>
              </div>

              {/* QR code */}
              {settings.withdrawQr && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 flex flex-col items-center gap-3">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider self-start">
                    Scan to Withdraw
                  </p>
                  <img
                    src={normalizeExternalImageUrl(settings.withdrawQr)}
                    alt="Withdraw QR Code"
                    className="w-44 h-44 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-white p-2"
                  />
                  <p className="text-xs text-slate-500 dark:text-gray-400 text-center leading-relaxed">
                    Scan this QR code to complete your withdrawal
                  </p>
                </div>
              )}

              {/* Wallet locked — redirect to Support */}
              {walletLocked && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-blue-800 dark:text-blue-200">Need to change wallet?</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Go to <strong>Support / Tickets</strong> and submit a wallet change request.
                        Admin will review and update it.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                onClick={handleWithdraw}
                disabled={checkingEligibility || loading || !amount || estimated <= 0 || !isEligible}
                className="w-full py-4 text-base font-bold text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 dark:disabled:bg-red-900 rounded-2xl transition-colors shadow-sm disabled:cursor-not-allowed"
              >
                {checkingEligibility
                  ? "Checking Eligibility..."
                  : !isEligible
                  ? (t("withdrawalRestricted") || "Withdrawal Restricted")
                  : loading
                    ? t("processing")
                    : t("withdrawNow")}
              </button>
            </div>
          </div>

          {/* Withdrawal history */}
          {pendingRequests.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t("pending")} {t("requests")}</h3>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {pendingRequests.map(req => {
                  const Icon = STATUS_ICONS[req.status] ?? Clock;
                  return (
                    <div key={req.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                            {req.amount.toFixed(2)} USDT
                          </p>
                          {req.taxAmount != null && req.taxAmount > 0 && (
                            <span className="text-xs text-red-500 font-medium">
                              − {req.taxAmount.toFixed(2)} tax → {(req.finalPayout ?? req.amount - req.taxAmount).toFixed(2)} payout
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-gray-400 truncate">
                          {req.date} · {req.protocol} · {req.address.slice(0, 12)}…
                        </p>
                      </div>
                      <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLES[req.status] ?? STATUS_STYLES.pending}`}>
                        <Icon className="w-3 h-3" />
                        {req.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}
