/**
 * TrustSection — homepage "Why Shop With DealX Stocks" trust block.
 * Static trust signals reinforcing credibility (SSR-friendly, no external deps).
 */

import { ShieldCheck, BadgeCheck, Clock3, Headphones, Globe2, Tags } from "lucide-react";

const FEATURES = [
  { icon: ShieldCheck, title: "Verified Listings", desc: "Every product link is checked against the official marketplace." },
  { icon: Tags, title: "Real-Time Prices", desc: "Prices, discounts and ratings pulled from live catalog data." },
  { icon: Globe2, title: "Global Marketplaces", desc: "Amazon, Alibaba, AliExpress and eBay — all in one place." },
  { icon: BadgeCheck, title: "5%+ Real Discounts", desc: "Deals only qualify when the compare price is genuinely higher." },
  { icon: Clock3, title: "Always Free to Use", desc: "Browse and compare deals with no signup or subscription." },
  { icon: Headphones, title: "24/7 Support", desc: "A real support team ready to help you find the right product." },
];

export function TrustSection() {
  return (
    <section id="why-us" className="py-10 sm:py-14 px-3 sm:px-4 max-w-7xl mx-auto">
      <div className="bg-gradient-to-br from-gray-50 to-purple-50 dark:from-gray-900 dark:to-purple-950/20 rounded-3xl border border-gray-100 dark:border-gray-800 px-5 sm:px-8 py-10 sm:py-12">
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-1">
            Why Shop With Us
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Trusted by Deal Hunters Worldwide
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-2xl mx-auto">
            We aggregate real product data from the world's leading marketplaces so you can compare prices
            and discounts with confidence.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4 p-5 rounded-2xl bg-white dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/60">
              <div className="w-11 h-11 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
