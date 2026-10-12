/**
 * CategoryDiscovery — homepage "Browse by Category" section.
 * Renders real catalog categories with product counts, each linking to its
 * /categories/[platform]/[category] page for internal SEO linking.
 */

import { Link } from "wouter";
import { ArrowRight, Layers } from "lucide-react";
import { useProductsCatalog } from "../hooks/useCatalogs";
import { allCategories } from "../lib/storefront";
import { categoryUrl } from "../lib/seo/urls";

const COLORS = [
  "bg-purple-600",
  "bg-indigo-600",
  "bg-blue-600",
  "bg-teal-600",
  "bg-green-600",
  "bg-orange-600",
  "bg-red-600",
  "bg-pink-600",
];

export function CategoryDiscovery() {
  const { data: catalog, loading } = useProductsCatalog();
  const categories = allCategories(catalog)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 8);

  if (!loading && categories.length === 0) return null;

  return (
    <section id="categories" className="py-10 sm:py-14 px-3 sm:px-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-purple-600 to-indigo-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-0.5">
              Shop by Category
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Popular Categories
            </h2>
          </div>
        </div>
        <Link
          href="/categories"
          className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
        >
          All categories <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading && categories.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {categories.map((cat, i) => (
            <Link
              key={cat.slug}
              href={categoryUrl(cat.platform, cat.name)}
              className="group p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700/60 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className={`${COLORS[i % COLORS.length]} w-9 h-9 rounded-xl flex items-center justify-center mb-3`}>
                <Layers className="h-5 w-5 text-white" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors line-clamp-1">
                {cat.name}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {cat.productCount} product{cat.productCount !== 1 ? "s" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
