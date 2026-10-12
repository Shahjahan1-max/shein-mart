/**
 * Platform logic property-based tests (Requirements 2.1, 2.3, 2.6, 2.9, 17.1, 17.2, 30.1-30.4)
 *
 * Uses fast-check. 200 runs per property per design.md Section 9.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  determinePlatform,
  migratePlatformProgress,
  dedupePlatformOrders,
  type Platform,
  type PlatformProgressMap,
  type PlatformOrderLike,
} from "../data/platformShiftLogic";
import { updateTaskSession, createTaskSession } from "../data/taskSessionData";

describe("platform logic properties", () => {
  it("Property 1: platform determination is deterministic", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 10_000, noNaN: true }),
        (balance) => determinePlatform(balance) === determinePlatform(balance),
      ),
      { numRuns: 200 },
    );
  });

  it("Property 3: platform shift does not false-complete", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 24 }),
        fc.float({ min: 0, max: 1000, noNaN: true }),
        (tasksDone, totalEarned) => {
          const map: PlatformProgressMap = {
            amazon: { tasksDone, completed: false, totalEarned },
          };
          const result = migratePlatformProgress(map, "amazon", "alibaba", 25);
          return result.alibaba?.completed === false;
        },
      ),
      { numRuns: 200 },
    );
  });

  it("Property 4: order deduplication yields unique (userId, platformId) pairs", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            userId: fc.constantFrom("u1", "u2", "u3"),
            platformId: fc.constantFrom("amazon", "alibaba", "aliexpress"),
            status: fc.constantFrom("pending", "assigned", "in_progress", "completed"),
            createdAt: fc.constant(new Date().toISOString()),
            commissionRate: fc.constant(4),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (orders) => {
          const deduped = dedupePlatformOrders(orders);
          const keys = deduped.map((o) => `${o.userId}:${o.platformId}`);
          return keys.length === new Set(keys).size;
        },
      ),
      { numRuns: 200 },
    );
  });

  it("Property 2: completedCount invariant 0 <= completedCount <= totalTasks", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 55 }),
        (totalTasks, completedCount) => {
          const session = createTaskSession({ userId: "u1", taskCode: "tc1", totalTasks });
          const updated = updateTaskSession(session, {
            completedCount: Math.min(completedCount, totalTasks + 5),
          });
          return updated.completedCount >= 0 && updated.completedCount <= updated.totalTasks;
        },
      ),
      { numRuns: 200 },
    );
  });
});
