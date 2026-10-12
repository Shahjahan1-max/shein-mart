/**
 * ConsultationCta — "book a free consultation" conversion block.
 * Primary action routes to /contact with an intent query so the sales
 * team can pre-fill context; secondary action points to the ROI tool.
 */

import { Link } from "wouter";
import { CalendarCheck, Calculator, ArrowRight } from "lucide-react";

export function ConsultationCta() {
  return (
    <section className="py-8 sm:py-12 px-3 sm:px-4 max-w-7xl mx-auto">
      <div className="rounded-3xl border border-purple-200/70 dark:border-purple-800/40 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-900 dark:to-purple-950/20 px-6 sm:px-10 py-10 sm:py-12 grid lg:grid-cols-2 gap-8 items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-2">
            Grow With Us
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-3">
            Book a Free Consultation
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-lg">
            Whether you're a brand scaling marketplace sales, a supplier winning B2B orders, or a shopper
            building an earning habit — our team will map a practical growth plan in a 30-minute call.
            No obligation, no pressure.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link
              href="/contact?intent=consultation"
              className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors"
            >
              <CalendarCheck className="h-4 w-4" /> Book a consultation
            </Link>
            <Link
              href="/tools/roi-calculator"
              className="inline-flex items-center justify-center gap-2 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 text-sm font-semibold px-6 py-3 rounded-full hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
            >
              <Calculator className="h-4 w-4" /> Estimate your earnings <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { title: "Marketplace & deal strategy", desc: "Where to list, how to rank and how to win the Buy Box." },
            { title: "Earning & referral setup", desc: "Understand packages, commissions and the wallet in one session." },
            { title: "Custom growth roadmap", desc: "Leave with a written 30/60/90-day plan tailored to your goal." },
          ].map(item => (
            <div
              key={item.title}
              className="flex gap-3 p-4 rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/60"
            >
              <div className="h-8 w-8 rounded-lg bg-purple-600/10 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <ArrowRight className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
