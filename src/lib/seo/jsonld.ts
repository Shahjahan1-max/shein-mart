/**
 * Structured data (JSON-LD) engine — Organization, WebSite, Product, Offer,
 * BreadcrumbList, FAQPage and SearchAction builders for DealXStocks.
 *
 * All builders are pure (no DOM). Values must match visible page content.
 */

import { canonicalUrl, categoryUrl, productUrl, SITE_NAME, SITE_URL } from "./urls";

export type JsonLdNode = Record<string, unknown>;

export interface BreadcrumbItem {
  name?: string;
  label?: string;
  path?: string;
  href?: string;
  url?: string;
}

export interface ProductData {
  id: string;
  title: string;
  price?: string | null;
  compare_price?: string | null;
  image?: string | null;
  product_url?: string | null;
  platform: string;
  rating?: number | null;
  reviews?: number | null;
  description?: string | null;
  category?: string | null;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** Extract a numeric price from a "$49.99" style string. */
export function parsePrice(price?: string | number | null): number | null {
  if (typeof price === "number" && Number.isFinite(price)) return price;
  if (typeof price !== "string" || !price.trim()) return null;
  const n = parseFloat(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Organization schema — mounted on the homepage. */
export function organizationSchema(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${canonicalUrl("/")}#organization`,
    name: SITE_NAME,
    url: canonicalUrl("/"),
    logo: "https://dealxstocks.com/favicon.svg",
    sameAs: [],
  };
}

/** WebSite schema with SearchAction — mounted on the homepage. */
export function webSiteSchema(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${canonicalUrl("/")}#website`,
    url: canonicalUrl("/"),
    name: SITE_NAME,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Product schema from a real catalog product. */
export function productSchema(product: ProductData): JsonLdNode {
  const price = parsePrice(product.price);
  const comparePrice = parsePrice(product.compare_price);
  const offers: JsonLdNode = {
    "@type": "Offer",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: product.product_url || undefined,
  };
  if (price !== null) offers.price = price;
  if (comparePrice !== null && comparePrice > (price || 0)) {
    offers.listPrice = comparePrice;
    offers.price = price;
  }

  const node: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonicalUrl(productUrl(product.id, product.title))}#product`,
    name: product.title,
    url: canonicalUrl(productUrl(product.id, product.title)),
    offers,
  };
  if (product.description) node.description = product.description;
  if (product.image) node.image = product.image;
  if (product.category) node.category = product.category;
  if (product.platform) node.brand = { "@type": "Brand", name: product.platform };
  if (product.rating != null && product.reviews != null) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviews,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return node;
}

/** BreadcrumbList schema for a trail of breadcrumb items. */
export function breadcrumbListSchema(items: BreadcrumbItem[]): JsonLdNode {
  const trail = items.filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => {
      const name = item.name || item.label || "";
      const pathVal = item.path || item.href;
      const targetUrl = item.url || (pathVal ? canonicalUrl(pathVal) : undefined);
      return {
        "@type": "ListItem",
        position: index + 1,
        name,
        item: targetUrl,
      };
    }),
  };
}

/** FAQPage schema for a list of Q&As. */
export function faqPageSchema(items: FaqItem[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item, index) => ({
      "@type": "Question",
      position: index + 1,
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/** BreadcrumbList schema for a category page trail. */
export function categoryBreadcrumbSchema(
  platformName: string,
  categoryName: string,
  items: BreadcrumbItem[] = []
): JsonLdNode {
  const trail: BreadcrumbItem[] = [
    { name: "Home", path: "/" },
    ...items,
    { name: platformName, path: categoryUrl(platformName, "") },
    { name: categoryName, path: categoryUrl(platformName, categoryName) },
  ];
  return breadcrumbListSchema(trail);
}

/** Article schema for guides and blog posts. */
export function articleSchema(data: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
  image?: string;
}): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.title,
    description: data.description,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": data.url,
    },
    datePublished: data.datePublished,
    dateModified: data.dateModified,
    author: {
      "@type": "Organization",
      name: data.authorName || SITE_NAME,
      url: canonicalUrl("/"),
    },
    publisher: organizationSchema(),
    image: data.image || "https://dealxstocks.com/opengraph.jpg",
  };
}

/** WebPage schema for informational trust, methodology, and legal pages. */
export function webPageSchema(data: {
  title: string;
  description: string;
  url: string;
  type?: "WebPage" | "AboutPage" | "ContactPage" | "MedicalWebPage" | "QAPage";
  lastUpdated?: string;
}): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": data.type || "WebPage",
    "@id": `${data.url}#webpage`,
    url: data.url,
    name: data.title,
    description: data.description,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${canonicalUrl("/")}#website`,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: canonicalUrl("/"),
    },
    dateModified: data.lastUpdated || "2026-08-08",
  };
}

/** HowTo schema for step-by-step methodology and guides. */
export function howToSchema(data: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
}): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: data.name,
    description: data.description,
    step: data.steps.map((s, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: s.name,
      itemListElement: [
        {
          "@type": "HowToDirection",
          text: s.text,
        },
      ],
    })),
  };
}

/** Serialize a JSON-LD node to a <script> tag body (unescaped JSON). */
export function jsonLdToScript(node: JsonLdNode): string {
  return JSON.stringify(node);
}
