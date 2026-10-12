import { useLocation } from "wouter";
import { ArrowDownLeft, ArrowUpRight, History } from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import { useDeposits, useWithdrawals } from "../../hooks/useApi";

interface TxItem { id: string; type: "deposit" | "withdraw"; label: string; amount: string; date: string; status: string; }

export function DepositWithdrawal() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { t } = useLang();
  const userId = user?.id ?? "";
  const { data: deposits = [] } = useDeposits(userId);
  const { data: withdrawals = [] } = useWithdrawals(userId);
  const recentTx: TxItem[] = [
    ...deposits.map(d => ({ id: d.id, type: "deposit" as const, label: "USDT Deposit", amount: `+${d.amount.toFixed(2)}`, date: d.date, status: d.status })),
    ...withdrawals.map(w => ({ id: w.id, type: "withdraw" as const, label: "USDT Withdrawal", amount: `-${w.amount.toFixed(2)}`, date: w.date, status: w.status })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <DashboardLayout showBack title={t("wallet")} backTo="/dashboard/mine">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <button
            onClick={() => navigate("/dashboard/deposit")}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 text-left hover:shadow-sm transition-all min-h-[260px]"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                <ArrowDownLeft className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{t("deposit")}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("depositUsdt")}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-green-200 dark:border-green-900/40 bg-green-50/50 dark:bg-green-900/10 p-5 min-h-[180px]">
              <div className="h-full flex flex-col justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{t("deposit")}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {t("depositUsdt")}
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-center rounded-xl bg-white dark:bg-gray-800 border border-green-100 dark:border-green-900/30 py-3">
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">{t("depositNow")}</p>
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/dashboard/withdraw")}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 text-left hover:shadow-sm transition-all min-h-[260px]"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{t("withdraw")}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("withdrawUsdt")}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 p-5 min-h-[180px]">
              <div className="h-full flex flex-col justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{t("withdraw")}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {t("withdrawUsdt")}
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-center rounded-xl bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900/30 py-3">
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400">{t("withdrawNow")}</p>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50 dark:border-gray-700">
            <History className="h-4 w-4 text-purple-600" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t("recentTransactions")}</h3>
          </div>
          {recentTx.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <History className="h-8 w-8 text-gray-200 dark:text-gray-700" />
              <p className="text-sm text-gray-400 dark:text-gray-500">{t("noTransactionsYet")}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {recentTx.map(tx => (
                <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5">
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
