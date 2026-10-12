import React from 'react';
import { Tag, TrendingUp, Search, ShieldCheck, ArrowRight } from 'lucide-react';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';

export default function EbaySEO() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      <Header />
      <main className="flex-grow pt-24 pb-16">
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Tag className="w-4 h-4" /> Cassini Algorithm Optimization
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
            Master eBay Search with <span className="bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 bg-clip-text text-transparent">Cassini SEO</span>
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-gray-600 dark:text-gray-300 mb-10 leading-relaxed">
            Gain unfair visibility on eBay through structured item specifics, optimized titles, Top Rated Plus status alignment, and high-conversion listings.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/contact" className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
              Get eBay Listing Audit <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
