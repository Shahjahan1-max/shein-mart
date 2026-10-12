/**
 * DealsPage — /deals
 * Public deals page listing real discounted products, sorted by discount,
 * with per-page SEO metadata.
 */

import { Link } from "wouter";
import { ArrowLeft, Percent } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { PageMeta } from "../../components/seo/PageMeta";
import { JsonLd } from "../../components/seo/JsonLd";
import { useProductsCatalog } from "../../hooks/useCatalogs";
import { ProductCard } from "../../components/ProductCard";
import { getDeals } from "../../lib/storefront";
import { breadcrumbListSchema } from "../../lib/seo/jsonld";
import { dealsUrl } from "../../lib/seo/urls";

export function DealsPage() {
  const { data: catalog, loading } = useProductsCatalog();
  const deals = getDeals(catalog);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <PageMeta
        meta={{
          title: "Today's Best Deals & Discounts | DealX Stocks",
          description:
            "Browse today's best product deals and discounts from Amazon, Alibaba, AliExpress and eBay. Save up to 60% on top-rated products.",
          canonical: dealsUrl(),
          ogType: "website",
        }}
      />
      <JsonLd
        data={breadcrumbListSchema([
          { name: "Home", path: "/" },
          { name: "Deals", path: dealsUrl() },
        ])}
      />
      <main className="flex-grow">
        <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-10 pb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-green-500 to-emerald-600" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400 mb-0.5">
                Limited Time
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Today's Best Deals
              </h1>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Curated discounts across Amazon, Alibaba, AliExpress and eBay. Prices and availability change
            frequently — grab these while they last.
          </p>
        </section>

        <section className="max-w-7xl mx-auto px-3 sm:px-6 pb-16">
          {loading && deals.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
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
          ) : deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Percent className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No active deals right now. Check back soon.</p>
              <Link href="/" className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:underline">
                <ArrowLeft className="h-4 w-4" /> Back to Home
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {deals.map(item => (
                <ProductCard key={item.product.id} product={item.product} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
