/**
 * ctaVariants.ts — pure resolver for the CMS-driven A/B CTA banner (Phase 5A).
 * Maps an LPCTA config into ready-to-render CtaBanner props.
 * No DOM, no React runtime — fully unit-testable.
 */

import type { LPCTA } from "../data/landingPageData";
import type { CtaAction } from "../components/CtaBanner";

export interface CtaBannerProps {
  title: string;
  subtitle?: string;
  actions: CtaAction[];
}

/** Build CtaBanner props from an LPCTA CMS config. */
export function resolveCtaBanner(cta: LPCTA | null | undefined): CtaBannerProps {
  const config: LPCTA = {
    variant: "a",
    title: "Start Earning While You Shop",
    subtitle: "Create a free account, complete tasks and earn commissions on every successful referral.",
    primaryLabel: "Start Earning Free",
    primaryHref: "/register",
    secondaryLabel: "Browse Today's Deals",
    secondaryHref: "/deals",
    ...(cta ?? {}),
  };

  const actions: CtaAction[] = [];
  if (config.primaryLabel.trim()) {
    actions.push({ label: config.primaryLabel.trim(), href: config.primaryHref.trim() || "/register", primary: true });
  }
  if (config.secondaryLabel.trim()) {
    actions.push({ label: config.secondaryLabel.trim(), href: config.secondaryHref.trim() || "/deals" });
  }

  return {
    title: config.title.trim() || "Start Earning While You Shop",
    subtitle: config.subtitle.trim() || undefined,
    actions,
  };
}

/** Human label for a variant key (used in admin UI and stats). */
export function variantLabel(variant: "a" | "b"): string {
  return variant === "b" ? "Variant B (Consultation First)" : "Variant A (Earn First)";
}

/** Full preset config for a variant (used when switching variants in admin). */
export function ctaPresetFor(variant: "a" | "b"): LPCTA {
  if (variant === "b") {
    return {
      variant: "b",
      title: "Get Your Marketplace Growth Plan",
      subtitle:
        "Book a free consultation with our team and leave with a 30/60/90-day growth roadmap for your channel.",
      primaryLabel: "Book a Consultation",
      primaryHref: "/contact?intent=consultation",
      secondaryLabel: "Estimate Your Earnings",
      secondaryHref: "/tools/roi-calculator",
    };
  }
  return {
    variant: "a",
    title: "Start Earning While You Shop",
    subtitle:
      "Create a free account, complete tasks and earn commissions on every successful referral.",
    primaryLabel: "Start Earning Free",
    primaryHref: "/register",
    secondaryLabel: "Browse Today's Deals",
    secondaryHref: "/deals",
  };
}