import { SeoContentLayout } from "../../components/seo/SeoContentLayout";
import { AnswerBox } from "../../components/seo/AnswerBox";
import { COMPANY_FACTS } from "../../data/companyFacts";
import { ShieldCheck, Target, Layers, RefreshCw, CheckCircle } from "lucide-react";

export default function AboutUs() {
  return (
    <SeoContentLayout
      title="About DealX Stocks"
      subtitle="The independent marketplace deal aggregation and product discovery platform."
      breadcrumbs={[{ label: "About Us" }]}
      canonicalPath="/about"
      metaDescription="Learn about DealX Stocks — an independent global deal discovery platform indexing products across Amazon, Alibaba, AliExpress, and eBay."
    >
      {/* GEO Answer Box */}
      <AnswerBox
        question="What is DealX Stocks?"
        shortAnswer={COMPANY_FACTS.shortAnswer}
        detailedExplanation={COMPANY_FACTS.entityDescription}
        howItWorksSteps={COMPANY_FACTS.howItWorksSteps}
        limitations={COMPANY_FACTS.limitations}
        relatedPages={[
          { label: "How It Works", href: "/how-it-works" },
          { label: "Methodology", href: "/methodology" },
          { label: "Trust Center", href: "/trust" },
        ]}
      />

      {/* Main Content Sections */}
      <section className="space-y-6 text-sm text-slate-700 leading-relaxed">
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Our Mission & Value Proposition
        </h2>
        <p>
          DealX Stocks was created to solve e-commerce catalog fragmentation. With millions of products scattered across separate marketplace silos, consumers face significant friction comparing deals, checking historical pricing, and evaluating cross-border purchasing options.
        </p>
        <p>
          Our platform brings order to this ecosystem by indexing public product metadata, standardizing pricing structures, and providing a clean, searchable interface.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              Supported Marketplaces
            </h3>
            <p className="text-xs text-slate-600">
              We index deal offers from Amazon, Alibaba, AliExpress, and eBay into unified categories.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 text-blue-600" />
              Data Freshness
            </h3>
            <p className="text-xs text-slate-600">
              Catalog items undergo scheduled API verification and community issue checks to maintain link health.
            </p>
          </div>
        </div>

        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2 pt-4">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          Our Core Transparency Principles
        </h2>
        <ul className="space-y-2 text-xs">
          {COMPANY_FACTS.transparencyPrinciples.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-slate-700">
              <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </SeoContentLayout>
  );
}
