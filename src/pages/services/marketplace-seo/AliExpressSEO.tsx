import React from 'react';
import { ShoppingCart, TrendingUp, Search, ShieldCheck, ArrowRight } from 'lucide-react';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';

export default function AliExpressSEO() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      <Header />
      <main className="flex-grow pt-24 pb-16">
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <ShoppingCart className="w-4 h-4" /> Global Cross-Border Retail
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
            Drive Cross-Border Sales with <span className="bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">AliExpress SEO</span>
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-gray-600 dark:text-gray-300 mb-10 leading-relaxed">
            Expand into 200+ countries with search-optimized product titles, multilingual category tagging, and localized currency pricing algorithms.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/contact" className="px-8 py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-500/20 transition-all flex items-center gap-2">
              Optimize AliExpress Store <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
