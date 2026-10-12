import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowDownLeft, ArrowUpRight, Copy, Check, QrCode, TrendingUp, History, Wallet as WalletIcon } from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import { DEFAULT_SETTINGS } from "../../data/adminData";
import type { WalletConfig } from "../../data/adminData";
import { useDeposits, useSettings, useUserWalletAssignments, useWithdrawals } from "../../hooks/useApi";

function getWalletAddress(wallets: WalletConfig[], assignedWalletId?: string): string {
  if (!wallets.length) return "";
  const found = assignedWalletId ? wallets.find(w => w.id === assignedWalletId) : null;
  return (found ?? wallets[0])?.address ?? "";
}

function QRCode({ value }: { value: string }) {
  const size = 120; const cell = 6;
  const n = Math.floor(size / cell);
  const rows = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => {
      const corner = (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
      const inner = (r >= 2 && r < 5 && c >= 2 && c < 5) || (r >= 2 && r < 5 && c >= n - 5 && c < n - 2) || (r >= n - 5 && r < n - 2 && c >= 2 && c < 5);
      const data = (value.charCodeAt((r * n + c) % value.length) + r * 7 + c * 11) % 3 === 0;
      return corner || inner || (!((r < 7 && (c === 0 || c === 6)) || (c < 7 && (r === 0 || r === 6))) && data);
    })
  );
  return (
    <div className="inline-flex border-4 border-white dark:border-gray-200 rounded-xl shadow-md overflow-hidden bg-white">
      {rows.map((row, r) => (
        <div key={r} className="flex flex-col">
          {row.map((filled, c) => (
            <div key={c} style={{ width: cell, height: cell, backgroundColor: filled ? "#111" : "#fff" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

interface TxItem { id: string; type: "deposit" | "withdraw"; label: string; amount: string; date: string; status: string; }

export function Wallet() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const userId = user?.id ?? "";

  const { data: depositsData, loading: depsLoading } = useDeposits(userId);
  const { data: withdrawalsData, loading: wdsLoading } = useWithdrawals(userId);
  const { data: apiSettings } = useSettings<typeof DEFAULT_SETTINGS>();
  const { data: walletAssignments = [] } = useUserWalletAssignments();
  const settings = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;
  const wallets: WalletConfig[] = Array.isArray(settings.wallets) ? settings.wallets : [];
  const assignedWalletId = walletAssignments.find(item => item.userId === userId)?.walletId;
  const walletAddress = getWalletAddress(wallets, assignedWalletId);

  const recentTx: TxItem[] = [
    ...(depositsData ?? []).map(d => ({
      id: d.id, type: "deposit" as const, label: "USDT Deposit",
      amount: `+${d.amount.toFixed(2)}`, date: d.date, status: d.status,
    })),
    ...(withdrawalsData ?? []).map(w => ({
      id: w.id, type: "withdraw" as const, label: "USDT Withdrawal",
      amount: `-${w.amount.toFixed(2)}`, date: w.date, status: w.status,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const copyAddr = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DashboardLayout showBack title={t("wallet")} backTo="/dashboard/mine"
      actions={
        <div className="flex gap-2">
          <button onClick={() => navigate("/dashboard/deposit")} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors">
            <ArrowDownLeft className="h-4 w-4" /> {t("deposit")}
          </button>
          <button onClick={() => navigate("/dashboard/withdraw")} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">
            <ArrowUpRight className="h-4 w-4" /> {t("withdraw")}
          </button>
        </div>
      }
    >
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Balance card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <WalletIcon className="h-5 w-5 opacity-80" />
              <span className="text-sm font-medium opacity-80">{t("balance")}</span>
            </div>
            <p className="text-4xl font-extrabold mb-1">
              {(user?.balance ?? 0).toFixed(2)} <span className="text-xl font-semibold text-purple-300">USDT</span>
            </p>
            <p className="text-purple-300 text-sm mb-6">≈ ${(user?.balance ?? 0).toFixed(2)} USD</p>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <ArrowDownLeft className="h-4 w-4 text-green-300" />
                  <p className="text-sm font-bold">{t("deposit")}</p>
                </div>
                <button onClick={() => navigate("/dashboard/deposit")} className="text-[11px] text-purple-300 hover:text-slate-900 dark:text-white transition-colors underline underline-offset-2">
                  {t("depositUsdt")}
                </button>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <ArrowUpRight className="h-4 w-4 text-red-300" />
                  <p className="text-sm font-bold">{t("withdraw")}</p>
                </div>
                <button onClick={() => navigate("/dashboard/withdraw")} className="text-[11px] text-purple-300 hover:text-slate-900 dark:text-white transition-colors underline underline-offset-2">
                  {t("withdrawUsdt")}
                </button>
              </div>
            </div>
          </div>

          {/* QR + address */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-4 w-full">
              <QrCode className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">{t("usdtAddress")}</span>
              <span className="ml-auto text-[10px] font-semibold text-purple-700 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full">TRC20</span>
            </div>
            <QRCode value={walletAddress || "no-wallet-configured"} />
            <div className="w-full mt-4 bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-left">
              <p className="text-[10px] text-slate-500 dark:text-gray-400 mb-1">{t("walletAddress")}</p>
              {walletAddress
                ? <p className="text-[11px] font-mono text-gray-700 dark:text-gray-300 break-all leading-relaxed">{walletAddress}</p>
                : <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">No wallet configured yet</p>
              }
            </div>
            <button onClick={copyAddr} disabled={!walletAddress} className={`mt-3 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${copied ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("copied") : t("copyAddress")}
            </button>
          </div>
        </div>

        {/* Transaction history */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t("recentTransactions")}</h3>
            </div>
            <button onClick={() => navigate("/dashboard/records")} className="text-xs text-purple-600 dark:text-purple-400 font-medium hover:underline">{t("viewAll")}</button>
          </div>
          {depsLoading || wdsLoading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <TrendingUp className="h-8 w-8 text-gray-200 dark:text-gray-700 animate-pulse" />
              <p className="text-sm text-gray-400 dark:text-gray-500">Loading transactions…</p>
            </div>
          ) : recentTx.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <TrendingUp className="h-8 w-8 text-gray-200 dark:text-gray-700" />
              <p className="text-sm text-gray-400 dark:text-gray-500">{t("noTransactionsYet")}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-[200px]">{t("makeDepositToStart")}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {recentTx.map(tx => (
                <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${tx.type === "withdraw" ? "bg-red-50 dark:bg-red-900/20" : "bg-green-50 dark:bg-green-900/20"}`}>
                    {tx.type === "withdraw" ? <ArrowUpRight className="h-4 w-4 text-red-500" /> : <ArrowDownLeft className="h-4 w-4 text-green-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{tx.label}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400">{tx.date}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${tx.amount.startsWith("+") ? "text-green-600" : "text-red-500"}`}>{tx.amount}</p>
                    <p className="text-[10px] text-slate-500 dark:text-gray-400">{tx.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
