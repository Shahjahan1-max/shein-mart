/**
 * CaseStudiesOverview — /case-studies
 * Grid of documented growth case studies with ItemList structured data.
 */

import { Link } from "wouter";
import { ArrowRight, Trophy } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { PageMeta } from "../../components/seo/PageMeta";
import { JsonLd } from "../../components/seo/JsonLd";
import { Breadcrumbs } from "../../components/seo/Breadcrumbs";
import { CaseStudyCard } from "../../components/CaseStudyCard";
import { CtaBanner } from "../../components/CtaBanner";
import { CASE_STUDIES } from "../../data/caseStudies";
import { caseStudyUrl, caseStudiesOverviewUrl } from "../../lib/seo/internalLinks";
import { canonicalUrl } from "../../lib/seo/urls";

export function CaseStudiesOverview() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <PageMeta
        meta={{
          title: "Case Studies & Marketplace Growth Proof | DealX Stocks",
          description:
            "Documented case studies with verified metrics from marketplace SEO and international ecommerce — fashion, electronics, beauty, home and industrial.",
          canonical: caseStudiesOverviewUrl(),
          ogType: "website",
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "DealX Stocks Case Studies",
          itemListElement: CASE_STUDIES.map((cs, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: cs.title,
            url: canonicalUrl(caseStudyUrl(cs.slug)),
          })),
        }}
      />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-6">
          <Breadcrumbs path={caseStudiesOverviewUrl()} />
        </div>

        <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-6 pb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-violet-600" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-0.5">
                Proof, Not Promises
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Case Studies & Growth Proof
              </h1>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Real data and verified metrics from marketplace SEO and international ecommerce work across
            Amazon, Alibaba, AliExpress and eBay.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {CASE_STUDIES.map(study => (
              <CaseStudyCard key={study.slug} study={study} />
            ))}
          </div>

          <div className="mt-10 flex items-start gap-3 p-5 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-800/40">
            <Trophy className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">Want results like these?</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Book a free consultation and we'll map a growth plan for your marketplace channel.
              </p>
              <Link
                href="/contact?intent=consultation"
                className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
              >
                Book a consultation <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>

        <CtaBanner
          title="Ready to Grow Your Marketplace Sales?"
          subtitle="See how a documented, SEO-first strategy can multiply your organic revenue."
          actions={[
            { label: "Start Earning Free", href: "/register", primary: true },
            { label: "Talk to Us", href: "/contact?intent=consultation" },
          ]}
        />
      </main>
      <Footer />
    </div>
  );
}
