/**
 * Verified company facts for DealX Stocks.
 * Strict compliance with entity SEO, Google E-E-A-T, and factual accuracy principles.
 * NO fake awards, fake reviews, fake user counts, or exaggerated claims.
 */

export interface VerifiedCompanyFacts {
  brandName: string;
  legalEntityName: string;
  tagline: string;
  officialDomain: string;
  siteUrl: string;
  foundingYear: number;
  headquarters: string;
  coreService: string;
  businessModel: string;
  supportedMarketplaces: string[];
  transparencyPrinciples: string[];
  contactEmail: string;
  supportChannel: string;
  entityDescription: string;
  shortAnswer: string;
  howItWorksSteps: { title: string; description: string }[];
  limitations: string[];
}

export const COMPANY_FACTS: VerifiedCompanyFacts = {
  brandName: "DealX Stocks",
  legalEntityName: "DealX Stocks Ltd.",
  tagline: "Marketplace Aggregation & Product Discovery Platform",
  officialDomain: "dealxstocks.com",
  siteUrl: "https://dealxstocks.com",
  foundingYear: 2024,
  headquarters: "Global Remote / Digital Platform",
  coreService: "Online deal aggregation, marketplace product discovery, and price comparison.",
  businessModel: "Independent deal aggregation platform with transparent affiliate link attribution.",
  supportedMarketplaces: ["Amazon", "Alibaba", "AliExpress", "eBay"],
  transparencyPrinciples: [
    "Fact-based product data aggregation without exaggerated claims",
    "Clear disclosure of affiliate and third-party marketplace links",
    "Independent platform operation not owned by Amazon, Alibaba, AliExpress, or eBay",
    "Open reporting mechanism for inaccurate prices or broken links",
    "Standardized pricing disclaimers acknowledging external marketplace price fluctuations",
  ],
  contactEmail: "support@dealstocks.com",
  supportChannel: "https://t.me/customerservice_160",
  entityDescription:
    "DealX Stocks is a digital marketplace deal aggregator and product discovery platform. It organizes product listings, promotional offers, and comparative shopping data from major global e-commerce platforms including Amazon, Alibaba, AliExpress, and eBay into a structured, searchable catalog.",
  shortAnswer:
    "DealX Stocks is an independent e-commerce deal aggregator that indexes, organizes, and compares product offers across major e-commerce platforms like Amazon, Alibaba, AliExpress, and eBay to help shoppers find validated deals and discover trending products.",
  howItWorksSteps: [
    {
      title: "1. Data Aggregation",
      description:
        "DealX Stocks aggregates public product information, category taxonomy, and promotional pricing from external e-commerce marketplaces.",
    },
    {
      title: "2. Categorization & Quality Check",
      description:
        "Listings are structured into intuitive categories and enriched with marketplace comparisons, buying guides, and ROI calculations.",
    },
    {
      title: "3. Transparent Referral & Redirection",
      description:
        "When a user selects a product deal, DealX Stocks provides direct, transparent links to the original seller's marketplace listing where the transaction takes place.",
    },
    {
      title: "4. Verification & Feedback",
      description:
        "Users can report stale deals or pricing discrepancies, prompting real-time catalog verification and updates.",
    },
  ],
  limitations: [
    "DealX Stocks does not sell products directly or process payment transactions.",
    "Prices and item availability are set by external sellers and may change on destination marketplaces without prior notification.",
    "Order fulfillment, shipping, returns, and customer service for purchased products are handled exclusively by the destination marketplace sellers.",
    "DealX Stocks is an independent aggregator and is not officially endorsed or owned by Amazon, Alibaba, AliExpress, or eBay.",
  ],
};
