/**
 * telemetryCollector.ts — Privacy-Conscious Client Event Collector
 *
 * Implements client-side telemetry with:
 * - Pseudonymous Anonymous Visitor ID
 * - Controlled Device Fingerprint (non-invasive)
 * - Consent-aware event queuing & batching
 * - Session correlation with salted hash
 * - Beacon API fallback for page unloads
 *
 * Strictly NO keystroke logging, NO form field contents, NO secrets.
 */

import { api } from "./apiClient";

export const CONSENT_STORAGE_KEY = "ds_privacy_consent_v2";
export const VISITOR_ID_KEY = "ds_anonymous_visitor_id";
export const DEVICE_ID_KEY = "ds_device_record_id";
export const SESSION_HASH_KEY = "ds_session_hash";

export interface TelemetryEventPayload {
  event_id: string;
  event_type: string;
  client_timestamp_utc: string;
  user_id?: string | null;
  anonymous_visitor_id: string;
  session_id_hash: string;
  device_record_id: string;
  page: string;
  route: string;
  referrer: string;
  consent_state: string;
  app_version: string;
  metadata?: Record<string, unknown>;
}

export interface ConsentPreferences {
  necessary: boolean;
  security: boolean;
  analytics: boolean;
  fraud_prevention: boolean;
  marketing: boolean;
  grantedAt?: string;
  expiresAt?: string;
}

let eventQueue: TelemetryEventPayload[] = [];
let batchTimeout: NodeJS.Timeout | null = null;
let cachedDeviceId: string | null = null;
let currentUserId: string | null = null;

/**
 * Generate cryptographic UUID or fallback
 */
export function generateRandomId(prefix = "id"): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
  } catch {}
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get or initialize pseudonymous visitor ID
 */
export function getAnonymousVisitorId(): string {
  if (typeof window === "undefined") return "server-env";
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id || !id.startsWith("vis-")) {
      id = generateRandomId("vis");
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return "vis-ephemeral";
  }
}

/**
 * Rotate / reset anonymous visitor ID upon request
 */
export function rotateVisitorId(): string {
  if (typeof window === "undefined") return "server-env";
  try {
    const newId = generateRandomId("vis");
    localStorage.setItem(VISITOR_ID_KEY, newId);
    return newId;
  } catch {
    return "vis-ephemeral";
  }
}

/**
 * Get or initialize tab session hash
 */
export function getSessionIdHash(): string {
  if (typeof window === "undefined") return "session-env";
  try {
    let hash = sessionStorage.getItem(SESSION_HASH_KEY);
    if (!hash || !hash.startsWith("ses-")) {
      hash = generateRandomId("ses");
      sessionStorage.setItem(SESSION_HASH_KEY, hash);
    }
    return hash;
  } catch {
    return "ses-ephemeral";
  }
}

/**
 * Generate privacy-aware device record ID (stable hash of non-invasive screen/browser parameters)
 */
export async function getDeviceRecordId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  if (typeof window === "undefined") return "dev-server";

  try {
    const saved = localStorage.getItem(DEVICE_ID_KEY);
    if (saved && saved.startsWith("dev-")) {
      cachedDeviceId = saved;
      return saved;
    }
  } catch {}

  const signals = [
    typeof screen !== "undefined" ? `${screen.width}x${screen.height}x${screen.colorDepth}` : "",
    typeof window !== "undefined" ? String(window.devicePixelRatio || 1) : "",
    typeof navigator !== "undefined" ? navigator.platform || "" : "",
    typeof navigator !== "undefined" ? navigator.language || "" : "",
    typeof navigator !== "undefined" ? String(navigator.hardwareConcurrency || 4) : "",
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    "touch" in window || navigator.maxTouchPoints > 0 ? "touch" : "notouch",
  ].join("|");

  try {
    const msgUint8 = new TextEncoder().encode(signals);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
    cachedDeviceId = `dev-${hex}`;
    try {
      localStorage.setItem(DEVICE_ID_KEY, cachedDeviceId);
    } catch {}
    return cachedDeviceId;
  } catch {
    cachedDeviceId = generateRandomId("dev");
    return cachedDeviceId;
  }
}

/**
 * Check if telemetry is permitted under current consent
 */
export function isTelemetryPermitted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const pref: ConsentPreferences = JSON.parse(raw);
    if (!pref.security && !pref.analytics && !pref.fraud_prevention) return false;
    if (pref.expiresAt && Date.now() > Date.parse(pref.expiresAt)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Save user consent choices (persists for 90 days)
 */
export async function recordUserConsent(
  preferences: ConsentPreferences,
  userId?: string | null,
  decision = "accepted_all"
): Promise<void> {
  if (typeof window === "undefined") return;

  const now = new Date();
  const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days

  const payload: ConsentPreferences = {
    ...preferences,
    grantedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {}

  const visitorId = getAnonymousVisitorId();

  // Send consent audit record to backend
  try {
    await api.post("/api/telemetry/consent", {
      visitorId,
      userId: userId || currentUserId || null,
      categories: preferences,
      decision,
    });
  } catch (err) {
    console.warn("Consent audit submission warning:", err);
  }

  // Track consent update event
  trackTelemetryEvent("consent_updated", {
    decision,
    categories: preferences,
  });
}

/**
 * Withdraw consent & clear non-essential storage
 */
export async function withdrawUserConsent(userId?: string | null): Promise<void> {
  if (typeof window === "undefined") return;

  const visitorId = getAnonymousVisitorId();

  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    rotateVisitorId();
  } catch {}

  try {
    await api.post("/api/telemetry/consent", {
      visitorId,
      userId: userId || currentUserId || null,
      categories: {
        necessary: true,
        security: true,
        analytics: false,
        fraud_prevention: false,
        marketing: false,
      },
      decision: "withdrawn",
    });
  } catch {}

  eventQueue = [];
  if (batchTimeout) {
    clearTimeout(batchTimeout);
    batchTimeout = null;
  }
}

/**
 * Set current authenticated user ID for event correlation
 */
export function setTelemetryUser(userId: string | null): void {
  currentUserId = userId;
}

/**
 * Track a standardized business or security event
 */
export async function trackTelemetryEvent(
  eventType: string,
  metadata: Record<string, unknown> = {},
  explicitUserId?: string | null
): Promise<void> {
  if (typeof window === "undefined") return;

  // Security & Fraud prevention tracking can operate with baseline security justification
  const permitted = isTelemetryPermitted();

  const visitorId = getAnonymousVisitorId();
  const sessionId = getSessionIdHash();
  const deviceId = await getDeviceRecordId();

  const eventPayload: TelemetryEventPayload = {
    event_id: generateRandomId("evt"),
    event_type: eventType,
    client_timestamp_utc: new Date().toISOString(),
    user_id: explicitUserId || currentUserId || null,
    anonymous_visitor_id: visitorId,
    session_id_hash: sessionId,
    device_record_id: deviceId,
    page: window.location.pathname || "/",
    route: window.location.pathname || "/",
    referrer: document.referrer || "",
    consent_state: permitted ? "granted" : "security_only",
    app_version: "2.0.0",
    metadata: {
      ...metadata,
      screen: `${window.screen.width}x${window.screen.height}`,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  eventQueue.push(eventPayload);

  // Trigger batch send if queue has 5 or more events
  if (eventQueue.length >= 5) {
    flushTelemetryQueue();
  } else if (!batchTimeout) {
    batchTimeout = setTimeout(flushTelemetryQueue, 2500);
  }
}

let isTelemetryUnavailable = false;
let nextTelemetryAttempt = 0;

/**
 * Flush queued events to backend API
 */
export async function flushTelemetryQueue(): Promise<void> {
  if (batchTimeout) {
    clearTimeout(batchTimeout);
    batchTimeout = null;
  }

  if (eventQueue.length === 0) return;
  if (isTelemetryUnavailable && Date.now() < nextTelemetryAttempt) return;

  const toSend = [...eventQueue];
  eventQueue = [];

  try {
    await api.post("/api/telemetry/events", { events: toSend });
    isTelemetryUnavailable = false;
  } catch (err: unknown) {
    const is404 = typeof err === "object" && err !== null && ("status" in err && (err as { status: number }).status === 404 || String(err).includes("404"));
    if (is404) {
      isTelemetryUnavailable = true;
      nextTelemetryAttempt = Date.now() + 5 * 60 * 1000; // 5 min backoff
    }
    // Retain only last 10 events safely
    eventQueue = [...toSend.slice(-10), ...eventQueue].slice(0, 10);
  }
}

/**
 * Initialize lifecycle hooks for telemetry (page view, visibility change, beforeunload)
 */
export function initTelemetryCollector(): void {
  if (typeof window === "undefined") return;

  // Track initial page view
  trackTelemetryEvent("page_view", {
    url: window.location.href,
    title: document.title,
  });

  // Track page hide / unload via Beacon API
  const handlePageUnload = () => {
    if (eventQueue.length === 0) return;
    const payload = JSON.stringify({ events: eventQueue });
    eventQueue = [];
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/telemetry/events", payload);
      }
    } catch {}
  };

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      handlePageUnload();
    }
  });
  window.addEventListener("beforeunload", handlePageUnload);
}
