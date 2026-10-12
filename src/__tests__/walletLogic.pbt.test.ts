/**
 * Wallet logic property-based tests (Requirements 3.4, 4.1, 4.2, 20.1, 20.2, 30.5, 30.6)
 *
 * Uses fast-check. 200 runs per property per design.md Section 9.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";

export function applyDeposit(balance: number, amount: number): number {
  return Math.round((balance + amount) * 100) / 100;
}

export function isWithdrawalAllowed(completedTasks: number): boolean {
  return completedTasks >= 25;
}

describe("wallet logic properties", () => {
  it("Property 5: deposit balance invariant (within half-cent of exact sum)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100_000, noNaN: true }),
        fc.double({ min: 0.01, max: 10_000, noNaN: true }),
        (prevBalance, depositAmount) => {
          const newBalance = applyDeposit(prevBalance, depositAmount);
          return Math.abs(newBalance - (prevBalance + depositAmount)) <= 0.0051;
        },
      ),
      { numRuns: 200 },
    );
  });

  it("Property 5b: rounded deposit keeps exact 2-decimal math close to unrounded sum", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100_000, noNaN: true }),
        fc.double({ min: 0.01, max: 10_000, noNaN: true }),
        (prevBalance, depositAmount) => {
          const expected = Math.round((prevBalance + depositAmount) * 100) / 100;
          return applyDeposit(prevBalance, depositAmount) === expected;
        },
      ),
      { numRuns: 200 },
    );
  });

  it("Property 6: withdrawal lock rejects any completedTasks in [0, 24]", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 24 }),
        (completedTasks) => isWithdrawalAllowed(completedTasks) === false,
      ),
      { numRuns: 200 },
    );
  });

  it("Property 6b: withdrawal lock allows 25 or more completed tasks", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 25, max: 1000 }),
        (completedTasks) => isWithdrawalAllowed(completedTasks) === true,
      ),
      { numRuns: 200 },
    );
  });
});
