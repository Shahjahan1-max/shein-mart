/**
 * ROI calculator data + logic (Phase 4B — Authority & Conversion).
 * Pure, testable functions that estimate earnings from affiliate/referral
 * shopping commissions over a chosen time horizon.
 */

export interface RoiInput {
  /** Estimated visits/clicks to marketplace links per month. */
  monthlyVisits: number;
  /** Share of visits that result in a purchase, percent (0–100). */
  conversionRate: number;
  /** Commission paid by the marketplace, percent (0–100). */
  commissionRate: number;
  /** Average order value in USD. */
  averageOrderValue: number;
  /** Planning horizon in months. */
  months: number;
}

export interface RoiResult {
  monthlyOrders: number;
  monthlyRevenue: number;
  monthlyCommission: number;
  totalCommission: number;
}

export const ROI_DEFAULT_INPUT: RoiInput = {
  monthlyVisits: 1000,
  conversionRate: 3,
  commissionRate: 5,
  averageOrderValue: 60,
  months: 12,
};

/** Return a finite non-negative number (default used when invalid). */
export function clampPositive(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

/** Estimate commissions over the horizon from shopping-traffic inputs. */
export function calculateRoi(input: Partial<RoiInput> = {}): RoiResult {
  const visits = Math.round(clampPositive(input.monthlyVisits ?? 0));
  const conversion = clampPositive(input.conversionRate ?? 0) / 100;
  const commission = clampPositive(input.commissionRate ?? 0) / 100;
  const aov = clampPositive(input.averageOrderValue ?? 0);
  const months = Math.max(0, Math.round(clampPositive(input.months ?? 0)));

  const monthlyOrders = visits * conversion;
  const monthlyRevenue = monthlyOrders * aov;
  const monthlyCommission = monthlyRevenue * commission;
  const totalCommission = monthlyCommission * months;

  return {
    monthlyOrders: Math.round(monthlyOrders * 100) / 100,
    monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
    monthlyCommission: Math.round(monthlyCommission * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
  };
}

/** Format a number as USD, e.g. 1234.5 -> "$1,234.50". */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

/** Format a plain number with thousands separators. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}
