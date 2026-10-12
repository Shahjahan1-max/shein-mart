import { ExternalLink, Send, Twitter, Facebook, Instagram, Youtube, ArrowUpRight, Heart, Sparkles, ShieldCheck, ArrowUp } from "lucide-react";
import logoImg from "@assets/Deal_Stocks_Icon.webp";
import { LPSocialLink } from "../data/landingPageData";
import { DEFAULT_SETTINGS } from "../data/adminData";
import { useSettings } from "../hooks/useApi";
import { useLandingPageSettings } from "../hooks/useLandingPageSettings";
import { useLang } from "../contexts/LangContext";
import { translateDisplayText } from "../data/displayTranslations";

const SOCIAL_ICONS: Record<string, React.ElementType> = {
  twitter: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  telegram: Send,
};

function SocialIcon({ social }: { social: LPSocialLink }) {
  const Icon = SOCIAL_ICONS[social.platform.toLowerCase()] ?? ExternalLink;
  return (
    <a
      href={social.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={social.platform}
      className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 hover:border-primary/50 text-gray-400 hover:text-primary transition-all duration-200 flex items-center justify-center hover:scale-105"
    >
      <Icon className="h-3.5 w-3.5" />
    </a>
  );
}

export function Footer() {
  const { data: landingPage } = useLandingPageSettings();
  const { lang } = useLang();
  const { data: apiSettings } = useSettings<typeof DEFAULT_SETTINGS>();

  const cfg = landingPage.footer;
  const settings = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;
  const admin = {
    siteName: settings.siteName || DEFAULT_SETTINGS.siteName,
    companyLogo: settings.companyLogo || "",
    telegramSupport: settings.telegramSupport || DEFAULT_SETTINGS.telegramSupport,
  };

  const copyright = (cfg.copyright || "© 2014 DealX Stocks. All rights reserved.")
    .replace("{year}", "2014")
    .replace(/2026/g, "2014");
  const activeSocials = cfg.socials.filter(s => s.active);

  const siteParts = admin.siteName.split(" ");

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-[#080E14] border-t border-gray-800/80 text-gray-300 relative overflow-hidden">
      {/* Top accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-6">

        {/* Quick Marketplace Hubs Pill Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 mb-8 border-b border-gray-800/60 text-xs">
          <div className="flex items-center gap-2 text-gray-400 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="uppercase tracking-wider text-[11px] text-gray-300">Fast Navigation:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <a href="/marketplaces/amazon" className="px-2.5 py-1 rounded-md bg-gray-900/80 border border-gray-800 text-gray-300 hover:text-white hover:border-primary/50 transition-all">Amazon Deals</a>
            <a href="/marketplaces/alibaba" className="px-2.5 py-1 rounded-md bg-gray-900/80 border border-gray-800 text-gray-300 hover:text-white hover:border-primary/50 transition-all">Alibaba Wholesale</a>
            <a href="/marketplaces/aliexpress" className="px-2.5 py-1 rounded-md bg-gray-900/80 border border-gray-800 text-gray-300 hover:text-white hover:border-primary/50 transition-all">AliExpress Express</a>
            <a href="/marketplaces/ebay" className="px-2.5 py-1 rounded-md bg-gray-900/80 border border-gray-800 text-gray-300 hover:text-white hover:border-primary/50 transition-all">eBay Surplus</a>
            <a href="/tools/roi-calculator" className="px-2.5 py-1 rounded-md bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 transition-all font-semibold">ROI Calculator</a>
          </div>
        </div>

        {/* Unified 12-Column Responsive Footer Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-6 lg:gap-6 xl:gap-8 mb-10">

          {/* Column 1: Brand (Spans 3 cols on lg) */}
          <div className="col-span-2 sm:col-span-3 md:col-span-6 lg:col-span-3">
            <a href="/" className="flex items-center gap-2.5 mb-3 group w-fit">
              {admin.companyLogo ? (
                <img
                  src={admin.companyLogo}
                  alt={admin.siteName}
                  className="h-8 w-auto max-w-[130px] object-contain rounded"
                />
              ) : (
                <img
                  src={logoImg}
                  alt={admin.siteName}
                  className="h-8 w-8 object-contain rounded-lg group-hover:scale-105 transition-transform"
                />
              )}
              <span className="text-base font-extrabold text-white tracking-tight">
                {siteParts.length > 1 ? (
                  <>
                    {siteParts[0]}
                    <span className="text-primary"> {siteParts.slice(1).join(" ")}</span>
                  </>
                ) : (
                  admin.siteName
                )}
              </span>
            </a>

            {cfg.description && (
              <p className="text-xs text-gray-400 leading-relaxed mb-4 max-w-[250px]">
                {translateDisplayText(cfg.description, lang)}
              </p>
            )}

            {/* Social icons */}
            {activeSocials.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-4">
                {activeSocials.map(s => <SocialIcon key={s.id} social={s} />)}
              </div>
            )}

            {/* Telegram Support button */}
            <a
              href={admin.telegramSupport}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary-foreground text-xs font-semibold rounded-lg transition-all group"
            >
              <Send className="h-3 w-3 text-primary" />
              <span>Chat on Telegram</span>
              <ArrowUpRight className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </a>
          </div>

          {/* Column 2: Storefront (Spans 2 cols on lg) */}
          <div className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-2">
            <h4 className="text-white font-extrabold text-xs uppercase tracking-wider mb-3">
              Storefront
            </h4>
            <ul className="space-y-1.5">
              <li>
                <a href="/deals" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Deals</a>
              </li>
              <li>
                <a href="/categories" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Categories</a>
              </li>
              <li>
                <a href="/all-products" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">All Products</a>
              </li>
              <li>
                <a href="/guides" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Guides & Insights</a>
              </li>
              <li>
                <a href="/case-studies" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Case Studies</a>
              </li>
              <li>
                <a href="/tools/roi-calculator" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">ROI Calculator</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Company (Spans 2 cols on lg) */}
          <div className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-2">
            <h4 className="text-white font-extrabold text-xs uppercase tracking-wider mb-3">
              Company
            </h4>
            <ul className="space-y-1.5">
              <li>
                <a href="/about" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">About Us</a>
              </li>
              <li>
                <a href="/how-it-works" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">How It Works</a>
              </li>
              <li>
                <a href="/methodology" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Methodology</a>
              </li>
              <li>
                <a href="/editorial-policy" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Editorial Policy</a>
              </li>
              <li>
                <a href="/press" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Press & Media</a>
              </li>
              <li>
                <a href="/careers" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Careers</a>
              </li>
            </ul>
          </div>

          {/* Column 4: Marketplaces (Spans 1 col on lg) */}
          <div className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-1">
            <h4 className="text-white font-extrabold text-xs uppercase tracking-wider mb-3">
              Platforms
            </h4>
            <ul className="space-y-1.5">
              <li>
                <a href="/marketplaces/amazon" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Amazon</a>
              </li>
              <li>
                <a href="/marketplaces/alibaba" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Alibaba</a>
              </li>
              <li>
                <a href="/marketplaces/aliexpress" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">AliExpress</a>
              </li>
              <li>
                <a href="/marketplaces/ebay" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">eBay</a>
              </li>
              <li>
                <a href="/marketplaces" className="text-xs font-bold text-accent hover:underline block truncate">All Hubs →</a>
              </li>
            </ul>
          </div>

          {/* Column 5: Support & Trust (Spans 2 cols on lg) */}
          <div className="col-span-1 sm:col-span-1 md:col-span-3 lg:col-span-2">
            <h4 className="text-white font-extrabold text-xs uppercase tracking-wider mb-3">
              Support & Trust
            </h4>
            <ul className="space-y-1.5">
              <li>
                <a href="/support" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Support Center</a>
              </li>
              <li>
                <a href="/faq" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">FAQ</a>
              </li>
              <li>
                <a href="/trust" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Trust Center</a>
              </li>
              <li>
                <a href="/data-sources" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Data Sources</a>
              </li>
              <li>
                <a href="/report-issue" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Report an Issue</a>
              </li>
              <li>
                <a href="/feedback" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Submit Feedback</a>
              </li>
            </ul>
          </div>

          {/* Column 6: Legal & Compliance (Spans 2 cols on lg) */}
          <div className="col-span-1 sm:col-span-1 md:col-span-3 lg:col-span-2">
            <h4 className="text-white font-extrabold text-xs uppercase tracking-wider mb-3">
              Legal & Compliance
            </h4>
            <ul className="space-y-1.5">
              <li>
                <a href="/privacy-policy" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Privacy Policy</a>
              </li>
              <li>
                <a href="/terms-of-service" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Terms of Service</a>
              </li>
              <li>
                <a href="/cookie-policy" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Cookie Policy</a>
              </li>
              <li>
                <a href="/disclaimer" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Disclaimer</a>
              </li>
              <li>
                <a href="/affiliate-disclosure" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Affiliate Disclosure</a>
              </li>
              <li>
                <a href="/marketplace-disclosure" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Marketplace Disclosure</a>
              </li>
              <li>
                <a href="/data-accuracy" className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all block truncate">Data Accuracy</a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Sub-Footer Bar */}
        <div className="border-t border-gray-800/60 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex flex-wrap items-center gap-2">
            {copyright && <span>{copyright}</span>}
            <span className="hidden sm:inline text-gray-700">·</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium text-[11px] bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Systems Operational
            </span>
          </div>

          <div className="flex items-center gap-3.5 flex-wrap">
            <a href="/login" className="font-semibold text-gray-300 hover:text-white transition-colors">Sign In</a>
            <span className="text-gray-700">·</span>
            <a href="/register" className="font-semibold text-gray-300 hover:text-white transition-colors">Sign Up</a>
            <span className="text-gray-700">·</span>
            <a href="/privacy-policy" className="hover:text-gray-300 transition-colors">Privacy</a>
            <span className="text-gray-700">·</span>
            <a href="/terms-of-service" className="hover:text-gray-300 transition-colors">Terms</a>
            <span className="text-gray-700">·</span>
            <button onClick={scrollToTop} className="hover:text-white transition-colors inline-flex items-center gap-1 text-gray-400">
              <span>Top</span> <ArrowUp className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
}
