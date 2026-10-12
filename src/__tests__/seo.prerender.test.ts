/**
 * seo.prerender.test.ts — build-time static pre-render engine (Phase 4A).
 * Validates the pure page enumeration + head/JSON-LD/crawlable-content builders.
 */

import { describe, it, expect } from "vitest";
import {
  buildPublicPages,
  pageToHeadHtml,
  pageToStaticBlockHtml,
  pagesToSitemap,
  escHtml,
  type PrerenderPage,
} from "../prerender/publicPages";

const pages = buildPublicPages();
const byPath = (path: string): PrerenderPage => {
  const page = pages.find(p => p.path === path);
  if (!page) throw new Error(`missing prerender page: ${path}`);
  return page;
};

describe("buildPublicPages", () => {
  it("covers the core indexable routes", () => {
    for (const path of ["/", "/deals", "/categories", "/faq", "/glossary", "/guides", "/marketplaces"]) {
      expect(byPath(path).path).toBe(path);
    }
  });

  it("covers the authority & conversion routes (Phase 4B)", () => {
    for (const path of ["/case-studies", "/tools/roi-calculator"]) {
      expect(byPath(path).path).toBe(path);
    }
    const detail = pages.filter(p => /^\/case-studies\/[^/]+$/.test(p.path));
    expect(detail.length).toBeGreaterThanOrEqual(6);
    const report = pages.find(p => p.path === "/case-studies/global-fashion-brand-amazon-eu");
    expect(report).toBeTruthy();
  });

  it("enumerates every concrete product, category and guide URL", () => {
    const productPaths = pages.filter(p => p.path.startsWith("/products/"));
    const categoryPaths = pages.filter(p => /^\/categories\/[^/]+\/[^/]+$/.test(p.path));
    const guidePaths = pages.filter(p => p.path.startsWith("/guides/") && p.path !== "/guides");
    expect(productPaths.length).toBeGreaterThan(20);
    expect(categoryPaths.length).toBeGreaterThan(5);
    expect(guidePaths.length).toBeGreaterThanOrEqual(3);
  });

  it("excludes noindex routes (search, quote)", () => {
    const paths = pages.map(p => p.path);
    expect(paths).not.toContain("/search");
    expect(paths).not.toContain("/quote");
    expect(paths.every(p => !p.noindex)).toBe(true);
  });

  it("produces unique paths", () => {
    const paths = pages.map(p => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("gives every page a canonical absolute URL and indexable robots", () => {
    for (const page of pages) {
      expect(page.canonical).toMatch(/^https:\/\/dealxstocks\.com\//);
      expect(page.robots).toBe("index, follow");
      expect(page.heading.length).toBeGreaterThan(0);
      expect(page.intro.length).toBeGreaterThan(0);
      expect(page.priority).toBeGreaterThan(0);
      expect(page.priority).toBeLessThanOrEqual(1);
    }
  });
});

describe("structured data per page type", () => {
  it("home emits Organization, WebSite and FAQPage schema", () => {
    const home = byPath("/");
    const types = home.jsonld.map(n => n["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");
    expect(types).toContain("FAQPage");
  });

  it("product page emits Product + BreadcrumbList schema", () => {
    const product = byPath("/products/echo-dot-5th-gen-smart-speaker");
    const types = product.jsonld.map(n => n["@type"]);
    expect(types).toContain("Product");
    expect(types).toContain("BreadcrumbList");
    const productNode = product.jsonld.find(n => n["@type"] === "Product");
    expect(productNode).toBeTruthy();
    expect((productNode as { name?: string }).name).toContain("Echo Dot");
  });

  it("category page emits ItemList + BreadcrumbList", () => {
    const category = byPath("/categories/amazon/electronics");
    const types = category.jsonld.map(n => n["@type"]);
    expect(types).toContain("ItemList");
    expect(types).toContain("BreadcrumbList");
  });

  it("guide page emits Article schema", () => {
    const guide = byPath("/guides/how-we-pick-deals");
    expect(guide.jsonld.map(n => n["@type"])).toContain("Article");
  });

  it("guide Article schema carries an articleBody and wordCount", () => {
    const guide = byPath("/guides/how-we-pick-deals");
    const article = guide.jsonld.find(n => n["@type"] === "Article") as { articleBody?: string; wordCount?: number };
    expect(typeof article.articleBody).toBe("string");
    expect((article.articleBody ?? "").length).toBeGreaterThan(100);
    expect(article.wordCount).toBeGreaterThan(50);
    expect((article.articleBody ?? "").toLowerCase()).toContain("compare price");
  });

  it("case study overview emits ItemList of case studies", () => {
    const overview = byPath("/case-studies");
    const types = overview.jsonld.map(n => n["@type"]);
    expect(types).toContain("ItemList");
    const list = overview.jsonld.find(n => n["@type"] === "ItemList") as { itemListElement?: unknown[] };
    expect(list.itemListElement?.length).toBeGreaterThanOrEqual(6);
  });

  it("case study detail emits Report schema with published date", () => {
    const detail = byPath("/case-studies/electronics-manufacturer-alibaba-b2b");
    const types = detail.jsonld.map(n => n["@type"]);
    expect(types).toContain("Report");
    expect(types).toContain("BreadcrumbList");
    const report = detail.jsonld.find(n => n["@type"] === "Report") as { datePublished?: string; headline?: string };
    expect(report.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(report.headline).toContain("Electronics Manufacturer");
  });

  it("ROI calculator page is indexable with a breadcrumb", () => {
    const roi = byPath("/tools/roi-calculator");
    expect(roi.robots).toBe("index, follow");
    expect(roi.jsonld.map(n => n["@type"])).toContain("BreadcrumbList");
    expect(roi.links.some(l => l.href === "/case-studies")).toBe(true);
  });
});

describe("escHtml", () => {
  it("escapes HTML metacharacters", () => {
    expect(escHtml(`a < b & "c" 'd'`)).toBe(`a &lt; b &amp; &quot;c&quot; &#39;d&#39;`);
  });
});

describe("pageToHeadHtml", () => {
  const html = pageToHeadHtml(byPath("/"));

  it("includes title, description, canonical and robots", () => {
    expect(html).toContain("<title>");
    expect(html).toContain('name="description"');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('name="robots"');
  });

  it("includes Open Graph and Twitter tags", () => {
    expect(html).toContain('property="og:type"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('property="og:image"');
  });

  it("serializes JSON-LD into ld+json scripts", () => {
    const scripts = html.match(/<script type="application\/ld\+json">/g) ?? [];
    expect(scripts.length).toBeGreaterThanOrEqual(3);
  });
});

describe("pageToStaticBlockHtml", () => {
  const block = pageToStaticBlockHtml(byPath("/deals"));

  it("renders a noscript block with an h1 and crawlable links", () => {
    expect(block).toContain("<noscript>");
    expect(block).toContain("<h1>");
    expect(block).toMatch(/<li><a href="https?:\/\/|href="\//);
  });

  it("escapes link labels", () => {
    const safe = pageToStaticBlockHtml({
      ...byPath("/deals"),
      links: [{ label: `Tom & <Jerry>`, href: "/deals" }],
    });
    expect(safe).toContain("Tom &amp; &lt;Jerry&gt;");
  });
});

describe("pagesToSitemap", () => {
  const sitemap = pagesToSitemap(pages);

  it("renders a valid urlset with one entry per page", () => {
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(sitemap).toContain("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");
    expect((sitemap.match(/<url>/g) ?? []).length).toBe(pages.length);
  });

  it("places the homepage first with priority 1.0", () => {
    const firstUrl = sitemap.slice(sitemap.indexOf("<url>"), sitemap.indexOf("</url>") + 6);
    expect(firstUrl).toContain("https://dealxstocks.com/</loc>");
    expect(firstUrl).toContain("<priority>1.0</priority>");
  });
});
