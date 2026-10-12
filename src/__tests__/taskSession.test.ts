/**
 * Task session unit tests (Requirements 29.4, 29.5, 2.1, 2.6, 19.2)
 */
import { describe, it, expect } from "vitest";
import {
  createTaskSession,
  updateTaskSession,
  isSessionComplete,
  mergeTaskSessions,
  validateSession,
  determinePlatformFromBalance,
  shouldShiftPlatform,
} from "../data/taskSessionData";

describe("createTaskSession", () => {
  it("produces completedCount: 0", () => {
    const session = createTaskSession({ userId: "u1", taskCode: "TC-1", totalTasks: 25 });
    expect(session.completedCount).toBe(0);
    expect(session.completedTaskCount).toBe(0);
    expect(session.currentTaskIndex).toBe(0);
  });

  it("normalizes an invalid platform to amazon", () => {
    const session = createTaskSession({
      userId: "u1",
      taskCode: "TC-1",
      currentPlatform: "unknown" as "amazon",
    });
    expect(session.currentPlatform).toBe("amazon");
  });

  it("defaults totalTasks to 25 when not provided", () => {
    const session = createTaskSession({ userId: "u1", taskCode: "TC-1" });
    expect(session.totalTasks).toBe(25);
    expect(session.totalTaskCount).toBe(25);
  });

  it("sets initial balance state from currentBalance", () => {
    const session = createTaskSession({ userId: "u1", taskCode: "TC-1", currentBalance: 250 });
    expect(session.balanceState.balanceAtSessionStart).toBe(250);
    expect(session.balanceState.balanceAtLastUpdate).toBe(250);
  });
});

describe("updateTaskSession", () => {
  it("clamps completedCount to totalTasks", () => {
    const session = createTaskSession({ userId: "u1", taskCode: "TC-1", totalTasks: 10 });
    const updated = updateTaskSession(session, { completedCount: 25 });
    expect(updated.completedCount).toBe(10);
    expect(updated.completedTaskCount).toBe(10);
  });

  it("marks session completed when completedCount reaches totalTasks", () => {
    const session = createTaskSession({ userId: "u1", taskCode: "TC-1", totalTasks: 5 });
    const updated = updateTaskSession(session, { completedCount: 5 });
    expect(updated.status).toBe("completed");
    expect(updated.taskStatus).toBe("completed");
  });

  it("keeps session in_progress before completion", () => {
    const session = createTaskSession({ userId: "u1", taskCode: "TC-1", totalTasks: 5 });
    const updated = updateTaskSession(session, { completedCount: 3 });
    expect(updated.status).toBe("in_progress");
  });

  it("does not let completedCount drop below 0", () => {
    const session = createTaskSession({ userId: "u1", taskCode: "TC-1", totalTasks: 5 });
    const updated = updateTaskSession(session, { completedCount: -5 });
    expect(updated.completedCount).toBe(0);
  });

  it("updates updatedAt timestamp", () => {
    const session = createTaskSession({ userId: "u1", taskCode: "TC-1" });
    const updated = updateTaskSession(session, {});
    expect(updated.updatedAt).toBeDefined();
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(0);
  });
});

describe("isSessionComplete", () => {
  it("returns true when completedCount equals totalTasks", () => {
    const session = updateTaskSession(
      createTaskSession({ userId: "u1", taskCode: "TC-1", totalTasks: 25 }),
      { completedCount: 25 },
    );
    expect(isSessionComplete(session)).toBe(true);
  });

  it("returns false when completedCount is below totalTasks", () => {
    const session = updateTaskSession(
      createTaskSession({ userId: "u1", taskCode: "TC-1", totalTasks: 25 }),
      { completedCount: 10 },
    );
    expect(isSessionComplete(session)).toBe(false);
  });
});

describe("mergeTaskSessions", () => {
  it("merges unique completedTaskIds across sessions", () => {
    const s1 = createTaskSession({ userId: "u1", taskCode: "TC-1" });
    const s2 = createTaskSession({ userId: "u1", taskCode: "TC-1" });
    const a = updateTaskSession(s1, { completedTaskIds: ["t1", "t2"], completedCount: 2 });
    const b = updateTaskSession(s2, { completedTaskIds: ["t2", "t3"], completedCount: 2 });
    const merged = mergeTaskSessions([a, b]);
    expect(merged.completedTaskIds).toEqual(["t1", "t2", "t3"]);
  });

  it("takes the max completedCount across sessions", () => {
    const s1 = createTaskSession({ userId: "u1", taskCode: "TC-1" });
    const s2 = createTaskSession({ userId: "u1", taskCode: "TC-1" });
    const a = updateTaskSession(s1, { completedCount: 5 });
    const b = updateTaskSession(s2, { completedCount: 8 });
    const merged = mergeTaskSessions([a, b]);
    expect(merged.completedCount).toBe(8);
  });

  it("throws on an empty list", () => {
    expect(() => mergeTaskSessions([])).toThrow();
  });
});

describe("determinePlatformFromBalance", () => {
  it("maps boundary values to the correct platform", () => {
    expect(determinePlatformFromBalance(0)).toBe("amazon");
    expect(determinePlatformFromBalance(499)).toBe("amazon");
    expect(determinePlatformFromBalance(500)).toBe("alibaba");
    expect(determinePlatformFromBalance(899)).toBe("alibaba");
    expect(determinePlatformFromBalance(900)).toBe("aliexpress");
  });

  it("maps balances just above boundaries", () => {
    expect(determinePlatformFromBalance(499.99)).toBe("amazon");
    expect(determinePlatformFromBalance(500.01)).toBe("alibaba");
    expect(determinePlatformFromBalance(899.99)).toBe("alibaba");
    expect(determinePlatformFromBalance(900.01)).toBe("aliexpress");
  });

  it("maps negative balances to amazon", () => {
    expect(determinePlatformFromBalance(-100)).toBe("amazon");
  });
});

describe("shouldShiftPlatform", () => {
  it("returns true when crossing a platform threshold", () => {
    expect(shouldShiftPlatform(499, 500)).toBe(true);
    expect(shouldShiftPlatform(899, 900)).toBe(true);
    expect(shouldShiftPlatform(500, 499)).toBe(true);
  });

  it("returns false when staying on the same platform", () => {
    expect(shouldShiftPlatform(100, 400)).toBe(false);
    expect(shouldShiftPlatform(600, 800)).toBe(false);
    expect(shouldShiftPlatform(950, 1000)).toBe(false);
  });
});

describe("validateSession", () => {
  it("rejects sessions where completedCount > totalTasks", () => {
    const session = createTaskSession({ userId: "u1", taskCode: "TC-1", totalTasks: 10 });
    const bad = { ...session, completedCount: 11, completedTaskCount: 11 };
    const result = validateSession(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("cannot exceed"))).toBe(true);
  });

  it("accepts a valid session", () => {
    const session = createTaskSession({ userId: "u1", taskCode: "TC-1", totalTasks: 10 });
    expect(validateSession(session).valid).toBe(true);
  });

  it("rejects a session with invalid platform", () => {
    const session = createTaskSession({ userId: "u1", taskCode: "TC-1" });
    const bad = { ...session, currentPlatform: "ebay" as "amazon" };
    const result = validateSession(bad);
    expect(result.valid).toBe(false);
  });

  it("rejects a session missing sessionId", () => {
    const session = createTaskSession({ userId: "u1", taskCode: "TC-1" });
    const bad = { ...session, sessionId: "" };
    const result = validateSession(bad);
    expect(result.valid).toBe(false);
  });
});
