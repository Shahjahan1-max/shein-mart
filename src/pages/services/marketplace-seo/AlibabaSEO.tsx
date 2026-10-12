import React from 'react';
import { Globe, TrendingUp, Search, ShieldCheck, ArrowRight, Layers, Award } from 'lucide-react';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';

export default function AlibabaSEO() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      <Header />
      <main className="flex-grow pt-24 pb-16">
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Globe className="w-4 h-4" /> B2B Global Trade Engine
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
            Scale B2B Inquiries with <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">Alibaba SEO</span>
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-gray-600 dark:text-gray-300 mb-10 leading-relaxed">
            Optimize your Alibaba Gold Supplier minisite, product keyword rankings, and RFQ response visibility to secure high-volume international wholesale buyers.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/contact" className="px-8 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2">
              Request Alibaba Strategy <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-xl font-bold text-orange-600 dark:text-orange-400 mb-2">Minisite Architecture</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Structuring your Alibaba storefront navigation and company credentials to build trust with global enterprise buyers.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-xl font-bold text-orange-600 dark:text-orange-400 mb-2">B2B Keyword Optimization</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Targeting wholesale search terms, specifications, minimum order quantities (MOQ), and OEM/ODM buyer intent.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-xl font-bold text-orange-600 dark:text-orange-400 mb-2">Star Supplier Optimization</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Improving seller response rate, trade assurance metrics, and showcase allocation to maximize rank boost.</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
