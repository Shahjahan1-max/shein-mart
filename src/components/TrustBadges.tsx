/**
 * TrustBadges — compact security / trust strip shown across marketing pages.
 * Reinforces credibility near conversion points (CTA, product listings).
 */

import { Lock, ShieldCheck, HandCoins, Globe2, FileCheck, BadgeCheck } from "lucide-react";

const BADGES = [
  { icon: Lock, label: "Secure Checkout", desc: "We link only to official marketplace checkout pages." },
  { icon: ShieldCheck, label: "Verified Listings", desc: "Product links are checked against real marketplace pages." },
  { icon: HandCoins, label: "No Hidden Fees", desc: "Free to browse — commissions never change your price." },
  { icon: BadgeCheck, label: "Real Discounts Only", desc: "Deals require a verified 5%+ price reduction." },
  { icon: Globe2, label: "Global Marketplaces", desc: "Amazon, Alibaba, AliExpress and eBay in one place." },
  { icon: FileCheck, label: "Buyer Protection", desc: "Orders, shipping and returns stay with the marketplace." },
];

export function TrustBadges() {
  return (
    <section className="py-8 sm:py-10 px-3 sm:px-4 max-w-7xl mx-auto" aria-label="Trust and security">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {BADGES.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex flex-col items-center text-center gap-1.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50"
          >
            <div className="h-9 w-9 rounded-lg bg-purple-600/10 dark:bg-purple-500/20 flex items-center justify-center">
              <Icon className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-[11px] font-bold text-gray-900 dark:text-gray-100 leading-tight">{label}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug hidden sm:block">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
