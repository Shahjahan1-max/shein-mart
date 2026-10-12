export interface LPButton {
  id: string;
  label: string;
  link: string;
  active: boolean;
  variant: "primary" | "secondary";
}

export interface LPNavLink {
  id: string;
  label: string;
  href: string;
  external: boolean;
  active: boolean;
}

export interface LPStat {
  id: string;
  label: string;
  value: string;
}

export interface LPTrustBadge {
  id: string;
  text: string;
  active: boolean;
}

export interface LPHero {
  badge: string;
  title: string;
  titleHighlight: string;
  titleSuffix: string;
  subtitle: string;
  backgroundImage: string;
  stats: LPStat[];
  trustBadges: LPTrustBadge[];
  shopperCount: string;
  shopperText: string;
}

export interface LPMarketplaceSection {
  title: string;
  subtitle: string;
}

export interface LPMarketplaceCard {
  id: string;
  name: string;
  url: string;
  tagline: string;
  badge: string;
  stats: string;
  active: boolean;
}

export interface LPSupportCard {
  id: string;
  label: string;
  desc: string;
  href: string;
  cta: string;
  active: boolean;
}

export interface LPSupport {
  title: string;
  description: string;
  active: boolean;
  cards: LPSupportCard[];
}

export interface LPFooterLink {
  id: string;
  label: string;
  href: string;
  external: boolean;
  active: boolean;
}

export interface LPFooterGroup {
  id: string;
  title: string;
  links: LPFooterLink[];
}

export interface LPSocialLink {
  id: string;
  platform: string;
  href: string;
  active: boolean;
}

export interface LPFooter {
  description: string;
  copyright: string;
  groups: LPFooterGroup[];
  socials: LPSocialLink[];
  active: boolean;
}

export interface LPReview {
  id: string;
  name: string;
  location: string;
  rating: number;
  text: string;
  avatar: string;
  active: boolean;
}

export interface LPComingSoon {
  title: string;
  description: string;
}

export interface LPReviewsSection {
  title: string;
  subtitle: string;
}

export interface LPCTA {
  /** A/B variant — "a" = earn-first, "b" = consultation-first. */
  variant: "a" | "b";
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
}

export interface LPVisibility {
  showHero: boolean;
  showMarketplaceCards: boolean;
  showSupport: boolean;
  showFooter: boolean;
  showReviews: boolean;
  showComingSoon: boolean;
  showCategoryDiscovery: boolean;
  showDeals: boolean;
  showTrust: boolean;
  showFaq: boolean;
  showTestimonials: boolean;
  showCaseStudies: boolean;
  showCtaBanner: boolean;
}

export interface LandingPageSettings {
  hero: LPHero;
  heroButtons: LPButton[];
  navLinks: LPNavLink[];
  marketplaceSection: LPMarketplaceSection;
  marketplaceCards: LPMarketplaceCard[];
  support: LPSupport;
  reviews: LPReview[];
  reviewsSection: LPReviewsSection;
  footer: LPFooter;
  comingSoon: LPComingSoon;
  cta: LPCTA;
  visibility: LPVisibility;
  updatedAt: string;
}

export const DEFAULT_LANDING_PAGE: LandingPageSettings = {
  hero: {
    badge: "Discover deals from 12+ global marketplaces",
    title: "Your Global saim",
    titleHighlight: "Deal Discovery",
    titleSuffix: "Platform",
    subtitle:
      "Browse curated products from Amazon, Alibaba, AliExpress and more. Find the best prices across the world's top marketplaces — all in one place.",
    backgroundImage: "",
    stats: [
      { id: "s1", label: "Products Listed", value: "500K+" },
      { id: "s2", label: "Marketplaces", value: "12+" },
      { id: "s3", label: "Categories", value: "200+" },
      { id: "s4", label: "Daily Deals", value: "1,000+" },
    ],
    trustBadges: [
      { id: "tb1", text: "Verified Listings", active: true },
      { id: "tb2", text: "Real-Time Prices", active: true },
      { id: "tb3", text: "Global Shipping", active: true },
    ],
    shopperCount: "50,000+",
    shopperText: "discovering deals today",
  },
  heroButtons: [
    { id: "hb1", label: "Get Started Free", link: "/register", active: true, variant: "primary" },
    { id: "hb2", label: "Browse Products", link: "#products", active: true, variant: "secondary" },
  ],
  navLinks: [
    { id: "nl1", label: "Amazon", href: "https://www.amazon.com", external: true, active: true },
    { id: "nl2", label: "Alibaba", href: "https://www.alibaba.com", external: true, active: true },
    { id: "nl3", label: "AliExpress", href: "https://www.aliexpress.com", external: true, active: true },
    { id: "nl4", label: "All Products", href: "#products", external: false, active: true },
    { id: "nl5", label: "Support", href: "#support", external: false, active: true },
  ],
  marketplaceSection: {
    title: "Shop on Top Marketplaces",
    subtitle: "Discover millions of products from the world's leading platforms",
  },
  marketplaceCards: [
    { id: "mc1", name: "Amazon", url: "https://www.amazon.com", tagline: "World's Largest Retailer", badge: "Prime eligible", stats: "350M+ products", active: true },
    { id: "mc2", name: "Alibaba", url: "https://www.alibaba.com", tagline: "Global B2B Wholesale", badge: "Bulk pricing", stats: "200K+ suppliers", active: true },
    { id: "mc3", name: "AliExpress", url: "https://www.aliexpress.com", tagline: "Affordable Global Shopping", badge: "Free shipping", stats: "100M+ items", active: true },
  ],
  support: {
    title: "We're Here to Help",
    description:
      "Our dedicated support team is available around the clock to help you find the best deals, resolve questions, and assist with any issues.",
    active: true,
    cards: [
      { id: "sc1", label: "Telegram Support", desc: "Chat with our team instantly on Telegram", href: "https://t.me/customerservice_160", cta: "Chat on Telegram", active: true },
      { id: "sc2", label: "Email Support", desc: "Send us an email and we'll reply within 24 hours", href: "mailto:support@dealstocks.com", cta: "Send Email", active: true },
      { id: "sc3", label: "Help Center", desc: "Browse FAQs, guides and documentation", href: "#", cta: "Browse Help", active: true },
    ],
  },
  reviews: [
    { id: "rv1",  name: "Sarah M.",   location: "New York, USA",       rating: 5, text: "Found an incredible deal on headphones — saved $80 compared to retail. DealX Stocks is my go-to!", avatar: "SM",  active: true },
    { id: "rv2",  name: "Ahmed K.",   location: "Dubai, UAE",           rating: 5, text: "Amazing platform. I can compare prices across Amazon and AliExpress instantly. Highly recommend!", avatar: "AK",  active: true },
    { id: "rv3",  name: "Marie L.",   location: "Paris, France",        rating: 4, text: "Very clean interface. Found exactly what I needed from Alibaba at wholesale prices.", avatar: "ML",  active: true },
    { id: "rv4",  name: "James T.",   location: "London, UK",           rating: 5, text: "The search function is superb. Filtered 100+ products in seconds. Will definitely use again.", avatar: "JT",  active: true },
    { id: "rv5",  name: "Yuki N.",    location: "Tokyo, Japan",         rating: 5, text: "I love how all marketplaces are aggregated in one place. Saves so much time shopping!", avatar: "YN",  active: true },
    { id: "rv6",  name: "Carlos R.",  location: "Madrid, Spain",        rating: 4, text: "Great prices from AliExpress section. The product cards are clean and informative.", avatar: "CR",  active: true },
    { id: "rv7",  name: "Priya S.",   location: "Mumbai, India",        rating: 5, text: "Best deal discovery site I've used. The marketplace strip shows all my favorite platforms!", avatar: "PS",  active: true },
    { id: "rv8",  name: "Liu Wei",    location: "Shanghai, China",      rating: 5, text: "Very professional platform. Alibaba wholesale deals here are top quality.", avatar: "LW",  active: true },
    { id: "rv9",  name: "Emma B.",    location: "Sydney, Australia",    rating: 4, text: "Love the dark mode! Clean, fast, and has everything I need for online shopping.", avatar: "EB",  active: true },
    { id: "rv10", name: "Hassan A.",  location: "Cairo, Egypt",         rating: 5, text: "Found bulk deals for my small business through Alibaba. Incredible savings!", avatar: "HA",  active: true },
    { id: "rv11", name: "Nina V.",    location: "Berlin, Germany",      rating: 5, text: "The UI is elegant and very easy to use. Product categories are well organized.", avatar: "NV",  active: true },
    { id: "rv12", name: "Tomás M.",   location: "São Paulo, Brazil",    rating: 4, text: "Affordable gadgets from AliExpress listed clearly. Prices are always accurate.", avatar: "TM",  active: true },
    { id: "rv13", name: "Anna K.",    location: "Moscow, Russia",       rating: 5, text: "My favorite way to find deals. The notification bell keeps me updated on price drops!", avatar: "AK",  active: true },
    { id: "rv14", name: "Omar Y.",    location: "Istanbul, Turkey",     rating: 4, text: "Excellent site. Compared 30 products in minutes. Saved over $200 on my last order.", avatar: "OY",  active: true },
    { id: "rv15", name: "Fatima H.",  location: "Tehran, Iran",         rating: 5, text: "Persian language support is a great touch. Very user-friendly for international shoppers.", avatar: "FH",  active: true },
    { id: "rv16", name: "Kwame A.",   location: "Accra, Ghana",         rating: 5, text: "The best platform for African shoppers to find global deals. Highly trustworthy!", avatar: "KA",  active: true },
  ],
  reviewsSection: {
    title: "What Shoppers Say",
    subtitle: "Thousands of happy deal hunters worldwide",
  },
  footer: {
    description:
      "Your global marketplace aggregator. Discover the best deals across Amazon, Alibaba, AliExpress, and 12+ more platforms.",
    copyright:
      "© 2014 DealX Stocks. All rights reserved. Product links are affiliate redirects to official marketplaces.",
    groups: [
      {
        id: "fg1",
        title: "Company",
        links: [
          { id: "fl1", label: "About Us", href: "#", external: false, active: true },
          { id: "fl2", label: "How It Works", href: "#", external: false, active: true },
          { id: "fl3", label: "Careers", href: "#", external: false, active: true },
          { id: "fl4", label: "Press", href: "#", external: false, active: true },
        ],
      },
      {
        id: "fg2",
        title: "Marketplaces",
        links: [
          { id: "fl5", label: "Amazon", href: "https://www.amazon.com", external: true, active: true },
          { id: "fl6", label: "Alibaba", href: "https://www.alibaba.com", external: true, active: true },
          { id: "fl7", label: "AliExpress", href: "https://www.aliexpress.com", external: true, active: true },
          { id: "fl8", label: "eBay", href: "https://www.ebay.com", external: true, active: true },
        ],
      },
      {
        id: "fg3",
        title: "Support",
        links: [
          { id: "fl9",  label: "Help Center",    href: "#",                                        external: false, active: true },
          { id: "fl10", label: "Telegram Chat",  href: "https://t.me/customerservice_160",         external: true,  active: true },
          { id: "fl11", label: "Email Support",  href: "mailto:support@dealstocks.com",            external: false, active: true },
          { id: "fl12", label: "Report Issue",   href: "#",                                        external: false, active: true },
        ],
      },
      {
        id: "fg4",
        title: "Legal",
        links: [
          { id: "fl13", label: "Privacy Policy",   href: "#", external: false, active: true },
          { id: "fl14", label: "Terms of Service", href: "#", external: false, active: true },
          { id: "fl15", label: "Cookie Policy",    href: "#", external: false, active: true },
          { id: "fl16", label: "Disclaimer",       href: "#", external: false, active: true },
        ],
      },
    ],
    socials: [
      { id: "sl1", platform: "twitter",   href: "#",                                    active: true },
      { id: "sl2", platform: "facebook",  href: "#",                                    active: true },
      { id: "sl3", platform: "instagram", href: "#",                                    active: true },
      { id: "sl4", platform: "youtube",   href: "#",                                    active: true },
      { id: "sl5", platform: "telegram",  href: "https://t.me/customerservice_160",     active: true },
    ],
    active: true,
  },
  comingSoon: {
    title: "More products coming soon",
    description: "We're constantly adding new deals from global marketplaces. Sign up to be notified.",
  },
  cta: {
    variant: "a",
    title: "Start Earning While You Shop",
    subtitle:
      "Create a free account, complete tasks and earn commissions on every successful referral.",
    primaryLabel: "Start Earning Free",
    primaryHref: "/register",
    secondaryLabel: "Browse Today's Deals",
    secondaryHref: "/deals",
  },
  visibility: {
    showHero: true,
    showMarketplaceCards: true,
    showSupport: true,
    showFooter: true,
    showReviews: true,
    showComingSoon: true,
    showCategoryDiscovery: true,
    showDeals: true,
    showTrust: true,
    showFaq: true,
    showTestimonials: true,
    showCaseStudies: true,
    showCtaBanner: true,
  },
  updatedAt: "",
};

export function loadLandingPage(): LandingPageSettings {
  return { ...DEFAULT_LANDING_PAGE };
}

export function saveLandingPage(data: LandingPageSettings): void {
  void data;
}

export function genLPId(): string {
  return `lp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
