import React from 'react';
import { Layers, ArrowRight } from 'lucide-react';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';

export default function IndustriesOverview() {
  const industries = [
    { title: 'Fashion & Apparel', desc: 'Size variation indexing, visual search optimization, seasonal trend keyword strategy.' },
    { title: 'Consumer Electronics', desc: 'Technical specification schema, comparison intent keywords, accessory cross-linking.' },
    { title: 'Home & Garden', desc: 'Dimensional attribute keywords, room-based buyer intent, bulky item delivery positioning.' },
    { title: 'Beauty & Personal Care', desc: 'Ingredient transparency keywords, safety certification badges, repeat customer subscription SEO.' },
    { title: 'Sports & Outdoors', desc: 'Activity-based keyword intent, seasonal gear strategy, durable quality positioning.' },
    { title: 'B2B Industrial & Manufacturing', desc: 'OEM/ODM wholesale keywords, CAD specification indexing, RFQ lead capture.' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      <Header />
      <main className="flex-grow pt-24 pb-16">
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-16 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
            Industry Vertical <span className="bg-gradient-to-r from-primary to-indigo-600 dark:from-blue-400 dark:to-indigo-500 bg-clip-text text-transparent">Specialization</span>
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-gray-600 dark:text-gray-300 mb-12">
            Tailored SEO strategies designed for the unique buyer behavior and search algorithms of specific verticals.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {industries.map((ind, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm text-left">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{ind.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">{ind.desc}</p>
                <a href="/contact" className="text-xs font-semibold text-primary dark:text-blue-400 hover:underline flex items-center gap-1">
                  Request Vertical Strategy <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
