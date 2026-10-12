/**
 * SEO URL utilities tests (Phase 1 foundation).
 * Pure function tests — no DOM, no Firebase.
 */

import { describe, it, expect } from "vitest";
import {
  canonicalUrl,
  normalizePath,
  slugify,
  platformSlug,
  categorySlug,
  productSlug,
  categoryUrl,
  productUrl,
  dealsUrl,
  searchUrl,
  collectionUrl,
  guideUrl,
  isNoindexPath,
  isSitemapEligible,
  robotsDirective,
  isExternalUrl,
  isSafeLinkUrl,
} from "../lib/seo/urls";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Smart Home")).toBe("smart-home");
    expect(slugify("Electronics")).toBe("electronics");
  });

  it("strips apostrophes and special characters", () => {
    expect(slugify("Men's & Women's")).toBe("mens-womens");
    expect(slugify("100% Organic!")).toBe("100-organic");
  });

  it("handles edge inputs", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
    expect(slugify("  Hello World  ")).toBe("hello-world");
  });

  it("limits to 80 chars", () => {
    expect(slugify("a".repeat(200))).toHaveLength(80);
  });
});

describe("platformSlug / categorySlug", () => {
  it("collapses platform names to single-token slugs", () => {
    expect(platformSlug("Amazon")).toBe("amazon");
    expect(platformSlug("AliExpress")).toBe("aliexpress");
  });

  it("keeps category slugs hyphenated", () => {
    expect(categorySlug("Smart Home")).toBe("smart-home");
    expect(categorySlug("Home & Kitchen")).toBe("home-kitchen");
  });
});

describe("URL builders", () => {
  it("builds category URLs", () => {
    expect(categoryUrl("Amazon", "Electronics")).toBe("/categories/amazon/electronics");
    expect(categoryUrl("AliExpress", "Gadgets & Tech")).toBe("/categories/aliexpress/gadgets-tech");
  });

  it("builds product URLs from title, falling back to id", () => {
    expect(productUrl("amz-el-1", "Echo Dot Smart Speaker")).toBe("/products/echo-dot-smart-speaker");
    expect(productUrl("amz-x", "")).toBe("/products/amz-x");
  });

  it("builds deals, search, collection and guide URLs", () => {
    expect(dealsUrl()).toBe("/deals");
    expect(searchUrl()).toBe("/search");
    expect(searchUrl("echo dot")).toBe("/search?q=echo%20dot");
    expect(collectionUrl("Best Sellers")).toBe("/collections/best-sellers");
    expect(guideUrl("How to Start Selling")).toBe("/guides/how-to-start-selling");
  });
});

describe("canonicalUrl / normalizePath", () => {
  it("normalizes trailing slashes and query strings", () => {
    expect(normalizePath("/services/")).toBe("/services");
    expect(normalizePath("services")).toBe("/services");
    expect(normalizePath("/deals?page=2")).toBe("/deals");
    expect(normalizePath("/")).toBe("/");
  });

  it("builds absolute canonical URLs", () => {
    expect(canonicalUrl("/")).toBe("https://dealxstocks.com/");
    expect(canonicalUrl("/services")).toBe("https://dealxstocks.com/services");
  });
});

describe("indexability", () => {
  it("marks auth/dashboard/admin paths noindex", () => {
    expect(isNoindexPath("/login")).toBe(true);
    expect(isNoindexPath("/register")).toBe(true);
    expect(isNoindexPath("/dashboard/wallet")).toBe(true);
    expect(isNoindexPath("/admin/users")).toBe(true);
    expect(isNoindexPath("/super-admin")).toBe(true);
  });

  it("keeps public pages indexable", () => {
    expect(isNoindexPath("/")).toBe(false);
    expect(isNoindexPath("/services")).toBe(false);
    expect(isNoindexPath("/marketplaces")).toBe(false);
    expect(isNoindexPath("/deals")).toBe(false);
    expect(isNoindexPath("/categories/amazon/electronics")).toBe(false);
  });

  it("sitemap eligibility excludes auth + quote", () => {
    expect(isSitemapEligible("/")).toBe(true);
    expect(isSitemapEligible("/services")).toBe(true);
    expect(isSitemapEligible("/login")).toBe(false);
    expect(isSitemapEligible("/quote")).toBe(false);
  });

  it("produces robots directives", () => {
    expect(robotsDirective("/")).toBe("index, follow");
    expect(robotsDirective("/dashboard")).toBe("noindex, nofollow");
  });
});

describe("link safety", () => {
  it("detects external URLs", () => {
    expect(isExternalUrl("https://www.amazon.com/dp/B09B8V1LZ3")).toBe(true);
    expect(isExternalUrl("/products/echo")).toBe(false);
    expect(isExternalUrl("mailto:support@dealxstocks.com")).toBe(true);
  });

  it("rejects unsafe javascript/data URLs", () => {
    expect(isSafeLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeLinkUrl("https://dealxstocks.com/")).toBe(true);
  });
});
