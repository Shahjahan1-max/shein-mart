/**
 * Storefront data helpers — pure functions over the products catalog.
 * No DOM, no Firebase. Drives category, product-detail and deals pages.
 */

import {
  categorySlug,
  platformSlug,
  productSlug,
} from "./seo/urls";
import type { ProductsCatalog, ProductPlatform, ProductCategory, ProductEntry } from "../hooks/useCatalogs";

export interface FlatProduct {
  product: ProductEntry;
  platform: string;
  platformSlug: string;
  category: string;
  categorySlug: string;
  slug: string;
  /** Canonical path for internal linking / SEO. */
  href: string;
}

/** Flatten the nested catalog into a single array of products with context. */
export function flattenCatalog(catalog: ProductsCatalog | undefined | null): FlatProduct[] {
  const platforms = catalog?.platforms ?? [];
  const flat: FlatProduct[] = [];
  for (const platform of platforms) {
    for (const category of platform.categories) {
      for (const product of category.products) {
        flat.push({
          product,
          platform: platform.name,
          platformSlug: platformSlug(platform.name),
          category: category.category_name,
          categorySlug: categorySlug(category.category_name),
          slug: productSlug(product.id, product.title),
          href: `/products/${productSlug(product.id, product.title)}`,
        });
      }
    }
  }
  return flat;
}

export interface CategoryPageData {
  platform: ProductPlatform;
  category: ProductCategory;
  platformSlug: string;
  categorySlug: string;
  flat: FlatProduct[];
}

/** Find a platform by its URL slug (e.g. "amazon", "aliexpress"). */
export function findPlatformBySlug(catalog: ProductsCatalog | undefined | null, slug: string): ProductPlatform | undefined {
  const platforms = catalog?.platforms ?? [];
  const normalized = String(slug || "").trim().toLowerCase();
  return platforms.find(p => platformSlug(p.name) === normalized);
}

/** Find a category within a platform by its URL slug. */
export function findCategory(
  platform: ProductPlatform | undefined,
  categoryNameSlug: string
): ProductCategory | undefined {
  if (!platform) return undefined;
  const normalized = String(categoryNameSlug || "").trim().toLowerCase();
  return platform.categories.find(c => categorySlug(c.category_name) === normalized);
}

/** Resolve a full category page payload (platform + category + flat products). */
export function resolveCategoryPage(
  catalog: ProductsCatalog | undefined | null,
  platformSlugValue: string,
  categorySlugValue: string
): CategoryPageData | null {
  const platform = findPlatformBySlug(catalog, platformSlugValue);
  const category = findCategory(platform, categorySlugValue);
  if (!platform || !category) return null;
  const flat = flattenCatalog({
    platform: catalog?.platform ?? "DealX Stocks",
    version: catalog?.version ?? "1.0",
    platforms: [platform],
  }).filter(f => f.categorySlug === categorySlug(category.category_name));
  return {
    platform,
    category,
    platformSlug: platformSlug(platform.name),
    categorySlug: categorySlug(category.category_name),
    flat,
  };
}

/** Resolve a single product by its URL slug or product ID (first match wins). */
export function resolveProduct(
  catalog: ProductsCatalog | undefined | null,
  slug: string
): FlatProduct | null {
  const normalized = String(slug || "").trim().toLowerCase();
  if (!normalized) return null;
  const flat = flattenCatalog(catalog);
  return (
    flat.find(
      f =>
        f.product.id.toLowerCase() === normalized ||
        f.slug.toLowerCase() === normalized ||
        f.slug.toLowerCase().startsWith(normalized) ||
        normalized.startsWith(f.product.id.toLowerCase())
    ) ?? null
  );
}

export interface DealEntry extends FlatProduct {
  discountPercent: number | null;
  originalPrice: number | null;
  salePrice: number | null;
}

/** Extract a numeric price, ignoring unit suffixes like "/pc" or "$3,500.00". */
export function numericPrice(price: string | number | null | undefined): number | null {
  if (typeof price === "number" && Number.isFinite(price)) return price;
  if (typeof price !== "string" || !price.trim()) return null;
  const cleaned = price.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Compute the discount percentage (0 when none / invalid). */
export function discountPercent(price: string | number | null | undefined, comparePrice: string | number | null | undefined): number | null {
  const sale = numericPrice(price);
  const orig = numericPrice(comparePrice);
  if (sale === null || orig === null || orig <= sale || sale <= 0) return null;
  return Math.round(((orig - sale) / orig) * 100);
}

/** Products that actually carry a discount (compare_price > price). */
export function getDeals(catalog: ProductsCatalog | undefined | null): DealEntry[] {
  return flattenCatalog(catalog)
    .map(f => {
      const d = discountPercent(f.product.price, f.product.compare_price);
      return {
        ...f,
        discountPercent: d,
        originalPrice: numericPrice(f.product.compare_price),
        salePrice: numericPrice(f.product.price),
      };
    })
    .filter(d => d.discountPercent !== null && d.discountPercent >= 5)
    .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));
}

/** Related products: same category first, then same platform, excluding self. */
export function getRelatedProducts(
  catalog: ProductsCatalog | undefined | null,
  current: FlatProduct,
  limit = 4
): FlatProduct[] {
  const all = flattenCatalog(catalog).filter(f => f.slug !== current.slug);
  const sameCategory = all.filter(f => f.categorySlug === current.categorySlug && f.platformSlug === current.platformSlug);
  const samePlatform = all.filter(f => f.platformSlug === current.platformSlug && !sameCategory.includes(f));
  const others = all.filter(f => !sameCategory.includes(f) && !samePlatform.includes(f));
  return [...sameCategory, ...samePlatform, ...others].slice(0, limit);
}

export type SortKey = "featured" | "price-asc" | "price-desc" | "rating" | "discount";

export interface SortOption {
  key: SortKey;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { key: "featured", label: "Featured" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "rating", label: "Top Rated" },
  { key: "discount", label: "Biggest Discount" },
];

export function isValidSortKey(value: string | null | undefined): value is SortKey {
  return SORT_OPTIONS.some(o => o.key === value);
}

/** Sort a flat list of products by a sort key. */
export function sortProducts(flat: FlatProduct[], sort: SortKey): FlatProduct[] {
  const list = [...flat];
  switch (sort) {
    case "price-asc":
      return list.sort((a, b) => (numericPrice(a.product.price) ?? Infinity) - (numericPrice(b.product.price) ?? Infinity));
    case "price-desc":
      return list.sort((a, b) => (numericPrice(b.product.price) ?? 0) - (numericPrice(a.product.price) ?? 0));
    case "rating":
      return list.sort((a, b) => (b.product.rating ?? 0) - (a.product.rating ?? 0));
    case "discount":
      return list.sort((a, b) => (discountPercent(b.product.price, b.product.compare_price) ?? 0) - (discountPercent(a.product.price, a.product.compare_price) ?? 0));
    case "featured":
    default:
      return list;
  }
}

/** Paginate a list with an optional page size (null disables pagination). */
export function paginate<T>(items: T[], page: number, pageSize: number | null): { data: T[]; total: number; hasMore: boolean } {
  const total = items.length;
  if (!pageSize || pageSize <= 0) return { data: items, total, hasMore: false };
  const safePage = Math.max(1, Math.floor(page) || 1);
  const start = (safePage - 1) * pageSize;
  return { data: items.slice(start, start + pageSize), total, hasMore: start + pageSize < total };
}

/** Collect unique category slugs across all platforms (for nav / category discovery). */
export function allCategories(catalog: ProductsCatalog | undefined | null): { name: string; slug: string; productCount: number; platform: string }[] {
  const platforms = catalog?.platforms ?? [];
  const map = new Map<string, { name: string; slug: string; productCount: number; platform: string }>();
  for (const platform of platforms) {
    for (const category of platform.categories) {
      const slug = categorySlug(category.category_name);
      const existing = map.get(slug);
      if (existing) existing.productCount += category.products.length;
      else map.set(slug, { name: category.category_name, slug, productCount: category.products.length, platform: platform.name });
    }
  }
  return [...map.values()];
}
