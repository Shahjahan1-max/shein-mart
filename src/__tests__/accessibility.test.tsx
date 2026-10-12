/**
 * accessibility.test.tsx — automated WCAG smoke audit for the public
 * marketing surface (Phase 6B). Renders key public components in jsdom and
 * asserts the core name/role/value rules:
 *   - images must have alt text
 *   - buttons must have an accessible name
 *   - links must have a real href and a name
 *   - inputs must be labelled
 * No external a11y dependency — pure DOM audit, fast and deterministic.
 */

import { describe, it, expect } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { Router } from "wouter";
import { CtaBanner, defaultEarnCtaActions } from "../components/CtaBanner";
import { ConsultationCta } from "../components/ConsultationCta";
import { Footer } from "../components/layout/footer";
import { LeadMagnetForm } from "../components/LeadMagnetForm";
import { Breadcrumbs } from "../components/seo/Breadcrumbs";
import { CookieConsent } from "../components/CookieConsent";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function auditDom(container: HTMLElement): string[] {
  const violations: string[] = [];
  container.querySelectorAll("img").forEach(img => {
    const alt = img.getAttribute("alt");
    if (alt === null || alt.trim() === "") {
      violations.push(`img without alt text: ${img.getAttribute("src") ?? "(no src)"}`);
    }
  });
  container.querySelectorAll("button").forEach(btn => {
    const name =
      btn.textContent?.trim() ||
      btn.getAttribute("aria-label") ||
      btn.getAttribute("aria-labelledby") ||
      "";
    if (!name) {
      violations.push(`button without accessible name: ${btn.outerHTML.slice(0, 90)}`);
    }
  });
  container.querySelectorAll("a").forEach(a => {
    const href = a.getAttribute("href");
    const name = a.textContent?.trim() || a.getAttribute("aria-label") || "";
    if (!href || href.trim() === "" || href === "#") {
      violations.push(`link without valid href: ${a.outerHTML.slice(0, 90)}`);
    } else if (!name) {
      violations.push(`link without accessible name: ${href}`);
    }
  });
  container.querySelectorAll("input").forEach(inp => {
    const labelled =
      inp.getAttribute("aria-label") ||
      inp.getAttribute("aria-labelledby") ||
      inp.closest("label");
    if (!labelled) {
      violations.push(`input without label/aria-label: ${inp.getAttribute("type") ?? "text"}`);
    }
  });
  return violations;
}

function renderToContainer(node: React.ReactNode): { container: HTMLElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Router>{node}</Router>);
  });
  return { container, root };
}

describe("public components accessibility audit", () => {
  const cases: Array<[string, React.ReactNode]> = [
    ["CtaBanner", <CtaBanner key="cta" title="Start Earning" subtitle="No risk." actions={defaultEarnCtaActions()} />],
    ["ConsultationCta", <ConsultationCta key="cc" />],
    ["Footer", <Footer key="f" />],
    ["LeadMagnetForm", <LeadMagnetForm key="lm" />],
    ["Breadcrumbs", <Breadcrumbs key="bc" items={[{ label: "Services", href: "/services" }, { label: "Marketplace SEO", href: "/services/marketplace-seo" }, { label: "Amazon" }]} />],
    ["CookieConsent", <CookieConsent key="ccn" />],
  ];

  it.each(cases)("%s passes the name/role/value audit", (_name, node) => {
    const { container, root } = renderToContainer(node);
    const violations = auditDom(container);
    act(() => root.unmount());
    document.body.removeChild(container);
    expect(violations).toEqual([]);
  });
});