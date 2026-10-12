/**
 * Internal-linking engine (Phase 3B — SEO Features).
 * Pure functions that derive contextual internal links for any page context,
 * plus glossary term auto-linking for body copy. No DOM — fully testable.
 */

import { categoryUrl, productUrl, dealsUrl, guideUrl, searchUrl, caseStudyUrl, caseStudiesOverviewUrl, roiCalculatorUrl } from "./urls";
import type { ProductsCatalog } from "../../hooks/useCatalogs";
import {
  flattenCatalog,
  getRelatedProducts,
  allCategories,
  type FlatProduct,
} from "../storefront";

export interface InternalLink {
  label: string;
  href: string;
  /** Group label used to bucket links in the UI. */
  group: string;
}

export type LinkContext =
  | { kind: "home" }
  | { kind: "deals" }
  | { kind: "category"; platform: string; category: string }
  | { kind: "product"; product: FlatProduct }
  | { kind: "guide"; slug: string; title: string };

/** Category links for a given platform (limit + top-N by product count). */
export function categoryLinksFor(
  catalog: ProductsCatalog | undefined | null,
  platform: string | null,
  limit = 6
): InternalLink[] {
  const platforms = catalog?.platforms ?? [];
  const target = platform
    ? platforms.find(p => p.name.toLowerCase() === platform.toLowerCase())
    : platforms[0];
  if (!target) return [];

  const links: InternalLink[] = target.categories
    .slice()
    .sort((a, b) => b.products.length - a.products.length)
    .slice(0, limit)
    .map(c => ({
      label: c.category_name,
      href: categoryUrl(target.name, c.category_name),
      group: "Categories",
    }));

  // If a specific platform was requested, also surface top categories from others.
  if (platform) {
    const others = platforms.filter(p => p.name.toLowerCase() !== platform.toLowerCase());
    const extra = others.flatMap(p =>
      p.categories.slice().sort((a, b) => b.products.length - a.products.length).slice(0, 3).map(c => ({
        label: `${c.category_name} (${p.name})`,
        href: categoryUrl(p.name, c.category_name),
        group: "More Categories",
      }))
    );
    return [...links, ...extra].slice(0, limit + 3);
  }
  return links;
}

/** Product links (related + top rated) for a given context. */
export function productLinksFor(
  catalog: ProductsCatalog | undefined | null,
  context: FlatProduct | null,
  limit = 4
): InternalLink[] {
  const all = flattenCatalog(catalog);
  const related = context ? getRelatedProducts(catalog, context, limit) : [];
  const fallback = all
    .filter(p => !context || p.slug !== context.slug)
    .slice(0, limit);

  const source = related.length > 0 ? related : fallback;
  return source.map(p => ({
    label: p.product.title,
    href: productUrl(p.product.id, p.product.title),
    group: "Related Products",
  }));
}

/** Deals link — used across contexts to feed the /deals hub. */
export function dealsLinks(): InternalLink[] {
  return [{ label: "Today's Best Deals", href: dealsUrl(), group: "Deals" }];
}

/** Search/exploration links. */
export function exploreLinks(): InternalLink[] {
  return [
    { label: "All Categories", href: "/categories", group: "Explore" },
    { label: "Browse Products", href: searchUrl(), group: "Explore" },
  ];
}

/** Guide links (internal content hub cross-linking). */
export function guideLinks(context?: LinkContext): InternalLink[] {
  const base = [
    { label: "How We Pick Deals", href: guideUrl("how-we-pick-deals"), group: "Guides" },
    { label: "Understanding Discounts", href: guideUrl("understanding-discounts"), group: "Guides" },
    { label: "Safe Shopping Guide", href: guideUrl("safe-shopping-guide"), group: "Guides" },
  ];
  if (context?.kind === "product") {
    return [{ label: "How to Compare Product Prices", href: guideUrl("understanding-discounts"), group: "Guides" }, ...base];
  }
  return base;
}

/** Build a full set of contextual internal links for a page context. */
export function buildInternalLinks(
  context: LinkContext,
  catalog: ProductsCatalog | undefined | null,
  opts: { limit?: number } = {}
): InternalLink[] {
  const limit = opts.limit ?? 6;

  switch (context.kind) {
    case "home":
      return [
        ...categoryLinksFor(catalog, null, limit),
        ...dealsLinks(),
        ...guideLinks(),
        ...exploreLinks(),
      ];
    case "deals":
      return [...exploreLinks(), ...categoryLinksFor(catalog, null, limit), ...guideLinks(context)];
    case "category":
      return [
        ...categoryLinksFor(catalog, context.platform, limit),
        ...dealsLinks(),
        ...productLinksFor(catalog, null, 0).slice(0, 0),
        ...guideLinks(context),
      ];
    case "product":
      return [
        ...productLinksFor(catalog, context.product, limit),
        ...categoryLinksFor(catalog, context.product.platform, 4),
        ...dealsLinks(),
        ...guideLinks(context),
      ];
    case "guide":
      return [...guideLinks(), ...exploreLinks(), ...dealsLinks()];
    default:
      return [];
  }
}

/** Auto-link glossary terms in body text (first N occurrences per term). */
export function autoLinkTerms(
  text: string,
  terms: { term: string; slug: string }[],
  opts: { perTerm?: number; wordBoundary?: boolean } = {}
): string {
  const perTerm = opts.perTerm ?? 1;
  const wordBoundary = opts.wordBoundary ?? true;
  let out = text;
  for (const { term, slug } of terms) {
    if (!term) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const boundary = wordBoundary ? `(?<![\\p{L}\\p{N}])` : "";
    const endBoundary = wordBoundary ? `(?![\\p{L}\\p{N}])` : "";
    const regex = new RegExp(`${boundary}(${escaped})${endBoundary}`, "giu");
    let count = 0;
    out = out.replace(regex, match => {
      if (count >= perTerm) return match;
      count += 1;
      return `<a href="/glossary#${slug}" class="auto-link">${match}</a>`;
    });
  }
  return out;
}

/** Case study detail URL: /case-studies/[slug]. */
export { caseStudyUrl };

/** Case studies overview URL. */
export { caseStudiesOverviewUrl };

/** ROI calculator tool URL. */
export { roiCalculatorUrl };

/** Authority / conversion hub links (case studies, tools, resources). */
export function authorityLinks(): InternalLink[] {
  return [
    { label: "Case Studies", href: caseStudiesOverviewUrl(), group: "Proof" },
    { label: "ROI Calculator", href: roiCalculatorUrl(), group: "Tools" },
    { label: "Resources", href: "/resources", group: "Tools" },
    { label: "Frequently Asked Questions", href: "/faq", group: "Help" },
    { label: "Book a Consultation", href: "/contact?intent=consultation", group: "Help" },
  ];
}

/** Sanity: assert that a set of internal links contains no duplicates by href. */
export function dedupeInternalLinks(links: InternalLink[]): InternalLink[] {
  const seen = new Set<string>();
  const out: InternalLink[] = [];
  for (const link of links) {
    if (seen.has(link.href)) continue;
    seen.add(link.href);
    out.push(link);
  }
  return out;
}

export { allCategories };
