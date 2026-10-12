/**
 * FaqPage — /faq
 * Public FAQ page. Reuses the shared FaqAccordion and emits FAQPage JSON-LD.
 */

import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { PageMeta } from "../../components/seo/PageMeta";
import { JsonLd } from "../../components/seo/JsonLd";
import { Breadcrumbs } from "../../components/seo/Breadcrumbs";
import { FaqAccordion } from "../../components/FaqAccordion";
import { ALL_FAQS } from "../../data/faq";
import { faqPageSchema } from "../../lib/seo/jsonld";

export function FaqPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <PageMeta
        meta={{
          title: "Frequently Asked Questions | DealX Stocks",
          description:
            "Answers to common questions about DealX Stocks — how deals work, affiliate links, shipping, earning income and verifying discounts.",
          canonical: "/faq",
          ogType: "website",
        }}
      />
      <JsonLd data={faqPageSchema(ALL_FAQS)} />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-6">
          <Breadcrumbs path="/faq" />
        </div>
        <FaqAccordion
          title="Frequently Asked Questions"
          subtitle="Everything you need to know about using DealX Stocks"
          items={ALL_FAQS}
        />
      </main>
      <Footer />
    </div>
  );
}
