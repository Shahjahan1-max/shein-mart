/**
 * roiCalculator.test.ts — Phase 4B earnings-estimator math (pure logic).
 */

import { describe, it, expect } from "vitest";
import {
  calculateRoi,
  clampPositive,
  formatNumber,
  formatUsd,
  ROI_DEFAULT_INPUT,
} from "../data/roiCalculator";

describe("calculateRoi", () => {
  it("computes the default scenario correctly", () => {
    // 1000 visits * 3% = 30 orders; 30 * $60 = $1800; 5% commission = $90/mo; * 12 = $1080.
    const result = calculateRoi(ROI_DEFAULT_INPUT);
    expect(result.monthlyOrders).toBe(30);
    expect(result.monthlyRevenue).toBe(1800);
    expect(result.monthlyCommission).toBe(90);
    expect(result.totalCommission).toBe(1080);
  });

  it("clamps negative and non-finite inputs to zero", () => {
    const result = calculateRoi({ monthlyVisits: -500, conversionRate: NaN, commissionRate: 10, averageOrderValue: 50, months: 3 });
    expect(result.monthlyOrders).toBe(0);
    expect(result.monthlyCommission).toBe(0);
    expect(result.totalCommission).toBe(0);
  });

  it("scales linearly with visits and commission", () => {
    // Base $90/mo; 2x visits -> $180/mo; 2x commission rate -> $360/mo.
    const base = calculateRoi({ ...ROI_DEFAULT_INPUT, monthlyVisits: 2000, commissionRate: 10 });
    expect(base.monthlyOrders).toBe(60);
    expect(base.monthlyCommission).toBe(360);
    expect(base.totalCommission).toBe(4320);
  });

  it("respects the planning horizon", () => {
    const one = calculateRoi({ ...ROI_DEFAULT_INPUT, months: 1 });
    const six = calculateRoi({ ...ROI_DEFAULT_INPUT, months: 6 });
    expect(one.totalCommission * 6).toBeCloseTo(six.totalCommission, 5);
  });
});

describe("clampPositive", () => {
  it("falls back for non-finite values", () => {
    expect(clampPositive(NaN)).toBe(0);
    expect(clampPositive(Infinity)).toBe(0);
  });

  it("keeps finite non-negative numbers", () => {
    expect(clampPositive(12.5)).toBe(12.5);
    expect(clampPositive(0)).toBe(0);
  });

  it("clamps negatives to zero", () => {
    expect(clampPositive(-3)).toBe(0);
  });
});

describe("formatters", () => {
  it("formats USD with thousands separators and no cents", () => {
    expect(formatUsd(1234)).toBe("$1,234");
    expect(formatUsd(999999)).toBe("$999,999");
  });

  it("handles non-finite values safely", () => {
    expect(formatUsd(NaN)).toBe("$0.00");
  });

  it("formats plain numbers", () => {
    expect(formatNumber(12345)).toBe("12,345");
    expect(formatNumber(0)).toBe("0");
  });
});
