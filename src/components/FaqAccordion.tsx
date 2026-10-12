/**
 * FaqAccordion — reusable FAQ accordion.
 * Renders a list of Q&As with accessible expand/collapse. Pairs with the
 * FAQPage JSON-LD schema (emitted by the consumer via <JsonLd>).
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FaqItem } from "../lib/seo/jsonld";

interface FaqAccordionProps {
  items: FaqItem[];
  title?: string;
  subtitle?: string;
}

export function FaqAccordion({ items, title = "Frequently Asked Questions", subtitle }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!items || items.length === 0) return null;

  return (
    <section id="faq" className="py-10 sm:py-16 px-3 sm:px-4 max-w-4xl mx-auto">
      <div className="text-center mb-8 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
        {subtitle && <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">{subtitle}</p>}
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className={`rounded-2xl border transition-colors ${
                isOpen
                  ? "border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60"
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${index}`}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left"
              >
                <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
                  {item.question}
                </span>
                <ChevronDown
                  className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                id={`faq-panel-${index}`}
                role="region"
                className={`grid transition-all duration-200 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="overflow-hidden">
                  <p className="px-4 sm:px-5 pb-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
