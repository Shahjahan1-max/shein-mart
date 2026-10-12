/**
 * RoiCalculatorPage — /tools/roi-calculator
 * Interactive earnings estimator with supporting content, trust badges and CTA.
 */

import { Calculator } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { PageMeta } from "../../components/seo/PageMeta";
import { JsonLd } from "../../components/seo/JsonLd";
import { Breadcrumbs } from "../../components/seo/Breadcrumbs";
import { RoiCalculator } from "../../components/RoiCalculator";
import { TrustBadges } from "../../components/TrustBadges";
import { CtaBanner } from "../../components/CtaBanner";
import { roiCalculatorUrl } from "../../lib/seo/internalLinks";

export function RoiCalculatorPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <PageMeta
        meta={{
          title: "Deal Earnings Calculator — Estimate Your Commission | DealX Stocks",
          description:
            "Estimate your monthly and yearly commission from affiliate shopping links. Adjust traffic, conversion and commission rates to project your DealX Stocks earnings.",
          canonical: roiCalculatorUrl(),
          ogType: "website",
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://dealxstocks.com/" },
            { "@type": "ListItem", position: 2, name: "ROI Calculator", item: "https://dealxstocks.com/tools/roi-calculator" },
          ],
        }}
      />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-6">
          <Breadcrumbs path={roiCalculatorUrl()} />
        </div>

        <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-6 pb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-violet-600" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-0.5">
                Free Tool
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                <Calculator className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                Deal Earnings Calculator
              </h1>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl mb-8">
            Estimate the commission you could earn from shopping referrals on Amazon, Alibaba, AliExpress and
            eBay. Move the sliders to match your traffic, conversion rate and order value — the math updates live.
          </p>

          <RoiCalculator />
        </section>

        <TrustBadges />

        <CtaBanner
          title="Turn Estimated Earnings Into Real Income"
          subtitle="Create a free account, complete tasks and withdraw your earnings through the DealX Stocks wallet."
          actions={[
            { label: "Start Earning Free", href: "/register", primary: true },
            { label: "See Today's Deals", href: "/deals" },
          ]}
        />
      </main>
      <Footer />
    </div>
  );
}
