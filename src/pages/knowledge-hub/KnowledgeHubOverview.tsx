import React from 'react';
import { BookOpen, Search, ArrowRight, ShieldCheck } from 'lucide-react';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';

export default function KnowledgeHubOverview() {
  const sections = [
    { title: 'Marketplace SEO Blog', desc: 'Latest insights on Amazon A9 updates, Alibaba ranking changes, and global SEO trends.' },
    { title: 'SEO Guides & Manuals', desc: 'Comprehensive step-by-step optimization blueprints for e-commerce brands.' },
    { title: 'SEO Glossary', desc: 'Clear definitions of essential marketplace SEO, BSR, ACoS, TACoS, and schema terms.' },
    { title: 'E-commerce Academy', desc: 'Structured training modules for marketplace growth managers and founders.' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      <Header />
      <main className="flex-grow pt-24 pb-16">
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-16 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
            Knowledge Hub & <span className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-500 bg-clip-text text-transparent">SEO Intelligence</span>
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-gray-600 dark:text-gray-300 mb-12">
            Authoritative guides, research papers, and technical documentation on global marketplace search algorithms.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            {sections.map((sec, i) => (
              <div key={i} className="p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm text-left">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{sec.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{sec.desc}</p>
                <a href="/guides" className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline">
                  Browse Articles <ArrowRight className="w-4 h-4" />
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
