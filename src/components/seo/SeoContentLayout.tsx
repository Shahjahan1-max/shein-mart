import React, { useState } from "react";
import { Header } from "../Header";
import { Footer } from "../Footer";
import { Breadcrumbs, type BreadcrumbItemDef } from "./Breadcrumbs";
import { ShieldCheck, Info, Calendar, Mail, FileText } from "lucide-react";
import { useTheme } from "../ThemeToggle";
import { useViewMode } from "../../contexts/ViewModeContext";
import { webPageSchema, jsonLdToScript } from "../../lib/seo/jsonld";

export interface SeoContentLayoutProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItemDef[];
  lastUpdated?: string;
  canonicalPath: string;
  metaDescription: string;
  children: React.ReactNode;
}

export function SeoContentLayout({
  title,
  subtitle,
  breadcrumbs,
  lastUpdated = "2026-08-08",
  canonicalPath,
  metaDescription,
  children,
}: SeoContentLayoutProps) {
  const { theme, toggle } = useTheme();
  const { viewMode } = useViewMode();
  const [search, setSearch] = useState("");

  const pageSchema = webPageSchema({
    title,
    description: metaDescription,
    url: `https://dealxstocks.com${canonicalPath}`,
    lastUpdated,
  });

  return (
    <div className={`${theme} ${viewMode === "mobile" ? "max-w-[430px] mx-auto min-h-screen shadow-2xl overflow-hidden bg-white dark:bg-gray-950" : ""}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdToScript(pageSchema) }}
      />
      <Header search={search} onSearchChange={setSearch} theme={theme} onThemeToggle={toggle} showNotifications={false} />

      <main className="bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-gray-100 min-h-screen pt-24 pb-16 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Breadcrumbs */}
          <Breadcrumbs items={breadcrumbs} path={canonicalPath} />

          {/* Page Hero / Title */}
          <div className="mb-10 border-b border-slate-200 dark:border-gray-800 pb-8">
            <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-primary font-semibold">
              <span className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold">
                DealX Stocks Platform Information
              </span>
              {lastUpdated && (
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400 font-medium">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Last updated: {lastUpdated}</span>
                </div>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 text-base sm:text-lg text-slate-600 dark:text-gray-300 max-w-3xl leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          {/* Main Grid: Content + Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* Content Column */}
            <div className="lg:col-span-8 space-y-8">
              {children}
            </div>

            {/* Sidebar Trust & Info Column */}
            <aside className="lg:col-span-4 space-y-6">
              
              {/* Trust Badge Card */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Verified Platform Facts</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">
                  DealX Stocks is an independent deal aggregation platform indexing offers across Amazon, Alibaba, AliExpress, and eBay.
                </p>
                <div className="pt-3 border-t border-slate-100 dark:border-gray-800 text-[11px] text-slate-600 dark:text-gray-400 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span>No fake reviews or inflated price claims</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span>Transparent affiliate disclosures</span>
                  </div>
                </div>
              </div>

              {/* Navigation Links Card */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Explore Trust & Policies
                </h3>
                <ul className="space-y-2 text-xs text-slate-600 dark:text-gray-400">
                  <li>
                    <a href="/how-it-works" className="hover:text-primary transition-colors block py-0.5">
                      • How Deal Aggregation Works
                    </a>
                  </li>
                  <li>
                    <a href="/methodology" className="hover:text-primary transition-colors block py-0.5">
                      • Listing & Price Methodology
                    </a>
                  </li>
                  <li>
                    <a href="/data-sources" className="hover:text-primary transition-colors block py-0.5">
                      • E-Commerce Data Sources
                    </a>
                  </li>
                  <li>
                    <a href="/trust" className="hover:text-primary transition-colors block py-0.5">
                      • Trust & Anti-Scam Policy
                    </a>
                  </li>
                  <li>
                    <a href="/affiliate-disclosure" className="hover:text-primary transition-colors block py-0.5">
                      • FTC Affiliate Disclosure
                    </a>
                  </li>
                  <li>
                    <a href="/marketplace-disclosure" className="hover:text-primary transition-colors block py-0.5">
                      • Marketplace Independence
                    </a>
                  </li>
                </ul>
              </div>

              {/* Support CTA */}
              <div className="p-5 rounded-2xl border border-primary/20 dark:border-primary/30 bg-gradient-to-br from-primary/5 via-slate-50 to-white dark:from-primary/10 dark:via-gray-900 dark:to-gray-900 shadow-sm space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Have Questions or Issues?
                </h4>
                <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">
                  Report expired deals, inaccurate pricing, or contact our support team 24/7.
                </p>
                <div className="pt-2 flex flex-col gap-2">
                  <a
                    href="/report-issue"
                    className="w-full text-center py-2 px-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs transition-colors shadow-sm"
                  >
                    Report Pricing Issue
                  </a>
                  <a
                    href="mailto:support@dealstocks.com"
                    className="w-full text-center py-2 px-3 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-800 dark:text-gray-200 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-200 dark:border-gray-700"
                  >
                    <Mail className="h-3.5 w-3.5 text-primary" /> Contact Support
                  </a>
                </div>
              </div>

            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
