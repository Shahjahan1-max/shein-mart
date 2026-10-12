/**
 * Guides data (Phase 3B — SEO Features).
 * Programmatic buying-guide templates with glossary auto-linking support.
 */

export interface GuideSection {
  heading: string;
  body: string;
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: "how-we-pick-deals",
    title: "How DealX Stocks Picks Its Deals",
    description: "The exact criteria behind every deal we surface — real price history, verified discounts and marketplace trust.",
    category: "Deals",
    readTime: "3 min read",
    sections: [
      {
        heading: "Real discounts only",
        body: "A product only reaches our deals rail when its compare price is genuinely higher than the sale price. We compute the exact discount percentage from the catalog data and hide any listing where the 'original' price is a fake anchor. If you see a -17% badge, that is a real reduction from the listed compare price.",
      },
      {
        heading: "Marketplace trust matters",
        body: "Every product links to its official marketplace listing on Amazon, Alibaba, AliExpress or eBay. We never fabricate inventory or sell directly — your order, shipping and returns are handled by the marketplace itself.",
      },
      {
        heading: "Freshness and turnover",
        body: "Prices and availability change quickly. We refresh from the catalog and rotate the deals rail so stale listings drop off. Treat a deal you like as time-sensitive and verify the final price at checkout.",
      },
    ],
  },
  {
    slug: "understanding-discounts",
    title: "Understanding Discounts, Compare Prices and Price Drops",
    description: "Learn to tell a real discount from a marketing trick, and how to time your purchase for the lowest price.",
    category: "Deals",
    readTime: "4 min read",
    sections: [
      {
        heading: "Compare price vs sale price",
        body: "The compare price is the original or 'was' price, shown with a strikethrough. The discount percentage is calculated as (compare - sale) / compare. A listing with no compare price carries no verified discount — treat it as a normal price, not a deal.",
      },
      {
        heading: "Watch for fake anchors",
        body: "Some sellers inflate the original price to make a discount look bigger than it is. We guard against this by only counting deals where the numbers come from the real catalog, and by never inventing compare prices.",
      },
      {
        heading: "Flash sales and timing",
        body: "Flash sales produce the steepest price drops but end quickly. If a deal is genuinely good, check the marketplace page directly and decide before it expires. Price drops on stable products often repeat, so patience can pay off.",
      },
    ],
  },
  {
    slug: "safe-shopping-guide",
    title: "Safe Shopping Guide for Global Marketplaces",
    description: "How to shop Amazon, Alibaba, AliExpress and eBay safely — seller reviews, secure checkout and return policies.",
    category: "Guides",
    readTime: "5 min read",
    sections: [
      {
        heading: "Check the seller, not just the product",
        body: "Before you buy, open the seller profile. Look at feedback score, review count and how long the seller has been active. Established sellers with thousands of reviews are far safer than brand-new accounts with perfect ratings and no history.",
      },
      {
        heading: "Use secure checkout only",
        body: "Always complete checkout on the official marketplace domain with a lock icon in the address bar. Never enter payment details on third-party sites. DealX Stocks links only to official marketplace listings.",
      },
      {
        heading: "Understand return policies",
        body: "Return windows, restocking fees and shipping responsibilities differ by marketplace and seller. Read the listing's return policy before ordering, and keep the order confirmation in case you need to open a dispute.",
      },
    ],
  },
  {
    slug: "how-to-find-the-best-deals",
    title: "How to Find the Best Online Deals: A Systematic Shopping Guide",
    description: "Learn how to systematically discover genuine online discounts, compare marketplace prices, spot price inflation, and buy safely across major e-commerce platforms.",
    category: "Shopping Strategy",
    readTime: "6 min read",
    sections: [
      {
        heading: "Cross-Platform Comparison",
        body: "Compare identical model numbers or specifications across Amazon, eBay, and AliExpress before buying.",
      },
      {
        heading: "Verify Historical Price Trends",
        body: "Check whether the current price is a real discount or a standard list price disguised with a sale badge.",
      },
      {
        heading: "Factor In Total Shipping & Import Costs",
        body: "Calculate total landing cost including delivery charges, customs tariffs, and tax duties.",
      },
    ],
  },
  {
    slug: "how-deal-aggregation-works",
    title: "How Deal Aggregation Works: Technology, Data & Transparency",
    description: "Discover how deal aggregation software indexes product feeds, organizes e-commerce offers, normalizes category data, and helps shoppers make informed choices.",
    category: "Platform Mechanics",
    readTime: "7 min read",
    sections: [
      {
        heading: "Public Feed Indexing",
        body: "Aggregators fetch public product listings, titles, pricing data, and product images from marketplace feeds.",
      },
      {
        heading: "Taxonomy Normalization",
        body: "Unstructured titles are categorized (e.g. mapping 'Wireless Earbuds' and 'Bluetooth Headset' into Consumer Electronics).",
      },
      {
        heading: "Deal Validation",
        body: "Algorithms check discount thresholds, stock statuses, and seller reliability indicators.",
      },
    ],
  },
  {
    slug: "compare-marketplaces",
    title: "Comparing Global E-Commerce Marketplaces: Amazon vs Alibaba vs AliExpress vs eBay",
    description: "A factual breakdown comparing Amazon, Alibaba, AliExpress, and eBay on pricing, fulfillment speed, buyer protection, and product focus.",
    category: "Marketplace Comparison",
    readTime: "8 min read",
    sections: [
      {
        heading: "Amazon Global Retail",
        body: "Best for fast domestic delivery, consumer electronics, home items, and hassle-free returns.",
      },
      {
        heading: "Alibaba B2B Wholesale",
        body: "Best for business-to-business wholesale purchasing, OEM manufacturing, and high-volume discounts.",
      },
      {
        heading: "AliExpress Factory Direct",
        body: "Best for budget consumer gadgets, fashion accessories, and factory-direct low-cost items.",
      },
      {
        heading: "eBay Refurbished & Outlets",
        body: "Best for certified refurbished tech, brand outlet deals, auctions, and vintage/rare items.",
      },
    ],
  },
  {
    slug: "how-to-evaluate-online-deals",
    title: "How to Evaluate Online Deals & Seller Trust Signals",
    description: "Protect your online shopping experience by evaluating merchant ratings, product reviews, price transparency, and return policy signals.",
    category: "Safety & Trust",
    readTime: "5 min read",
    sections: [
      {
        heading: "Seller Rating & Account Tenure",
        body: "Prefer sellers with over 95% positive feedback scores and established storefront histories.",
      },
      {
        heading: "Verified Buyer Review Photos",
        body: "Look at actual customer upload images in reviews rather than promotional render graphics.",
      },
      {
        heading: "Clear Return & Refund Window",
        body: "Ensure the listing provides at least a 14-to-30 day refund or replacement window.",
      },
    ],
  },
  {
    slug: "price-comparison-guide",
    title: "The Ultimate E-Commerce Price Comparison Guide",
    description: "A comprehensive guide on price comparison methodologies, model matching, SKU verification, and total cost calculation.",
    category: "Comparison Tactics",
    readTime: "6 min read",
    sections: [
      {
        heading: "Match Model & Part Numbers",
        body: "Verify the manufacturer Part Number (MPN) or UPC barcode to ensure identical item comparison.",
      },
      {
        heading: "Account for Bundled Accessories",
        body: "Check if a higher-priced offer includes essential extras like memory cards, cases, or extended warranties.",
      },
      {
        heading: "Evaluate Refurbished Grades",
        body: "Compare Certified Refurbished vs Open Box vs Brand New pricing structures.",
      },
    ],
  },
  {
    slug: "buying-guide",
    title: "Smart E-Commerce Buying Guide: From Research to Checkout",
    description: "A complete framework for researching product categories, setting realistic deal expectations, avoiding shopping pitfalls, and buying safely online.",
    category: "Smart Shopping",
    readTime: "7 min read",
    sections: [
      {
        heading: "Needs Assessment",
        body: "Identify key features you need versus non-essential add-ons that inflate product price.",
      },
      {
        heading: "Market Research",
        body: "Browse DealX Stocks categories to explore available market options and price brackets.",
      },
      {
        heading: "Safe Transaction",
        body: "Complete checkout on destination merchant platforms using credit cards or buyer-protected payment systems.",
      },
    ],
  },
];

export function findGuide(slug: string): Guide | undefined {
  const normalized = String(slug || "").toLowerCase();
  return GUIDES.find(g => g.slug === normalized);
}
