import { SeoContentLayout } from "../../components/seo/SeoContentLayout";
import { AnswerBox } from "../../components/seo/AnswerBox";
import { FaqSection } from "../../components/seo/FaqSection";
import { TRUST_FRAMEWORK } from "../../data/trustData";

export default function HowItWorks() {
  return (
    <SeoContentLayout
      title="How DealX Stocks Works"
      subtitle="A step-by-step breakdown of how DealX Stocks aggregates, verifies, and routes deal listings."
      breadcrumbs={[{ label: "About", href: "/about" }, { label: "How It Works" }]}
      canonicalPath="/how-it-works"
      metaDescription="Learn how DealX Stocks indexes product listings, normalizes e-commerce categories, verifies discounts, and routes direct marketplace traffic."
    >
      <AnswerBox
        question="How does DealX Stocks process product listings?"
        shortAnswer="DealX Stocks indexes public product feeds from Amazon, Alibaba, AliExpress, and eBay, organizes listings into standardized categories, verifies discount parameters, and provides direct outbound referral links to merchant websites."
        detailedExplanation="E-commerce stores maintain distinct data schemas and URL structures. DealX Stocks normalizes title attributes, categorizes items, calculates savings, and verifies link integrity before surfacing items in search and storefront discovery views."
        howItWorksSteps={[
          { title: "1. Public Feed Indexing", description: "Automated ingestion of public product offers and category feeds." },
          { title: "2. Schema Standardization", description: "Mapping product specifications into uniform categories." },
          { title: "3. Deal Verification", description: "Auditing prices against list baselines and seller feedback." },
          { title: "4. Outbound Routing", description: "Direct referral links to merchant checkout pages." },
        ]}
        limitations={[
          "DealX Stocks does not process payments or manage order shipping.",
          "Prices are updated periodically; destination merchant site pricing governs final sale terms.",
        ]}
        relatedPages={[
          { label: "Data Sources", href: "/data-sources" },
          { label: "Methodology", href: "/methodology" },
        ]}
      />

      <section className="space-y-6 text-sm text-slate-700 leading-relaxed">
        <h2 className="text-xl font-extrabold text-slate-900">The Deal Aggregation Pipeline</h2>
        <p>
          Our platform operates strictly as an information provider. We do not maintain warehouse inventories or process financial transactions directly. Instead, our technology builds a searchable index of current e-commerce opportunities so buyers can perform market research and cross-platform price checks efficiently.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-sm">
            <h3 className="font-extrabold text-slate-900 text-sm">For Shoppers</h3>
            <p className="text-xs text-slate-600">
              Search products across top e-commerce platforms in one place, compare prices, read buying guides, and click directly through to official seller listings.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-sm">
            <h3 className="font-extrabold text-slate-900 text-sm">For Resellers & Earners</h3>
            <p className="text-xs text-slate-600">
              Calculate potential referral commissions with our ROI Calculator tool and explore marketplace comparison playbooks.
            </p>
          </div>
        </div>

        <FaqSection
          title="Frequently Asked Questions About How It Works"
          items={TRUST_FRAMEWORK.methodology.faqs}
        />
      </section>
    </SeoContentLayout>
  );
}
