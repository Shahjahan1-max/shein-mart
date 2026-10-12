import { SeoContentLayout } from "../../components/seo/SeoContentLayout";
import { TRUST_FRAMEWORK } from "../../data/trustData";

export default function Transparency() {
  const data = TRUST_FRAMEWORK.transparency;

  return (
    <SeoContentLayout
      title={data.title}
      subtitle={data.subtitle}
      breadcrumbs={[{ label: "About", href: "/about" }, { label: "Transparency" }]}
      canonicalPath="/transparency"
      metaDescription={data.metaDescription}
      lastUpdated={data.lastUpdated}
    >
      <section className="space-y-6 text-sm text-gray-300 leading-relaxed">
        {data.overview.map((para, idx) => (
          <p key={idx}>{para}</p>
        ))}

        <h2 className="text-xl font-bold text-white pt-4">Operational Disclosures</h2>
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
