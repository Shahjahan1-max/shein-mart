import { api } from "./apiClient";
import { listFirebaseDocs } from "./apiClient";
import type { ApiDeposit, ApiWithdrawal } from "../hooks/useApi";

export interface ExportableTransaction {
  id: string;
  kind: "Deposit" | "Withdrawal";
  userId: string;
  userName: string;
  amount: number;
  bonusOrTaxAmount: number;
  bonusOrTaxType: string;
  netAmount: number;
  protocol: string;
  walletAddress: string;
  status: string;
  displayDate: string;
  dateObj: Date | null;
  createdAtRaw: string;
  proofUrl?: string;
}

export interface TransactionExportFilter {
  dateMode: "upto" | "all" | "range";
  upToDate?: string;     // YYYY-MM-DD
  startDate?: string;    // YYYY-MM-DD
  endDate?: string;      // YYYY-MM-DD
  type: "all" | "deposits" | "withdrawals";
  status: "all" | string;
  searchQuery?: string;
}

/**
 * Safely parse a transaction's timestamp from createdAt, date, or creditedAt
 */
export function parseTxDate(raw?: { createdAt?: string; date?: string; creditedAt?: string } | null): Date | null {
  if (!raw) return null;
  if (raw.createdAt) {
    const d = new Date(raw.createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (raw.date) {
    const d = new Date(raw.date);
    if (!isNaN(d.getTime())) return d;
  }
  if (raw.creditedAt) {
    const d = new Date(raw.creditedAt);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Normalize an ApiDeposit into unified exportable transaction format
 */
export function normalizeDeposit(dep: ApiDeposit): ExportableTransaction {
  const bonus = Number(dep.bonusAmount) || 0;
  const net = dep.creditedAmount != null && dep.creditedAmount > 0 ? dep.creditedAmount : (dep.amount + bonus);
  return {
    id: dep.id || "",
    kind: "Deposit",
    userId: dep.userId || "",
    userName: dep.userName || "User",
    amount: Number(dep.amount) || 0,
    bonusOrTaxAmount: bonus,
    bonusOrTaxType: dep.bonusType ? `Bonus (${dep.bonusType})` : (bonus > 0 ? "Bonus" : ""),
    netAmount: net,
    protocol: dep.protocol || "TRC20",
    walletAddress: dep.walletAddress || "",
    status: dep.status || "pending",
    displayDate: dep.date || (dep.createdAt ? new Date(dep.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""),
    dateObj: parseTxDate(dep),
    createdAtRaw: dep.createdAt || "",
    proofUrl: dep.proofUrl || "",
  };
}

/**
 * Normalize an ApiWithdrawal into unified exportable transaction format
 */
export function normalizeWithdrawal(wd: ApiWithdrawal): ExportableTransaction {
  const tax = Number(wd.taxAmount) || 0;
  const net = wd.finalPayout != null && wd.finalPayout > 0 ? wd.finalPayout : (wd.amount - tax);
  return {
    id: wd.id || "",
    kind: "Withdrawal",
    userId: wd.userId || "",
    userName: wd.userName || "User",
    amount: Number(wd.amount) || 0,
    bonusOrTaxAmount: tax,
    bonusOrTaxType: wd.taxType ? `Tax (${wd.taxType})` : (tax > 0 ? "Tax" : ""),
    netAmount: net,
    protocol: wd.protocol || "TRC20",
    walletAddress: wd.address || "",
    status: wd.status || "pending",
    displayDate: wd.date || (wd.createdAt ? new Date(wd.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""),
    dateObj: parseTxDate(wd),
    createdAtRaw: wd.createdAt || "",
  };
}

/**
 * Fetch total unpaginated deposits and withdrawals from backend / database
 */
export async function fetchAllTransactionsData(): Promise<{
  deposits: ExportableTransaction[];
  withdrawals: ExportableTransaction[];
  combined: ExportableTransaction[];
}> {
  // Fetch deposits (unpaginated)
  let rawDeposits: ApiDeposit[] = [];
  try {
    const res = await api.get<{ success: boolean; data: ApiDeposit[] }>("/api/deposits", { requiresAdmin: true });
    if (Array.isArray(res?.data)) rawDeposits = res.data;
  } catch (err) {
    console.warn("Direct /api/deposits fetch failed, trying Firebase fallback:", err);
  }
  if (!rawDeposits.length) {
    try {
      rawDeposits = await listFirebaseDocs<ApiDeposit>("deposits");
    } catch (fbErr) {
      console.error("Firebase fallback for deposits failed:", fbErr);
    }
  }

  // Fetch withdrawals (unpaginated)
  let rawWithdrawals: ApiWithdrawal[] = [];
  try {
    const res = await api.get<{ success: boolean; data: ApiWithdrawal[] }>("/api/withdrawals", { requiresAdmin: true });
    if (Array.isArray(res?.data)) rawWithdrawals = res.data;
  } catch (err) {
    console.warn("Direct /api/withdrawals fetch failed, trying Firebase fallback:", err);
  }
  if (!rawWithdrawals.length) {
    try {
      rawWithdrawals = await listFirebaseDocs<ApiWithdrawal>("withdrawals");
    } catch (fbErr) {
      console.error("Firebase fallback for withdrawals failed:", fbErr);
    }
  }

  const deposits = rawDeposits.map(normalizeDeposit);
  const withdrawals = rawWithdrawals.map(normalizeWithdrawal);
  const combined = [...deposits, ...withdrawals].sort((a, b) => {
    const timeA = a.dateObj ? a.dateObj.getTime() : 0;
    const timeB = b.dateObj ? b.dateObj.getTime() : 0;
    return timeB - timeA;
  });

  return { deposits, withdrawals, combined };
}

/**
 * Filter transactions based on date cut-off, range, type, status, and search query
 */
export function filterTransactionsForExport(
  items: ExportableTransaction[],
  filter: TransactionExportFilter,
): ExportableTransaction[] {
  let result = items;

  // 1. Filter by kind / type
  if (filter.type === "deposits") {
    result = result.filter(item => item.kind === "Deposit");
  } else if (filter.type === "withdrawals") {
    result = result.filter(item => item.kind === "Withdrawal");
  }

  // 2. Filter by status
  if (filter.status && filter.status !== "all") {
    const s = filter.status.toLowerCase();
    result = result.filter(item => item.status.toLowerCase() === s);
  }

  // 3. Filter by search query
  if (filter.searchQuery && filter.searchQuery.trim()) {
    const q = filter.searchQuery.trim().toLowerCase();
    result = result.filter(item =>
      item.userName.toLowerCase().includes(q) ||
      item.userId.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.walletAddress.toLowerCase().includes(q)
    );
  }

  // 4. Filter by date
  if (filter.dateMode === "upto" && filter.upToDate) {
    // Cut-off: all data up to the end of the specified day (23:59:59.999 local)
    const [y, m, d] = filter.upToDate.split("-").map(Number);
    const cutOff = new Date(y, m - 1, d, 23, 59, 59, 999);
    result = result.filter(item => {
      if (!item.dateObj) return true; // Keep if date could not be parsed
      return item.dateObj.getTime() <= cutOff.getTime();
    });
  } else if (filter.dateMode === "range") {
    let start: Date | null = null;
    let end: Date | null = null;

    if (filter.startDate) {
      const [sy, sm, sd] = filter.startDate.split("-").map(Number);
      start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    }
    if (filter.endDate) {
      const [ey, em, ed] = filter.endDate.split("-").map(Number);
      end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
    }

    result = result.filter(item => {
      if (!item.dateObj) return true;
      const t = item.dateObj.getTime();
      if (start && t < start.getTime()) return false;
      if (end && t > end.getTime()) return false;
      return true;
    });
  }

  return result;
}

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Build RFC 4180 CSV string with UTF-8 BOM and trigger client-side download
 */
export function exportTransactionsToCsv(
  items: ExportableTransaction[],
  customFilename?: string,
): { count: number; filename: string } {
  const headers = [
    "Transaction ID",
    "Type",
    "User Name",
    "User ID",
    "Amount (USDT)",
    "Bonus / Tax Amount (USDT)",
    "Adjustment Note",
    "Net Amount (USDT)",
    "Protocol",
    "Wallet Address",
    "Status",
    "Date",
    "Timestamp (ISO)",
    "Proof URL",
  ];

  const rows = items.map(tx => [
    escapeCsv(tx.id),
    escapeCsv(tx.kind),
    escapeCsv(tx.userName),
    escapeCsv(tx.userId),
    escapeCsv(tx.amount.toFixed(2)),
    escapeCsv(tx.bonusOrTaxAmount > 0 ? tx.bonusOrTaxAmount.toFixed(2) : "0.00"),
    escapeCsv(tx.bonusOrTaxType || "-"),
    escapeCsv(tx.netAmount.toFixed(2)),
    escapeCsv(tx.protocol),
    escapeCsv(tx.walletAddress),
    escapeCsv(tx.status),
    escapeCsv(tx.displayDate),
    escapeCsv(tx.createdAtRaw),
    escapeCsv(tx.proofUrl || ""),
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const todayStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `dealxstocks_transactions_${todayStr}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { count: items.length, filename };
}
