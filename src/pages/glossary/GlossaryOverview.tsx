/**
 * GlossaryOverview — /glossary
 * SEO glossary of marketplace & deals terminology. Each term has an anchor for
 * deep-linking (used by the internal auto-link engine). Emits ItemList JSON-LD.
 */

import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { PageMeta } from "../../components/seo/PageMeta";
import { JsonLd } from "../../components/seo/JsonLd";
import { Breadcrumbs } from "../../components/seo/Breadcrumbs";
import { GLOSSARY_TERMS } from "../../data/glossary";

const CATEGORY_STYLES: Record<string, string> = {
  "Marketplace SEO": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Deals: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Earnings: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Metrics: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Platforms: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  SEO: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
};

function itemListSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "DealX Stocks Glossary",
    itemListElement: GLOSSARY_TERMS.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.term,
      url: `https://dealxstocks.com/glossary#${t.slug}`,
    })),
  };
}

export function GlossaryOverview() {
  const groups = GLOSSARY_TERMS.reduce<Record<string, typeof GLOSSARY_TERMS>>((acc, term) => {
    (acc[term.category] = acc[term.category] || []).push(term);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <PageMeta
        meta={{
          title: "Marketplace & Deals Glossary | DealX Stocks",
          description:
            "Clear definitions of essential marketplace, deals and SEO terms — A9, Buy Box, commissions, discounts, flash sales and more.",
          canonical: "/glossary",
          ogType: "website",
        }}
      />
      <JsonLd data={itemListSchema()} />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-6">
          <Breadcrumbs path="/glossary" />
        </div>

        <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-6 pb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-indigo-600 to-purple-600" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-0.5">
                Learn the Lingo
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Deals & Marketplace Glossary
              </h1>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Short, practical definitions of the terms you'll see across DealX Stocks — from A9 algorithms and
            Buy Boxes to commissions, cashback and flash sales.
          </p>

          {Object.entries(groups).map(([category, terms]) => (
            <section key={category} className="mt-10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                {category}
                <span className="text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                  {terms.length}
                </span>
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {terms.map(term => (
                  <article
                    key={term.slug}
                    id={term.slug}
                    className="p-5 rounded-2xl bg-white dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700/60 scroll-mt-24"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{term.term}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_STYLES[term.category] ?? "bg-gray-100 text-gray-600"}`}>
                        {term.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{term.definition}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
