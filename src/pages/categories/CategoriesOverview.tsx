/**
 * CategoriesOverview — /categories
 * Public category discovery page listing all platforms and their categories
 * from the real catalog, with SEO metadata.
 */

import { Link } from "wouter";
import { ArrowLeft, Layers } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { PageMeta } from "../../components/seo/PageMeta";
import { JsonLd } from "../../components/seo/JsonLd";
import { useProductsCatalog } from "../../hooks/useCatalogs";
import { breadcrumbListSchema } from "../../lib/seo/jsonld";
import { categoryUrl } from "../../lib/seo/urls";

const PLATFORM_COLORS: Record<string, string> = {
  Amazon: "#FF9900",
  Alibaba: "#FF6A00",
  AliExpress: "#E62B31",
  eBay: "#0064D2",
};

export function CategoriesOverview() {
  const { data: catalog, loading } = useProductsCatalog();
  const platforms = catalog?.platforms ?? [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <PageMeta
        meta={{
          title: "Shop by Category | DealX Stocks",
          description:
            "Browse products by category and marketplace — Electronics, Smart Home, Gadgets, Fashion and more from Amazon, Alibaba, AliExpress and eBay.",
          canonical: "/categories",
          ogType: "website",
        }}
      />
      <JsonLd
        data={breadcrumbListSchema([
          { name: "Home", path: "/" },
          { name: "Categories", path: "/categories" },
        ])}
      />
      <main className="flex-grow">
        <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-10 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-purple-600 to-indigo-600" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-0.5">
                Browse by Marketplace
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Shop by Category
              </h1>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Explore curated products across the world's leading marketplaces.
          </p>
        </section>

        <section className="max-w-7xl mx-auto px-3 sm:px-6 pb-16">
          {loading && platforms.length === 0 ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
                  <div className="h-4 w-24 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-5/6 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : platforms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Layers className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No categories available right now.</p>
              <Link href="/" className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:underline">
                <ArrowLeft className="h-4 w-4" /> Back to Home
              </Link>
            </div>
          ) : (
            <div className="space-y-10">
              {platforms.map(platform => (
                <div key={platform.name}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-8 w-1 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[platform.name] ?? "#7c3aed" }} />
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white" style={{ color: PLATFORM_COLORS[platform.name] ?? undefined }}>
                      {platform.name}
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {platform.categories.map(category => (
                      <Link
                        key={category.category_name}
                        href={categoryUrl(platform.name, category.category_name)}
                        className="group p-4 rounded-2xl bg-white dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700/60 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md hover:-translate-y-0.5 transition-all"
                      >
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
                          {category.category_name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {category.products.length} product{category.products.length !== 1 ? "s" : ""}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
