export type Platform = "amazon" | "alibaba" | "aliexpress";

export interface PlatformThresholds {
  amazon: [number, number];
  alibaba: [number, number];
  aliexpress: [number, number];
}

export interface PlatformProgressState {
  tasksDone: number;
  completed: boolean;
  totalEarned: number;
}

export type PlatformProgressMap = Record<string, PlatformProgressState>;

export interface PlatformOrderLike {
  id: string;
  userId: string;
  platformId: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  assignedAt?: string;
  completedAt?: string;
  [key: string]: unknown;
}

export function getPlatformThresholds(): PlatformThresholds {
  return {
    amazon: [0, 499],
    alibaba: [500, 899],
    aliexpress: [900, Infinity],
  };
}

export function determinePlatform(balance: number): Platform {
  if (balance >= 900) return "aliexpress";
  if (balance >= 500) return "alibaba";
  return "amazon";
}

export function detectPlatformShift(oldBalance: number, newBalance: number): boolean {
  return determinePlatform(oldBalance) !== determinePlatform(newBalance);
}

export function getAllPlatforms(): Platform[] {
  return ["amazon", "alibaba", "aliexpress"];
}

export function isValidPlatform(platform: string): platform is Platform {
  return getAllPlatforms().includes(platform as Platform);
}

export function migratePlatformProgress(
  progress: PlatformProgressMap,
  sourcePlatform: Platform,
  targetPlatform: Platform,
  totalTasks = 25,
): PlatformProgressMap {
  const source = progress[sourcePlatform];
  if (!source || sourcePlatform === targetPlatform || progress[targetPlatform]) {
    return { ...progress };
  }

  return {
    ...progress,
    [targetPlatform]: {
      tasksDone: source.tasksDone,
      totalEarned: source.totalEarned,
      completed: false,
    },
  };
}

function orderRank(order: PlatformOrderLike): number {
  const statusRank: Record<string, number> = {
    in_progress: 5,
    assigned: 4,
    pending: 3,
    reassignment_requested: 2,
    completed: 1,
  };
  return statusRank[order.status] ?? 0;
}

function orderTime(order: PlatformOrderLike): number {
  const value = order.updatedAt ?? order.assignedAt ?? order.completedAt ?? order.createdAt ?? "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function dedupePlatformOrders<T extends PlatformOrderLike>(orders: T[]): T[] {
  const byUserPlatform = new Map<string, T>();

  for (const order of orders) {
    const key = `${order.userId}:${order.platformId}`;
    const existing = byUserPlatform.get(key);
    if (!existing) {
      byUserPlatform.set(key, order);
      continue;
    }

    const currentRank = orderRank(order);
    const existingRank = orderRank(existing);
    if (
      currentRank > existingRank ||
      (currentRank === existingRank && orderTime(order) >= orderTime(existing))
    ) {
      byUserPlatform.set(key, order);
    }
  }

  return Array.from(byUserPlatform.values());
}

// ─── Additional platform helpers ─────────────────────────────────────────────

/**
 * Result of a platform shift analysis.
 */
export interface PlatformShiftResult {
  shifted: boolean;
  oldPlatform: Platform;
  newPlatform: Platform;
  reason: string;
}

/**
 * Checks if a user can access a specific platform based on their balance.
 * A user can access a platform when their balance falls within that platform's range.
 */
export function canAccessPlatform(balance: number, platform: Platform): boolean {
  const thresholds = getPlatformThresholds();
  const [min, max] = thresholds[platform];
  return balance >= min && balance <= max;
}

/**
 * Returns detailed information about a platform shift between two balances,
 * including which platforms are involved and a human-readable reason.
 */
export function getPlatformShiftDetails(
  oldBalance: number,
  newBalance: number,
): PlatformShiftResult {
  const oldPlatform = determinePlatform(oldBalance);
  const newPlatform = determinePlatform(newBalance);
  const shifted = oldPlatform !== newPlatform;

  let reason: string;
  if (shifted) {
    reason =
      newBalance > oldBalance
        ? `Balance increased from ${oldBalance} to ${newBalance} USDT`
        : `Balance decreased from ${oldBalance} to ${newBalance} USDT`;
  } else {
    reason = `No platform shift (balance changed from ${oldBalance} to ${newBalance} USDT)`;
  }

  return { shifted, oldPlatform, newPlatform, reason };
}

/**
 * Returns true when the balance change moves the user to a higher platform tier.
 * Platform hierarchy: amazon (0) < alibaba (1) < aliexpress (2)
 */
export function isUpgrade(oldBalance: number, newBalance: number): boolean {
  const order: Record<Platform, number> = { amazon: 0, alibaba: 1, aliexpress: 2 };
  return order[determinePlatform(newBalance)] > order[determinePlatform(oldBalance)];
}

/**
 * Returns true when the balance change moves the user to a lower platform tier.
 * Platform hierarchy: amazon (0) < alibaba (1) < aliexpress (2)
 */
export function isDowngrade(oldBalance: number, newBalance: number): boolean {
  const order: Record<Platform, number> = { amazon: 0, alibaba: 1, aliexpress: 2 };
  return order[determinePlatform(newBalance)] < order[determinePlatform(oldBalance)];
}

/**
 * Returns the minimum balance required to access a specific platform.
 */
export function getMinimumBalance(platform: Platform): number {
  return getPlatformThresholds()[platform][0];
}

/**
 * Returns the maximum balance for a specific platform tier.
 * Returns Infinity for aliexpress (highest tier).
 */
export function getMaximumBalance(platform: Platform): number {
  return getPlatformThresholds()[platform][1];
}

/**
 * Returns the next platform tier above the given one,
 * or null if already on the highest tier (aliexpress).
 */
export function getNextPlatform(platform: Platform): Platform | null {
  if (platform === "amazon") return "alibaba";
  if (platform === "alibaba") return "aliexpress";
  return null;
}

/**
 * Returns the previous platform tier below the given one,
 * or null if already on the lowest tier (amazon).
 */
export function getPreviousPlatform(platform: Platform): Platform | null {
  if (platform === "aliexpress") return "alibaba";
  if (platform === "alibaba") return "amazon";
  return null;
}

/**
 * Returns how much more balance is needed to reach the next platform tier,
 * or null if the user is already on the highest tier.
 */
export function getBalanceToNextTier(currentBalance: number): number | null {
  const next = getNextPlatform(determinePlatform(currentBalance));
  if (!next) return null;
  return Math.max(0, getMinimumBalance(next) - currentBalance);
}
