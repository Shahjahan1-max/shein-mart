# ⚛️ DealXStocks Frontend — React & TypeScript Web App

High-performance, enterprise-grade React SPA built with **Vite 6**, **TypeScript 6**, **TailwindCSS 4**, and **Radix UI**.

---

## 🏗️ Architecture & Component Design

```
src/
├── main.tsx                # App entry + global error reporting (window.onerror/unhandledrejection)
├── App.tsx                 # Router (Wouter), Context Providers, Admin/Super-Admin guards, CookieConsent
├── index.css               # Design System, Tokens, Tailwind Imports
│
├── pages/                  # Page-level route components
│   ├── Home.tsx            # Agency Landing Page + CMS-driven A/B CTA banner
│   ├── auth/               # Login, Register, Password Recovery
│   ├── dashboard/          # Client Portal (Preserved)
│   ├── admin/              # Admin Panel (incl. Leads console)
│   ├── services/           # Service Pages (SEO, Growth, Intelligence)
│   ├── marketplaces/       # Amazon, Alibaba, AliExpress, eBay
│   ├── industries/         # Fashion, B2B, Electronics, etc.
│   ├── deals/ categories/ products/ guides/ glossary/
│   ├── resources/          # Case studies, Whitepapers
│   ├── about/ legal/ support/ tools/
│   └── knowledge-hub/      # Blog, FAQ, Glossary, Academy
│
├── components/             # Reusable UI & Composition Layer
│   ├── ui/                 # Atomic design components (shadcn/ui + Radix)
│   ├── seo/                # JSON-LD, Breadcrumbs, FaqSection, SeoContentLayout
│   ├── layout/             # Header, Footer, Bottom Nav, Sidebars
│   ├── CtaBanner.tsx       # Conversion banner (tracks cta_click)
│   ├── LeadMagnetForm.tsx  # Email capture → leadCaptures (tracks generate_lead)
│   └── CookieConsent.tsx   # GDPR consent banner (analytics consent)
│
├── contexts/               # Global React Contexts
│   ├── AuthContext.tsx     # Firebase Auth state & user session
│   ├── LangContext.tsx     # Multilingual (i18n) state
│   ├── AdminContext.tsx    # Admin permissions & view mode
│   └── LoaderContext.tsx   # Global loading state
│
├── hooks/                  # Custom Data & Logic Hooks
│   ├── useApi.ts           # REST API fetching wrapper
│   ├── useCachedApi.ts     # In-memory cached API fetcher
│   ├── useLiveData.ts      # Real-time WebSocket connection
│   ├── useCatalogs.ts      # Product & service catalog hooks
│   └── useLandingPageSettings.ts  # CMS settings with deep merge
│
└── lib/                    # Infrastructure Utilities
    ├── apiClient.ts        # Fetch HTTP client + generic Firebase doc API
    ├── firebaseClient.ts   # Firebase Web SDK + analytics init
    ├── analytics.ts        # Consent-safe tracking (dataLayer + Firebase), DNT
    ├── ctaVariants.ts      # A/B CTA variant resolver + presets
    ├── leads.ts            # CSV export + lead aggregation helpers
    ├── dataCache.ts        # Client-side cache engine
    ├── seo/                # URLs, breadcrumbs, internal links, JSON-LD, routes
    └── design-tokens.ts    # Centralized CSS/JS tokens
```

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev

# Run TypeScript type check
npm run typecheck

# Test suite (Vitest, jsdom) — 22 files, 268 tests
npm run test

# Build for production (vite + prerender-public + postbuild-hostinger)
npm run build
```

---

## 🌍 i18n & Internationalization

Locale UI dictionaries: `en` (default), `ar`, `fr`, `fr-ca`, `fa`, `ur`.
Public marketing content is English-first; dashboard chrome is localized.

---

## 📦 Production Build Pipeline

```
vite build
  → scripts/prerender-public.mjs   (123 static URLs → dist/public, sitemap.xml, IndexNow key)
  → scripts/postbuild-hostinger.mjs (dist/public → dist, .htaccess with /api/ exclusion)
```

---

## 🧪 Testing

```bash
# Run Vitest test suite
npm run test

# Watch mode
npm run test:watch
```

Coverage: SEO metadata/URLs/JSON-LD · storefront · platform logic (fast-check) · wallet ·
task sessions · ROI calculator · analytics/consent · leads/CTA helpers · automated a11y audit.

---

## 📄 Phase Documentation

See root `README.md` → "Phase Status (0 → 7)" plus `DEALXSTOCKS_PHASE_*.md` files for each
phase's delivery and non-regression evidence.