import { SeoContentLayout } from "../../components/seo/SeoContentLayout";
import { LEGAL_PAGES } from "../../data/legalContent";
import { DollarSign } from "lucide-react";

export default function AffiliateDisclosure() {
  const content = LEGAL_PAGES["affiliate-disclosure"];

  return (
    <SeoContentLayout
      title={content.title}
      subtitle="Full FTC compliance disclosure of affiliate links, referral attribution, and zero markup policy."
      breadcrumbs={[{ label: content.title }]}
      canonicalPath={`/${content.slug}`}
      metaDescription={content.metaDescription}
      lastUpdated={content.lastUpdated}
    >
      <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
        {content.sections.map((sec, idx) => (
          <div key={idx} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              {sec.heading}
            </h2>
            {sec.content.map((p, pIdx) => (
              <p key={pIdx}>{p}</p>
            ))}
          </div>
        ))}
      </div>
    </SeoContentLayout>
  );
}
