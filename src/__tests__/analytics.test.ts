/**
 * analytics.test.ts — consent-safe tracking lib (Phase 6C).
 * firebaseClient is mocked so jsdom tests never touch Firebase.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/firebaseClient", () => ({
  initFirebaseAnalytics: vi.fn(async () => null),
  firebaseApp: {},
  firebaseConfig: { measurementId: "G-TEST" },
}));

import {
  trackEvent,
  trackPageView,
  reportError,
  consentGranted,
  getConsentState,
  setAnalyticsConsent,
  resetAnalyticsStateForTests,
} from "../lib/analytics";

function dataLayer(): Array<Record<string, unknown>> {
  return (window as unknown as { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [];
}

beforeEach(() => {
  delete (window as unknown as { dataLayer?: unknown }).dataLayer;
  try {
    window.localStorage.removeItem("ds-analytics-consent");
  } catch {}
  resetAnalyticsStateForTests();
});

describe("analytics lib", () => {
  it("tracks an event into dataLayer", () => {
    trackEvent("test_event", { page: "/x", n: 2 });
    expect(dataLayer()).toEqual([{ event: "test_event", page: "/x", n: 2 }]);
  });

  it("honors the opt-out consent flag", () => {
    window.localStorage.setItem("ds-analytics-consent", "0");
    expect(consentGranted()).toBe(false);
    trackEvent("blocked_event");
    expect(dataLayer()).toEqual([]);
  });

  it("treats missing consent key as granted", () => {
    expect(consentGranted()).toBe(true);
  });

  it("tracks explicit consent decisions round-trip", () => {
    expect(getConsentState()).toBe("unset");
    setAnalyticsConsent(true);
    expect(getConsentState()).toBe("granted");
    expect(consentGranted()).toBe(true);
    setAnalyticsConsent(false);
    expect(getConsentState()).toBe("declined");
    expect(consentGranted()).toBe(false);
  });

  it("honors the Do-Not-Track signal when no decision was made", () => {
    Object.defineProperty(window.navigator, "doNotTrack", { value: "1", configurable: true });
    try {
      expect(getConsentState()).toBe("unset");
      expect(consentGranted()).toBe(false);
    } finally {
      Object.defineProperty(window.navigator, "doNotTrack", { value: undefined, configurable: true });
    }
  });

  it("deduplicates identical consecutive page views", () => {
    trackPageView("/deals");
    trackPageView("/deals");
    const events = dataLayer().filter(e => e.event === "page_view");
    expect(events).toHaveLength(1);
    expect(events[0].page_path).toBe("/deals");
  });

  it("tracks distinct paths separately", () => {
    trackPageView("/deals");
    trackPageView("/guides");
    expect(dataLayer().filter(e => e.event === "page_view")).toHaveLength(2);
  });

  it("ignores empty paths", () => {
    trackPageView("");
    expect(dataLayer()).toEqual([]);
  });

  it("reports errors with source, message and stack", () => {
    reportError("ErrorBoundary", new Error("boom"), { componentStack: "at X" });
    const evt = dataLayer()[0];
    expect(evt.event).toBe("error_occurred");
    expect(evt.source).toBe("ErrorBoundary");
    expect(evt.message).toBe("boom");
    expect(String(evt.stack)).toContain("boom");
    expect(evt.componentStack).toBe("at X");
  });

  it("handles string errors and never throws", () => {
    expect(() => reportError("x", "plain failure")).not.toThrow();
    expect(() => trackEvent("y", { a: undefined })).not.toThrow();
  });
});