/**
 * CategoryPage — /categories/[platform]/[category]
 * Public storefront category page with sort/filter, breadcrumbs, per-page SEO
 * metadata and BreadcrumbList structured data.
 */

import { useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, PackageOpen, SlidersHorizontal } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { Breadcrumbs } from "../../components/seo/Breadcrumbs";
import { RelatedLinks } from "../../components/seo/RelatedLinks";
import { PageMeta } from "../../components/seo/PageMeta";
import { JsonLd } from "../../components/seo/JsonLd";
import { useProductsCatalog } from "../../hooks/useCatalogs";
import { useLang } from "../../contexts/LangContext";
import { translateDisplayText } from "../../data/displayTranslations";
import { ProductCard } from "../../components/ProductCard";
import {
  resolveCategoryPage,
  sortProducts,
  SORT_OPTIONS,
  isValidSortKey,
} from "../../lib/storefront";
import { categoryBreadcrumbSchema } from "../../lib/seo/jsonld";
import { buildInternalLinks } from "../../lib/seo/internalLinks";
import { categoryUrl } from "../../lib/seo/urls";

const PLATFORM_COLORS: Record<string, string> = {
  Amazon: "#FF9900",
  Alibaba: "#FF6A00",
  AliExpress: "#E62B31",
  eBay: "#0064D2",
};

export function CategoryPage() {
  const params = useParams<{ platform: string; category: string }>();
  const platformSlugValue = params.platform ?? "";
  const categorySlugValue = params.category ?? "";
  const { data: catalog, loading } = useProductsCatalog();
  const page = resolveCategoryPage(catalog, platformSlugValue, categorySlugValue);
  const { lang } = useLang();

  const [sort, setSort] = useState<string>("featured");
  const sortKey = isValidSortKey(sort) ? sort : "featured";

  if (!page) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Header />
        <main className="flex-grow flex flex-col items-center justify-center px-4 py-24 text-center">
          <PageMeta meta={{ title: "Category Not Found", description: "The category you're looking for does not exist.", noindex: true }} />
          <PackageOpen className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Category Not Found</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">The category you're looking for doesn't exist or was moved.</p>
          <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const { platform, category, flat } = page;
  const platformColor = PLATFORM_COLORS[platform.name] ?? "#7c3aed";
  const sorted = sortProducts(flat, sortKey);
  const title = `${category.category_name} Deals & Products | ${platform.name}`;
  const description = `Browse ${flat.length} ${category.category_name} products from ${platform.name} with prices, ratings and deals.`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <PageMeta
        meta={{
          title,
          description,
          canonical: categoryUrl(platform.name, category.category_name),
          ogType: "website",
        }}
      />
      <JsonLd data={categoryBreadcrumbSchema(platform.name, category.category_name)} />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-6">
          <Breadcrumbs path={`/categories/${platformSlugValue}/${categorySlugValue}`} />
        </div>

        {/* Page header */}
        <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-6 pb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-1.5 rounded-full" style={{ backgroundColor: platformColor }} />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: platformColor }}>
                {platform.name}
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                {category.category_name}
              </h1>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            {flat.length} product{flat.length !== 1 ? "s" : ""} — browse curated {category.category_name} products
            on {platform.name} with prices, ratings and exclusive deals.
          </p>
        </section>

        {/* Sort bar */}
        <section className="max-w-7xl mx-auto px-3 sm:px-6 pb-8">
          <div className="flex items-center justify-between gap-3 mb-5">
            <span className="w-fit flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-full">
              <SlidersHorizontal className="h-3.5 w-3.5" /> {flat.length} products
            </span>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              <span className="hidden sm:inline">Sort:</span>
              <select
                value={sortKey}
                onChange={e => setSort(e.target.value)}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.key} value={opt.key}>
                    {translateDisplayText(opt.label, lang)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading && sorted.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="bg-gray-100 dark:bg-gray-700 animate-pulse" style={{ aspectRatio: "4/3" }} />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-5 w-1/2 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <PackageOpen className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No products in this category yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {sorted.map(item => (
                <ProductCard key={item.product.id} product={item.product} />
              ))}
            </div>
          )}
        </section>

        <RelatedLinks
          title="Related Categories & More"
          links={buildInternalLinks({ kind: "category", platform: platform.name, category: category.category_name }, catalog, { limit: 6 })}
        />
      </main>
      <Footer />
    </div>
  );
}
