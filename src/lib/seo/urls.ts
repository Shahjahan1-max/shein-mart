/**
 * SEO URL utilities — slug generation, canonical URLs, public route builders
 * and indexability rules for DealXStocks (Phase 1 foundation).
 *
 * These are pure functions (no DOM, no side effects) so they are fully
 * unit-testable and safe to use at build time for pre-render.
 */

export const SITE_URL = "https://dealxstocks.com";
export const SITE_NAME = "DealX Stocks";
export const SITE_TAGLINE = "Earn While You Shop";

/** Routes that must never be indexed (auth, dashboard, admin, super-admin). */
export const NOINDEX_PATH_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/dashboard",
  "/admin",
  "/super-admin",
  "/quote",
];

/** Public paths that are intentionally excluded from the sitemap. */
export const SITEMAP_EXCLUDED_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/quote",
];

/** Build a canonical absolute URL from a site-relative path. */
export function canonicalUrl(path: string): string {
  const clean = normalizePath(path);
  return `${SITE_URL}${clean === "/" ? "/" : clean}`;
}

/** Normalize a site-relative path: trim, collapse slashes, strip query/hash. */
export function normalizePath(path: string): string {
  const raw = String(path || "").trim();
  const [cleanPath] = raw.split(/[?#]/);
  let out = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  out = out.replace(/\/{2,}/g, "/");
  if (out.length > 1) out = out.replace(/\/+$/, "");
  return out === "" ? "/" : out;
}

/** Convert an arbitrary string into a URL-safe slug. */
export function slugify(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Platform name → slug used in category URLs (e.g. "Amazon" → "amazon"). */
export function platformSlug(name: string): string {
  return slugify(name).replace(/-/g, "");
}

/** Category name → slug (e.g. "Smart Home" → "smart-home"). */
export function categorySlug(name: string): string {
  return slugify(name);
}

/** Product title → slug for /products/[slug]. */
export function productSlug(id: string, title: string): string {
  const base = slugify(title);
  if (base) return base;
  return slugify(id);
}

/** Category page URL: /categories/[platform]/[category]. */
export function categoryUrl(platformName: string, categoryName: string): string {
  return `/categories/${platformSlug(platformName)}/${categorySlug(categoryName)}`;
}

/** Product detail URL: /products/[slug]. */
export function productUrl(id: string, title: string): string {
  return `/products/${productSlug(id, title)}`;
}

/** Deals page URL. */
export function dealsUrl(): string {
  return "/deals";
}

/** Search URL with optional query. */
export function searchUrl(query?: string): string {
  const q = String(query || "").trim();
  return q ? `/search?q=${encodeURIComponent(q)}` : "/search";
}

/** Collection (curated) URL — reserved for Phase 2 curated collections. */
export function collectionUrl(slug: string): string {
  return `/collections/${slugify(slug)}`;
}

/** Guides / knowledge hub URL. */
export function guideUrl(slug: string): string {
  return `/guides/${slugify(slug)}`;
}

/** Case study detail URL: /case-studies/[slug]. */
export function caseStudyUrl(slug: string): string {
  return `/case-studies/${slugify(slug)}`;
}

/** Case studies overview URL. */
export function caseStudiesOverviewUrl(): string {
  return "/case-studies";
}

/** Marketplace detail URL: /marketplaces/[slug]. */
export function marketplaceUrl(slug: string): string {
  return `/marketplaces/${slugify(slug)}`;
}

/** Legal page URL: /[slug]. */
export function legalUrl(slug: string): string {
  return `/${slugify(slug)}`;
}

/** Trust & company page URL: /[slug]. */
export function trustUrl(slug: string): string {
  return `/${slugify(slug)}`;
}

/** ROI calculator tool URL. */
export function roiCalculatorUrl(): string {
  return "/tools/roi-calculator";
}

/** Whether a path should be excluded from indexing. */
export function isNoindexPath(path: string): boolean {
  const clean = normalizePath(path);
  if (clean === "/") return false;
  return NOINDEX_PATH_PREFIXES.some(prefix => clean === prefix || clean.startsWith(`${prefix}/`));
}

/** Whether a path belongs in the sitemap. */
export function isSitemapEligible(path: string): boolean {
  const clean = normalizePath(path);
  if (clean === "/") return true;
  if (isNoindexPath(clean)) return false;
  return !SITEMAP_EXCLUDED_PATHS.some(prefix => clean === prefix || clean.startsWith(`${prefix}/`));
}

/** Robots directive string for a path. */
export function robotsDirective(path: string): string {
  return isNoindexPath(path) ? "noindex, nofollow" : "index, follow";
}

/** Build the sitemap URL entry for a path (canonical absolute URL). */
export function sitemapUrl(path: string): string {
  return canonicalUrl(path);
}

/** True when the URL points to an external site (used for outbound affiliate links). */
export function isExternalUrl(url: string): boolean {
  if (!url) return false;
  if (/^(mailto:|tel:|javascript:|data:|blob:)/i.test(url)) return true;
  try {
    const u = new URL(url, SITE_URL);
    return u.hostname.toLowerCase() !== new URL(SITE_URL).hostname.toLowerCase();
  } catch {
    return false;
  }
}

/** True for URLs that are safe to link as-is from an SEO standpoint. */
export function isSafeLinkUrl(url: string): boolean {
  return !/^(javascript:|data:text\/html|vbscript:)/i.test(String(url || "").trim());
}
