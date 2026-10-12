/**
 * CaseStudiesStrip — homepage authority section showing 3 documented case
 * studies with a link to the full /case-studies overview.
 */

import { Link } from "wouter";
import { ArrowRight, Trophy } from "lucide-react";
import { CASE_STUDIES } from "../data/caseStudies";
import { CaseStudyCard } from "./CaseStudyCard";
import { caseStudiesOverviewUrl } from "../lib/seo/internalLinks";

export function CaseStudiesStrip() {
  return (
    <section className="py-10 sm:py-14 px-3 sm:px-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-1">
            Proof, Not Promises
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Marketplace Growth, Measured
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-2xl">
            Documented results with verified metrics from real marketplace SEO and ecommerce work.
          </p>
        </div>
        <Link
          href={caseStudiesOverviewUrl()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:underline w-fit"
        >
          View all case studies <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {CASE_STUDIES.slice(0, 3).map(study => (
          <CaseStudyCard key={study.slug} study={study} />
        ))}
      </div>

      <div className="mt-6 flex items-start gap-3 p-5 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-800/40">
        <Trophy className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          <span className="font-semibold text-gray-900 dark:text-white">Want results like these?</span>{" "}
          Book a free consultation and we'll map a growth plan for your marketplace channel.
        </p>
        <Link
          href="/contact?intent=consultation"
          className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex-shrink-0"
        >
          Book a consultation <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
