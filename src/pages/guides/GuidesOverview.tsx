/**
 * GuidesOverview — /guides
 * Index of the programmatic buying guides. Uses guideUrl for internal linking.
 */

import { Link } from "wouter";
import { ArrowRight, BookOpen } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { PageMeta } from "../../components/seo/PageMeta";
import { JsonLd } from "../../components/seo/JsonLd";
import { Breadcrumbs } from "../../components/seo/Breadcrumbs";
import { GUIDES } from "../../data/guides";
import { guideUrl } from "../../lib/seo/urls";

const ICONS = [BookOpen, ArrowRight, BookOpen];

export function GuidesOverview() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <PageMeta
        meta={{
          title: "Shopping & Deals Guides | DealX Stocks",
          description:
            "Practical guides on spotting real discounts, comparing product prices, timing flash sales and shopping marketplaces safely.",
          canonical: "/guides",
          ogType: "website",
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "DealX Stocks Guides",
          itemListElement: GUIDES.map((g, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: g.title,
            url: `https://dealxstocks.com${guideUrl(g.slug)}`,
          })),
        }}
      />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-6">
          <Breadcrumbs path="/guides" />
        </div>

        <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-6 pb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-0.5">
                Learn & Save
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Shopping & Deals Guides
              </h1>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Short, practical guides that help you spot real discounts, compare prices and shop global
            marketplaces with confidence.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {GUIDES.map((guide, i) => {
              const Icon = ICONS[i % ICONS.length];
              return (
                <Link
                  key={guide.slug}
                  href={guideUrl(guide.slug)}
                  className="group p-6 rounded-2xl bg-white dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700/60 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">
                    {guide.category} · {guide.readTime}
                  </p>
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors mb-2">
                    {guide.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3">
                    {guide.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Read guide <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
