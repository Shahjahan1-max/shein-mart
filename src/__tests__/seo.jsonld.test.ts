/**
 * JSON-LD structured data engine tests (Phase 1 foundation).
 */

import { describe, it, expect } from "vitest";
import {
  organizationSchema,
  webSiteSchema,
  productSchema,
  breadcrumbListSchema,
  faqPageSchema,
  categoryBreadcrumbSchema,
  parsePrice,
  jsonLdToScript,
  type ProductData,
} from "../lib/seo/jsonld";

describe("organizationSchema", () => {
  it("emits a valid Organization node", () => {
    const node = organizationSchema();
    expect(node["@context"]).toBe("https://schema.org");
    expect(node["@type"]).toBe("Organization");
    expect(node.name).toBe("DealX Stocks");
    expect(node.url).toMatch(/^https:\/\/dealxstocks\.com\/$/);
  });
});

describe("webSiteSchema", () => {
  it("emits a WebSite node with SearchAction", () => {
    const node = webSiteSchema();
    expect(node["@type"]).toBe("WebSite");
    expect(node.potentialAction).toMatchObject({ "@type": "SearchAction" });
    const target = node.potentialAction as { target: { urlTemplate: string } };
    expect(target.target.urlTemplate).toContain("search_term_string");
  });
});

describe("parsePrice", () => {
  it("parses dollar-prefixed strings", () => {
    expect(parsePrice("$49.99")).toBe(49.99);
    expect(parsePrice("$1,299.00")).toBe(1299);
  });

  it("accepts numbers and rejects garbage", () => {
    expect(parsePrice(25)).toBe(25);
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("Free")).toBeNull();
  });
});

describe("productSchema", () => {
  const product: ProductData = {
    id: "amz-el-1",
    title: "Echo Dot (5th Gen) Smart Speaker",
    price: "$49.99",
    compare_price: "$59.99",
    image: "https://example.com/echo.jpg",
    product_url: "https://www.amazon.com/dp/B09B8V1LZ3",
    platform: "Amazon",
    rating: 4.7,
    reviews: 89421,
    description: "Compact smart speaker.",
    category: "Electronics",
  };

  it("emits a valid Product with Offer", () => {
    const node = productSchema(product);
    expect(node["@type"]).toBe("Product");
    expect(node.name).toBe(product.title);
    expect(node.category).toBe("Electronics");
    const offers = node.offers as Record<string, unknown>;
    expect(offers["@type"]).toBe("Offer");
    expect(offers.price).toBe(49.99);
    expect(offers.priceCurrency).toBe("USD");
    expect(offers.listPrice).toBe(59.99);
  });

  it("emits aggregateRating from real data", () => {
    const node = productSchema(product);
    const rating = node.aggregateRating as Record<string, unknown>;
    expect(rating.ratingValue).toBe(4.7);
    expect(rating.reviewCount).toBe(89421);
  });

  it("serializes to JSON without undefined", () => {
    const script = jsonLdToScript(productSchema(product));
    expect(() => JSON.parse(script)).not.toThrow();
    expect(JSON.parse(script)["@type"]).toBe("Product");
  });
});

describe("breadcrumbListSchema", () => {
  it("assigns sequential positions", () => {
    const node = breadcrumbListSchema([
      { name: "Home", path: "/" },
      { name: "Categories", path: "/categories" },
      { name: "Electronics", path: "/categories/amazon/electronics" },
    ]);
    const items = node.itemListElement as Record<string, unknown>[];
    expect(items).toHaveLength(3);
    expect(items[0].position).toBe(1);
    expect(items[2].position).toBe(3);
    expect(items[2].item).toContain("/categories/amazon/electronics");
  });

  it("supports explicit urls", () => {
    const node = breadcrumbListSchema([{ name: "Home", url: "https://dealxstocks.com/" }]);
    const items = node.itemListElement as Record<string, unknown>[];
    expect(items[0].item).toBe("https://dealxstocks.com/");
  });
});

describe("categoryBreadcrumbSchema", () => {
  it("builds a home → platform → category trail", () => {
    const node = categoryBreadcrumbSchema("Amazon", "Electronics");
    const items = node.itemListElement as Record<string, unknown>[];
    expect(items.map(i => i.name)).toEqual(["Home", "Amazon", "Electronics"]);
    expect(items[1].item).toContain("/categories/amazon");
  });
});

describe("faqPageSchema", () => {
  it("emits mainEntity questions", () => {
    const node = faqPageSchema([
      { question: "Is it free?", answer: "Yes." },
      { question: "How do I earn?", answer: "Complete tasks." },
    ]);
    const main = node.mainEntity as Record<string, unknown>[];
    expect(main).toHaveLength(2);
    expect(main[0].name).toBe("Is it free?");
    expect((main[0].acceptedAnswer as Record<string, unknown>).text).toBe("Yes.");
  });
});
