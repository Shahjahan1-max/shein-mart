import { SeoContentLayout } from "../../components/seo/SeoContentLayout";
import { LEGAL_PAGES } from "../../data/legalContent";
import { Cookie } from "lucide-react";

export default function CookiePolicy() {
  const content = LEGAL_PAGES["cookie-policy"];

  return (
    <SeoContentLayout
      title={content.title}
      subtitle="Details regarding essential cookies, local storage, and user preferences."
      breadcrumbs={[{ label: content.title }]}
      canonicalPath={`/${content.slug}`}
      metaDescription={content.metaDescription}
      lastUpdated={content.lastUpdated}
    >
      <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
        {content.sections.map((sec, idx) => (
          <div key={idx} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Cookie className="h-4 w-4 text-amber-600" />
              {sec.heading}
            </h2>
            {sec.content.map((p, pIdx) => (
              <p key={pIdx}>{p}</p>
            ))}
            {sec.bullets && (
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 pt-2">
                {sec.bullets.map((b, bIdx) => (
                  <li key={bIdx}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </SeoContentLayout>
  );
}
