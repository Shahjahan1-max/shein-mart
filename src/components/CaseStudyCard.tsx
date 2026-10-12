/**
 * CaseStudyCard — summary card for a case study, used on /case-studies
 * and the /resources page. Links to the full case study detail page.
 */

import { Link } from "wouter";
import { ArrowRight, TrendingUp } from "lucide-react";
import type { CaseStudy } from "../data/caseStudies";
import { caseStudyUrl } from "../lib/seo/internalLinks";

export function CaseStudyCard({ study }: { study: CaseStudy }) {
  return (
    <Link
      href={caseStudyUrl(study.slug)}
      className="group p-6 sm:p-7 rounded-2xl bg-white dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700/60 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col"
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {study.marketplaces.slice(0, 2).map(m => (
          <span
            key={m}
            className="text-[10px] font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-600/10 dark:bg-purple-500/15 px-2 py-1 rounded-full"
          >
            {m}
          </span>
        ))}
        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">{study.industry}</span>
      </div>

      <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors mb-2 leading-snug">
        {study.title}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3 mb-4">
        {study.summary}
      </p>

      <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-gray-700/60">
        {study.metrics.slice(0, 2).map(metric => (
          <div key={metric.label}>
            <p className="text-lg font-extrabold text-purple-600 dark:text-purple-400 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              {metric.value}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">{metric.label}</p>
          </div>
        ))}
      </div>

      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
        Read case study <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </Link>
  );
}
