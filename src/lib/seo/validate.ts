/**
 * SEO validation utilities — used in tests, dev-time checks and the sitemap
 * builder. All pure functions operating on route registry data.
 */

import {
  canonicalUrl,
  isNoindexPath,
  isSitemapEligible,
  robotsDirective,
  SITE_URL,
} from "./urls";
import { PUBLIC_ROUTES } from "./routes";
import { validateMeta, type PageMeta } from "./meta";

export interface SeoValidationIssue {
  severity: "error" | "warning";
  path: string;
  message: string;
}

/** Validate the full public route registry. */
export function validateRouteRegistry(): SeoValidationIssue[] {
  const issues: SeoValidationIssue[] = [];
  for (const route of PUBLIC_ROUTES) {
    const path = route.path;
    if (!path.startsWith("/")) {
      issues.push({ severity: "error", path, message: "route path must start with /" });
    }
    if (!route.name) {
      issues.push({ severity: "error", path, message: "route is missing a name" });
    }
    if (route.meta) {
      // Title is derived from the route name; validate the rest of the meta.
      for (const msg of validateMeta({ title: route.name, ...route.meta } as PageMeta)) {
        if (msg === "title is required") continue;
        issues.push({ severity: "error", path, message: msg });
      }
    }
  }
  return issues;
}

/** Validate a concrete public path against indexability + canonical rules. */
export function validatePage(path: string, meta?: Partial<PageMeta>): SeoValidationIssue[] {
  const issues: SeoValidationIssue[] = [];

  if (!isSitemapEligible(path)) {
    // noindex paths must not be in the sitemap — this is enforced by design.
  }

  if (meta) {
    for (const msg of validateMeta(meta)) {
      issues.push({ severity: "error", path, message: msg });
    }
    if (meta.noindex && robotsDirective(path) === "index, follow") {
      issues.push({ severity: "warning", path, message: "meta.noindex set but path robots directive allows index" });
    }
  }

  const canonical = canonicalUrl(path);
  if (!canonical.startsWith(SITE_URL)) {
    issues.push({ severity: "error", path, message: `canonical ${canonical} is not on ${SITE_URL}` });
  }
  if (isNoindexPath(path) && !(meta && meta.noindex === true)) {
    issues.push({ severity: "warning", path, message: "path is noindex by prefix but meta.noindex not explicit" });
  }
  return issues;
}

/** Build a full sitemap.xml document string from eligible public paths. */
export function buildSitemapXml(paths: string[]): string {
  const eligible = paths.filter(p => isSitemapEligible(p));
  const urls = [...new Set(eligible)].map(
    path =>
      `  <url>\n    <loc>${canonicalUrl(path)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
