import { useMemo } from "react";
import { MarketplaceCards } from "../components/MarketplaceCards";
import { CategoryRail } from "../components/CategoryRail";
import { CategoryDiscovery } from "../components/CategoryDiscovery";
import { DealsRail } from "../components/DealsRail";
import { TrustSection } from "../components/TrustSection";
import { FaqAccordion } from "../components/FaqAccordion";
import { MarketplaceStrip } from "../components/MarketplaceStrip";
import { ReviewsTicker } from "../components/ReviewsTicker";
import { SupportSection } from "../components/SupportSection";
import { TestimonialsSection } from "../components/TestimonialsSection";
import { CaseStudiesStrip } from "../components/CaseStudiesStrip";
import { CtaBanner } from "../components/CtaBanner";
import { Footer } from "../components/Footer";
import { Hero } from "../components/Hero";
import { useLandingPageSettings } from "../hooks/useLandingPageSettings";
import { type ProductPlatform, useProductsCatalog } from "../hooks/useCatalogs";
import { Search, Package } from "lucide-react";
import { useLang } from "../contexts/LangContext";
import { translateDisplayText } from "../data/displayTranslations";
import { JsonLd } from "../components/seo/JsonLd";
import { organizationSchema, webSiteSchema, faqPageSchema } from "../lib/seo/jsonld";
import { resolveCtaBanner } from "../lib/ctaVariants";
import { HOMEPAGE_FAQS } from "../data/faq";

interface HomeProps {
  search: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  Amazon: "#FF9900",
  Alibaba: "#FF6A00",
  AliExpress: "#E62B31",
};

function filterProducts(platforms: ProductPlatform[], query: string) {
  if (!query.trim()) return platforms;
  const q = query.toLowerCase();
  return platforms.map(platform => ({
    ...platform,
    categories: platform.categories.map(cat => ({
      ...cat,
      products: cat.products.filter(p =>
        p.title.toLowerCase().includes(q) ||
        cat.category_name.toLowerCase().includes(q) ||
        platform.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      ),
    })).filter(cat => cat.products.length > 0),
  })).filter(pl => pl.categories.length > 0);
}

function totalProductCount(platforms: ProductPlatform[]) {
  return platforms.reduce((sum, pl) => sum + pl.categories.reduce((s, c) => s + c.products.length, 0), 0);
}

export function Home({ search }: HomeProps) {
  const { data: productsCatalog, loading: productsLoading } = useProductsCatalog();
  const productPlatforms = productsCatalog.platforms ?? [];
  const filtered = useMemo(() => filterProducts(productPlatforms, search), [productPlatforms, search]);
  const count = useMemo(() => totalProductCount(filtered), [filtered]);
  const isFiltered = search.trim().length > 0;
  const { data: cfg } = useLandingPageSettings();
  const vis = cfg.visibility;
  const { lang } = useLang();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors relative overflow-x-hidden">
      <JsonLd data={[organizationSchema(), webSiteSchema(), faqPageSchema(HOMEPAGE_FAQS)]} />

      {!isFiltered && vis.showHero && <Hero />}
      {!isFiltered && vis.showMarketplaceCards && <MarketplaceCards />}
      {!isFiltered && vis.showCategoryDiscovery && <CategoryDiscovery />}

      <section id="products" className="max-w-7xl mx-auto px-3 sm:px-6 pt-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-8">
          <div className="min-w-0">
            {!isFiltered && (
              <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-1">
                Curated Deals
              </p>
            )}
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {isFiltered ? "Search Results" : "Featured Products"}
            </h2>
            {isFiltered && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{count}</span>{" "}
                result{count !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
              </p>
            )}
          </div>
          <span className="w-fit text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-full">
            {count} products
          </span>
        </div>

        {productsLoading && productPlatforms.length === 0 ? (
          <div className="space-y-10">
            {[1, 2].map(s => (
              <div key={s}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-8 w-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                  {[1, 2, 3, 4, 5].map(i => (
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
              </div>
            ))}
          </div>
        ) : count === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-5 bg-purple-50 dark:bg-purple-900/20 rounded-3xl mb-5">
              <Search className="h-10 w-10 text-purple-400 dark:text-purple-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">No products found</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
              Try a different search term or browse all products.
            </p>
          </div>
        ) : (
          filtered.map(platform =>
            platform.categories.map(category => (
              <CategoryRail
                key={`${platform.name}-${category.category_name}`}
                platformName={platform.name}
                categoryName={category.category_name}
                products={category.products}
                platformColor={PLATFORM_COLORS[platform.name] ?? "#7c3aed"}
              />
            ))
          )
        )}
      </section>

      {!isFiltered && vis.showDeals && <DealsRail />}
      {!isFiltered && vis.showTrust && <TrustSection />}
      {!isFiltered && vis.showTestimonials && <TestimonialsSection />}
      {!isFiltered && vis.showCaseStudies && <CaseStudiesStrip />}
      {!isFiltered && vis.showFaq && (
        <FaqAccordion
          title="Frequently Asked Questions"
          subtitle="Answers to the questions shoppers ask us most"
          items={HOMEPAGE_FAQS}
        />
      )}

      {!isFiltered && vis.showComingSoon && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-6">
          <div className="flex items-center gap-4 bg-gradient-to-r from-purple-600/10 via-indigo-600/10 to-purple-600/10 dark:from-purple-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 border border-purple-200/60 dark:border-purple-800/40 rounded-2xl px-5 py-4">
            <div className="p-2.5 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex-shrink-0">
              <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
                {translateDisplayText(cfg.comingSoon.title, lang)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {translateDisplayText(cfg.comingSoon.description, lang)}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isFiltered && vis.showCtaBanner && <CtaBanner {...resolveCtaBanner(cfg.cta)} />}

      <MarketplaceStrip />
      <ReviewsTicker />
      {vis.showSupport && <SupportSection />}
      {vis.showFooter && <Footer />}
    </div>
  );
}
