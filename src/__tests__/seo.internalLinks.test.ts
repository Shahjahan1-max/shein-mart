/**
 * Phase 3B SEO-features tests — internal-linking engine, glossary, guides and
 * comparison data.
 */

import { describe, it, expect } from "vitest";
import {
  buildInternalLinks,
  categoryLinksFor,
  productLinksFor,
  dealsLinks,
  autoLinkTerms,
  dedupeInternalLinks,
} from "../lib/seo/internalLinks";
import { findGlossaryTerm } from "../data/glossary";
import { findGuide } from "../data/guides";
import { MARKETPLACE_COMPARISON, MARKETPLACE_DECISION_TREE } from "../data/comparisons";
import type { ProductsCatalog } from "../hooks/useCatalogs";

const catalog: ProductsCatalog = {
  platform: "DealX Stocks",
  version: "1.0",
  platforms: [
    {
      name: "Amazon",
      url: "https://www.amazon.com",
      color: "#FF9900",
      categories: [
        {
          category_name: "Electronics",
          products: [
            { id: "a1", title: "Echo Dot Smart Speaker", price: "$49.99", compare_price: "$59.99", image: "img", platform: "Amazon", rating: 4.7, reviews: 100 },
            { id: "a2", title: "Kindle", price: "$89.99", image: "img", platform: "Amazon", rating: 4.5, reviews: 50 },
          ],
        },
        {
          category_name: "Smart Home",
          products: [
            { id: "a3", title: "Smart Bulb", price: "$24.99", image: "img", platform: "Amazon", rating: 4.1, reviews: 10 },
          ],
        },
      ],
    },
    {
      name: "AliExpress",
      url: "https://www.aliexpress.com",
      color: "#E62B31",
      categories: [
        {
          category_name: "Gadgets",
          products: [
            { id: "b1", title: "Wireless Earbuds", price: "$12.99", compare_price: "$22.00", image: "img", platform: "AliExpress" },
          ],
        },
      ],
    },
  ],
};

describe("categoryLinksFor", () => {
  it("returns category links for the first platform when none specified", () => {
    const links = categoryLinksFor(catalog, null, 3);
    expect(links.length).toBeGreaterThan(0);
    expect(links.every(l => l.href.startsWith("/categories/amazon/"))).toBe(true);
  });

  it("includes cross-platform categories when a platform is specified", () => {
    const links = categoryLinksFor(catalog, "Amazon", 2);
    const hrefs = links.map(l => l.href);
    expect(hrefs.some(h => h.startsWith("/categories/amazon/"))).toBe(true);
    expect(hrefs.some(h => h.startsWith("/categories/aliexpress/"))).toBe(true);
  });

  it("handles null catalogs", () => {
    expect(categoryLinksFor(null, null, 3)).toEqual([]);
  });
});

describe("productLinksFor", () => {
  it("returns related product links when a context product is given", () => {
    const context = {
      product: catalog.platforms[0].categories[0].products[0],
      platform: "Amazon",
      platformSlug: "amazon",
      category: "Electronics",
      categorySlug: "electronics",
      slug: "echo-dot-smart-speaker",
      href: "/products/echo-dot-smart-speaker",
    };
    const links = productLinksFor(catalog, context, 4);
    expect(links.length).toBeGreaterThan(0);
    expect(links.every(l => l.href.startsWith("/products/"))).toBe(true);
  });

  it("falls back to the first products when no context is given", () => {
    const links = productLinksFor(catalog, null, 3);
    expect(links.length).toBe(3);
  });
});

describe("dealsLinks + buildInternalLinks", () => {
  it("home context includes categories, deals and guides", () => {
    const links = buildInternalLinks({ kind: "home" }, catalog, { limit: 4 });
    expect(links.some(l => l.href === "/deals")).toBe(true);
    expect(links.some(l => l.href === "/guides/how-we-pick-deals")).toBe(true);
    expect(links.some(l => l.href.startsWith("/categories/"))).toBe(true);
  });

  it("product context links to related products + categories + deals", () => {
    const context = {
      product: catalog.platforms[0].categories[0].products[0],
      platform: "Amazon",
      platformSlug: "amazon",
      category: "Electronics",
      categorySlug: "electronics",
      slug: "echo-dot-smart-speaker",
      href: "/products/echo-dot-smart-speaker",
    };
    const links = buildInternalLinks({ kind: "product", product: context }, catalog, { limit: 4 });
    expect(links.some(l => l.href === "/deals")).toBe(true);
    expect(links.some(l => l.group === "Related Products")).toBe(true);
  });

  it("dedupes internal links", () => {
    const dupes = [...dealsLinks(), ...dealsLinks()];
    expect(dedupeInternalLinks(dupes)).toHaveLength(1);
  });
});

describe("autoLinkTerms", () => {
  const terms = [
    { term: "Buy Box", slug: "buy-box" },
    { term: "Commission", slug: "commission" },
  ];

  it("wraps a glossary term in an anchor", () => {
    const out = autoLinkTerms("Learn about the Buy Box and how commission works.", terms);
    expect(out).toContain('<a href="/glossary#buy-box" class="auto-link">Buy Box</a>');
    expect(out).toContain('<a href="/glossary#commission" class="auto-link">commission</a>');
  });

  it("does not match partial words (word boundary)", () => {
    const out = autoLinkTerms("Commissions on Marketplace", [{ term: "Commission", slug: "commission" }]);
    expect(out).not.toContain('class="auto-link"');
  });

  it("links only the first N occurrences per term", () => {
    const out = autoLinkTerms("Buy Box vs Buy Box again.", terms);
    expect(out.match(/class="auto-link"/g)?.length).toBe(1);
  });
});

describe("glossary + guides + comparisons data", () => {
  it("looks up glossary terms by slug", () => {
    expect(findGlossaryTerm("buy-box")?.term).toBe("Buy Box");
    expect(findGlossaryTerm("nope")).toBeUndefined();
  });

  it("looks up guides by slug", () => {
    expect(findGuide("how-we-pick-deals")?.title).toBeTruthy();
    expect(findGuide("nope")).toBeUndefined();
  });

  it("comparison table has matching columns across all rows", () => {
    const ids = MARKETPLACE_COMPARISON.columns.map(c => c.id);
    for (const row of MARKETPLACE_COMPARISON.rows) {
      for (const id of ids) expect(row.values[id]).toBeTruthy();
    }
  });

  it("decision tree reaches a recommendation from start", () => {
    const start = MARKETPLACE_DECISION_TREE.find(n => n.id === "start");
    expect(start).toBeTruthy();
    expect(start!.choices.length).toBeGreaterThan(0);
  });
});
