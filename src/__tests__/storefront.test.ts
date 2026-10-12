/**
 * Storefront data helper tests (Phase 2 foundation).
 */

import { describe, it, expect } from "vitest";
import {
  flattenCatalog,
  resolveCategoryPage,
  resolveProduct,
  getDeals,
  getRelatedProducts,
  numericPrice,
  discountPercent,
  sortProducts,
  paginate,
  allCategories,
  isValidSortKey,
  type FlatProduct,
} from "../lib/storefront";
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
            { id: "a1", title: "Echo Dot (5th Gen) Smart Speaker", price: "$49.99", compare_price: "$59.99", image: "img", platform: "Amazon", rating: 4.7, reviews: 100, product_url: "https://amazon.com/a1" },
            { id: "a2", title: "Kindle", price: "$89.99", compare_price: "$99.99", image: "img", platform: "Amazon", rating: 4.5, reviews: 50, product_url: "https://amazon.com/a2" },
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
          category_name: "Gadgets & Tech",
          products: [
            { id: "b1", title: "Wireless Earbuds", price: "$12.99", compare_price: "$22.00", image: "img", platform: "AliExpress", rating: 4.2, reviews: 500, product_url: "https://aliexpress.com/b1" },
          ],
        },
      ],
    },
  ],
};

describe("flattenCatalog", () => {
  it("flattens platforms → categories → products with context", () => {
    const flat = flattenCatalog(catalog);
    expect(flat).toHaveLength(4);
    const first = flat[0];
    expect(first.platform).toBe("Amazon");
    expect(first.category).toBe("Electronics");
    expect(first.slug).toBe("echo-dot-5th-gen-smart-speaker");
    expect(first.href).toBe("/products/echo-dot-5th-gen-smart-speaker");
  });

  it("handles null/undefined catalogs", () => {
    expect(flattenCatalog(null)).toHaveLength(0);
    expect(flattenCatalog(undefined)).toHaveLength(0);
  });
});

describe("resolveCategoryPage", () => {
  it("resolves a real platform+category", () => {
    const page = resolveCategoryPage(catalog, "amazon", "electronics");
    expect(page).not.toBeNull();
    expect(page!.platform.name).toBe("Amazon");
    expect(page!.category.category_name).toBe("Electronics");
    expect(page!.flat).toHaveLength(2);
  });

  it("handles AliExpress platform slug collapse", () => {
    const page = resolveCategoryPage(catalog, "aliexpress", "gadgets-tech");
    expect(page).not.toBeNull();
    expect(page!.flat).toHaveLength(1);
  });

  it("returns null for unknown platform/category", () => {
    expect(resolveCategoryPage(catalog, "ebay", "electronics")).toBeNull();
    expect(resolveCategoryPage(catalog, "amazon", "nope")).toBeNull();
    expect(resolveCategoryPage(null, "amazon", "electronics")).toBeNull();
  });
});

describe("resolveProduct", () => {
  it("resolves a product by slug", () => {
    const found = resolveProduct(catalog, "kindle");
    expect(found).not.toBeNull();
    expect(found!.product.id).toBe("a2");
  });

  it("returns null for unknown slugs", () => {
    expect(resolveProduct(catalog, "nope")).toBeNull();
    expect(resolveProduct(null, "kindle")).toBeNull();
  });
});

describe("numericPrice / discountPercent", () => {
  it("parses prices with unit suffixes and commas", () => {
    expect(numericPrice("$4.50/pc")).toBe(4.5);
    expect(numericPrice("$3,500.00")).toBe(3500);
    expect(numericPrice(null)).toBeNull();
    expect(numericPrice("Free")).toBeNull();
  });

  it("computes discount percentages", () => {
    expect(discountPercent("$49.99", "$59.99")).toBe(17);
    expect(discountPercent("$12.99", "$22.00")).toBe(41);
    expect(discountPercent("$24.99", null)).toBeNull();
    expect(discountPercent("$30", "$20")).toBeNull();
  });
});

describe("getDeals", () => {
  it("returns only discounted products sorted by discount desc", () => {
    const deals = getDeals(catalog);
    expect(deals.length).toBeGreaterThan(0);
    const withoutDeal = deals.find(d => d.product.id === "a3");
    expect(withoutDeal).toBeUndefined();
    // Every returned deal has a discount
    for (const d of deals) expect(d.discountPercent).not.toBeNull();
  });
});

describe("getRelatedProducts", () => {
  it("prioritizes same category then same platform", () => {
    const current = resolveProduct(catalog, "echo-dot-5th-gen-smart-speaker") as FlatProduct;
    const related = getRelatedProducts(catalog, current, 4);
    expect(related.some(r => r.categorySlug === "electronics" && r.platformSlug === "amazon")).toBe(true);
    expect(related.some(r => r.slug === current.slug)).toBe(false);
  });
});

describe("sortProducts", () => {
  const flat = flattenCatalog(catalog);

  it("sorts by price ascending/descending", () => {
    const asc = sortProducts(flat, "price-asc");
    expect(asc[0].product.title).toBe("Wireless Earbuds");
    const desc = sortProducts(flat, "price-desc");
    expect(desc[0].product.title).toBe("Kindle");
  });

  it("sorts by rating", () => {
    const byRating = sortProducts(flat, "rating");
    expect(byRating[0].product.rating).toBe(4.7);
  });

  it("keeps featured order stable", () => {
    expect(sortProducts(flat, "featured").map(f => f.slug)).toEqual(flat.map(f => f.slug));
  });
});

describe("paginate", () => {
  it("paginates with hasMore", () => {
    const items = [1, 2, 3, 4, 5];
    const p1 = paginate(items, 1, 2);
    expect(p1.data).toEqual([1, 2]);
    expect(p1.hasMore).toBe(true);
    const p3 = paginate(items, 3, 2);
    expect(p3.data).toEqual([5]);
    expect(p3.hasMore).toBe(false);
  });

  it("returns all when pageSize is null", () => {
    const r = paginate([1, 2, 3], 1, null);
    expect(r.data).toHaveLength(3);
    expect(r.hasMore).toBe(false);
  });
});

describe("allCategories + sort key validation", () => {
  it("collects unique categories with counts", () => {
    const cats = allCategories(catalog);
    expect(cats.some(c => c.name === "Electronics")).toBe(true);
    expect(cats.find(c => c.name === "Electronics")!.productCount).toBe(2);
  });

  it("validates sort keys", () => {
    expect(isValidSortKey("price-asc")).toBe(true);
    expect(isValidSortKey("bogus")).toBe(false);
  });
});
