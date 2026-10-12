/**
 * platformSoftLock.ts — Pure UI/navigation logic for platform card soft-lock behavior.
 *
 * Soft-lock behavior:
 * - All three platform cards remain visible at all times.
 * - Only the balance-based active platform opens the real task screen.
 * - Non-active unlocked cards show a notice and redirect to the active platform on click.
 * - No new task session is created from an inactive card.
 * - Progress is preserved across platform shifts.
 *
 * This file contains NO localStorage access, NO API calls, NO Firebase writes,
 * and NO imports from adminData, userSyncApi, or teamUtils.
 * Platform determination is delegated to determinePlatform() from platformShiftLogic.
 */

import { determinePlatform } from "./platformShiftLogic";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlatformId = "amazon" | "alibaba" | "aliexpress";

/**
 * Describes the full state of a single platform card as seen by the UI.
 */
export interface PlatformCardState {
  platformId: PlatformId;
  isActive: boolean;
  isUnlocked: boolean;
  isCompleted: boolean;
  hasPendingReassignment: boolean;
  activePlatformId: PlatformId;
}

// ─── Card state helpers ───────────────────────────────────────────────────────

/**
 * Returns true when a platform card should show soft-lock behavior:
 * the card is unlocked but not the currently active platform and not completed.
 * Soft-locked cards are visible but redirect to the active platform on click.
 */
export function isSoftLocked(state: PlatformCardState): boolean {
  return state.isUnlocked && !state.isActive && !state.isCompleted;
}

// ─── Navigation helpers ───────────────────────────────────────────────────────

/**
 * Returns the platform the user should be navigated to when clicking a card:
 * - Locked card (not unlocked): null — button should be disabled.
 * - Active card: the card's own platformId.
 * - Inactive unlocked card: the activePlatformId (redirect, no new session).
 */
export function getNavigationTarget(
  platformId: PlatformId,
  activePlatformId: PlatformId,
  isUnlocked: boolean,
): PlatformId | null {
  if (!isUnlocked) return null;
  if (platformId === activePlatformId) return platformId;
  return activePlatformId;
}

/**
 * Returns the route path for a given platform:
 * - amazon  → /dashboard/ad-task
 * - others  → /dashboard/menu/{platformId}
 */
export function getPlatformRoutePath(platformId: PlatformId): string {
  if (platformId === "amazon") return "/dashboard/ad-task";
  return `/dashboard/menu/${platformId}`;
}

/**
 * Validates that a navigation from one platform to another is allowed.
 * Navigation to a non-active platform is always invalid — the caller should
 * redirect to the active platform instead to prevent new session creation.
 */
export function validatePlatformShift(
  fromPlatformId: PlatformId,
  toPlatformId: PlatformId,
  activePlatformId: PlatformId,
): { valid: boolean; reason?: string } {
  if (toPlatformId === activePlatformId) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: `Cannot navigate to ${toPlatformId} when active platform is ${activePlatformId}. Redirecting to active platform.`,
  };
}

// ─── UI state derivation ──────────────────────────────────────────────────────

/**
 * Derives the full visual state for a platform card from the user's balance
 * and the card's unlock/completion status.
 *
 * Active platform is determined purely from balance via determinePlatform().
 * No localStorage or API calls are made.
 */
export function getPlatformCardUIState(
  platformId: PlatformId,
  balance: number,
  isUnlocked: boolean,
  isCompleted: boolean,
  hasPendingReassignment: boolean,
): {
  isActive: boolean;
  isInactive: boolean;
  isLocked: boolean;
  showActiveIndicator: boolean;
  showInactiveIndicator: boolean;
  showLockedIndicator: boolean;
  cardOpacity: string;
  borderColor: string;
} {
  const activePlatformId = determinePlatform(balance) as PlatformId;
  const isActive = platformId === activePlatformId;
  const isInactive = isUnlocked && !isActive;
  const isLocked = !isUnlocked;

  return {
    isActive,
    isInactive,
    isLocked,
    showActiveIndicator: isActive && !isCompleted,
    showInactiveIndicator: isInactive && !isCompleted,
    showLockedIndicator: isLocked,
    cardOpacity: isLocked ? "opacity-50" : isInactive ? "opacity-75" : "opacity-100",
    borderColor: isActive
      ? "border-gray-100 dark:border-gray-800"
      : isInactive
      ? "border-amber-200 dark:border-amber-900/40"
      : "border-gray-100 dark:border-gray-800",
  };
}
