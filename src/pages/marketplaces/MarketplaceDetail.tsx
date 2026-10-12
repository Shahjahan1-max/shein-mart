import { useLocation } from "wouter";
import { SeoContentLayout } from "../../components/seo/SeoContentLayout";
import { AnswerBox } from "../../components/seo/AnswerBox";
import { FaqSection } from "../../components/seo/FaqSection";
import { MARKETPLACE_PROFILES, type MarketplaceProfile } from "../../data/marketplaceData";
import { ShoppingBag, ShieldCheck, CheckCircle2, ArrowRight, AlertCircle } from "lucide-react";

export interface MarketplaceDetailProps {
  marketplaceSlug?: string;
}

export default function MarketplaceDetail({ marketplaceSlug }: MarketplaceDetailProps) {
  const [location] = useLocation();
  const slug = marketplaceSlug || location.split("/").filter(Boolean).pop() || "amazon";
  const profile: MarketplaceProfile = MARKETPLACE_PROFILES[slug.toLowerCase()] || MARKETPLACE_PROFILES.amazon;

  return (
    <SeoContentLayout
      title={`${profile.name} Deals & Platform Overview`}
      subtitle={profile.tagline}
      breadcrumbs={[
        { label: "Marketplaces", href: "/marketplaces" },
        { label: profile.name },
      ]}
      canonicalPath={`/marketplaces/${profile.slug}`}
      metaDescription={`Discover curated ${profile.name} deals, learn how DealX Stocks aggregates ${profile.name} product offers, and compare marketplace features.`}
    >
      {/* Explicit Independence Disclaimer Banner */}
      <div className="p-4 rounded-xl border border-amber-800/60 bg-amber-950/20 text-amber-300 text-xs flex items-start gap-2.5 mb-6">
        <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-200">Independence Disclosure: </span>
          {profile.disclaimer}
        </div>
      </div>

      {/* GEO Answer Box */}
      <AnswerBox
        question={`What is ${profile.name} and how does DealX Stocks aggregate its deals?`}
        shortAnswer={profile.overview}
        detailedExplanation={profile.dealXRole}
        howItWorksSteps={[
          { title: "Marketplace Classification", description: profile.type },
          { title: "Best Suited Purpose", description: profile.bestFor },
        ]}
        limitations={[
          `DealX Stocks is an independent aggregator and is not owned by or officially affiliated with ${profile.name}.`,
          `Product transactions, warranties, and shipping are managed solely by ${profile.name} and its vendors.`,
        ]}
        relatedPages={[
          { label: "Browse Categories", href: "/categories" },
          { label: "View Today's Deals", href: "/deals" },
          { label: "Marketplaces Overview", href: "/marketplaces" },
        ]}
      />

      {/* Key Features */}
      <section className="space-y-6 text-sm text-gray-300 leading-relaxed">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-purple-400" />
          Key Features of {profile.name}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {profile.keyFeatures.map((feat, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-gray-800 bg-gray-900/60 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-gray-300 font-medium">{feat}</span>
            </div>
          ))}
        </div>

        {/* CTA to Storefront */}
        <div className="p-6 rounded-2xl border border-purple-900/40 bg-gradient-to-r from-purple-950/40 to-gray-900 flex flex-col sm:flex-row items-center justify-between gap-4 my-8">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Explore Indexed {profile.name} Deals</h3>
            <p className="text-xs text-gray-400">View latest verified deals, discounts, and comparative product listings.</p>
          </div>
          <a
            href="/deals"
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 flex-shrink-0"
          >
            <span>Browse Deals</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* FAQs */}
        <FaqSection
          title={`Frequently Asked Questions About ${profile.name} Deals`}
          items={profile.faq}
        />
      </section>
    </SeoContentLayout>
  );
}
