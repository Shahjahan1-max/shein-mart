import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { faqPageSchema, jsonLdToScript, type FaqItem } from "../../lib/seo/jsonld";

export interface FaqSectionProps {
  title?: string;
  subtitle?: string;
  items: FaqItem[];
}

export function FaqSection({ title = "Frequently Asked Questions", subtitle, items }: FaqSectionProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  if (!items || items.length === 0) return null;

  const jsonLdData = faqPageSchema(items);

  return (
    <section className="my-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdToScript(jsonLdData) }}
      />
      <div className="flex items-center gap-2 mb-2">
        <HelpCircle className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
      </div>
      {subtitle && <p className="text-xs text-slate-500 mb-6">{subtitle}</p>}

      <div className="space-y-3">
        {items.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-colors hover:border-slate-300 shadow-xs"
            >
              <button
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 focus:outline-none"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-bold text-slate-900">{item.question}</span>
                <ChevronDown
                  className={`h-4 w-4 text-primary transition-transform duration-200 flex-shrink-0 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-4 pt-2 text-xs text-slate-700 leading-relaxed border-t border-slate-200 bg-slate-50">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
