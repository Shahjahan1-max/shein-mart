import React from 'react';
import { ShoppingBag, Globe, ArrowRight, ShieldCheck, TrendingUp, Scale, Compass } from 'lucide-react';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { ComparisonTable } from '../../components/ComparisonTable';
import { DecisionTree } from '../../components/DecisionTree';
import { MARKETPLACE_COMPARISON, MARKETPLACE_DECISION_TREE } from '../../data/comparisons';

export default function MarketplacesOverview() {
  const marketplaces = [
    { id: 'amazon', name: 'Amazon Global', desc: 'Curated consumer electronics, daily deals, Prime offers, and retail discounts.', href: '/marketplaces/amazon', badge: 'US, UK, EU, JP, UAE' },
    { id: 'alibaba', name: 'Alibaba.com', desc: 'B2B wholesale pricing tiers, manufacturer directories, and volume sourcing deals.', href: '/marketplaces/alibaba', badge: 'Global Wholesale' },
    { id: 'aliexpress', name: 'AliExpress', desc: 'Cross-border B2C direct factory bargains, Choice promotions, and budget gadgets.', href: '/marketplaces/aliexpress', badge: '200+ Countries' },
    { id: 'ebay', name: 'eBay', desc: 'Certified Refurbished tech, brand outlets, fixed-price deals, and auction items.', href: '/marketplaces/ebay', badge: 'US, UK, DE, AU' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      <Header />
      <main className="flex-grow pt-24 pb-16">
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-16 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
            Supported <span className="bg-gradient-to-r from-primary to-indigo-600 dark:from-purple-400 dark:to-indigo-500 bg-clip-text text-transparent">Global Marketplaces</span>
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-gray-600 dark:text-gray-300 mb-12">
            Tailored SEO and growth engineering for the world’s largest e-commerce platforms and wholesale channels.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            {marketplaces.map((m) => (
              <a key={m.id} href={m.href} className="p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary/50 dark:hover:border-purple-500/50 shadow-sm hover:shadow-md transition-all text-left group">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-primary dark:group-hover:text-purple-400 transition-colors">{m.name}</h3>
                  <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary dark:bg-purple-500/10 dark:text-purple-400 border border-primary/20 dark:border-purple-500/20 font-semibold">{m.badge}</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{m.desc}</p>
                <span className="text-sm font-semibold text-primary dark:text-purple-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                  Explore Service <ArrowRight className="w-4 h-4" />
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* Comparison table */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-purple-500/10 flex items-center justify-center">
              <Scale className="w-5 h-5 text-primary dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Marketplace Comparison</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Side-by-side view of the leading global marketplaces we support.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
            <ComparisonTable
              columns={MARKETPLACE_COMPARISON.columns}
              rows={MARKETPLACE_COMPARISON.rows}
              caption="Compare Amazon, Alibaba, AliExpress and eBay"
            />
          </div>
        </section>

        {/* Decision tree */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-10">
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Compass className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Find Your Marketplace</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Answer a few questions and we'll point you in the right direction.</p>
                </div>
              </div>
              <div className="rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
                <DecisionTree nodes={MARKETPLACE_DECISION_TREE} />
              </div>
            </div>
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary dark:text-purple-400" /> Buy With Confidence
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  Every marketplace we list offers buyer protection — A-to-z Guarantee, Trade Assurance,
                  Purchase Protection or Money Back Guarantee. Always verify the final price and seller on
                  the official checkout page.
                </p>
              </div>
              <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary dark:text-purple-400" /> Deals Across All Four
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  Our deals rail draws from Amazon, Alibaba, AliExpress and eBay — browse the latest verified
                  discounts on the <a href="/deals" className="text-primary dark:text-purple-400 font-semibold hover:underline">deals page</a>.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
