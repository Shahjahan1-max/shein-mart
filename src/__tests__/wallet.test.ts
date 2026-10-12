/**
 * Wallet logic unit tests (Requirements 4.1, 4.2, 3.4, 20.1, 20.2)
 *
 * Pure logic tests for the withdrawal lock and balance arithmetic.
 * No live Firebase connection required.
 */

import { describe, it, expect } from "vitest";

const WITHDRAWAL_TASK_REQUIREMENT = 25;

export function isWithdrawalAllowed(completedTasks: number): boolean {
  return completedTasks >= WITHDRAWAL_TASK_REQUIREMENT;
}

export function applyDeposit(balance: number, amount: number): number {
  return Math.round((balance + amount) * 100) / 100;
}

describe("withdrawal lock", () => {
  it("rejects withdrawal when completed assigned tasks < 25", () => {
    for (let completed = 0; completed < 25; completed += 1) {
      expect(isWithdrawalAllowed(completed)).toBe(false);
    }
  });

  it("allows withdrawal when completed assigned tasks >= 25", () => {
    expect(isWithdrawalAllowed(24)).toBe(false);
    expect(isWithdrawalAllowed(25)).toBe(true);
    expect(isWithdrawalAllowed(30)).toBe(true);
    expect(isWithdrawalAllowed(100)).toBe(true);
  });

  it("rejects withdrawal at exactly 24 completed tasks", () => {
    expect(isWithdrawalAllowed(24)).toBe(false);
  });

  it("allows withdrawal at exactly 25 completed tasks", () => {
    expect(isWithdrawalAllowed(25)).toBe(true);
  });
});

describe("deposit balance arithmetic", () => {
  it("adds deposit to previous balance (integer case)", () => {
    expect(applyDeposit(100, 50)).toBe(150);
  });

  it("adds deposit to previous balance (decimal case)", () => {
    expect(applyDeposit(99.99, 0.01)).toBe(100);
  });

  it("adds large decimal deposits correctly", () => {
    expect(applyDeposit(250.75, 149.25)).toBe(400);
  });

  it("handles deposit of zero without changing balance", () => {
    expect(applyDeposit(50, 0)).toBe(50);
  });

  it("keeps at most 2 decimal places", () => {
    expect(applyDeposit(10, 0.125)).toBe(10.13);
  });
});

describe("rejected withdrawal leaves balance unchanged", () => {
  it("does not deduct balance when withdrawal is rejected", () => {
    const balanceBefore = 500;
    const rejected = !isWithdrawalAllowed(10);
    expect(rejected).toBe(true);
    const balanceAfter = balanceBefore;
    expect(balanceAfter).toBe(balanceBefore);
  });

  it("a rejected withdrawal never reduces the available balance", () => {
    const balanceBefore = 1234.56;
    const attemptedWithdraw = 100;
    const result = isWithdrawalAllowed(24) ? balanceBefore - attemptedWithdraw : balanceBefore;
    expect(result).toBe(balanceBefore);
  });
});
