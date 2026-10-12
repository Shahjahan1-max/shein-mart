import { useState, useEffect, useMemo } from "react";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  X,
  Loader2,
  CheckCircle2,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import {
  fetchAllTransactionsData,
  filterTransactionsForExport,
  exportTransactionsToCsv,
  type ExportableTransaction,
  type TransactionExportFilter,
} from "../../lib/transactionsCsv";

interface ExportTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: "all" | "deposits" | "withdrawals";
  initialStatus?: string;
  onSuccessToast?: (msg: string) => void;
}

export function ExportTransactionsModal({
  isOpen,
  onClose,
  initialType = "all",
  initialStatus = "all",
  onSuccessToast,
}: ExportTransactionsModalProps) {
  const [data, setData] = useState<ExportableTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filter state
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateMode, setDateMode] = useState<"upto" | "all" | "range">("upto");
  const [upToDate, setUpToDate] = useState<string>(todayStr);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [type, setType] = useState<"all" | "deposits" | "withdrawals">(initialType);
  const [status, setStatus] = useState<string>(initialStatus);

  // Sync initial props when opened
  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setStatus(initialStatus);
      setDateMode("upto");
      setUpToDate(new Date().toISOString().slice(0, 10));
    }
  }, [isOpen, initialType, initialStatus]);

  // Load total database dataset when opened
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const { combined } = await fetchAllTransactionsData();
        if (!isCancelled) {
          setData(combined);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error("Failed to load transactions for export:", err);
          setError("Failed to fetch full transactions from server. Please try again.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  // Filtered transactions computation
  const filtered = useMemo(() => {
    const filter: TransactionExportFilter = {
      dateMode,
      upToDate: dateMode === "upto" ? upToDate : undefined,
      startDate: dateMode === "range" ? startDate : undefined,
      endDate: dateMode === "range" ? endDate : undefined,
      type,
      status,
    };
    return filterTransactionsForExport(data, filter);
  }, [data, dateMode, upToDate, startDate, endDate, type, status]);

  // Stats computation
  const stats = useMemo(() => {
    let depsCount = 0;
    let wdsCount = 0;
    let totalGross = 0;

    for (const item of filtered) {
      if (item.kind === "Deposit") depsCount++;
      else wdsCount++;
      totalGross += item.amount;
    }

    return {
      total: filtered.length,
      deposits: depsCount,
      withdrawals: wdsCount,
      grossAmount: totalGross,
    };
  }, [filtered]);

  // Handle CSV Download
  function handleDownload() {
    if (filtered.length === 0) return;
    setExporting(true);

    try {
      let suffix = "";
      if (dateMode === "upto" && upToDate) {
        suffix = `_upto_${upToDate}`;
      } else if (dateMode === "range" && (startDate || endDate)) {
        suffix = `_from_${startDate || "start"}_to_${endDate || "end"}`;
      } else {
        suffix = "_all_time";
      }

      const typePrefix = type === "all" ? "transactions" : type;
      const filename = `dealxstocks_${typePrefix}${suffix}.csv`;

      const result = exportTransactionsToCsv(filtered, filename);
      onSuccessToast?.(`Exported ${result.count} transactions to ${result.filename}`);
      onClose();
    } catch (err) {
      console.error("CSV export error:", err);
      setError("Failed to generate CSV file.");
    } finally {
      setExporting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Export Transactions History (CSV / Excel)
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Download total records with flexible historical date filtering
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-red-700 dark:text-red-300 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* 1. Date Filter Section */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-gray-300">
              <Calendar className="w-4 h-4 text-purple-500" />
              1. Date Selection (تاریخ کی حد)
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDateMode("upto")}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-1 ${
                  dateMode === "upto"
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                    : "bg-white dark:bg-gray-800/80 border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:border-purple-400"
                }`}
              >
                <span>Up to Date</span>
                <span className="text-[10px] font-medium opacity-85">(اس تاریخ تک کا تمام ڈیٹا)</span>
              </button>

              <button
                type="button"
                onClick={() => setDateMode("all")}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-1 ${
                  dateMode === "all"
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                    : "bg-white dark:bg-gray-800/80 border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:border-purple-400"
                }`}
              >
                <span>All History</span>
                <span className="text-[10px] font-medium opacity-85">(شروع سے اب تک)</span>
              </button>

              <button
                type="button"
                onClick={() => setDateMode("range")}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-1 ${
                  dateMode === "range"
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                    : "bg-white dark:bg-gray-800/80 border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:border-purple-400"
                }`}
              >
                <span>Date Range</span>
                <span className="text-[10px] font-medium opacity-85">(مخصوص دورانیہ)</span>
              </button>
            </div>

            {/* Date Inputs according to mode */}
            {dateMode === "upto" && (
              <div className="p-3.5 bg-slate-50 dark:bg-gray-800/50 rounded-xl border border-slate-200 dark:border-gray-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-gray-300">
                    Select Cutoff Date (تاریخ منتخب کریں):
                  </label>
                  <button
                    type="button"
                    onClick={() => setUpToDate(todayStr)}
                    className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    Set to Today (آج)
                  </button>
                </div>
                <input
                  type="date"
                  value={upToDate}
                  onChange={e => setUpToDate(e.target.value)}
                  className="w-full bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-gray-400">
                  اس منتخب کردہ تاریخ تک کا جتنا بھی پچھلا ریکارڈ ہے، وہ ٹوٹل ڈیٹا ڈاؤن لوڈ فائل میں شامل ہوگا۔
                </p>
              </div>
            )}

            {dateMode === "range" && (
              <div className="p-3.5 bg-slate-50 dark:bg-gray-800/50 rounded-xl border border-slate-200 dark:border-gray-700/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">
                      From Date (تاریخ سے):
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">
                      To Date (تاریخ تک):
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {dateMode === "all" && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-xl text-xs text-purple-800 dark:text-purple-300">
                پلیٹ فارم کا آغاز سے لے کر آج تک کا مکمل تاریخی ریکارڈ ایکسپورٹ کیا جائے گا۔
              </div>
            )}
          </div>

          {/* 2. Type & Status Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-gray-300">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                2. Transaction Type
              </label>
              <div className="flex rounded-xl bg-slate-100 dark:bg-gray-800 p-1 border border-slate-200 dark:border-gray-700">
                {(["all", "deposits", "withdrawals"] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                      type === t
                        ? "bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-gray-400 hover:text-slate-900"
                    }`}
                  >
                    {t === "all" ? "All Types" : t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-gray-300">
                <Filter className="w-3.5 h-3.5 text-amber-500" />
                3. Status Filter
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Statuses (تمام اسٹیٹس)</option>
                <option value="completed">Completed (مکمل)</option>
                <option value="pending">Pending (زیرِ التواء)</option>
                <option value="approved">Approved (منظور شدہ)</option>
                <option value="rejected">Rejected (مسترد شدہ)</option>
              </select>
            </div>
          </div>

          {/* 3. Live Matching Preview Box */}
          <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
            {loading ? (
              <div className="flex items-center justify-center py-4 gap-2 text-xs font-bold text-slate-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                Fetching total unpaginated records from database...
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                      Ready to Export (ڈاؤن لوڈ کے لیے تیار):
                    </span>
                  </div>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                    {stats.total.toLocaleString()} Records
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600 dark:text-gray-300">
                  <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                    <span className="block text-slate-400 text-[10px]">Deposits</span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-400">{stats.deposits}</span>
                  </div>
                  <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                    <span className="block text-slate-400 text-[10px]">Withdrawals</span>
                    <span className="font-extrabold text-orange-600 dark:text-orange-400">{stats.withdrawals}</span>
                  </div>
                  <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                    <span className="block text-slate-400 text-[10px]">Total Volume</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">${stats.grossAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={loading || exporting || stats.total === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-xs transition-all cursor-pointer"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating CSV...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download CSV ({stats.total})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
