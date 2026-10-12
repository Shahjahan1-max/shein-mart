/**
 * DealsRail — homepage "Today's Best Deals" section.
 * Shows the top discounted products from the real catalog and links to /deals.
 */

import { Link } from "wouter";
import { ArrowRight, Percent } from "lucide-react";
import { useProductsCatalog } from "../hooks/useCatalogs";
import { ProductCard } from "./ProductCard";
import { getDeals } from "../lib/storefront";

export function DealsRail() {
  const { data: catalog, loading } = useProductsCatalog();
  const deals = getDeals(catalog).slice(0, 5);

  if (!loading && deals.length === 0) return null;

  return (
    <section id="deals" className="py-10 sm:py-14 px-3 sm:px-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-green-500 to-emerald-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400 mb-0.5">
              Limited Time
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Today's Best Deals
            </h2>
          </div>
        </div>
        <Link
          href="/deals"
          className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
        >
          View all deals <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading && deals.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-100 dark:bg-gray-700 animate-pulse" style={{ aspectRatio: "4/3" }} />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {deals.map(item => (
            <ProductCard key={item.product.id} product={item.product} />
          ))}
        </div>
      )}
    </section>
  );
}
