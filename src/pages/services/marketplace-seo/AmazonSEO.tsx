import React from 'react';
import { 
  ShoppingBag, 
  TrendingUp, 
  Search, 
  Star, 
  ShieldCheck, 
  BarChart3, 
  CheckCircle, 
  ArrowRight,
  Zap,
  Globe
} from 'lucide-react';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';

export default function AmazonSEO() {
  const features = [
    { title: 'A9 Algorithm Optimization', desc: 'Keyword positioning tuned specifically for Amazon search indexing and conversion velocity.' },
    { title: 'Listing Title & Bullet Structuring', desc: 'Optimized product titles and 5-bullet feature lists tailored for maximum customer click-through.' },
    { title: 'A+ Content & Brand Story', desc: 'High-converting enhanced brand content layout designed to boost conversion rates up to 25%.' },
    { title: 'Backend Search Terms Optimization', desc: 'Maximizing hidden search terms fields without keyword stuffing or character limit violations.' },
    { title: 'Review & Rating Strategy', desc: 'Ethical review acquisition systems and negative feedback mitigation strategies.' },
    { title: 'PPC & Organic Synergy', desc: 'Aligning sponsored products advertising with organic ranking algorithms to lower total ACoS.' }
  ];

  const processSteps = [
    { step: '01', title: 'Listing & Keyword Audit', desc: 'In-depth analysis of existing listings, ranking keywords, conversion bottlenecks, and competitor gap analysis.' },
    { step: '02', title: 'Content & Media Overhaul', desc: 'Rewriting titles, bullet points, descriptions, and designing A+ Content modules.' },
    { step: '03', title: 'Backend & Indexing Setup', desc: 'Optimizing backend search terms, search terms limit, subject matter, and target audience attributes.' },
    { step: '04', title: 'Launch & Velocity Tracking', desc: 'Monitoring keyword positions, organic rank growth, BSR (Best Seller Rank), and conversion metrics.' }
  ];

  const faqs = [
    { q: 'How long does it take to rank higher on Amazon?', a: 'Initial indexing improvements are often visible within 7 to 14 days. Significant organic rank gains and BSR movement typically occur between 30 and 60 days as sales velocity builds.' },
    { q: 'Does Amazon SEO help lower Amazon Advertising ACoS?', a: 'Yes! Higher organic rankings drive non-paid traffic, which lowers reliance on PPC ads and improves your overall Advertising Cost of Sales (ACoS) and Total ACoS (TACoS).' },
    { q: 'Do you support international Amazon marketplaces?', a: 'We optimize for Amazon US, UK, DE, FR, IT, ES, CA, JP, and UAE, providing localized native translation and regional keyword research.' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      <Header />

      <main className="flex-grow pt-24 pb-16">
        {/* Hero Section */}
        <section className="relative px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <ShoppingBag className="w-4 h-4" /> Amazon Growth Engine
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
            Dominate Amazon Search with <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">Data-Driven SEO</span>
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-gray-600 dark:text-gray-300 mb-10 leading-relaxed">
            Maximize your product visibility, rank top for high-intent buyer keywords, and dramatically increase your Best Seller Rank (BSR) across global Amazon marketplaces.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/contact" className="px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2">
              Get Free Amazon Audit <ArrowRight className="w-4 h-4" />
            </a>
            <a href="/case-studies" className="px-8 py-4 rounded-xl bg-white dark:bg-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white font-semibold border border-gray-200 dark:border-gray-700 shadow-sm transition-all">
              View Case Studies
            </a>
          </div>
        </section>

        {/* Stats Strip */}
        <section className="border-y border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 py-8">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-extrabold text-amber-500 dark:text-amber-400">+340%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Avg Organic Traffic Growth</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-amber-500 dark:text-amber-400">94.8%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Top 10 Keyword Success</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-amber-500 dark:text-amber-400">1.2M+</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Listings Optimized</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-amber-500 dark:text-amber-400">15+</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Global Marketplaces</div>
            </div>
          </div>
        </section>

        {/* Core Features */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Full-Funnel Amazon SEO Services</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-3 max-w-2xl mx-auto">Engineered to improve click-through rate, conversion rate, and overall sales velocity.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feat, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 hover:border-amber-500/50 shadow-sm transition-all group">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{feat.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Process Section */}
        <section className="py-20 bg-gray-100/60 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-800 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Our Amazon Optimization Process</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-3">Methodical 4-phase framework for sustained organic growth.</p>
            </div>
            <div className="grid md:grid-cols-4 gap-6">
              {processSteps.map((p, i) => (
                <div key={i} className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm relative">
                  <span className="text-4xl font-extrabold text-amber-500/20 absolute top-4 right-4">{p.step}</span>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 mt-4">{p.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map((faq, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-bold text-amber-600 dark:text-amber-400 mb-2">{faq.q}</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
