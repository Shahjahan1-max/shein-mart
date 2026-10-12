import { SeoContentLayout } from "../../components/seo/SeoContentLayout";
import { TRUST_FRAMEWORK } from "../../data/trustData";
import { ShieldCheck } from "lucide-react";

export default function Trust() {
  const data = TRUST_FRAMEWORK.trust;

  return (
    <SeoContentLayout
      title={data.title}
      subtitle={data.subtitle}
      breadcrumbs={[{ label: "About", href: "/about" }, { label: "Trust Center" }]}
      canonicalPath="/trust"
      metaDescription={data.metaDescription}
      lastUpdated={data.lastUpdated}
    >
      <section className="space-y-6 text-sm text-gray-300 leading-relaxed">
        {data.overview.map((para, idx) => (
          <p key={idx}>{para}</p>
        ))}

        <h2 className="text-xl font-bold text-white flex items-center gap-2 pt-4">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          Our Safety & Anti-Scam Commitments
        </h2>
        <div className="space-y-4">
          {data.keyPrinciples.map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-gray-800 bg-gray-900/60">
              <h3 className="font-bold text-white text-sm mb-1">{item.title}</h3>
              <p className="text-xs text-gray-400">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </SeoContentLayout>
  );
}
