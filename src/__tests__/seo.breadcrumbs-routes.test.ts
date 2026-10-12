/**
 * Breadcrumb + route registry + validation tests (Phase 1 foundation).
 */

import { describe, it, expect } from "vitest";
import { buildBreadcrumbs, breadcrumbsSchema } from "../lib/seo/breadcrumbs";
import {
  PUBLIC_ROUTES,
  matchPublicRoute,
  resolveRouteMeta,
  canonicalPathFor,
} from "../lib/seo/routes";
import { buildSitemapXml, validatePage, validateRouteRegistry } from "../lib/seo/validate";
import { isNoindexPath } from "../lib/seo/urls";

describe("buildBreadcrumbs", () => {
  it("returns only Home for the root path", () => {
    expect(buildBreadcrumbs("/")).toEqual([{ name: "Home", path: "/" }]);
  });

  it("builds a trail for nested paths", () => {
    const trail = buildBreadcrumbs("/services/international-seo");
    expect(trail.map(t => t.name)).toEqual(["Home", "Services", "International SEO"]);
    expect(trail[1].path).toBe("/services");
    expect(trail[2].path).toBeUndefined();
  });

  it("labels marketplace SEO segments", () => {
    const trail = buildBreadcrumbs("/services/marketplace-seo/amazon");
    expect(trail.map(t => t.name)).toEqual(["Home", "Services", "Marketplace SEO", "Amazon"]);
  });

  it("title-cases hyphenated product/category segments", () => {
    const trail = buildBreadcrumbs("/categories/amazon/smart-home");
    expect(trail.map(t => t.name)).toEqual(["Home", "Categories", "Amazon", "Smart Home"]);
  });

  it("ignores query strings", () => {
    expect(buildBreadcrumbs("/deals?page=2")[1].name).toBe("Deals");
  });
});

describe("breadcrumbsSchema", () => {
  it("produces a valid BreadcrumbList", () => {
    const schema = breadcrumbsSchema([{ name: "Home", path: "/" }, { name: "Deals" }]);
    expect(schema["@type"]).toBe("BreadcrumbList");
    expect((schema.itemListElement as unknown[]).length).toBe(2);
  });
});

describe("route registry", () => {
  it("registers all indexable public routes", () => {
    const names = PUBLIC_ROUTES.map(r => r.path);
    for (const p of ["/", "/services", "/marketplaces", "/industries", "/knowledge-hub", "/resources", "/about", "/contact", "/deals"]) {
      expect(names).toContain(p);
    }
  });

  it("resolves static routes by exact path", () => {
    const matched = matchPublicRoute("/services");
    expect(matched?.route.name).toBe("Services");
  });

  it("resolves dynamic routes with params", () => {
    const matched = matchPublicRoute("/products/echo-dot-5th-gen");
    expect(matched?.route.name).toBe("Product");
    expect(matched?.params.slug).toBe("echo-dot-5th-gen");
  });

  it("resolves multi-segment dynamic routes", () => {
    const matched = matchPublicRoute("/categories/amazon/electronics");
    expect(matched?.route.name).toBe("Category");
    expect(matched?.params.platform).toBe("amazon");
    expect(matched?.params.category).toBe("electronics");
  });

  it("canonicalizes dynamic paths to their matched form", () => {
    expect(canonicalPathFor("/products/echo-dot-5th-gen")).toBe("/products/echo-dot-5th-gen");
  });

  it("resolveRouteMeta returns registry meta for a known route", () => {
    const meta = resolveRouteMeta("/services");
    expect(meta).toBeDefined();
  });
});

describe("validation utilities", () => {
  it("registry validation passes with no errors", () => {
    const issues = validateRouteRegistry();
    expect(issues.filter(i => i.severity === "error")).toHaveLength(0);
  });

  it("validates a clean public page", () => {
    const issues = validatePage("/services", { title: "Services", description: "ok" });
    expect(issues.filter(i => i.severity === "error")).toHaveLength(0);
  });

  it("warns on noindex path without explicit meta", () => {
    const issues = validatePage("/dashboard/wallet");
    expect(issues.some(i => i.message.includes("noindex by prefix"))).toBe(true);
  });

  it("builds a valid sitemap XML with eligible paths", () => {
    const xml = buildSitemapXml(["/", "/services", "/login", "/quote", "/deals"]);
    expect(xml).toContain("<loc>https://dealxstocks.com/</loc>");
    expect(xml).toContain("<loc>https://dealxstocks.com/services</loc>");
    expect(xml).not.toContain("/login");
    expect(xml).not.toContain("/quote");
    expect(xml.startsWith("<?xml version=\"1.0\"")).toBe(true);
  });

  it("public routes never leak into noindex set", () => {
    for (const r of PUBLIC_ROUTES) {
      if (r.path.includes(":")) continue;
      if (r.path === "/search") continue;
      expect(isNoindexPath(r.path), `${r.path} should be indexable`).toBe(false);
    }
  });
});
