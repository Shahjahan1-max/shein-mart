/**
 * CaseStudyDetail — /case-studies/:slug
 * Full documented case study: challenge, approach, results, metrics, quote.
 * Emits Report JSON-LD with headline metrics for rich search results.
 */

import { Link, useParams } from "wouter";
import { ArrowLeft, Quote, TrendingUp, Briefcase } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { PageMeta } from "../../components/seo/PageMeta";
import { JsonLd } from "../../components/seo/JsonLd";
import { Breadcrumbs } from "../../components/seo/Breadcrumbs";
import { RelatedLinks } from "../../components/seo/RelatedLinks";
import { CtaBanner } from "../../components/CtaBanner";
import { findCaseStudy, CASE_STUDIES } from "../../data/caseStudies";
import { caseStudyUrl, caseStudiesOverviewUrl, roiCalculatorUrl } from "../../lib/seo/internalLinks";
import { canonicalUrl } from "../../lib/seo/urls";

export function CaseStudyDetail() {
  const params = useParams<{ slug: string }>();
  const study = findCaseStudy(params.slug ?? "");

  if (!study) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Header />
        <main className="flex-grow flex flex-col items-center justify-center px-4 py-24 text-center">
          <PageMeta meta={{ title: "Case Study Not Found", description: "The case study you're looking for does not exist.", noindex: true }} />
          <Briefcase className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Case Study Not Found</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This case study doesn't exist or was moved.</p>
          <Link href={caseStudiesOverviewUrl()} className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Browse all case studies
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const href = caseStudyUrl(study.slug);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <PageMeta
        meta={{
          title: `${study.title} | DealX Stocks`,
          description: study.summary,
          canonical: href,
          ogType: "article",
        }}
      />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Report",
            headline: study.title,
            description: study.summary,
            url: canonicalUrl(href),
            datePublished: study.publishedAt,
            dateModified: study.publishedAt,
            author: { "@type": "Organization", name: "DealX Stocks" },
            publisher: { "@type": "Organization", name: "DealX Stocks" },
            about: { "@type": "Service", name: "Marketplace SEO" },
          },
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: study.title,
            description: study.summary,
            url: canonicalUrl(href),
            datePublished: study.publishedAt,
            author: { "@type": "Organization", name: "DealX Stocks" },
            publisher: { "@type": "Organization", name: "DealX Stocks" },
            genre: study.industry,
          },
        ]}
      />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-6">
          <Breadcrumbs path={href} />
        </div>

        <article className="max-w-3xl mx-auto px-3 sm:px-6 pt-6 pb-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-2">
            {study.industry} · {study.duration} · {study.client}
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
            {study.title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-base mb-8">{study.summary}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {study.metrics.map(metric => (
              <div key={metric.label} className="p-4 rounded-2xl bg-white dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700/60">
                <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" /> {metric.value}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{metric.label}</p>
              </div>
            ))}
          </div>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">The Challenge</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{study.challenge}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Our Approach</h2>
            <ol className="space-y-3">
              {study.approach.map((step, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="h-6 w-6 rounded-full bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">The Results</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{study.results}</p>
          </section>

          {study.quote && (
            <figure className="mb-8 p-6 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-800/40">
              <Quote className="h-6 w-6 text-purple-500/70 dark:text-purple-400/70 mb-3" />
              <blockquote className="text-gray-800 dark:text-gray-100 text-base leading-relaxed mb-3">
                {study.quote.text}
              </blockquote>
              <figcaption className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-200">{study.quote.author}</span>
                {" — "}{study.quote.role}
              </figcaption>
            </figure>
          )}
        </article>

        <RelatedLinks
          title="More Proof & Tools"
          links={[
            ...CASE_STUDIES.filter(cs => cs.slug !== study.slug).map(cs => ({
              label: cs.title,
              href: caseStudyUrl(cs.slug),
              group: "More Case Studies",
            })),
            { label: "Estimate Your Earnings", href: roiCalculatorUrl(), group: "Tools" },
            { label: "Book a Consultation", href: "/contact?intent=consultation", group: "Help" },
          ]}
        />

        <CtaBanner
          title="Your Marketplace, Grown the Same Way"
          subtitle="Every result above came from a documented, measurable strategy. Let's build yours."
          actions={[
            { label: "Start Earning Free", href: "/register", primary: true },
            { label: "Talk to Us", href: "/contact?intent=consultation" },
          ]}
        />
      </main>
      <Footer />
    </div>
  );
}
