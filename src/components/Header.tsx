import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { HelpCircle, Menu, X, ExternalLink, Smartphone, Monitor, Search, ChevronDown } from "lucide-react";
import { LanguageSelector } from "./LanguageSelector";
import { NotificationBell } from "./NotificationBell";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";
import { DEFAULT_SETTINGS } from "../data/adminData";
import { useViewMode } from "../contexts/ViewModeContext";
import { useLang } from "../contexts/LangContext";
import { useSettings } from "../hooks/useApi";
import { useLandingPageSettings } from "../hooks/useLandingPageSettings";
import { translateDisplayText } from "../data/displayTranslations";
import logoImg from "@assets/Deal_Stocks_Icon.webp";

interface HeaderProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  theme?: "light" | "dark";
  onThemeToggle?: () => void;
  showNotifications?: boolean;
}

export function Header({ search = "", onSearchChange = () => {}, showNotifications = true }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { data: apiSettings } = useSettings<typeof DEFAULT_SETTINGS>();
  const settings = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;
  const { data: lp } = useLandingPageSettings();
  const moreRef = useRef<HTMLDivElement>(null);

  const data = {
    showLiveChat: settings.showLiveChat !== false,
    showLanguageToggle: settings.showLanguageToggle !== false,
    telegramSupport: settings.telegramSupport || DEFAULT_SETTINGS.telegramSupport,
    siteName: settings.siteName || DEFAULT_SETTINGS.siteName,
    companyLogo: settings.companyLogo || "",
    navLinks: lp.navLinks.filter(l => l.active),
  };
  const { viewMode, toggleViewMode } = useViewMode();
  const { lang } = useLang();
  const mobilePreview = viewMode === "mobile";

  // Primary top-level navigation links (fits cleanly on desktop without overflow)
  const primaryNav = [
    { id: "storefront-deals", label: "Deals", href: "/deals", external: false },
    { id: "storefront-categories", label: "Categories", href: "/categories", external: false },
    { id: "storefront-marketplaces", label: "Marketplaces", href: "/marketplaces", external: false },
    { id: "storefront-products", label: "All Products", href: "/all-products", external: false },
    { id: "storefront-guides", label: "Guides", href: "/guides", external: false },
  ];

  // Secondary "More" menu items (for desktop dropdown & mobile drawer)
  const secondaryNav = [
    { id: "storefront-case-studies", label: "Case Studies", href: "/case-studies", external: false },
    { id: "storefront-about", label: "About Us", href: "/about", external: false },
    { id: "storefront-how-it-works", label: "How It Works", href: "/how-it-works", external: false },
    { id: "storefront-methodology", label: "Methodology", href: "/methodology", external: false },
    { id: "storefront-support", label: "Support", href: "/support", external: false },
    ...data.navLinks,
  ];

  // Filter out any duplicates between primary and secondary
  const primaryHrefs = new Set(primaryNav.map(p => p.href));
  const uniqueSecondaryNav = secondaryNav.filter(s => !primaryHrefs.has(s.href));
  const allMobileNav = [...primaryNav, ...uniqueSecondaryNav];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const siteParts = data.siteName.split(" ");

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 max-w-full overflow-x-clip ${
        scrolled
          ? "bg-white/98 dark:bg-gray-900/98 shadow-md"
          : "bg-white/95 dark:bg-gray-900/95"
      } backdrop-blur-xl border-b border-gray-100/80 dark:border-gray-800/80`}
    >
      {/* Main header row */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 w-full">
        <div className="flex items-center gap-2 lg:gap-3 h-16 w-full">

          {/* Logo */}
          <a href="/" className="flex items-center gap-2 flex-shrink-0 group">
            {data.companyLogo ? (
              <img
                src={data.companyLogo}
                alt={data.siteName}
                className="h-8 w-auto max-w-[120px] object-contain rounded-lg"
              />
            ) : (
              <img
                src={logoImg}
                alt="DealX Stocks"
                className="h-8 w-8 object-contain rounded-lg group-hover:scale-105 transition-transform"
              />
            )}
            <span className="text-[16px] sm:text-[17px] font-extrabold text-gray-900 dark:text-white tracking-tight hidden sm:block leading-none">
              {siteParts.length > 1 ? (
                <>
                  {siteParts[0]}
                  <span className="text-primary">
                    {" "}{siteParts.slice(1).join(" ")}
                  </span>
                </>
              ) : (
                data.siteName
              )}
            </span>
          </a>

          {/* Search bar — desktop */}
          <div className={`flex-1 min-w-0 max-w-xs xl:max-w-md mx-1 lg:mx-2 ${mobilePreview ? "hidden" : "hidden md:block"}`}>
            <SearchBar value={search} onChange={onSearchChange} />
          </div>

          {/* Primary Nav links — desktop */}
          <nav className={`${mobilePreview ? "hidden" : "hidden lg:flex"} items-center gap-0.5 xl:gap-1 flex-shrink-0`}>
            {primaryNav.map(link => (
              <Link
                key={link.id}
                href={link.href}
                className="px-2.5 py-1.5 text-xs xl:text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
              >
                {translateDisplayText(link.label, lang)}
              </Link>
            ))}

            {/* "More" dropdown */}
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen(o => !o)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs xl:text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
              >
                <span>More</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${moreOpen ? "rotate-180 text-primary" : "opacity-60"}`} />
              </button>

              {moreOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-xl py-1.5 z-50">
                  {uniqueSecondaryNav.map(link =>
                    link.external ? (
                      <a
                        key={link.id}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMoreOpen(false)}
                        className="flex items-center justify-between px-3 py-2 text-xs xl:text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-400 transition-colors"
                      >
                        {translateDisplayText(link.label, lang)}
                        <ExternalLink className="h-3 w-3 opacity-40" />
                      </a>
                    ) : (
                      <Link
                        key={link.id}
                        href={link.href}
                        onClick={() => setMoreOpen(false)}
                        className="block px-3 py-2 text-xs xl:text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-400 transition-colors"
                      >
                        {translateDisplayText(link.label, lang)}
                      </Link>
                    )
                  )}
                </div>
              )}
            </div>
          </nav>

          {/* Right-side actions */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-auto">

            {/* Support */}
            {data.showLiveChat && (
              <a
                href={data.telegramSupport}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Support"
                className={`p-1.5 sm:p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors ${mobilePreview ? "hidden" : "hidden sm:flex"}`}
              >
                <HelpCircle className="h-[18px] w-[18px]" />
              </a>
            )}

            {/* Notifications */}
            {showNotifications && <NotificationBell />}

            {/* Language */}
            {data.showLanguageToggle && <LanguageSelector />}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Auth buttons — hidden on mobile unless in mobile preview */}
            <div className={`${mobilePreview ? "hidden" : "hidden sm:flex"} items-center gap-1.5 ml-1 pl-2.5 border-l border-border`}>
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs xl:text-sm font-semibold text-primary hover:bg-primary/10 rounded-xl transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-3.5 py-1.5 text-xs xl:text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 active:bg-primary/95 rounded-xl transition-colors shadow-sm"
              >
                Sign Up
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className={`${mobilePreview ? "flex" : "lg:hidden"} p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1`}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Search bar — below header on mobile/tablet */}
        <div className={`${mobilePreview ? "block" : "md:hidden"} pb-3`}>
          <SearchBar value={search} onChange={onSearchChange} />
        </div>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div
          className={`${mobilePreview ? "block" : "lg:hidden"} bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shadow-2xl animate-in slide-in-from-top-2 duration-200`}
        >
          <div className="px-4 py-3 space-y-1 max-h-[65vh] overflow-y-auto overscroll-contain">
            {/* Live Support Link */}
            {data.showLiveChat && (
              <a
                href={data.telegramSupport}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between px-3.5 py-2.5 text-sm font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/25 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors mb-2"
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span>{translateDisplayText("Live Customer Support", lang)}</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>
            )}

            {allMobileNav.map(link =>
              link.external ? (
                <a
                  key={link.id}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-400 rounded-xl transition-colors"
                >
                  {translateDisplayText(link.label, lang)}
                  <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                </a>
              ) : (
                <Link
                  key={link.id}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-400 rounded-xl transition-colors"
                >
                  {translateDisplayText(link.label, lang)}
                </Link>
              )
            )}
          </div>

          {/* Mobile Auth Buttons */}
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="flex-1 text-center py-2.5 text-sm font-semibold text-primary border border-primary/30 dark:border-primary/40 rounded-xl hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              onClick={() => setMenuOpen(false)}
              className="flex-1 text-center py-2.5 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm"
            >
              Sign Up
            </Link>
          </div>

          {/* Mobile Controls: Language, Theme, ViewMode */}
          <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {data.showLanguageToggle && <LanguageSelector />}
              <ThemeToggle />
            </div>
            <button
              onClick={() => { toggleViewMode(); setMenuOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              {viewMode === "mobile" ? <Monitor className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
              <span>{viewMode === "mobile" ? "Desktop View" : "Mobile View"}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
