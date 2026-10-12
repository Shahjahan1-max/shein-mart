/**
 * Public route registry — every indexable public route with its SEO metadata.
 * Used by the root metadata engine (useRouteMeta), the sitemap builder and SEO
 * validation. Dashboard / admin / super-admin routes are intentionally omitted
 * (they are never indexed).
 */

import type { PageMeta } from "./meta";

export interface PublicRouteDef {
  path: string;
  name: string;
  description: string;
  meta?: Partial<PageMeta>;
  /** For dynamic routes, a matcher that returns params or null. */
  match?: (path: string) => Record<string, string> | null;
  /** Build the concrete canonical path from params (defaults to the matched path). */
  canonical?: (params: Record<string, string>) => string;
}

const SITE_SUFFIX = "DealX Stocks";

export const PUBLIC_ROUTES: PublicRouteDef[] = [
  {
    path: "/",
    name: "Home",
    description:
      "Discover curated deals from Amazon, Alibaba, AliExpress and eBay. Complete tasks, earn commissions and grow your income with DealX Stocks.",
    meta: { ogType: "website" },
  },
  {
    path: "/services",
    name: "Services",
    description:
      "Professional marketplace SEO and international marketing services to grow your Amazon, Alibaba, AliExpress and eBay sales.",
  },
  {
    path: "/services/international-seo",
    name: "International SEO",
    description:
      "Rank globally with multilingual, multi-market international SEO services built for cross-border ecommerce.",
  },
  {
    path: "/services/marketplace-seo/amazon",
    name: "Amazon SEO Services",
    description:
      "Amazon listing optimization and SEO services to win the Buy Box and grow organic sales.",
  },
  {
    path: "/services/marketplace-seo/alibaba",
    name: "Alibaba SEO Services",
    description:
      "Alibaba product ranking and marketplace SEO services to attract more B2B buyers.",
  },
  {
    path: "/services/marketplace-seo/aliexpress",
    name: "AliExpress SEO Services",
    description:
      "AliExpress SEO and listing optimization to boost visibility and conversions.",
  },
  {
    path: "/services/marketplace-seo/ebay",
    name: "eBay SEO Services",
    description:
      "eBay SEO and listing optimization services to improve search visibility and sales.",
  },
  {
    path: "/marketplaces",
    name: "Marketplaces",
    description:
      "Compare the world's leading ecommerce marketplaces — Amazon, Alibaba, AliExpress and eBay — and where to sell.",
  },
  {
    path: "/industries",
    name: "Industries",
    description:
      "Industry-specific marketplace and SEO strategies for electronics, fashion, home, beauty, industrial and more.",
  },
  {
    path: "/knowledge-hub",
    name: "Knowledge Hub",
    description:
      "Guides, tutorials and playbooks on marketplace selling, SEO and cross-border ecommerce from DealX Stocks.",
  },
  {
    path: "/resources",
    name: "Resources",
    description:
      "Case studies, tools and resources to help you grow your ecommerce and marketplace business.",
  },
  {
    path: "/about",
    name: "About Us",
    description:
      "Learn about DealX Stocks — a global deal discovery and earning platform built for smart shoppers and earners.",
  },
  {
    path: "/contact",
    name: "Contact",
    description:
      "Get in touch with the DealX Stocks team. Request a quote, ask a question or start a partnership.",
  },
  // Reserved Phase 2 public routes (registered now so sitemap + meta engine are ready).
  {
    path: "/deals",
    name: "Deals",
    description: "Today's best deals and discounts from Amazon, Alibaba, AliExpress and eBay.",
  },
  {
    path: "/faq",
    name: "FAQ",
    description: "Frequently asked questions about DealX Stocks — deals, affiliate links, shipping, earning and discounts.",
  },
  {
    path: "/glossary",
    name: "Glossary",
    description: "Definitions of essential marketplace, deals and SEO terms used across DealX Stocks.",
  },
  {
    path: "/guides",
    name: "Guides",
    description: "Practical shopping and deals guides — spotting real discounts, comparing prices and safe marketplace shopping.",
  },
  {
    path: "/categories",
    name: "Categories",
    description: "Browse products by category and marketplace across DealX Stocks.",
  },
  {
    path: "/search",
    name: "Search",
    description: "Search products, categories and deals across DealX Stocks.",
    meta: { noindex: true },
  },
  {
    path: "/categories/:platform/:category",
    name: "Category",
    description: "Browse products in a category across leading marketplaces.",
  },
  {
    path: "/products/:slug",
    name: "Product",
    description: "Product details, price comparisons and deals.",
  },
  {
    path: "/guides/:slug",
    name: "Guide",
    description: "Expert buying guides and tutorials from the DealX Stocks knowledge hub.",
  },
  {
    path: "/case-studies",
    name: "Case Studies",
    description:
      "Documented marketplace SEO case studies with verified growth metrics across Amazon, Alibaba, AliExpress and eBay.",
  },
  {
    path: "/case-studies/:slug",
    name: "Case Study",
    description: "In-depth marketplace growth case study with challenge, approach, results and metrics.",
  },
  {
    path: "/tools/roi-calculator",
    name: "ROI Calculator",
    description:
      "Estimate your monthly and yearly commission from affiliate shopping links with the DealX Stocks earnings calculator.",
  },
  // Core Company Pages
  {
    path: "/how-it-works",
    name: "How It Works",
    description: "Learn how DealX Stocks aggregates, verifies, and categorizes deals from Amazon, Alibaba, AliExpress, and eBay.",
  },
  {
    path: "/methodology",
    name: "Methodology",
    description: "Discover our data aggregation standards, deal verification methods, and listing quality evaluation protocols.",
  },
  {
    path: "/editorial-policy",
    name: "Editorial Policy",
    description: "Our standards for fact-checking, editorial independence, deal evaluation, and content revisions.",
  },
  {
    path: "/data-sources",
    name: "Data Sources",
    description: "Learn about the public APIs, affiliate networks, and marketplace index feeds powering DealX Stocks.",
  },
  {
    path: "/trust",
    name: "Trust Center",
    description: "Discover DealX Stocks' safety standards, anti-scam protections, zero fake reviews policy, and data practices.",
  },
  {
    path: "/transparency",
    name: "Transparency & Governance",
    description: "Full disclosure of our affiliate business model, monetization structure, and marketplace independence.",
  },
  {
    path: "/press",
    name: "Press & Media",
    description: "Official press releases, media kit assets, brand guidelines, and news inquiry contacts for DealX Stocks.",
  },
  {
    path: "/careers",
    name: "Careers",
    description: "Explore remote engineering, data, and content roles at DealX Stocks.",
  },
  // Marketplace Dedicated Pages
  {
    path: "/marketplaces/amazon",
    name: "Amazon Marketplace Deals",
    description: "Browse curated Amazon product deals, Prime offers, and consumer electronics savings on DealX Stocks.",
  },
  {
    path: "/marketplaces/alibaba",
    name: "Alibaba B2B Wholesale Deals",
    description: "Explore Alibaba wholesale supplier deals, B2B price tiers, and manufacturer sourcing listings.",
  },
  {
    path: "/marketplaces/aliexpress",
    name: "AliExpress Choice Deals",
    description: "Discover factory-direct AliExpress deals, Choice bargains, and global shipping discounts.",
  },
  {
    path: "/marketplaces/ebay",
    name: "eBay Certified Refurbished & Deals",
    description: "Compare eBay daily deals, brand outlet discounts, and certified refurbished electronics.",
  },
  // Support & Trust Pages
  {
    path: "/support",
    name: "Support Center",
    description: "Get help with DealX Stocks, search our knowledge base, submit a ticket, or reach out on Telegram.",
  },
  {
    path: "/help",
    name: "Help Center",
    description: "Find user guides, deal aggregation FAQs, and customer assistance for DealX Stocks.",
  },
  {
    path: "/report-issue",
    name: "Report an Issue",
    description: "Report stale pricing, broken affiliate links, or inaccurate product information to our team.",
  },
  {
    path: "/feedback",
    name: "Submit Feedback",
    description: "Share your user experience, feature requests, or catalog suggestions with the DealX Stocks product team.",
  },
  // Product Discovery & All Products
  {
    path: "/products",
    name: "Products Catalog",
    description: "Browse the complete DealX Stocks product catalog indexed across leading e-commerce platforms.",
  },
  {
    path: "/all-products",
    name: "All Products",
    description: "Search and explore all product listings, comparative deals, and category offers.",
  },
  // Legal Pages
  {
    path: "/privacy-policy",
    name: "Privacy Policy",
    description: "Learn how DealX Stocks collects, protects, and manages user privacy and data security.",
  },
  {
    path: "/terms-of-service",
    name: "Terms of Service",
    description: "Review the terms and conditions governing your access to and use of DealX Stocks.",
  },
  {
    path: "/cookie-policy",
    name: "Cookie Policy",
    description: "Understand how DealX Stocks uses cookies and local storage technology to enhance your browsing experience.",
  },
  {
    path: "/disclaimer",
    name: "Disclaimer",
    description: "Important legal disclaimers regarding price updates, third-party marketplaces, and product availability.",
  },
  {
    path: "/affiliate-disclosure",
    name: "Affiliate Disclosure",
    description: "Full FTC compliance disclosure of affiliate links and monetization policies on DealX Stocks.",
  },
  {
    path: "/marketplace-disclosure",
    name: "Marketplace Disclosure",
    description: "Clarification of DealX Stocks' independent status and relationship with Amazon, Alibaba, AliExpress, and eBay.",
  },
  {
    path: "/data-accuracy",
    name: "Data Accuracy Policy",
    description: "Our policy regarding deal refresh intervals, price verification, and merchant data accuracy.",
  },
];

/** Find the registry entry that matches a path, returning params when dynamic. */
export function matchPublicRoute(path: string): { route: PublicRouteDef; params: Record<string, string> } | null {
  for (const route of PUBLIC_ROUTES) {
    if (route.path === path) return { route, params: {} };
    if (route.match) {
      const params = route.match(path);
      if (params) return { route, params };
    }
  }
  // Dynamic routes use simple segment matching (":param" tokens).
  const segments = path.split("/").filter(Boolean);
  for (const route of PUBLIC_ROUTES) {
    if (!route.path.includes(":")) continue;
    const tokens = route.path.split("/").filter(Boolean);
    if (tokens.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].startsWith(":")) params[tokens[i].slice(1)] = decodeURIComponent(segments[i]);
      else if (tokens[i] !== segments[i]) { ok = false; break; }
    }
    if (ok) return { route, params };
  }
  return null;
}

/** Build the canonical path for a matched route (defaults to the actual path). */
export function canonicalPathFor(path: string): string {
  const matched = matchPublicRoute(path);
  if (!matched) return path;
  const { route, params } = matched;
  if (route.canonical) return route.canonical(params);
  return path;
}

/** Resolve SEO metadata for a given site path. */
export function resolveRouteMeta(path: string, overrides?: Partial<PageMeta>): Partial<PageMeta> {
  const matched = matchPublicRoute(path);
  const base = matched ? matched.route.meta || {} : {};
  return { ...base, ...(overrides || {}) };
}

/** List of canonical public URLs eligible for the sitemap. */
export function publicCanonicalPaths(): string[] {
  return PUBLIC_ROUTES.filter(r => r.path !== "/search" && !r.path.includes(":"))
    .map(r => r.path)
    .filter(p => !p.includes(":"));
}

/** Human label for the site (used in breadcrumbs / structured data). */
export const SITE_LABEL = SITE_SUFFIX;
