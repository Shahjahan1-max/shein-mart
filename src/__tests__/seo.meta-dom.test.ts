/**
 * applyMeta DOM application test (jsdom).
 * Verifies that the metadata engine mutates document.head correctly.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { applyPageMeta, resolveMeta } from "../lib/seo/meta";

beforeEach(() => {
  document.head.innerHTML = "";
  document.title = "";
});

describe("applyMeta (DOM)", () => {
  it("sets the document title", () => {
    applyPageMeta({ title: "Deals" }, "/deals");
    expect(document.title).toBe("Deals | DealX Stocks");
  });

  it("sets meta description, robots, canonical and OG tags", () => {
    applyPageMeta(
      { title: "Services", description: "Our services", ogTitle: "Services OG" },
      "/services"
    );
    const description = document.head.querySelector('meta[name="description"]');
    expect(description?.getAttribute("content")).toBe("Our services");

    const robots = document.head.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute("content")).toBe("index, follow");

    const canonical = document.head.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute("href")).toBe("https://dealxstocks.com/services");

    const og = document.head.querySelector('meta[property="og:title"]');
    expect(og?.getAttribute("content")).toBe("Services OG");
  });

  it("applies noindex robots for protected paths", () => {
    applyPageMeta({ title: "Dashboard", noindex: true }, "/dashboard");
    const robots = document.head.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute("content")).toBe("noindex, nofollow");
  });

  it("resolveMeta + applyPageMeta are consistent", () => {
    const resolved = resolveMeta({ title: "Contact" }, "/contact");
    applyPageMeta({ title: "Contact" }, "/contact");
    expect(document.title).toBe(resolved.title);
  });

  it("overwrites tags on subsequent calls (no duplicates)", () => {
    applyPageMeta({ title: "First" }, "/a");
    applyPageMeta({ title: "Second" }, "/b");
    expect(document.title).toBe("Second | DealX Stocks");
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  });
});
