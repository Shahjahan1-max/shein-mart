/**
 * analytics.ts — consent-safe, fire-and-forget analytics + error tracking.
 *
 * Two sinks, both optional and never allowed to throw:
 *   1. window.dataLayer (GTM/GA4-friendly, passive observer)
 *   2. Firebase Analytics logEvent (lazy-initialized, measurementId-gated)
 *
 * Consent: `localStorage["ds-analytics-consent"] === "0"` disables all
 * tracking. Absence of the key means "not opted out" (GDPR-friendly default
 * for a consent banner that defers to the user).
 */

import type { Analytics } from "firebase/analytics";

type TrackParams = Record<string, string | number | boolean | undefined>;

let analyticsPromise: Promise<Analytics | null> | null = null;
let lastPath = "";

export const CONSENT_KEY = "ds-analytics-consent";

export type ConsentState = "granted" | "declined" | "unset";

export function isDev(): boolean {
  return import.meta.env.DEV === true;
}

/** Read the current explicit consent state (no side effects). */
export function getConsentState(): ConsentState {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    if (value === "0") return "declined";
    if (value === "1") return "granted";
  } catch {
    /* storage unavailable — treat as unset */
  }
  return "unset";
}

/** Persist an explicit user decision (from the consent banner). */
export function setAnalyticsConsent(granted: boolean): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, granted ? "1" : "0");
  } catch {
    /* storage unavailable — tracking stays gated on consentGranted() */
  }
}

/** True when tracking may run: explicit grant OR no decision AND no DNT. */
export function consentGranted(): boolean {
  try {
    if (window.localStorage.getItem(CONSENT_KEY) === "0") return false;
  } catch {
    /* fall through to DNT check */
  }
  try {
    const dnt = window.navigator.doNotTrack ?? "";
    if ((window as Window & { msDoNotTrack?: string }).msDoNotTrack === "1") return false;
    if (dnt === "1") return false;
  } catch {
    /* DNT unavailable */
  }
  return true;
}

async function loadFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (!analyticsPromise) {
    analyticsPromise = import("./firebaseClient").then(m =>
      m.initFirebaseAnalytics().catch(() => null)
    );
  }
  return analyticsPromise;
}

function pushDataLayer(name: string, params: TrackParams): void {
  try {
    if (typeof window === "undefined" || !consentGranted()) return;
    const win = window as unknown as { dataLayer?: unknown[] };
    win.dataLayer = win.dataLayer ?? [];
    win.dataLayer.push({ event: name, ...params });
  } catch {
    /* analytics must never break the app */
  }
}

function emitFirebase(name: string, params: TrackParams): void {
  if (typeof window === "undefined" || !consentGranted()) return;
  void loadFirebaseAnalytics()
    .then(a => {
      if (!a) return;
      return import("firebase/analytics").then(({ logEvent }) => logEvent(a, name, params));
    })
    .catch(() => {});
}

/** Fire a named event to both sinks. Safe to call from any component. */
export function trackEvent(name: string, params: TrackParams = {}): void {
  if (isDev()) console.info(`[analytics] ${name}`, params);
  pushDataLayer(name, params);
  emitFirebase(name, params);
}

/** Deduplicated page_view tracking (same path twice in a row is skipped). */
export function trackPageView(path: string, title?: string): void {
  if (!path || path === lastPath) return;
  lastPath = path;
  trackEvent("page_view", {
    page_path: path,
    page_title: title ?? (typeof document !== "undefined" ? document.title : path),
  });
}

/** Error reporting — surfaces runtime failures into analytics consoles. */
export function reportError(
  source: string,
  error: Error | string,
  extra: TrackParams = {}
): void {
  const message = typeof error === "string" ? error : error?.message ?? "Unknown error";
  const stack = typeof error === "string" ? undefined : error?.stack;
  if (isDev()) console.error(`[error-tracker] ${source}:`, error);
  trackEvent("error_occurred", { source, message, stack, ...extra });
}

/** Test helper only — resets module-level state. */
export function resetAnalyticsStateForTests(): void {
  analyticsPromise = null;
  lastPath = "";
}
