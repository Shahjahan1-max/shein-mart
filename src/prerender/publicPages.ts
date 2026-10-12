/**
 * publicPages.ts — build-time static pre-render engine (Phase 4A).
 *
 * Enumerates every concrete public URL and produces, for each one:
 *   - a complete, indexable <head> (title, description, canonical, OG/Twitter,
 *     robots and JSON-LD structured data), and
 *   - a crawlable static content block (h1 + intro + internal links).
 *
 * The static HTML is written next to the SPA shell at build time (see
 * scripts/prerender-public.mjs) so crawlers and link-shares see real content
 * and structured data without executing JavaScript. Stays entirely within the
 * Vite SPA — no framework change, no runtime SSR.
 *
 * This module is pure: no DOM, no import.meta.env, no side effects — safe to
 * run under Node at build time and fully unit-testable.
 */

import type { JsonLdNode } from "../lib/seo/jsonld";
import {
  breadcrumbListSchema,
  categoryBreadcrumbSchema,
  faqPageSchema,
  jsonLdToScript,
  organizationSchema,
  productSchema,
  webSiteSchema,
  type FaqItem,
} from "../lib/seo/jsonld";
import {
  canonicalUrl,
  caseStudyUrl,
  caseStudiesOverviewUrl,
  categorySlug,
  categoryUrl,
  guideUrl,
  platformSlug,
  productUrl,
  roiCalculatorUrl,
  SITE_NAME,
  SITE_TAGLINE,
} from "../lib/seo/urls";
import { DEFAULT_META, DEFAULT_OG_IMAGE, resolveMeta, type PageMeta } from "../lib/seo/meta";
import { canonicalPathFor, PUBLIC_ROUTES, resolveRouteMeta } from "../lib/seo/routes";
import {
  allCategories,
  flattenCatalog,
  getDeals,
  resolveCategoryPage,
} from "../lib/storefront";
import type { ProductsCatalog } from "../hooks/useCatalogs";
import productsSeed from "../data/products.json";
import { ALL_FAQS, HOMEPAGE_FAQS } from "../data/faq";
import { GLOSSARY_TERMS } from "../data/glossary";
import { GUIDES } from "../data/guides";
import { CASE_STUDIES } from "../data/caseStudies";
import { MARKETPLACE_COMPARISON } from "../data/comparisons";

export const CATALOG: ProductsCatalog = productsSeed as unknown as ProductsCatalog;

export interface PrerenderLink {
  label: string;
  href: string;
}

export interface PrerenderPage {
  /** Site-relative path, e.g. "/products/apple-airpods". */
  path: string;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  noindex: boolean;
  ogType: string;
  jsonld: JsonLdNode[];
  heading: string;
  intro: string;
  links: PrerenderLink[];
  changefreq: string;
  priority: number;
  lastmod: string;
}

export const LAST_MOD = "2014-08-08";

const STATIC_LINK_LIMIT = 16;
const PRODUCT_LINK_LIMIT = 12;

// ─── Text escaping ────────────────────────────────────────────────────────────

export function escHtml(input: string): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Page assembly ────────────────────────────────────────────────────────────

interface MkPageInput {
  path: string;
  meta?: Partial<PageMeta> & { ogType?: PageMeta["ogType"] };
  heading: string;
  intro: string;
  jsonld?: JsonLdNode[];
  links?: PrerenderLink[];
  changefreq?: string;
  priority?: number;
}

function mkPage(input: MkPageInput): PrerenderPage {
  const baseMeta = resolveRouteMeta(input.path);
  const resolved = resolveMeta({ ...baseMeta, ...(input.meta || {}) }, input.path);
  const canonical = /^https?:\/\//i.test(resolved.canonical) ? resolved.canonical : canonicalUrl(resolved.canonical);
  return {
    path: input.path,
    title: resolved.title,
    description: resolved.description || "",
    canonical,
    robots: resolved.robots,
    noindex: Boolean(input.meta?.noindex ?? resolved.noindex),
    ogType: input.meta?.ogType ?? baseMeta.ogType ?? "website",
    jsonld: input.jsonld ?? [],
    heading: input.heading,
    intro: input.intro,
    links: input.links ?? [],
    changefreq: input.changefreq ?? "monthly",
    priority: input.priority ?? 0.7,
    lastmod: LAST_MOD,
  };
}

function dedupeLinks(links: PrerenderLink[]): PrerenderLink[] {
  const seen = new Set<string>();
  const out: PrerenderLink[] = [];
  for (const link of links) {
    const key = link.href.replace(/#.*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
  }
  return out;
}

function productLink(f: { href: string; product: { title: string } }): PrerenderLink {
  return { label: f.product.title, href: f.href };
}

// ─── Static (non-catalog) pages ───────────────────────────────────────────────

function homePage(): PrerenderPage {
  const heading = `${SITE_NAME} — ${SITE_TAGLINE}`;
  const topCategories = allCategories(CATALOG).slice(0, 8);
  const topDeals = getDeals(CATALOG).slice(0, 6);
  const links: PrerenderLink[] = [
    { label: "Today's Best Deals", href: "/deals" },
    { label: "Browse Categories", href: "/categories" },
    ...topCategories.map(c => ({ label: `${c.name} Deals`, href: categoryUrl(c.platform, c.name) })),
    { label: "Shopping & Deals Guides", href: "/guides" },
    { label: "Marketplace Comparison", href: "/marketplaces" },
    { label: "Frequently Asked Questions", href: "/faq" },
    { label: "Deal Glossary", href: "/glossary" },
    ...topDeals.map(productLink),
  ];
  return mkPage({
    path: "/",
    heading,
    intro:
      "Discover curated deals and genuine discounts from Amazon, Alibaba, AliExpress and eBay. Compare prices, ratings and savings — and earn commissions on every task.",
    jsonld: [
      organizationSchema(),
      webSiteSchema(),
      faqPageSchema(HOMEPAGE_FAQS as FaqItem[]),
    ],
    links,
    changefreq: "weekly",
    priority: 1.0,
  });
}

function dealsPage(): PrerenderPage {
  const deals = getDeals(CATALOG).slice(0, PRODUCT_LINK_LIMIT);
  return mkPage({
    path: "/deals",
    heading: "Today's Best Deals",
    intro:
      "Real, verified discounts of 5% or more from Amazon, Alibaba, AliExpress and eBay. Every deal shows the exact discount, price and rating.",
    jsonld: [
      breadcrumbListSchema([
        { name: "Home", path: "/" },
        { name: "Deals", path: "/deals" },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Today's Best Deals",
        itemListElement: deals.map((d, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: d.product.title,
          url: canonicalUrl(d.href),
        })),
      },
    ],
    links: deals.map(productLink),
    changefreq: "daily",
    priority: 0.9,
  });
}

function categoriesOverviewPage(): PrerenderPage {
  const cats = allCategories(CATALOG);
  return mkPage({
    path: "/categories",
    heading: "Browse Deals by Category",
    intro:
      "Explore products by category and marketplace — from electronics and smart home to fashion and fitness — across Amazon, Alibaba, AliExpress and eBay.",
    jsonld: [
      breadcrumbListSchema([
        { name: "Home", path: "/" },
        { name: "Categories", path: "/categories" },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Deal Categories",
        itemListElement: cats.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `${c.name} Deals`,
          url: canonicalUrl(categoryUrl(c.platform, c.name)),
        })),
      },
    ],
    links: cats.map(c => ({ label: `${c.name} (${c.productCount})`, href: categoryUrl(c.platform, c.name) })),
    changefreq: "weekly",
    priority: 0.8,
  });
}

function faqPage(): PrerenderPage {
  return mkPage({
    path: "/faq",
    heading: "Frequently Asked Questions",
    intro:
      "Answers about how DealX Stocks works — deals, affiliate links, shipping, discounts, earning and safety on global marketplaces.",
    jsonld: [
      breadcrumbListSchema([
        { name: "Home", path: "/" },
        { name: "FAQ", path: "/faq" },
      ]),
      faqPageSchema(ALL_FAQS as FaqItem[]),
    ],
    links: [
      { label: "Shopping & Deals Guides", href: "/guides" },
      { label: "Deal Glossary", href: "/glossary" },
      { label: "Today's Best Deals", href: "/deals" },
      { label: "Contact Us", href: "/contact" },
    ],
    changefreq: "monthly",
    priority: 0.7,
  });
}

function glossaryPage(): PrerenderPage {
  return mkPage({
    path: "/glossary",
    heading: "Deal & Marketplace Glossary",
    intro:
      "Clear definitions of essential marketplace, deals and SEO terms — compare price, Buy Box, affiliate links and more.",
    jsonld: [
      breadcrumbListSchema([
        { name: "Home", path: "/" },
        { name: "Glossary", path: "/glossary" },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Deal & Marketplace Glossary",
        itemListElement: GLOSSARY_TERMS.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.term,
          url: canonicalUrl(`/glossary#${t.slug}`),
        })),
      },
    ],
    links: GLOSSARY_TERMS.map(t => ({ label: t.term, href: `/glossary#${t.slug}` })),
    changefreq: "monthly",
    priority: 0.7,
  });
}

function guidesOverviewPage(): PrerenderPage {
  return mkPage({
    path: "/guides",
    heading: "Shopping & Deals Guides",
    intro:
      "Practical guides on spotting real discounts, comparing product prices, timing flash sales and shopping marketplaces safely.",
    jsonld: [
      breadcrumbListSchema([
        { name: "Home", path: "/" },
        { name: "Guides", path: "/guides" },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "DealX Stocks Guides",
        itemListElement: GUIDES.map((g, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: g.title,
          url: canonicalUrl(guideUrl(g.slug)),
        })),
      },
    ],
    links: GUIDES.map(g => ({ label: g.title, href: guideUrl(g.slug) })),
    changefreq: "monthly",
    priority: 0.8,
  });
}

function marketplacesPage(): PrerenderPage {
  return mkPage({
    path: "/marketplaces",
    heading: "Marketplace Comparison",
    intro:
      "Compare Amazon, Alibaba, AliExpress and eBay — best fit, typical discounts, delivery speed and buyer protection — in one table.",
    jsonld: [
      breadcrumbListSchema([
        { name: "Home", path: "/" },
        { name: "Marketplaces", path: "/marketplaces" },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Marketplaces",
        itemListElement: MARKETPLACE_COMPARISON.columns.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.label,
          url: canonicalUrl("/marketplaces"),
        })),
      },
    ],
    links: [
      { label: "Today's Best Deals", href: "/deals" },
      { label: "Browse Categories", href: "/categories" },
      { label: "Shopping & Deals Guides", href: "/guides" },
      { label: "Deal Glossary", href: "/glossary" },
    ],
    changefreq: "monthly",
    priority: 0.8,
  });
}

/** Generic page for the remaining static registry routes (services, about, ...). */
function staticRegistryPage(path: string): PrerenderPage {
  const canonical = canonicalPathFor(path);
  const route = PUBLIC_ROUTES.find(r => r.path === path);
  const description = route?.description ?? DEFAULT_META.description ?? "";
  return mkPage({
    path,
    meta: { canonical, description },
    heading: route?.name ?? SITE_NAME,
    intro: description,
    jsonld: [
      breadcrumbListSchema([
        { name: "Home", path: "/" },
        { name: route?.name ?? "Page", path },
      ]),
    ],
    links: [
      { label: "Today's Best Deals", href: "/deals" },
      { label: "Browse Categories", href: "/categories" },
      { label: "Shopping & Deals Guides", href: "/guides" },
      { label: "Frequently Asked Questions", href: "/faq" },
      { label: "Contact Us", href: "/contact" },
    ],
    changefreq: "monthly",
    priority: 0.6,
  });
}

// ─── Catalog-driven pages ─────────────────────────────────────────────────────

export function buildCategoryPages(): PrerenderPage[] {
  const pages: PrerenderPage[] = [];
  for (const platform of CATALOG.platforms ?? []) {
    for (const category of platform.categories ?? []) {
      const data = resolveCategoryPage(
        CATALOG,
        platformSlug(platform.name),
        categorySlug(category.category_name),
      );
      if (!data) continue;
      const path = categoryUrl(data.platform.name, data.category.category_name);
      const productCount = data.flat.length;
      pages.push(
        mkPage({
          path,
          meta: {
            title: `${data.category.category_name} Deals on ${data.platform.name} | DealX Stocks`,
            description: `Browse ${productCount} curated ${data.category.category_name} products on ${data.platform.name}. Compare prices, discounts and ratings, then shop on the official marketplace.`,
            canonical: path,
            ogType: "website",
          },
          heading: `${data.category.category_name} Deals on ${data.platform.name}`,
          intro: `${productCount} curated ${data.category.category_name} products with real prices, discounts and ratings from ${data.platform.name}.`,
          jsonld: [
            categoryBreadcrumbSchema(data.platform.name, data.category.category_name),
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${data.category.category_name} Deals on ${data.platform.name}`,
              itemListElement: data.flat.slice(0, 50).map((f, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: f.product.title,
                url: canonicalUrl(f.href),
              })),
            },
          ],
          links: data.flat.slice(0, PRODUCT_LINK_LIMIT).map(productLink),
          changefreq: "weekly",
          priority: 0.7,
        }),
      );
    }
  }
  return pages;
}

export function buildProductPages(): PrerenderPage[] {
  const flat = flattenCatalog(CATALOG);
  const pages: PrerenderPage[] = [];
  for (const f of flat) {
    const path = f.href;
    const product = f.product;
    pages.push(
      mkPage({
        path,
        meta: {
          title: `${product.title} — Price & Deals | DealX Stocks`,
          description: product.description ?? `${product.title} on ${f.platform} — check the latest price, discount and rating before you buy.`,
          canonical: path,
          ogType: "product",
        },
        heading: product.title,
        intro: `${product.title} on ${f.platform}${product.price ? ` — ${product.price}` : ""}${product.compare_price ? ` (was ${product.compare_price})` : ""}${product.rating ? `, rated ${product.rating}/5` : ""}.`,
        jsonld: [
          breadcrumbListSchema([
            { name: "Home", path: "/" },
            { name: "Categories", path: "/categories" },
            { name: `${f.category}`, path: categoryUrl(f.platform, f.category) },
            { name: product.title, path },
          ]),
          productSchema({
            id: product.id,
            title: product.title,
            price: product.price,
            compare_price: product.compare_price,
            image: product.image,
            product_url: product.product_url,
            platform: f.platform,
            rating: product.rating ?? null,
            reviews: product.reviews ?? null,
            description: product.description ?? null,
            category: f.category,
          }),
        ],
        links: [
          { label: `More ${f.category} on ${f.platform}`, href: categoryUrl(f.platform, f.category) },
          ...flat
            .filter(o => o.slug !== f.slug)
            .slice(0, PRODUCT_LINK_LIMIT)
            .map(productLink),
        ],
        changefreq: "weekly",
        priority: 0.6,
      }),
    );
  }
  return pages;
}

export function buildGuidePages(): PrerenderPage[] {
  return GUIDES.map(guide => {
    const path = guideUrl(guide.slug);
    const articleBody = guide.sections.map(s => s.body).join("\n\n");
    const wordCount = articleBody.split(/\s+/).filter(Boolean).length;
    return mkPage({
      path,
      meta: {
        title: `${guide.title} | DealX Stocks`,
        description: guide.description,
        canonical: path,
        ogType: "article",
      },
      heading: guide.title,
      intro: guide.description,
      jsonld: [
        breadcrumbListSchema([
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: guide.title, path },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.title,
          description: guide.description,
          url: canonicalUrl(path),
          datePublished: LAST_MOD,
          articleBody,
          wordCount,
          author: { "@type": "Organization", name: SITE_NAME },
          publisher: { "@type": "Organization", name: SITE_NAME },
        },
      ],
      links: [
        ...GUIDES.filter(g => g.slug !== guide.slug).map(g => ({ label: g.title, href: guideUrl(g.slug) })),
        { label: "Today's Best Deals", href: "/deals" },
        { label: "Browse Categories", href: "/categories" },
        { label: "Deal Glossary", href: "/glossary" },
      ],
      changefreq: "monthly",
      priority: 0.8,
    });
  });
}

// ─── Authority & conversion pages (Phase 4B) ─────────────────────────────────

function caseStudiesOverviewPage(): PrerenderPage {
  return mkPage({
    path: caseStudiesOverviewUrl(),
    heading: "Case Studies & Growth Proof",
    intro:
      "Documented case studies with verified metrics from marketplace SEO and international ecommerce — fashion, electronics, beauty, home and industrial.",
    jsonld: [
      breadcrumbListSchema([
        { name: "Home", path: "/" },
        { name: "Case Studies", path: caseStudiesOverviewUrl() },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "DealX Stocks Case Studies",
        itemListElement: CASE_STUDIES.map((cs, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: cs.title,
          url: canonicalUrl(caseStudyUrl(cs.slug)),
        })),
      },
    ],
    links: CASE_STUDIES.map(cs => ({ label: cs.title, href: caseStudyUrl(cs.slug) })),
    changefreq: "monthly",
    priority: 0.8,
  });
}

export function buildCaseStudyPages(): PrerenderPage[] {
  return CASE_STUDIES.map(study => {
    const path = caseStudyUrl(study.slug);
    return mkPage({
      path,
      meta: {
        title: `${study.title} | DealX Stocks`,
        description: study.summary,
        canonical: path,
        ogType: "article",
      },
      heading: study.title,
      intro: study.summary,
      jsonld: [
        breadcrumbListSchema([
          { name: "Home", path: "/" },
          { name: "Case Studies", path: caseStudiesOverviewUrl() },
          { name: study.title, path },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "Report",
          headline: study.title,
          description: study.summary,
          url: canonicalUrl(path),
          datePublished: study.publishedAt,
          author: { "@type": "Organization", name: SITE_NAME },
          publisher: { "@type": "Organization", name: SITE_NAME },
          about: { "@type": "Service", name: "Marketplace SEO" },
        },
      ],
      links: [
        { label: "All Case Studies", href: caseStudiesOverviewUrl() },
        ...CASE_STUDIES.filter(cs => cs.slug !== study.slug).map(cs => ({
          label: cs.title,
          href: caseStudyUrl(cs.slug),
        })),
        { label: "Estimate Your Earnings", href: roiCalculatorUrl() },
        { label: "Today's Best Deals", href: "/deals" },
      ],
      changefreq: "monthly",
      priority: 0.7,
    });
  });
}

function roiCalculatorPage(): PrerenderPage {
  return mkPage({
    path: roiCalculatorUrl(),
    heading: "Deal Earnings Calculator",
    intro:
      "Estimate your monthly and yearly commission from affiliate shopping links. Adjust traffic, conversion and commission rates to project your DealX Stocks earnings.",
    jsonld: [
      breadcrumbListSchema([
        { name: "Home", path: "/" },
        { name: "ROI Calculator", path: roiCalculatorUrl() },
      ]),
    ],
    links: [
      { label: "Case Studies & Growth Proof", href: caseStudiesOverviewUrl() },
      { label: "Today's Best Deals", href: "/deals" },
      { label: "Browse Categories", href: "/categories" },
      { label: "Frequently Asked Questions", href: "/faq" },
    ],
    changefreq: "monthly",
    priority: 0.6,
  });
}

// ─── Public enumeration ───────────────────────────────────────────────────────

const SKIP_STATIC_PATHS = new Set([
  "/search",
  "/quote",
  "/categories/:platform/:category",
  "/products/:slug",
  "/guides/:slug",
  "/case-studies/:slug",
]);

/** All indexable public URLs with their prerender payloads. */
export function buildPublicPages(): PrerenderPage[] {
  const pages: PrerenderPage[] = [];

  pages.push(homePage());
  pages.push(dealsPage());
  pages.push(categoriesOverviewPage());
  pages.push(faqPage());
  pages.push(glossaryPage());
  pages.push(guidesOverviewPage());
  pages.push(marketplacesPage());
  pages.push(caseStudiesOverviewPage());
  pages.push(roiCalculatorPage());

  for (const route of PUBLIC_ROUTES) {
    if (SKIP_STATIC_PATHS.has(route.path)) continue;
    if (route.path.includes(":")) continue;
    if (route.path === "/") continue;
    if (["/deals", "/categories", "/faq", "/glossary", "/guides", "/marketplaces", "/case-studies", "/tools/roi-calculator"].includes(route.path)) continue;
    pages.push(staticRegistryPage(route.path));
  }

  pages.push(...buildCategoryPages());
  pages.push(...buildProductPages());
  pages.push(...buildGuidePages());
  pages.push(...buildCaseStudyPages());

  return dedupePages(pages.filter(p => !p.noindex));
}

function dedupePages(pages: PrerenderPage[]): PrerenderPage[] {
  const seen = new Set<string>();
  const out: PrerenderPage[] = [];
  for (const page of pages) {
    if (seen.has(page.path)) continue;
    seen.add(page.path);
    out.push(page);
  }
  return out;
}

// ─── Serialization (pure string builders) ────────────────────────────────────

/** Full <head> content for a page (charset, meta, canonical, OG/Twitter, JSON-LD). */
export function pageToHeadHtml(page: PrerenderPage): string {
  const ogImage = DEFAULT_OG_IMAGE;
  const parts: string[] = [
    `<meta charset="UTF-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
    `<title>${escHtml(page.title)}</title>`,
    `<meta name="description" content="${escHtml(page.description)}" />`,
    `<meta name="robots" content="${escHtml(page.robots)}" />`,
    `<meta name="theme-color" content="#8A4FFF" />`,
    `<link rel="canonical" href="${escHtml(page.canonical)}" />`,
    `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`,
    `<link rel="apple-touch-icon" href="/favicon.svg" />`,
    `<meta property="og:type" content="${escHtml(page.ogType)}" />`,
    `<meta property="og:url" content="${escHtml(page.canonical)}" />`,
    `<meta property="og:title" content="${escHtml(page.title)}" />`,
    `<meta property="og:description" content="${escHtml(page.description)}" />`,
    `<meta property="og:image" content="${escHtml(ogImage)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:site_name" content="${escHtml(SITE_NAME)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:url" content="${escHtml(page.canonical)}" />`,
    `<meta name="twitter:title" content="${escHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escHtml(page.description)}" />`,
    `<meta name="twitter:image" content="${escHtml(ogImage)}" />`,
    `<link rel="dns-prefetch" href="https://fonts.googleapis.com" />`,
    `<link rel="dns-prefetch" href="https://fonts.gstatic.com" />`,
    `<link rel="preconnect" href="https://fonts.googleapis.com" />`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`,
    `<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" onload="this.onload=null;this.rel='stylesheet'" />`,
    `<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" /></noscript>`,
  ];
  for (const node of page.jsonld) {
    parts.push(`\n<script type="application/ld+json">${jsonLdToScript(node)}</script>`);
  }
  return parts.join("\n  ");
}

/** Crawlable static content block shown to non-JS crawlers and link-shares. */
export function pageToStaticBlockHtml(page: PrerenderPage): string {
  const links = dedupeLinks(page.links).slice(0, STATIC_LINK_LIMIT);
  const items = links
    .map(l => `        <li><a href="${escHtml(l.href)}">${escHtml(l.label)}</a></li>`)
    .join("\n");
  return [
    `<noscript>`,
    `  <section style="max-width:960px;margin:0 auto;padding:2rem 1rem;">`,
    `    <h1>${escHtml(page.heading)}</h1>`,
    `    <p>${escHtml(page.intro)}</p>`,
    `    <h2>Explore</h2>`,
    `    <nav>`,
    `      <ul>`,
    items,
    `      </ul>`,
    `    </nav>`,
    `  </section>`,
    `</noscript>`,
  ].join("\n");
}

/** Single <url> block for the sitemap. */
export function pageToSitemapEntry(page: PrerenderPage): string {
  return [
    `  <url>`,
    `    <loc>${escHtml(page.canonical)}</loc>`,
    `    <lastmod>${escHtml(page.lastmod)}</lastmod>`,
    `    <changefreq>${escHtml(page.changefreq)}</changefreq>`,
    `    <priority>${page.priority.toFixed(1)}</priority>`,
    `  </url>`,
  ].join("\n");
}

/** Full sitemap.xml body from a list of pages. */
export function pagesToSitemap(pages: PrerenderPage[]): string {
  const entries = dedupePages(pages.filter(p => !p.noindex))
    .sort((a, b) => (a.path === "/" ? -1 : b.path === "/" ? 1 : a.path.localeCompare(b.path)))
    .map(pageToSitemapEntry)
    .join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    entries,
    `</urlset>`,
    ``,
  ].join("\n");
}
