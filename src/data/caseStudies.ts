/**
 * Case studies data (Phase 4B — Authority & Conversion).
 * Documented, results-driven growth stories used on /case-studies and detail pages.
 */

export interface CaseStudyMetric {
  label: string;
  value: string;
}

export interface CaseStudyQuote {
  text: string;
  author: string;
  role: string;
}

export interface CaseStudy {
  slug: string;
  client: string;
  title: string;
  summary: string;
  industry: string;
  marketplaces: string[];
  duration: string;
  challenge: string;
  approach: string[];
  results: string;
  metrics: CaseStudyMetric[];
  quote?: CaseStudyQuote;
  publishedAt: string;
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "global-fashion-brand-amazon-eu",
    client: "Verde Atelier",
    title: "Global Fashion Brand Triples Amazon EU Revenue in 12 Months",
    summary:
      "A fashion label with a strong D2C presence used marketplace SEO to scale Amazon Germany and France from a standing start to 3.4x revenue.",
    industry: "Fashion & Apparel",
    marketplaces: ["Amazon"],
    duration: "12 months",
    challenge:
      "Verde Atelier had healthy D2C traffic but almost no organic visibility on Amazon EU. Listings were keyword-light, brand names were unlocalised and the Buy Box rotated between resellers.",
    approach: [
      "Localised every listing title and bullet into German and French with high-intent marketplace keywords.",
      "Rebuilt the catalog around a clear category hierarchy so Amazon's A9 algorithm could map products to intent.",
      "Ran a structured review-velocity programme to push key SKUs past the 100-review threshold.",
      "Matched pricing strategy to win and hold the Buy Box on hero products.",
    ],
    results:
      "Organic keyword rankings grew across all target segments, impressions multiplied, and revenue more than tripled within a year while ad spend stayed flat.",
    metrics: [
      { label: "Revenue", value: "+340%" },
      { label: "Organic keywords", value: "+420%" },
      { label: "Buy Box win rate", value: "87%" },
      { label: "Markets", value: "DE + FR" },
    ],
    quote: {
      text: "Marketplace SEO was the lever we were missing. The category-first structure made our whole catalog discoverable, not just the hero products.",
      author: "Isabelle Mercier",
      role: "Head of Ecommerce, Verde Atelier",
    },
    publishedAt: "2026-07-15",
  },
  {
    slug: "electronics-manufacturer-alibaba-b2b",
    client: "Northgate Electronics",
    title: "Electronics Manufacturer Triples B2B Inquiries on Alibaba",
    summary:
      "A contract electronics manufacturer replaced a flat product dump with an SEO-built Alibaba storefront and tripled qualified RFQs in six months.",
    industry: "Electronics & Components",
    marketplaces: ["Alibaba"],
    duration: "6 months",
    challenge:
      "Northgate had 200+ SKUs listed on Alibaba with almost no search presence. Buyers could not tell their manufacturing capabilities apart from dropshippers, and inquiry quality was poor.",
    approach: [
      "Mapped the full product catalog to high-intent B2B keywords (bulk, MOQ, custom OEM, wholesale).",
      "Rewrote product pages around capability — certifications, production lines and QA — instead of generic copy.",
      "Optimised category landing pages for 'manufacturer' + product-type searches.",
      "Restructured the storefront so Trade Assurance and volume pricing were visible above the fold.",
    ],
    results:
      "Qualified RFQs tripled, average order value rose sharply, and the storefront now ranks on page one for its core capability keywords.",
    metrics: [
      { label: "Qualified RFQs", value: "+210%" },
      { label: "Page-one keywords", value: "38" },
      { label: "Avg. order value", value: "+64%" },
      { label: "Timeline", value: "6 months" },
    ],
    publishedAt: "2026-06-20",
  },
  {
    slug: "beauty-brand-amazon-ebay-organic-rank",
    client: "Lumen Skin",
    title: "Beauty Brand Lifts Organic Ranking 180% Across Amazon and eBay",
    summary:
      "A skincare startup used disciplined listing SEO and a unified catalog to more than double organic ranking on two marketplaces in nine months.",
    industry: "Beauty & Personal Care",
    marketplaces: ["Amazon", "eBay"],
    duration: "9 months",
    challenge:
      "Lumen Skin had great reviews but weak titles and no structured category presence. Most traffic came from paid ads, so profitability was fragile.",
    approach: [
      "Built a shared keyword map across Amazon and eBay to avoid cannibalisation and double listing strength.",
      "Re-ran all titles, back-end keywords and bullets with search-first copy.",
      "Standardised a single taxonomy so the same product appeared consistently in the same category on both platforms.",
      "Used eBay's structured-data fields to surface attributes in search filters.",
    ],
    results:
      "Organic ranking position improved 180% on average, paid-ad dependence dropped, and revenue from organic search now leads the business.",
    metrics: [
      { label: "Organic rank", value: "+180%" },
      { label: "Paid share of sales", value: "-46%" },
      { label: "SKUs optimised", value: "64" },
      { label: "Markets", value: "US + UK" },
    ],
    publishedAt: "2026-05-10",
  },
  {
    slug: "homeware-seller-aliexpress-global",
    client: "Kasa Homewares",
    title: "Homeware Seller Cuts CPC by Half While Scaling AliExpress Sales",
    summary:
      "By fixing listing quality scores and aligning organic + paid keywords, a homeware seller doubled AliExpress volume at half the cost per click.",
    industry: "Home & Living",
    marketplaces: ["AliExpress"],
    duration: "8 months",
    challenge:
      "Kasa Homewares had competitive prices but low listing scores. Ads were expensive and organic visibility was buried, making scale impossible.",
    approach: [
      "Audited listing quality signals — titles, images, attributes and fulfilment — and fixed the biggest scoring gaps first.",
      "Aligned paid keywords with the organic terms already driving impressions.",
      "Expanded the product range around proven winners instead of splitting effort across weak SKUs.",
      "Improved shipping options to lift conversion and quality scores together.",
    ],
    results:
      "Cost per click fell by half while order volume doubled, turning a break-even marketplace channel into the company's most profitable one.",
    metrics: [
      { label: "Order volume", value: "+112%" },
      { label: "CPC", value: "-52%" },
      { label: "Conversion rate", value: "+38%" },
      { label: "Listing score", value: "82/100" },
    ],
    publishedAt: "2026-04-02",
  },
  {
    slug: "industrial-machinery-wholesaler",
    client: "ForgeTech Industrial",
    title: "Industrial Machinery Wholesaler Wins Long-Tail B2B Search on Alibaba",
    summary:
      "A wholesaler of CNC and laser machinery captured long-tail manufacturing searches that the big suppliers ignored — and multiplied inquiries.",
    industry: "Industrial Machinery",
    marketplaces: ["Alibaba"],
    duration: "10 months",
    challenge:
      "ForgeTech competed against giants for generic 'CNC machine' keywords. Head terms were unreachable, so inquiry volume flatlined despite good products.",
    approach: [
      "Targeted long-tail technical queries (e.g. 'CNC router 1300x2500mm 4 axis') with dedicated pages.",
      "Turned specification sheets into readable, keyword-rich product copy.",
      "Published technical guides that answered buyer questions and fed internal links to product pages.",
      "Collected and displayed machine certifications and factory audits to build trust with procurement teams.",
    ],
    results:
      "Long-tail pages now generate the majority of inquiries, with near-zero competition and far better buyer intent than head terms.",
    metrics: [
      { label: "Inquiries", value: "+190%" },
      { label: "Long-tail share", value: "71%" },
      { label: "Certifications shown", value: "9" },
      { label: "Cost per lead", value: "-58%" },
    ],
    publishedAt: "2026-03-12",
  },
  {
    slug: "premium-electronics-retailer-ebay",
    client: "Aurora Gadgets",
    title: "Premium Electronics Retailer Rebuilds eBay Search Share",
    summary:
      "After algorithm changes crushed visibility, a refurbished-electronics retailer rebuilt its eBay catalog and recovered — then exceeded — its former sales.",
    industry: "Electronics & Components",
    marketplaces: ["eBay"],
    duration: "7 months",
    challenge:
      "An eBay algorithm update deprioritised Aurora's listings overnight. Titles, item specifics and category placement were outdated, and sales dropped sharply.",
    approach: [
      "Rewrote every listing title around the product + attribute + condition formula eBay rewards.",
      "Completed all item specifics to qualify for the refined search filters.",
      "Consolidated duplicate listings that were splitting the product's search equity.",
      "Rebuilt the store category structure to match how buyers actually browse.",
    ],
    results:
      "Search share recovered within a quarter and is now 40% above the pre-update baseline, with stronger margins from the consolidated catalog.",
    metrics: [
      { label: "Search share", value: "+40%" },
      { label: "Duplicate listings", value: "-61%" },
      { label: "Item specifics", value: "100%" },
      { label: "Revenue", value: "+83%" },
    ],
    publishedAt: "2026-02-05",
  },
];

export function findCaseStudy(slug: string): CaseStudy | undefined {
  const normalized = String(slug || "").toLowerCase();
  return CASE_STUDIES.find(cs => cs.slug === normalized);
}
