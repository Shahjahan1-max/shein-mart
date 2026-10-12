export type Platform = "amazon" | "alibaba" | "aliexpress";
export type TaskStatus = "active" | "assigned" | "in_progress" | "locked" | "completed";
export type SessionStatus = "active" | "paused" | "archived";

export interface TaskSession {
  sessionId: string;
  userId: string;
  taskCode: string;
  currentPlatform: Platform;
  highestUnlockedPlatform: Platform;
  currentTaskIndex: number;
  completedTaskIds: string[];
  pendingTaskIds: string[];
  completedCount: number;
  completedTaskCount: number;
  totalTasks: number;
  totalTaskCount: number;
  taskStatus: TaskStatus;
  status: TaskStatus;
  sessionStatus: SessionStatus;
  progressState: { totalEarned: number; lastTaskCompletedAt?: string; loopCount?: number };
  balanceState: { balanceAtSessionStart: number; balanceAtLastUpdate: number; lastBalanceCheckAt: string };
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  completedAt?: string;
}

export function normalizePlatform(value: unknown): Platform {
  return value === "alibaba" || value === "aliexpress" ? value : "amazon";
}

export function createTaskSession(input: {
  userId: string;
  taskCode: string;
  currentPlatform?: Platform;
  totalTasks?: number;
  currentBalance?: number;
  sessionId?: string;
}): TaskSession {
  const now = new Date().toISOString();
  const totalTasks = Math.max(1, Number(input.totalTasks || 25));
  const platform = normalizePlatform(input.currentPlatform);
  return {
    sessionId: input.sessionId || `ts_${input.userId}_${input.taskCode}`,
    userId: input.userId,
    taskCode: input.taskCode,
    currentPlatform: platform,
    highestUnlockedPlatform: platform,
    currentTaskIndex: 0,
    completedTaskIds: [],
    pendingTaskIds: [],
    completedCount: 0,
    completedTaskCount: 0,
    totalTasks,
    totalTaskCount: totalTasks,
    taskStatus: "in_progress",
    status: "in_progress",
    sessionStatus: "active",
    progressState: { totalEarned: 0 },
    balanceState: {
      balanceAtSessionStart: Number(input.currentBalance || 0),
      balanceAtLastUpdate: Number(input.currentBalance || 0),
      lastBalanceCheckAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function totalTasksFor(updates: Partial<TaskSession>, session: TaskSession): number {
  return Math.max(1, Number(updates.totalTaskCount ?? updates.totalTasks ?? session.totalTaskCount ?? session.totalTasks ?? 25));
}

export function updateTaskSession(session: TaskSession, updates: Partial<TaskSession>): TaskSession {
  const totalTasks = totalTasksFor(updates, session);
  const completedCount = Math.min(
    Math.max(Number(updates.completedTaskCount ?? updates.completedCount ?? session.completedTaskCount ?? session.completedCount ?? 0), 0),
    totalTasks,
  );
  const taskStatus = (updates.taskStatus || updates.status || session.taskStatus || session.status) as TaskStatus;
  const nextStatus = completedCount >= totalTasks ? "completed" : taskStatus;
  return {
    ...session,
    ...updates,
    completedCount,
    completedTaskCount: completedCount,
    totalTasks,
    totalTaskCount: totalTasks,
    taskStatus: nextStatus,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };
}

export function isSessionComplete(session: TaskSession): boolean {
  return Number(session.completedTaskCount ?? session.completedCount ?? 0) >= Number(session.totalTaskCount ?? session.totalTasks ?? 25);
}

export function mergeTaskSessions(sessions: TaskSession[]): TaskSession {
  if (!sessions.length) throw new Error("Cannot merge empty task session list.");
  const sorted = [...sessions].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const primary = sorted[0];
  const completedTaskIds = Array.from(new Set(sessions.flatMap(s => s.completedTaskIds || [])));
  const completedCount = Math.max(...sessions.map(s => Number(s.completedTaskCount ?? s.completedCount ?? 0)));
  const totalEarned = Math.max(...sessions.map(s => Number(s.progressState?.totalEarned || 0)));
  return updateTaskSession(primary, {
    completedTaskIds,
    completedCount,
    completedTaskCount: completedCount,
    currentTaskIndex: Math.max(...sessions.map(s => Number(s.currentTaskIndex || 0))),
    progressState: { ...(primary.progressState || {}), totalEarned },
  });
}

export function determinePlatformFromBalance(balance: number): Platform {
  if (balance >= 900) return "aliexpress";
  if (balance >= 500) return "alibaba";
  return "amazon";
}

export function shouldShiftPlatform(oldBalance: number, newBalance: number): boolean {
  return determinePlatformFromBalance(oldBalance) !== determinePlatformFromBalance(newBalance);
}

// ─── Additional session helpers ───────────────────────────────────────────────

/**
 * Validates a TaskSession for required fields, correct types, and logical
 * consistency. Returns a list of error strings; an empty list means valid.
 */
export function validateSession(session: TaskSession): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!session.sessionId || typeof session.sessionId !== "string") {
    errors.push("Missing or invalid sessionId");
  }
  if (!session.userId || typeof session.userId !== "string") {
    errors.push("Missing or invalid userId");
  }
  if (!session.taskCode || typeof session.taskCode !== "string") {
    errors.push("Missing or invalid taskCode");
  }

  const validPlatforms: Platform[] = ["amazon", "alibaba", "aliexpress"];
  if (!validPlatforms.includes(session.currentPlatform)) {
    errors.push("Invalid currentPlatform");
  }
  if (!validPlatforms.includes(session.highestUnlockedPlatform)) {
    errors.push("Invalid highestUnlockedPlatform");
  }

  if (typeof session.currentTaskIndex !== "number" || session.currentTaskIndex < 0) {
    errors.push("Invalid currentTaskIndex (must be >= 0)");
  }

  const completedCount = Number(session.completedTaskCount ?? session.completedCount ?? 0);
  const totalTasks = Number(session.totalTaskCount ?? session.totalTasks ?? 0);

  if (!Number.isFinite(completedCount) || completedCount < 0) {
    errors.push("Invalid completedCount (must be >= 0)");
  }
  if (!Number.isFinite(totalTasks) || totalTasks <= 0) {
    errors.push("Invalid totalTasks (must be > 0)");
  }
  if (completedCount > totalTasks) {
    errors.push("completedCount cannot exceed totalTasks");
  }

  if (!Array.isArray(session.completedTaskIds)) {
    errors.push("completedTaskIds must be an array");
  }
  if (!Array.isArray(session.pendingTaskIds)) {
    errors.push("pendingTaskIds must be an array");
  }

  if (
    !session.progressState ||
    typeof session.progressState !== "object" ||
    typeof session.progressState.totalEarned !== "number" ||
    session.progressState.totalEarned < 0
  ) {
    errors.push("Invalid progressState.totalEarned (must be a number >= 0)");
  }

  if (
    !session.balanceState ||
    typeof session.balanceState !== "object" ||
    typeof session.balanceState.balanceAtSessionStart !== "number" ||
    typeof session.balanceState.balanceAtLastUpdate !== "number" ||
    !session.balanceState.lastBalanceCheckAt
  ) {
    errors.push("Invalid balanceState");
  }

  if (!session.createdAt || typeof session.createdAt !== "string") {
    errors.push("Missing or invalid createdAt");
  }
  if (!session.updatedAt || typeof session.updatedAt !== "string") {
    errors.push("Missing or invalid updatedAt");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Returns a copy of the session with sessionStatus set to "archived"
 * and archivedAt stamped to the current time.
 */
export function archiveTaskSession(session: TaskSession): TaskSession {
  return updateTaskSession(session, {
    sessionStatus: "archived",
    archivedAt: new Date().toISOString(),
  });
}

/**
 * Returns a copy of the session with sessionStatus set to "paused".
 */
export function pauseTaskSession(session: TaskSession): TaskSession {
  return updateTaskSession(session, { sessionStatus: "paused" });
}

/**
 * Returns a copy of the session with sessionStatus set to "active".
 */
export function resumeTaskSession(session: TaskSession): TaskSession {
  return updateTaskSession(session, { sessionStatus: "active" });
}
