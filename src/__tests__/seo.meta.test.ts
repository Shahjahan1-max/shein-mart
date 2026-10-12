/**
 * Metadata engine tests (Phase 1 foundation).
 * Tests the pure meta resolvers — not DOM application (covered via jsdom in
 * the meta apply test below).
 */

import { describe, it, expect } from "vitest";
import { composeTitle, resolveMeta, validateMeta, DEFAULT_META } from "../lib/seo/meta";

describe("composeTitle", () => {
  it("appends the site suffix", () => {
    expect(composeTitle("Services")).toBe("Services | DealX Stocks");
  });

  it("does not duplicate the brand", () => {
    expect(composeTitle("DealX Stocks")).toBe("DealX Stocks");
    expect(composeTitle("Services | DealX Stocks")).toBe("Services | DealX Stocks");
  });

  it("falls back to default for empty titles", () => {
    expect(composeTitle("")).toBe(DEFAULT_META.title);
    expect(composeTitle("   ")).toBe(DEFAULT_META.title);
  });
});

describe("resolveMeta", () => {
  it("produces a complete resolved meta object", () => {
    const meta = resolveMeta({ title: "Deals", description: "Today's deals" }, "/deals");
    expect(meta.title).toBe("Deals | DealX Stocks");
    expect(meta.description).toBe("Today's deals");
    expect(meta.canonical).toBe("https://dealxstocks.com/deals");
    expect(meta.robots).toBe("index, follow");
    expect(meta.noindex).toBe(false);
  });

  it("respects explicit noindex", () => {
    const meta = resolveMeta({ title: "Login", noindex: true }, "/login");
    expect(meta.noindex).toBe(true);
    expect(meta.robots).toBe("noindex, nofollow");
  });

  it("uses path-based canonical when not provided", () => {
    const meta = resolveMeta({ title: "X" }, "/services/international-seo");
    expect(meta.canonical).toBe("https://dealxstocks.com/services/international-seo");
  });

  it("merges with defaults", () => {
    const meta = resolveMeta(undefined, "/");
    expect(meta.title).toBe(DEFAULT_META.title);
    expect(meta.canonical).toBe("https://dealxstocks.com/");
  });
});

describe("validateMeta", () => {
  it("flags missing title", () => {
    expect(validateMeta({})).toContain("title is required");
  });

  it("flags overly long titles and descriptions", () => {
    expect(validateMeta({ title: "x".repeat(70) })).toHaveLength(1);
    expect(validateMeta({ title: "ok", description: "y".repeat(200) })).toHaveLength(1);
  });

  it("flags non-absolute canonicals", () => {
    expect(validateMeta({ title: "ok", canonical: "/relative" })).toHaveLength(1);
  });

  it("returns no issues for a clean meta", () => {
    expect(validateMeta({ title: "Services", description: "Short description." })).toHaveLength(0);
  });
});
