import { useState, useEffect, useRef } from "react";
import {
  type LucideIcon, Diamond, CheckCircle2, Clock, XCircle, Check, Copy, Loader2,
  UploadCloud, Image as ImageIcon, X, ShieldCheck, Eye, ExternalLink
} from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import { DEFAULT_SETTINGS, computeDepositBonus } from "../../data/adminData";
import { MaintenanceOverlay } from "../../components/MaintenanceOverlay";
import type { WalletConfig } from "../../data/adminData";
import { notifyAdminNewDeposit } from "../../lib/notificationHelpers";
import {
  useDeposits, submitDeposit, useSettings, useUserWalletAssignments,
  uploadDepositProof, compressProofImage
} from "../../hooks/useApi";
import type { PlatformSettings } from "../../data/adminData";
import { normalizeExternalImageUrl } from "../../lib/imageUrl";

const PROTOCOLS = ["TRC20", "ERC20", "BEP20"];
const QUICK_AMOUNTS = [10, 50, 100, 500, 1000];

type RequestStatus = "pending" | "approved" | "rejected" | "completed";

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  approved:  "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  rejected:  "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800",
  completed: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800",
};

const STATUS_ICONS: Record<string, LucideIcon> = {
  pending: Clock, approved: Check, rejected: XCircle, completed: CheckCircle2,
};

function getAssignedWallet(walletId: string | undefined, wallets: WalletConfig[]): WalletConfig | null {
  const found = walletId ? wallets.find(w => w.id === walletId) : null;
  return found ?? wallets[0] ?? null;
}

export function Deposit() {
  const { user } = useAuth();
  const { t } = useLang();
  const [amount, setAmount] = useState("");
  const [protocol, setProtocol] = useState("TRC20");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Proof screenshot upload state
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [compressedProof, setCompressedProof] = useState<string | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load deposits from API
  const { data: allDeposits, refetch: refetchDeposits, loading: depositsLoading } = useDeposits(user?.id);
  const requests = allDeposits ?? [];
  const pendingRequests = requests.filter(req => String(req.status).toLowerCase() === "pending");

  // Load settings from Firebase-backed API
  const { data: apiSettings, loading: settingsLoading } = useSettings<PlatformSettings>();
  const { data: walletAssignments = [], loading: walletAssignmentsLoading } = useUserWalletAssignments();
  const settings = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;

  const [returnPath] = useState<string>(() => sessionStorage.getItem("ds_deposit_return_path") ?? "/dashboard");
  useEffect(() => { return () => { sessionStorage.removeItem("ds_deposit_return_path"); }; }, []);

  const wallets: WalletConfig[] = Array.isArray(settings.wallets) ? settings.wallets : [];
  const assignedWalletId = user ? walletAssignments.find(item => item.userId === user.id)?.walletId : undefined;
  const assignedWallet = user ? getAssignedWallet(assignedWalletId, wallets) : null;

  const estimated = parseFloat(amount) || 0;
  const bonusAmount = computeDepositBonus(estimated, settings);
  const totalReceived = parseFloat((estimated + bonusAmount).toFixed(2));
  const isProofRequired = settings.depositProofRequired !== false;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setProofError("Image size exceeds 15MB limit.");
      return;
    }
    setProofError(null);
    setProofFile(file);
    const url = URL.createObjectURL(file);
    setProofPreviewUrl(url);

    // Pre-compress in the background immediately so submission is instant with 0 lag
    try {
      const dataUrl = await compressProofImage(file);
      setCompressedProof(dataUrl);
    } catch (err) {
      console.warn("Background proof compression error:", err);
    }
  }

  function clearProof() {
    setProofFile(null);
    setCompressedProof(null);
    if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    setProofPreviewUrl(null);
    setProofError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDeposit() {
    if (!amount || estimated <= 0 || !user) return;
    if (isProofRequired && !proofFile) {
      setProofError("Please attach your payment receipt or screenshot before submitting.");
      return;
    }
    setLoading(true);
    setProofError(null);
    try {
      let uploadedProofUrl: string | undefined;
      if (proofFile) {
        try {
          const res = await uploadDepositProof(proofFile, compressedProof || undefined);
          uploadedProofUrl = res.url;
        } catch (err) {
          console.warn("Failed to upload proof to storage, continuing:", err);
        }
      }

      await submitDeposit({
        id: `DEP-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        amount: estimated,
        bonusAmount: bonusAmount > 0 ? bonusAmount : undefined,
        bonusType: bonusAmount > 0 ? settings.depositBonusType : undefined,
        protocol,
        walletId: assignedWallet?.id,
        walletAddress: assignedWallet?.address,
        proofUrl: uploadedProofUrl,
        status: "pending",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      });
      notifyAdminNewDeposit(user.id, user.name, estimated);
      refetchDeposits();
      setAmount("");
      clearProof();
    } catch (err) {
      console.error("Failed to submit deposit:", err);
    } finally {
      setLoading(false);
    }
  }

  function copyAddress(address: string) {
    navigator.clipboard.writeText(address).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  const isHydrating = !user || settingsLoading || walletAssignmentsLoading || depositsLoading;

  if (isHydrating) {
    return (
      <>
        <MaintenanceOverlay />
        <DashboardLayout showBack title={t("deposit")} backTo={returnPath}>
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
          </div>
        </DashboardLayout>
      </>
    );
  }

  return (
    <>
    <MaintenanceOverlay />
    <DashboardLayout showBack title={t("deposit")} backTo={returnPath}>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-5">
            {/* Payment method */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t("paymentMethod")}</h3>
              <div className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl w-fit text-sm font-semibold">
                <Diamond className="h-4 w-4" /> USDT
              </div>
            </div>

            {/* Assigned Wallet */}
            {assignedWallet ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t("depositTo")}</h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{assignedWallet.network} {t("wallet")}</span>
                    {assignedWallet.label && <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">{assignedWallet.label}</span>}
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-gray-800 dark:text-gray-200 break-all leading-relaxed flex-1">{assignedWallet.address}</span>
                    <button onClick={() => copyAddress(assignedWallet.address)} className="flex-shrink-0 p-1.5 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
                      <Copy className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                    </button>
                  </div>
                  {copied && <p className="text-xs text-green-500">{t("addressCopied")}</p>}
                </div>
              </div>
            ) : wallets.length === 0 ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{t("noWalletsConfigured")}</p>
              </div>
            ) : null}

            {/* Protocol */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t("protocol")}</h3>
              <div className="flex gap-2">
                {PROTOCOLS.map(p => (
                  <button key={p} onClick={() => setProtocol(p)} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${protocol === p ? "bg-purple-600 text-white border-purple-600 shadow-sm" : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-purple-400"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("amount")}</h3>
                <span className="text-xs text-slate-500 dark:text-gray-400">{t("available")}: {(user?.balance ?? 0).toFixed(2)} USDT</span>
              </div>
              <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-700 mb-3">
                <span className="px-4 py-3 text-sm font-semibold text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600">USDT</span>
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
              </div>
              <div className="grid grid-cols-5 gap-1 sm:gap-2">
                {QUICK_AMOUNTS.map(v => (
                  <button key={v} onClick={() => setAmount(String(v))} className={`py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all touch-manipulation active:scale-95 ${amount === String(v) ? "bg-purple-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Proof of Payment Screenshot */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                    Deposit Proof Screenshot
                    {isProofRequired ? (
                      <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-800/40">
                        Required
                      </span>
                    ) : (
                      <span className="text-[10px] lowercase font-normal text-slate-400">
                        (optional)
                      </span>
                    )}
                  </h3>
                </div>
                {proofPreviewUrl && (
                  <button
                    type="button"
                    onClick={clearProof}
                    className="text-xs text-red-500 hover:text-red-600 font-semibold flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileSelect}
              />

              {proofError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-2.5 font-medium flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  {proofError}
                </p>
              )}

              {!proofPreviewUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`group cursor-pointer border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center transition-all flex flex-col items-center justify-center gap-2 ${
                    proofError
                      ? "border-red-400 dark:border-red-600 bg-red-50/30 dark:bg-red-950/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-400 bg-gray-50/50 dark:bg-gray-700/20 hover:bg-purple-50/30 dark:hover:bg-purple-950/20"
                  }`}
                >
                  <div className="w-11 h-11 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center transition-transform group-hover:scale-110">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200">
                      Attach Payment Receipt / Screenshot {isProofRequired && <span className="text-red-500 font-extrabold">*</span>}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-gray-400 mt-0.5">
                      PNG, JPG, WebP up to 10MB {isProofRequired ? "(Mandatory for verification)" : "(Fast Verification)"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-2xl p-3 flex items-center gap-3">
                  <div
                    className="relative cursor-pointer w-16 h-16 rounded-xl overflow-hidden bg-black/5 flex-shrink-0 border border-gray-200 dark:border-gray-600"
                    onClick={() => setPreviewModalUrl(proofPreviewUrl)}
                  >
                    <img src={proofPreviewUrl} alt="Deposit Proof" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <Eye className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{proofFile?.name}</p>
                    <p className="text-[11px] text-slate-400 dark:text-gray-400 mt-0.5">
                      {proofFile ? `${(proofFile.size / 1024).toFixed(0)} KB` : ""} · <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Attached ✓</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setPreviewModalUrl(proofPreviewUrl)}
                      className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 mt-1"
                    >
                      <Eye className="w-3 h-3" /> Preview Image
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-5">
            {settings.depositQr && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 flex flex-col items-center gap-3">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider self-start">{t("scanToDeposit")}</p>
                <img src={normalizeExternalImageUrl(settings.depositQr)} alt="Deposit QR Code" className="w-44 h-44 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-white p-2" />
                <p className="text-xs text-slate-500 dark:text-gray-400 text-center leading-relaxed">{t("scanQrDesc")}</p>
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("summary")}</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t("depositAmount")}</span>
                <span className="font-bold text-gray-900 dark:text-white">{estimated.toFixed(2)} USDT</span>
              </div>
              {settings.depositBonusEnabled && bonusAmount > 0 && (
                <>
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span>{t("bonus")}{settings.depositBonusType === "percentage" ? ` (+${settings.depositBonusValue}%)` : " (fixed)"}</span>
                    <span className="font-bold">+ {bonusAmount.toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-gray-200 dark:border-gray-700">
                    <span className="font-bold text-gray-900 dark:text-white">{t("youReceive")}</span>
                    <span className="font-extrabold text-green-600 dark:text-green-400">{totalReceived.toFixed(2)} USDT</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400">
                <span>{t("referenceRate")}</span><span>1 USD = 1 USDT</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400">
                <span>{t("protocol")}</span><span className="font-semibold">{protocol}</span>
              </div>
              {assignedWallet && (
                <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400">
                  <span>{t("network")}</span><span className="font-semibold">{assignedWallet.network}</span>
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed pt-1 border-t border-gray-200 dark:border-gray-700">{t("paymentConditions")}</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleDeposit}
                disabled={loading || !amount || estimated <= 0 || (isProofRequired && !proofFile)}
                className="w-full py-4 text-base font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 dark:disabled:bg-purple-900/50 rounded-2xl transition-colors shadow-sm disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t("submitting")}</span>
                  </>
                ) : isProofRequired && !proofFile && amount ? (
                  "Attach Proof Screenshot to Submit"
                ) : (
                  t("depositNow")
                )}
              </button>

              {isProofRequired && !proofFile && estimated > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium">
                  * Proof screenshot is required before submitting your deposit.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Request history */}
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
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{req.amount.toFixed(2)} USDT</p>
                        {req.bonusAmount != null && req.bonusAmount > 0 && (
                          <span className="text-xs text-green-500 font-medium">+ {req.bonusAmount.toFixed(2)} {t("bonus").toLowerCase()}</span>
                        )}
                        {req.proofUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewModalUrl(req.proofUrl!)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800"
                          >
                            <ImageIcon className="w-3 h-3" /> Proof Attached
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-gray-400">{req.date} · {req.protocol}</p>
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

      {/* Proof Image Preview Modal */}
      {previewModalUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in"
          onClick={() => setPreviewModalUrl(null)}
        >
          <div
            className="relative max-w-xl max-h-[85vh] bg-white dark:bg-gray-900 rounded-3xl p-3 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewModalUrl(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/60 text-white hover:bg-black flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewModalUrl}
              alt="Deposit Proof Preview"
              className="max-h-[75vh] w-auto mx-auto object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </DashboardLayout>
    </>
  );
}
