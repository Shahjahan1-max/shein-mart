/**
 * phase5.test.ts — A/B CTA resolver (5A) + lead CSV/aggregation helpers (5B).
 */

import { describe, it, expect } from "vitest";
import {
  ctaPresetFor,
  resolveCtaBanner,
  variantLabel,
} from "../lib/ctaVariants";
import {
  buildLeadsCsv,
  countBySource,
  csvEscape,
  formatLeadDate,
  type LeadCapture,
} from "../lib/leads";

describe("resolveCtaBanner (5A)", () => {
  it("falls back to the earn-first default when config is missing", () => {
    const props = resolveCtaBanner(null);
    expect(props.title).toContain("Start Earning");
    expect(props.actions).toHaveLength(2);
    expect(props.actions[0]).toMatchObject({ label: "Start Earning Free", href: "/register", primary: true });
    expect(props.actions[1]).toMatchObject({ href: "/deals" });
  });

  it("maps a custom config into banner props", () => {
    const props = resolveCtaBanner({
      variant: "b",
      title: "  Get Your Plan  ",
      subtitle: "Book a consultation",
      primaryLabel: " Book Now ",
      primaryHref: "/contact?intent=consultation",
      secondaryLabel: "Estimate",
      secondaryHref: "/tools/roi-calculator",
    });
    expect(props.title).toBe("Get Your Plan");
    expect(props.actions[0]).toMatchObject({ label: "Book Now", href: "/contact?intent=consultation", primary: true });
    expect(props.actions[1]).toMatchObject({ label: "Estimate", href: "/tools/roi-calculator" });
  });

  it("drops empty buttons and keeps fallback hrefs on blank links", () => {
    const props = resolveCtaBanner({
      variant: "a",
      title: "T",
      subtitle: "",
      primaryLabel: "Go",
      primaryHref: "  ",
      secondaryLabel: "",
      secondaryHref: "",
    });
    expect(props.subtitle).toBeUndefined();
    expect(props.actions).toHaveLength(1);
    expect(props.actions[0].href).toBe("/register");
  });

  it("presets differ per variant", () => {
    const a = ctaPresetFor("a");
    const b = ctaPresetFor("b");
    expect(a.variant).toBe("a");
    expect(a.primaryHref).toBe("/register");
    expect(b.variant).toBe("b");
    expect(b.primaryHref).toBe("/contact?intent=consultation");
    expect(a.primaryHref).not.toBe(b.primaryHref);
  });

  it("labels variants", () => {
    expect(variantLabel("a")).toContain("Earn First");
    expect(variantLabel("b")).toContain("Consultation First");
  });
});

describe("leads helpers (5B)", () => {
  const leads: LeadCapture[] = [
    { id: "1", email: "old@x.com", source: "playbook", createdAt: "2026-07-01T10:00:00Z" },
    {
      id: "2",
      email: 'quote"comma,user@x.com',
      source: "homepage,hero",
      createdAt: "2026-08-01T10:00:00Z",
    },
  ];

  it("escapes quotes, commas and newlines per RFC 4180", () => {
    expect(csvEscape(`a"b`)).toBe(`"a""b"`);
    expect(csvEscape("a,b")).toBe(`"a,b"`);
    expect(csvEscape("plain")).toBe("plain");
  });

  it("builds a CSV with header, newest first and escaped cells", () => {
    const csv = buildLeadsCsv(leads);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("email,source,createdAt,id");
    expect(lines.length).toBe(3);
    expect(lines[1]).toContain("quote\"\"comma,user@x.com"); // newest first
    expect(lines[1]).toContain('"homepage,hero"');
    expect(lines[2]).toContain("old@x.com");
  });

  it("returns just the header for an empty list", () => {
    expect(buildLeadsCsv([])).toBe("email,source,createdAt,id");
  });

  it("aggregates counts by source, sorted descending", () => {
    const bySource = countBySource([
      { email: "a@x.com", source: "playbook", createdAt: "" },
      { email: "b@x.com", source: "homepage", createdAt: "" },
      { email: "c@x.com", source: "playbook", createdAt: "" },
    ]);
    expect(bySource).toEqual([
      { source: "playbook", count: 2 },
      { source: "homepage", count: 1 },
    ]);
  });

  it("groups missing sources under 'unknown'", () => {
    const bySource = countBySource([{ email: "a@x.com", source: "", createdAt: "" }]);
    expect(bySource).toEqual([{ source: "unknown", count: 1 }]);
  });

  it("formats dates safely", () => {
    expect(formatLeadDate(undefined)).toBe("—");
    expect(formatLeadDate("not-a-date")).toBe("—");
    expect(formatLeadDate("2026-08-01T00:00:00Z")).not.toBe("—");
  });
});