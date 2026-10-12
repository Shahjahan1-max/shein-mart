import { SeoContentLayout } from "../../components/seo/SeoContentLayout";
import { AnswerBox } from "../../components/seo/AnswerBox";
import { TRUST_FRAMEWORK } from "../../data/trustData";
import { CheckCircle2 } from "lucide-react";

export default function Methodology() {
  const data = TRUST_FRAMEWORK.methodology;

  return (
    <SeoContentLayout
      title={data.title}
      subtitle={data.subtitle}
      breadcrumbs={[{ label: "About", href: "/about" }, { label: "Methodology" }]}
      canonicalPath="/methodology"
      metaDescription={data.metaDescription}
      lastUpdated={data.lastUpdated}
    >
      <AnswerBox
        question="What is DealX Stocks' deal indexing methodology?"
        shortAnswer="Our methodology standardizes public e-commerce data into uniform product profiles, calculates verified discount percentages against realistic list prices, and enforces link health audits."
        howItWorksSteps={data.keyPrinciples.map(p => ({ title: p.title, description: p.detail }))}
        relatedPages={[
          { label: "Data Sources", href: "/data-sources" },
          { label: "Trust Center", href: "/trust" },
        ]}
      />

      <section className="space-y-6 text-sm text-gray-300 leading-relaxed">
        <h2 className="text-xl font-bold text-white">Our Methodological Pillars</h2>
        <div className="space-y-4">
          {data.keyPrinciples.map((p, idx) => (
            <div key={idx} className="p-5 rounded-xl border border-gray-800 bg-gray-900/60">
              <h3 className="font-bold text-white text-base mb-1 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-purple-400" />
                {p.title}
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed">{p.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </SeoContentLayout>
  );
}
