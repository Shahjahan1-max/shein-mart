/**
 * Services Overview Page
 * Enterprise-grade services listing with filtering and detailed service cards
 */

import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { Globe, Package, Target, Rocket, Search, Zap, Shield, TrendingUp, ArrowRight, CheckCircle, Lightbulb, BarChart3 } from 'lucide-react';

const ALL_SERVICES = [
  {
    id: 'international-seo',
    title: 'International SEO',
    shortDescription: 'Comprehensive SEO strategy for global expansion across 15+ markets with localized keyword research and technical optimization.',
    fullDescription: 'Our International SEO service helps brands expand globally with confidence. We combine deep technical expertise with cultural intelligence to ensure your brand resonates in every market.',
    icon: Globe,
    color: 'from-blue-500 to-blue-600',
    features: [
      'Multi-language keyword research and localization',
      'Hreflang implementation and management',
      'Country-specific technical SEO audits',
      'Geo-targeting and ccTLD/subdomain strategy',
      'Local search engine optimization (Baidu, Yandex, Naver)',
      'International content strategy and creation',
      'Cross-border link building campaigns',
      'International analytics and reporting',
    ],
    outcomes: [
      'Average 180% organic traffic increase in new markets',
      'Top 10 rankings for 500+ localized keywords',
      'Successful launches in 15+ countries',
    ],
    pricing: 'Starting at $5,000/month',
    timeline: '3-6 months for initial results',
    caseStudies: ['Global Fashion Brand', 'Electronics Manufacturer'],
    related: ['marketplace-seo', 'technical-audit', 'content-strategy'],
  },
  {
    id: 'marketplace-seo',
    title: 'Marketplace SEO',
    shortDescription: 'Specialized SEO for Amazon, Alibaba, AliExpress, eBay and emerging marketplaces with algorithm-specific strategies.',
    fullDescription: 'Each marketplace has unique ranking algorithms. Our marketplace SEO experts decode these algorithms to maximize your product visibility and sales velocity.',
    icon: Package,
    color: 'from-orange-500 to-orange-600',
    features: [
      'Amazon A9 algorithm optimization',
      'Alibaba search ranking strategies',
      'AliExpress product discoverability',
      'eBay Cassini algorithm mastery',
      'Marketplace-specific keyword research',
      'Listing optimization (title, bullets, backend)',
      'A+ Content / Enhanced Brand Content',
      'Review generation and management',
      'PPC and organic synergy strategies',
    ],
    outcomes: [
      'Average 280% increase in product page views',
      '40% improvement in conversion rates',
      'Top 3 rankings for competitive keywords',
    ],
    pricing: 'Starting at $3,500/month per marketplace',
    timeline: '2-4 months for initial rankings',
    caseStudies: ['Global Fashion Brand', 'Home & Garden Retailer'],
    related: ['international-seo', 'product-visibility', 'growth-strategy'],
  },
  {
    id: 'product-visibility',
    title: 'Product Visibility Optimization',
    shortDescription: 'End-to-end product discoverability optimization including listing optimization, content enhancement, and conversion rate improvement.',
    fullDescription: 'Product visibility is the foundation of marketplace success. We optimize every element of your product presence for maximum discoverability and conversion.',
    icon: Target,
    color: 'from-green-500 to-green-600',
    features: [
      'Comprehensive listing audits and optimization',
      'High-converting product title formulas',
      'Bullet point optimization for conversion',
      'Backend search term maximization',
      'A+ Content / Enhanced Brand Content creation',
      'Product image SEO and optimization',
      'Video content strategy and production',
      'Review acquisition and management systems',
      'Q&A optimization for trust signals',
    ],
    outcomes: [
      'Average 45% increase in click-through rate',
      '30% improvement in conversion rate',
      'Reduced return rates by 25%',
    ],
    pricing: 'Starting at $2,500/month per 50 SKUs',
    timeline: '1-2 months for optimization complete',
    caseStudies: ['Home & Garden Retailer', 'Electronics Manufacturer'],
    related: ['marketplace-seo', 'content-strategy', 'growth-strategy'],
  },
  {
    id: 'growth-strategy',
    title: 'eCommerce Growth Strategy',
    shortDescription: 'Data-driven eCommerce growth strategies combining SEO, marketplace intelligence, and competitive analysis for sustainable scaling.',
    fullDescription: 'Growth without strategy is gambling. We build comprehensive, data-backed growth roadmaps that align SEO, marketplace optimization, and business objectives.',
    icon: Rocket,
    color: 'from-purple-500 to-purple-600',
    features: [
      'Market opportunity analysis and sizing',
      'Competitive intelligence and gap analysis',
      'Customer journey mapping and optimization',
      'Multi-channel growth roadmap development',
      'KPI framework and dashboard setup',
      'Resource allocation and budget optimization',
      'Quarterly business reviews and pivots',
      'Scaling playbooks for new markets',
    ],
    outcomes: [
      'Average 3.2x ROI on growth investments',
      'Successful expansion to 3+ new markets',
      'Reduced customer acquisition cost by 40%',
    ],
    pricing: 'Starting at $7,500/month (retainer)',
    timeline: 'Ongoing partnership model',
    caseStudies: ['Global Fashion Brand', 'Electronics Manufacturer', 'Home & Garden Retailer'],
    related: ['international-seo', 'marketplace-seo', 'marketplace-intelligence'],
  },
  {
    id: 'technical-audit',
    title: 'Technical SEO Audit',
    shortDescription: 'Comprehensive technical SEO audits identifying critical issues and opportunities across your entire digital presence.',
    fullDescription: 'Technical foundation determines SEO ceiling. Our audits go beyond surface-level checks to uncover deep technical debt and optimization opportunities.',
    icon: Search,
    color: 'from-cyan-500 to-cyan-600',
    features: [
      'Comprehensive crawl and indexation analysis',
      'Core Web Vitals and performance audit',
      'Mobile-first indexing readiness',
      'Site architecture and internal linking review',
      'Schema markup and structured data audit',
      'International SEO technical validation',
      'JavaScript rendering and indexing check',
      'Security and HTTPS implementation review',
      'XML sitemap and robots.txt optimization',
    ],
    outcomes: [
      'Average 50+ critical issues identified',
      'Prioritized fix roadmap with effort/impact scoring',
      'Measurable performance improvements post-fix',
    ],
    pricing: 'Starting at $3,000 (one-time)',
    timeline: '2-3 weeks for comprehensive audit',
    caseStudies: ['Electronics Manufacturer', 'Home & Garden Retailer'],
    related: ['international-seo', 'marketplace-seo', 'content-strategy'],
  },
  {
    id: 'content-strategy',
    title: 'Content Strategy & Creation',
    shortDescription: 'Strategic content creation that ranks, converts, and builds topical authority across all target markets and languages.',
    fullDescription: 'Content is the vehicle for SEO success. We create content that serves user intent, satisfies search algorithms, and drives measurable business outcomes.',
    icon: Lightbulb,
    color: 'from-amber-500 to-amber-600',
    features: [
      'Topical authority mapping and content clusters',
      'Multi-language content creation and localization',
      'Product-focused content (guides, comparisons, reviews)',
      'Category page optimization and enrichment',
      'Blog and resource center strategy',
      'Video content strategy and scripts',
      'User-generated content programs',
      'Content refresh and historical optimization',
      'Content performance analytics and iteration',
    ],
    outcomes: [
      'Average 200% increase in organic traffic to content',
      'Top 10 rankings for 200+ informational keywords',
      'Increased dwell time and reduced bounce rate',
    ],
    pricing: 'Starting at $4,000/month',
    timeline: '3-6 months for topical authority',
    caseStudies: ['Global Fashion Brand', 'Electronics Manufacturer'],
    related: ['international-seo', 'product-visibility', 'technical-audit'],
  },
  {
    id: 'marketplace-intelligence',
    title: 'Marketplace Intelligence Platform',
    shortDescription: 'Proprietary data platform providing real-time marketplace insights, competitive tracking, and growth opportunity identification.',
    fullDescription: 'Data without intelligence is noise. Our platform transforms marketplace data into actionable intelligence for strategic decision-making.',
    icon: BarChart3,
    color: 'from-indigo-500 to-indigo-600',
    features: [
      'Real-time keyword ranking tracking',
      'Competitive share of voice analysis',
      'Price and promotion monitoring',
      'Review sentiment and trend analysis',
      'Category trend forecasting',
      'New product launch detection',
      'Custom alerting and reporting',
      'API access for internal tools',
      'White-label reporting for agencies',
    ],
    outcomes: [
      'Early detection of 90%+ market shifts',
      'Competitive advantage through first-mover insights',
      'Data-driven resource allocation',
    ],
    pricing: 'Starting at $1,500/month',
    timeline: 'Immediate access, 1 week setup',
    caseStudies: ['All enterprise clients'],
    related: ['growth-strategy', 'marketplace-seo', 'international-seo'],
  },
];

export function ServicesOverview() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Header />
      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/50 via-purple-900/50 to-indigo-900/50" />
        <div className="relative max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-4">Our Services</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">
            Comprehensive SEO & Growth Services
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            End-to-end solutions for marketplace domination and sustainable eCommerce growth across all major global platforms.
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {ALL_SERVICES.map((service, i) => (
            <a key={service.id} href={`/services/${service.id}`} className="group">
              <Card variant="elevated" hover className="h-full flex flex-col" padding="lg">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${service.color}20 w-fit mb-4`}>
                  <service.icon className="h-6 w-6" style={{ color: service.color.split(' ')[1] }} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{service.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-1">{service.shortDescription}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {service.features.slice(0, 4).map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                {service.features.length > 4 && (
                  <li className="text-sm text-purple-600 dark:text-purple-400">
                    +{service.features.length - 4} more features
                  </li>
                )}
              </ul>
                <Button variant="outline" className="w-full mt-auto">
                  View Details <ArrowRight className="h-4 w-4" />
                </Button>
              </Card>
            </a>
          ))}
        </div>
      </section>

      {/* Process Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900/50">
        <div className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-3">Our Process</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
            How We Deliver Results
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            A proven methodology that transforms marketplace presence into sustainable growth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { step: '01', title: 'Discovery & Audit', description: 'Comprehensive technical, content, and competitive audit across all target marketplaces and markets.' },
            { step: '02', title: 'Strategy & Roadmap', description: 'Data-driven growth roadmap with prioritized initiatives, resource allocation, and success metrics.' },
            { step: '03', title: 'Execution & Optimization', description: 'Systematic implementation with continuous testing, iteration, and real-time performance monitoring.' },
            { step: '04', title: 'Scale & Expand', description: 'Replicate winning strategies across new markets, marketplaces, and product lines for compound growth.' },
          ].map((step, i) => (
            <Card key={i} variant="elevated" padding="lg" className="relative">
              <div className="absolute -top-3 left-6 bg-white dark:bg-gray-900 px-2">
                <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">{step.step}</span>
              </div>
              <div className="pt-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{step.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{step.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 rounded-3xl p-8 sm:p-12 md:p-12 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-6">
            Ready to Transform Your Marketplace Presence?
          </h2>
          <p className="text-purple-200 text-lg max-w-2xl mx-auto mb-10">
            Start with a comprehensive growth audit to uncover your biggest opportunities across all major marketplaces.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="xl" className="bg-white text-purple-700 hover:bg-purple-50 px-10 py-5" onClick={() => window.location.href = '/contact'}>
              Get Free Growth Audit
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 px-8 py-4" onClick={() => window.location.href = '/contact'}>
              Schedule Consultation
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}