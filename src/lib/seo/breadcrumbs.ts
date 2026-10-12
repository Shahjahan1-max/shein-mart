/**
 * Breadcrumb trail builder — derives a breadcrumb list for a site path.
 * Pure function (testable); powers both the Breadcrumbs UI component and the
 * BreadcrumbList JSON-LD schema.
 */

import { canonicalUrl } from "./urls";
import type { BreadcrumbItem } from "./jsonld";

const HOME: BreadcrumbItem = { name: "Home", path: "/" };

/** Build a breadcrumb trail for a site path. */
export function buildBreadcrumbs(path: string): BreadcrumbItem[] {
  const clean = (String(path || "").split(/[?#]/)[0] || "/").replace(/\/+$/, "");
  if (!clean || clean === "/") return [HOME];

  const segments = clean.split("/").filter(Boolean);
  const trail: BreadcrumbItem[] = [HOME];
  let acc = "";

  segments.forEach((segment, index) => {
    acc += `/${segment}`;
    const isLast = index === segments.length - 1;
    const label = segmentToLabel(segment, isLast);
    trail.push({ name: label, path: isLast ? undefined : acc });
  });

  return trail;
}

/** Convert a URL segment into a human-readable breadcrumb label. */
function segmentToLabel(segment: string, isLast: boolean): string {
  const decoded = decodeURIComponent(segment);
  const labels: Record<string, string> = {
    services: "Services",
    "marketplace-seo": "Marketplace SEO",
    "international-seo": "International SEO",
    international: "International",
    seo: "SEO",
    amazon: "Amazon",
    alibaba: "Alibaba",
    aliexpress: "AliExpress",
    ebay: "eBay",
    marketplaces: "Marketplaces",
    industries: "Industries",
    "knowledge-hub": "Knowledge Hub",
    resources: "Resources",
    about: "About Us",
    contact: "Contact",
    deals: "Deals",
    search: "Search",
    categories: "Categories",
    products: "Products",
    guides: "Guides",
    collections: "Collections",
  };

  if (labels[decoded]) return labels[decoded];

  // URL-encoded multi-word segments (e.g. "smart-home") → title case.
  if (decoded.includes("-")) {
    const readable = decoded
      .split("-")
      .map(word => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(" ");
    if (!isLast) return readable;
    return readable;
  }
  return decoded;
}

/** BreadcrumbList schema for a trail. */
export function breadcrumbsSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.filter(Boolean).map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url || (item.path ? canonicalUrl(item.path) : undefined),
    })),
  };
}
