/**
 * ResourcesOverview — /resources
 * Real case studies, testimonials, lead magnet and tools wired from data files.
 */

import { ArrowRight, Calculator, FolderOpen } from "lucide-react";
import { Link } from "wouter";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { PageMeta } from "../../components/seo/PageMeta";
import { JsonLd } from "../../components/seo/JsonLd";
import { Breadcrumbs } from "../../components/seo/Breadcrumbs";
import { CaseStudyCard } from "../../components/CaseStudyCard";
import { TestimonialsSection } from "../../components/TestimonialsSection";
import { LeadMagnetForm } from "../../components/LeadMagnetForm";
import { CtaBanner } from "../../components/CtaBanner";
import { CASE_STUDIES } from "../../data/caseStudies";
import { caseStudiesOverviewUrl, roiCalculatorUrl } from "../../lib/seo/internalLinks";

export default function ResourcesOverview() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <PageMeta
        meta={{
          title: "Resources — Case Studies, Tools & Guides | DealX Stocks",
          description:
            "Free resources for marketplace sellers and shoppers — documented case studies, testimonials, an ROI calculator and the Deal Hunter's Playbook.",
          canonical: "/resources",
          ogType: "website",
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://dealxstocks.com/" },
            { "@type": "ListItem", position: 2, name: "Resources", item: "https://dealxstocks.com/resources" },
          ],
        }}
      />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-6">
          <Breadcrumbs path="/resources" />
        </div>

        <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-6 pb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-violet-600" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-0.5">
                Free Resources
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Resources & Growth Proof
              </h1>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl mb-8">
            Everything you need to grow — documented case studies, verified testimonials, free tools and a
            lead-magnet playbook.
          </p>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Case Studies</h2>
                <Link
                  href={caseStudiesOverviewUrl()}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {CASE_STUDIES.slice(0, 4).map(study => (
                  <CaseStudyCard key={study.slug} study={study} />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <LeadMagnetForm />
              <div className="p-6 rounded-2xl bg-white dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/60">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-9 w-9 rounded-lg bg-purple-600/10 dark:bg-purple-500/20 flex items-center justify-center">
                    <Calculator className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Deal Earnings Calculator</h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                  Project your monthly commission from shopping referrals in seconds.
                </p>
                <Link
                  href={roiCalculatorUrl()}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Open the calculator <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="p-6 rounded-2xl bg-white dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/60">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-9 w-9 rounded-lg bg-emerald-600/10 dark:bg-emerald-500/20 flex items-center justify-center">
                    <FolderOpen className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Shopping & Deals Guides</h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                  Practical guides on spotting real discounts and safe marketplace shopping.
                </p>
                <Link
                  href="/guides"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Browse guides <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <TestimonialsSection limit={3} />

        <CtaBanner
          title="Ready to Start Growing?"
          subtitle="Join free, complete tasks and earn commissions on every successful referral."
          actions={[
            { label: "Start Earning Free", href: "/register", primary: true },
            { label: "Book a Consultation", href: "/contact?intent=consultation" },
          ]}
        />
      </main>
      <Footer />
    </div>
  );
}
