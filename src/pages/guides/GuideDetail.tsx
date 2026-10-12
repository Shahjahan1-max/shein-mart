/**
 * GuideDetail — /guides/:slug
 * Programmatic guide template. Applies glossary auto-linking to body copy,
 * emits Article JSON-LD and shows contextual internal links.
 */

import { Link, useParams } from "wouter";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { PageMeta } from "../../components/seo/PageMeta";
import { JsonLd } from "../../components/seo/JsonLd";
import { Breadcrumbs } from "../../components/seo/Breadcrumbs";
import { RelatedLinks } from "../../components/seo/RelatedLinks";
import { findGuide, GUIDES } from "../../data/guides";
import { GLOSSARY_TERMS } from "../../data/glossary";
import { autoLinkTerms } from "../../lib/seo/internalLinks";
import { guideUrl, canonicalUrl } from "../../lib/seo/urls";

export function GuideDetail() {
  const params = useParams<{ slug: string }>();
  const guide = findGuide(params.slug ?? "");

  if (!guide) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Header />
        <main className="flex-grow flex flex-col items-center justify-center px-4 py-24 text-center">
          <PageMeta meta={{ title: "Guide Not Found", description: "The guide you're looking for does not exist.", noindex: true }} />
          <BookOpen className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Guide Not Found</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">The guide you're looking for doesn't exist or was moved.</p>
          <Link href="/guides" className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Browse all guides
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const href = guideUrl(guide.slug);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <PageMeta
        meta={{
          title: `${guide.title} | DealX Stocks`,
          description: guide.description,
          canonical: href,
          ogType: "article",
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.title,
          description: guide.description,
          url: canonicalUrl(href),
          publisher: { "@type": "Organization", name: "DealX Stocks" },
          datePublished: "2026-08-08",
          author: { "@type": "Organization", name: "DealX Stocks" },
        }}
      />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-6">
          <Breadcrumbs path={href} />
        </div>

        <article className="max-w-3xl mx-auto px-3 sm:px-6 pt-6 pb-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">
            {guide.category} · {guide.readTime}
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
            {guide.title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-base mb-8">{guide.description}</p>

          {guide.sections.map((section, i) => (
            <section key={i} className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{section.heading}</h2>
              <p
                className="text-gray-600 dark:text-gray-300 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: autoLinkTerms(section.body, GLOSSARY_TERMS.map(t => ({ term: t.term, slug: t.slug }))),
                }}
              />
            </section>
          ))}
        </article>

        <RelatedLinks
          title="Keep Exploring"
          links={[
            ...GUIDES.filter(g => g.slug !== guide.slug).map(g => ({ label: g.title, href: guideUrl(g.slug), group: "More Guides" })),
            { label: "Today's Best Deals", href: "/deals", group: "Deals" },
            { label: "All Categories", href: "/categories", group: "Explore" },
          ]}
        />
      </main>
      <Footer />
    </div>
  );
}
