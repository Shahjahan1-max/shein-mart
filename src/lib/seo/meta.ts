/**
 * Metadata engine — per-route <title>, meta description, canonical, Open Graph
 * and Twitter tags for DealXStocks (Phase 1 foundation).
 *
 * A single provider (usePageMeta) is mounted at the app root and re-applies
 * metadata whenever the route changes. Pages may override fields by rendering
 * <PageMeta ... /> (last writer wins). Falls back to a documented default.
 */

import { useEffect } from "react";
import { canonicalUrl, SITE_NAME, SITE_TAGLINE, robotsDirective } from "./urls";

export interface PageMeta {
  title: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  robots?: string;
  ogType?: "website" | "article" | "product";
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterCard?: "summary" | "summary_large_image";
  keywords?: string[];
}

/** Default Open Graph / Twitter image served from the site root. */
export const DEFAULT_OG_IMAGE = "https://dealxstocks.com/opengraph.jpg";

/** Fallback metadata used when no route matches. */
export const DEFAULT_META: PageMeta = {
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description:
    "DealX Stocks is a global deal discovery and earning platform. Browse curated products from Amazon, Alibaba, AliExpress and more — and earn commissions on every task.",
  canonical: canonicalUrl("/"),
  noindex: false,
  ogType: "website",
  ogImage: DEFAULT_OG_IMAGE,
  twitterCard: "summary_large_image",
};

/** Compose a full title with the site suffix, avoiding duplication. */
export function composeTitle(rawTitle: string): string {
  const t = String(rawTitle || "").trim();
  if (!t) return DEFAULT_META.title;
  if (t === SITE_NAME) return t;
  if (t.toLowerCase().includes(SITE_NAME.toLowerCase())) return t;
  return `${t} | ${SITE_NAME}`;
}

export interface ResolvedMeta extends PageMeta {
  title: string;
  canonical: string;
  robots: string;
}

/** Resolve a PageMeta (or partial) into a complete, valid document meta. */
export function resolveMeta(meta: Partial<PageMeta> | PageMeta | undefined, path?: string): ResolvedMeta {
  const { canonical, ...rest } = meta || {};
  const base: PageMeta = { ...DEFAULT_META, ...rest };
  const noindex = Boolean(base.noindex);
  return {
    ...base,
    title: composeTitle(base.title || DEFAULT_META.title),
    canonical: canonical || canonicalUrl(path || "/"),
    robots: base.robots || robotsDirective(path || "/"),
    noindex,
  };
}

/** Validate that a meta object is structurally sound (pure, testable). */
export function validateMeta(meta: Partial<PageMeta>): string[] {
  const issues: string[] = [];
  if (!meta || typeof meta !== "object") return ["meta is not an object"];
  if (!meta.title || !String(meta.title).trim()) issues.push("title is required");
  else if (String(meta.title).length > 65) issues.push(`title is ${String(meta.title).length} chars (recommend <= 65)`);
  if (meta.description !== undefined && String(meta.description).length > 160) {
    issues.push(`description is ${String(meta.description).length} chars (recommend <= 160)`);
  }
  if (meta.canonical && !/^https?:\/\//i.test(meta.canonical)) issues.push("canonical must be absolute http(s) URL");
  return issues;
}

/** Apply a resolved meta object to document.head (idempotent tag management). */
export function applyMeta(meta: ResolvedMeta): void {
  const head = document.head;

  const upsertMeta = (selector: string, tag: string, attrs: Record<string, string>, content?: string) => {
    let el = head.querySelector(selector);
    if (!el) {
      el = document.createElement("meta");
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      head.appendChild(el);
    } else {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    }
    if (content !== undefined) {
      const existing = el.hasAttribute("content") ? el.getAttribute("content") : undefined;
      if (existing !== content) el.setAttribute("content", content);
    }
  };

  // Title
  document.title = meta.title;

  // Canonical
  let canonical = head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    head.appendChild(canonical);
  }
  canonical.setAttribute("href", meta.canonical);

  // Primary meta
  upsertMeta('meta[name="description"]', "meta", { name: "description" }, meta.description || "");
  upsertMeta('meta[name="robots"]', "meta", { name: "robots" }, meta.robots);

  // Open Graph
  upsertMeta('meta[property="og:type"]', "meta", { property: "og:type" }, meta.ogType || "website");
  upsertMeta('meta[property="og:url"]', "meta", { property: "og:url" }, meta.canonical);
  upsertMeta('meta[property="og:title"]', "meta", { property: "og:title" }, meta.ogTitle || meta.title);
  upsertMeta(
    'meta[property="og:description"]',
    "meta",
    { property: "og:description" },
    meta.ogDescription || meta.description || ""
  );
  upsertMeta('meta[property="og:image"]', "meta", { property: "og:image" }, meta.ogImage || DEFAULT_OG_IMAGE);
  upsertMeta('meta[property="og:site_name"]', "meta", { property: "og:site_name" }, SITE_NAME);

  // Twitter
  upsertMeta('meta[name="twitter:card"]', "meta", { name: "twitter:card" }, meta.twitterCard || "summary_large_image");
  upsertMeta('meta[name="twitter:url"]', "meta", { name: "twitter:url" }, meta.canonical);
  upsertMeta('meta[name="twitter:title"]', "meta", { name: "twitter:title" }, meta.ogTitle || meta.title);
  upsertMeta(
    'meta[name="twitter:description"]',
    "meta",
    { name: "twitter:description" },
    meta.ogDescription || meta.description || ""
  );
  upsertMeta('meta[name="twitter:image"]', "meta", { name: "twitter:image" }, meta.ogImage || DEFAULT_OG_IMAGE);

  // Keywords (optional)
  if (meta.keywords?.length) {
    upsertMeta('meta[name="keywords"]', "meta", { name: "keywords" }, meta.keywords.join(", "));
  }
}

/** Apply a partial/PageMeta object directly (used by tests and root wiring). */
export function applyPageMeta(meta: Partial<PageMeta> | PageMeta | undefined, path?: string): void {
  applyMeta(resolveMeta(meta, path));
}

/** Root metadata hook: re-applies metadata whenever location or meta changes. */
export function usePageMeta(meta: Partial<PageMeta> | PageMeta, path: string): void {
  useEffect(() => {
    applyPageMeta(meta, path);
  }, [path, meta]);
}
