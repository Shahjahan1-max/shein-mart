/**
 * cookie-consent.test.tsx — consent banner behavior (Phase 7A).
 * Renders in jsdom with clean localStorage, then exercises the accept /
 * decline flow and verifies the analytics consent key round-trips.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { CookieConsent } from "../components/CookieConsent";
import {
  consentGranted,
  getConsentState,
  CONSENT_KEY,
} from "../lib/analytics";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderConsent() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<CookieConsent />);
  });
  return { container, root };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("CookieConsent", () => {
  it("is hidden when a decision already exists", () => {
    window.localStorage.setItem(CONSENT_KEY, "1");
    const { container, root } = renderConsent();
    expect(container.querySelector('[role="region"]')).toBeNull();
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("renders when no decision exists", () => {
    const { container, root } = renderConsent();
    const banner = container.querySelector('[role="region"][aria-label="Cookie consent"]');
    expect(banner).not.toBeNull();
    expect(container.querySelector("button")?.textContent).toContain("Accept");
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("persists grant and hides on Accept", () => {
    const { container, root } = renderConsent();
    const accept = [...(container.querySelectorAll("button") ?? [])].find(b =>
      b.textContent?.includes("Accept")
    );
    act(() => {
      accept?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(getConsentState()).toBe("granted");
    expect(consentGranted()).toBe(true);
    expect(container.querySelector('[role="region"]')).toBeNull();
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("persists decline and hides on Decline", () => {
    const { container, root } = renderConsent();
    const decline = [...(container.querySelectorAll("button") ?? [])].find(b =>
      b.textContent?.includes("Decline")
    );
    act(() => {
      decline?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(getConsentState()).toBe("declined");
    expect(consentGranted()).toBe(false);
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe("0");
    expect(container.querySelector('[role="region"]')).toBeNull();
    act(() => root.unmount());
    document.body.removeChild(container);
  });
});