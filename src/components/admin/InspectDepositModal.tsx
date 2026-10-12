import { useState } from "react";
import {
  X, CheckCircle, XCircle, Clock, Copy, Check, ExternalLink,
  ZoomIn, ShieldCheck, User, Wallet, ArrowDownLeft, AlertCircle, Loader2
} from "lucide-react";
import type { ApiDeposit } from "../../hooks/useApi";

interface InspectDepositModalProps {
  deposit: ApiDeposit | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (deposit: ApiDeposit) => Promise<void>;
  onReject: (deposit: ApiDeposit) => Promise<void>;
  onReset?: (deposit: ApiDeposit) => Promise<void>;
  isProcessing?: boolean;
}

export function InspectDepositModal({
  deposit,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onReset,
  isProcessing = false,
}: InspectDepositModalProps) {
  const [copied, setCopied] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  if (!isOpen || !deposit) return null;

  const totalCredit = deposit.amount + (deposit.bonusAmount ?? 0);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  const statusStyles: Record<string, { badge: string; label: string }> = {
    pending:   { badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800", label: "Pending Verification" },
    approved:  { badge: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800", label: "Approved" },
    completed: { badge: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800", label: "Completed & Credited" },
    rejected:  { badge: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800", label: "Rejected" },
  };

  const currentStatus = statusStyles[deposit.status?.toLowerCase() ?? "pending"] ?? statusStyles.pending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div
        className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/70 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                  Deposit Request Inspection
                </h3>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${currentStatus.badge}`}>
                  {currentStatus.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">
                ID: <span className="font-mono">{deposit.id}</span> · {deposit.date}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-300 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-gray-800/60 border border-slate-200/70 dark:border-gray-700/60 rounded-2xl p-3.5 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Deposit Amount</span>
              <p className="text-lg font-black text-slate-900 dark:text-white">${deposit.amount.toFixed(2)}</p>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400">USDT {deposit.protocol}</span>
            </div>

            <div className="bg-slate-50 dark:bg-gray-800/60 border border-slate-200/70 dark:border-gray-700/60 rounded-2xl p-3.5 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Bonus Credited</span>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                +${(deposit.bonusAmount ?? 0).toFixed(2)}
              </p>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400">{deposit.bonusType ? `${deposit.bonusType} bonus` : "No bonus"}</span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded-2xl p-3.5 space-y-1">
              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Total to Credit</span>
              <p className="text-lg font-black text-purple-700 dark:text-purple-300">${totalCredit.toFixed(2)}</p>
              <span className="text-[10px] font-semibold text-purple-600/80 dark:text-purple-400">Final User Balance</span>
            </div>
          </div>

          {/* User & Wallet Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* User Details */}
            <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-4 space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-gray-300">
                <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Client Information</span>
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-bold text-slate-900 dark:text-white text-sm">{deposit.userName || "User"}</p>
                <p className="text-slate-500 dark:text-gray-400 font-mono">User ID: {deposit.userId}</p>
              </div>
            </div>

            {/* Target Wallet Details */}
            <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-4 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-gray-300">
                  <Wallet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Assigned Deposit Wallet</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  {deposit.protocol}
                </span>
              </div>
              {deposit.walletAddress ? (
                <div className="flex items-start justify-between gap-2 bg-slate-50 dark:bg-gray-800 p-2 rounded-xl text-xs">
                  <span className="font-mono text-slate-800 dark:text-gray-200 break-all leading-tight">
                    {deposit.walletAddress}
                  </span>
                  <button
                    onClick={() => handleCopy(deposit.walletAddress!)}
                    className="p-1 text-slate-500 hover:text-purple-600 flex-shrink-0"
                    title="Copy Address"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No specific wallet address recorded.</p>
              )}
            </div>
          </div>

          {/* Payment Proof Screenshot Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-gray-300">
                  Payment Proof Screenshot
                </h4>
              </div>
              {deposit.proofUrl && (
                <a
                  href={deposit.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  <span>Open Full Size</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {deposit.proofUrl ? (
              <div className="relative group bg-slate-950/5 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-gray-800 overflow-hidden flex flex-col items-center justify-center p-2 sm:p-3">
                <div
                  className="relative cursor-pointer max-h-[340px] overflow-hidden rounded-xl w-full flex items-center justify-center"
                  onClick={() => setIsZoomed(!isZoomed)}
                >
                  <img
                    src={deposit.proofUrl}
                    alt="Deposit Payment Proof"
                    className={`max-h-[340px] max-w-full object-contain rounded-xl transition-transform duration-200 ${
                      isZoomed ? "scale-125" : "hover:scale-102"
                    }`}
                  />
                  <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 text-white text-xs font-bold flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>{isZoomed ? "Zoom Out" : "Click to Zoom"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-gray-700 p-8 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-400 dark:text-gray-500 mx-auto" />
                <p className="text-sm font-bold text-slate-700 dark:text-gray-300">No Proof Image Attached</p>
                <p className="text-xs text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
                  The client submitted this deposit request without attaching a transaction screenshot. You can verify against blockchain tx records.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-gray-800 bg-slate-50/70 dark:bg-gray-800/50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {(deposit.status === "pending" || deposit.status === "approved") && (
              <>
                <button
                  onClick={() => onReject(deposit)}
                  disabled={isProcessing}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold transition-colors shadow-sm"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  <span>Reject Deposit</span>
                </button>

                <button
                  onClick={() => onApprove(deposit)}
                  disabled={isProcessing}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold transition-colors shadow-sm"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>Approve & Credit Balance</span>
                </button>
              </>
            )}

            {(deposit.status === "completed" || deposit.status === "rejected") && onReset && (
              <button
                onClick={() => onReset(deposit)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold transition-colors shadow-sm"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                <span>Reset to Pending</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
