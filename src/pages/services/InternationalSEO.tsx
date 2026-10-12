/**
 * International SEO Service Detail Page
 * Enterprise-grade service detail page with full content, FAQ, and conversion elements
 */

import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Card, StatCard, MetricCard } from '../../components/ui/card';
import { Badge, StatusBadge } from '../../components/ui/badge';
import { Tabs, TabList, TabTrigger, TabContent } from '../../components/ui/tabs';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { Globe, CheckCircle, ArrowRight, Shield, Zap, Target, Users, BarChart3, Search, Zap as ZapIcon, FileText, ShieldCheck, TrendingUp, Globe as GlobeIcon, ArrowUpRight, Users as UsersIcon, DollarSign } from 'lucide-react';

const FAQ_DATA = [
  {
    q: 'How long does it take to see results from International SEO?',
    a: 'Initial improvements typically appear within 3-4 months, with significant traffic growth visible at 6-9 months. New market entry typically takes 6-12 months for substantial results, depending on competition and domain authority.',
  },
  {
    q: 'Do you handle hreflang implementation?',
    a: 'Yes, we provide complete hreflang implementation including XML sitemap hreflang, HTML link tags, and HTTP header implementation. We also audit existing hreflang for errors and conflicts.',
  },
  {
    q: 'Which search engines do you optimize for internationally?',
    a: 'We optimize for Google globally, plus Baidu (China), Yandex (Russia), Naver (Korea), Seznam (Czech Republic), and other local search engines based on target markets. Each engine requires specific technical and content strategies.',
  },
  {
    q: 'How do you handle multi-language content?',
    a: 'We work with native-speaking SEO specialists and professional translators for each target language. Content is not merely translated—it\'s localized with cultural nuances, local search intent, and regional keyword variations.',
  },
  {
    q: 'What technical requirements are needed for international SEO?',
    a: 'Key requirements include: proper hreflang implementation, country-specific hosting or CDN, proper ccTLD/subdomain/subdirectory structure, geo-targeting in Search Console, localized schema markup, and local server response times under 200ms.',
  },
  {
    q: 'How do you measure International SEO success?',
    a: 'We track: organic traffic by country/language, keyword rankings per market, organic conversion rates by region, revenue attributed to international organic traffic, share of voice vs local competitors, and Core Web Vitals by region.',
  },
];

const PROCESS_STEPS = [
  {
    number: '01',
    title: 'International SEO Audit',
    description: 'Comprehensive technical, content, and competitive audit across all target markets including hreflang validation, geo-targeting review, and local competitor analysis.',
    deliverables: ['Technical SEO audit per market', 'Hreflang validation report', 'Local competitor gap analysis', 'Keyword opportunity sizing'],
    timeline: '2-3 weeks',
  },
  {
    number: '02',
    title: 'Strategy & Roadmap',
    description: 'Data-driven international SEO strategy with market prioritization, resource allocation, and quarterly milestone planning.',
    deliverables: ['Market prioritization matrix', 'Keyword strategy per market', 'Content localization roadmap', 'Technical implementation plan'],
    timeline: '1-2 weeks',
  },
  {
    number: '03',
    title: 'Technical Implementation',
    description: 'Systematic implementation of hreflang, geo-targeting, site structure, schema markup, and Core Web Vitals optimization across all target markets.',
    deliverables: ['Hreflang implementation', 'Geo-targeting configuration', 'Schema markup deployment', 'Core Web Vitals optimization'],
    timeline: '4-6 weeks',
  },
  {
    number: '04',
    title: 'Content Localization & Creation',
    description: 'Native-language content creation and optimization for priority markets including keyword research, content creation, and on-page optimization.',
    deliverables: ['Localized keyword research', 'Localized content creation', 'On-page optimization', 'Local link building campaigns'],
    timeline: 'Ongoing monthly',
  },
  {
    number: '05',
    title: 'Authority Building & Monitoring',
    description: 'Local link building, citation building, review management, and continuous performance monitoring with monthly reporting and quarterly strategy reviews.',
    deliverables: ['Local link acquisition', 'Citation building', 'Performance dashboards', 'Quarterly strategy reviews'],
    timeline: 'Ongoing monthly',
  },
];

const KEY_MARKETS = [
  { country: 'United States', code: 'US', language: 'English', searchEngine: 'Google', opportunity: 'High', color: 'text-blue-600' },
  { country: 'China', code: 'CN', language: 'Chinese (Simplified)', searchEngine: 'Baidu', opportunity: 'Very High', color: 'text-red-600' },
  { country: 'Germany', code: 'DE', language: 'German', searchEngine: 'Google', opportunity: 'High', color: 'text-yellow-600' },
  { country: 'Japan', code: 'JP', language: 'Japanese', searchEngine: 'Google/Yahoo', opportunity: 'High', color: 'text-red-600' },
  { country: 'United Kingdom', code: 'GB', language: 'English', searchEngine: 'Google', opportunity: 'High', color: 'text-blue-600' },
  { country: 'France', code: 'FR', language: 'French', searchEngine: 'Google', opportunity: 'Medium', color: 'text-blue-600' },
  { country: 'Brazil', code: 'BR', language: 'Portuguese', searchEngine: 'Google', opportunity: 'Medium', color: 'text-green-600' },
  { country: 'India', code: 'IN', language: 'Hindi/English', searchEngine: 'Google', opportunity: 'Very High', color: 'text-orange-600' },
];

export function InternationalSEO() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Header />
      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/50 via-indigo-950/50 to-purple-950/50" />
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Badge variant="primary">International SEO</Badge>
            <Badge variant="secondary">Global Expansion</Badge>
            <Badge variant="outline">15+ Markets</Badge>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">
            International SEO Services
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Scale Organically Across 15+ Global Markets
            </span>
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-3xl mb-10 leading-relaxed">
            Comprehensive SEO strategy for global expansion across 15+ markets with localized keyword research, 
            technical optimization, and cultural intelligence. We help brands dominate search in every target market.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="gap-2 px-8 py-4" onClick={() => window.location.href = '/contact'}>
              Start Global Expansion
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="gap-2 px-8 py-4" onClick={() => window.location.href = '/services'}>
              View All Services
            </Button>
          </div>
        </div>
      </section>

      {/* Key Metrics */}
      <section className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          <StatCard label="Markets Served" value="15+" suffix="+" icon={<GlobeIcon className="h-5 w-5" />} color="primary" />
          <StatCard label="Avg Traffic Growth" value="180%" suffix="%" icon={<TrendingUp className="h-5 w-5" />} color="success" />
          <StatCard label="Markets Launched" value="12" suffix="+" icon={<GlobeIcon className="h-5 w-5" />} color="info" />
          <StatCard label="Client Retention" value="98%" suffix="%" icon={<ShieldCheck className="h-5 w-5" />} color="purple" />
        </div>
      </section>

      {/* Service Overview */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">
            Comprehensive International SEO Coverage
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-12">
            End-to-end international SEO from technical foundation to content localization and authority building.
          </p>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabList className="grid grid-cols-2 md:grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              <TabTrigger value="overview">Overview</TabTrigger>
              <TabTrigger value="process">Our Process</TabTrigger>
              <TabTrigger value="markets">Key Markets</TabTrigger>
            </TabList>

            <TabContent value="overview" className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">What We Deliver</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    International SEO requires more than translation. We build a complete international search presence 
                    that resonates with local audiences while maintaining brand consistency globally.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { icon: GlobeIcon, title: 'Multi-Market Strategy', desc: 'Custom strategies for each target market' },
                      { icon: Search, title: 'Localized Keyword Research', desc: 'Native-language keyword intelligence' },
                      { icon: Shield, title: 'Technical Foundation', desc: 'Hreflang, geo-targeting, schema markup' },
                      { icon: FileText, title: 'Content Localization', desc: 'Native content creation & optimization' },
                      { icon: UsersIcon, title: 'Local Authority Building', desc: 'Local link building & citations' },
                      { icon: BarChart3, title: 'Performance Intelligence', desc: 'Per-market analytics & reporting' },
                    ].map((item, i) => (
                      <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg w-fit mb-2">
                          <item.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{item.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl p-8">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Typical Results Timeline</h3>
                  <div className="space-y-4">
                    {[
                      { time: 'Months 1-3', title: 'Foundation', desc: 'Audit complete, technical fixes deployed, hreflang live' },
                      { time: 'Months 3-6', title: 'Traction', desc: 'First rankings in target markets, traffic growth begins' },
                      { time: 'Months 6-12', title: 'Growth', desc: 'Top 10 rankings for priority keywords, measurable traffic' },
                      { time: 'Year 1+', title: 'Scale', desc: 'Top 3 rankings, significant revenue attribution, new markets' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-4 p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                          {i + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">{item.time}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabContent>

            <TabContent value="process" className="space-y-6">
              <div className="space-y-6">
                {PROCESS_STEPS.map((step, i) => (
                  <Card key={i} variant="elevated" padding="lg" className="relative">
                    <div className="absolute -top-3 left-6 bg-white dark:bg-gray-900 px-2">
                      <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{step.number}</span>
                    </div>
                    <div className="pt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{step.title}</h3>
                        <Badge variant="secondary">{step.timeline}</Badge>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">{step.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {step.deliverables.map((d, idx) => (
                          <Badge key={idx} variant="outline" className="text-sm">{d}</Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabContent>

            <TabContent value="markets" className="space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Market</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Language</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Search Engine</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Opportunity</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Key Considerations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KEY_MARKETS.map((market, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{market.country} <span className="text-sm text-gray-500 ml-2">({market.code})</span></td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{market.language}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{market.searchEngine}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={market.color}>{market.opportunity}</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                          {market.code === 'CN' && 'ICP license, Baidu SEO, Great Firewall'}
                          {market.code === 'DE' && 'GDPR, strict privacy, local hosting'}
                          {market.code === 'JP' && 'Yahoo Japan, complex writing systems'}
                          {market.code === 'BR' && 'Portuguese localization, local payment'}
                          {market.code === 'IN' && 'Hindi/English, mobile-first, price sensitive'}
                          {market.code === 'US' && 'High competition, E-E-A-T critical'}
                          {market.code === 'GB' && 'Post-Brexit regulations, local trust signals'}
                          {market.code === 'FR' && 'French language law, CNIL compliance'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabContent>
          </Tabs>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4 text-center">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 text-center mb-12">
            Common questions about our International SEO services and approach.
          </p>
          <div className="space-y-4">
            {FAQ_DATA.map((faq, i) => (
              <Card key={i} variant="outlined" padding="lg">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{faq.q}</h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-700 rounded-3xl p-8 sm:p-12 md:p-16 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-6">
            Ready to Expand Globally?
          </h2>
          <p className="text-blue-200 text-lg max-w-2xl mx-auto mb-10">
            Get a comprehensive international SEO audit and discover your biggest growth opportunities across 15+ markets.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="xl" className="bg-white text-blue-700 hover:bg-blue-50 px-10 py-5" onClick={() => window.location.href = '/contact'}>
              Get Free International SEO Audit
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 px-8 py-4" onClick={() => window.location.href = '/services'}>
              View All Services
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}