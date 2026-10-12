/**
 * Fact-checked Marketplace Profile definitions for DealX Stocks.
 * Clear differentiation between Amazon, Alibaba, AliExpress, eBay, and DealX Stocks aggregation role.
 */

export interface MarketplaceProfile {
  id: string;
  slug: string;
  name: string;
  type: "B2C E-Commerce" | "B2B Wholesale" | "Cross-Border B2C" | "C2C / B2C Auction & Retail";
  tagline: string;
  overview: string;
  dealXRole: string;
  keyFeatures: string[];
  bestFor: string;
  disclaimer: string;
  faq: { question: string; answer: string }[];
}

export const MARKETPLACE_PROFILES: Record<string, MarketplaceProfile> = {
  amazon: {
    id: "mp-amazon",
    slug: "amazon",
    name: "Amazon",
    type: "B2C E-Commerce",
    tagline: "Global Retail & Fast Consumer Fulfillment",
    overview:
      "Amazon is one of the world's largest consumer e-commerce platforms, offering millions of consumer products, fast delivery, and verified customer feedback across electronics, home goods, fashion, and daily essentials.",
    dealXRole:
      "DealX Stocks indexes verified Amazon deals, price drops, and popular product listings, directing users directly to Amazon product detail pages to make secure purchases.",
    keyFeatures: [
      "Extensive product selection across consumer categories",
      "Prime shipping availability on eligible items",
      "Transparent customer reviews and seller feedback ratings",
      "Robust customer protection and straightforward return policies",
    ],
    bestFor: "Shoppers seeking fast delivery, branded consumer electronics, home goods, and reliable customer service.",
    disclaimer:
      "DealX Stocks is an independent deal aggregator and is not owned, operated, or officially endorsed by Amazon.com, Inc.",
    faq: [
      {
        question: "Does DealX Stocks ship Amazon products?",
        answer:
          "No. DealX Stocks aggregates deal listings and links you directly to Amazon. Amazon and its third-party sellers handle order processing, payment, shipping, and customer support.",
      },
      {
        question: "Are Amazon prices on DealX Stocks guaranteed?",
        answer:
          "Prices on Amazon change dynamically based on seller stock and promotion periods. DealX Stocks updates pricing regularly, but the final price is determined at checkout on Amazon.com.",
      },
    ],
  },
  alibaba: {
    id: "mp-alibaba",
    slug: "alibaba",
    name: "Alibaba",
    type: "B2B Wholesale",
    tagline: "Global B2B Wholesale & Manufacturer Sourcing",
    overview:
      "Alibaba.com is a leading international B2B platform connecting global buyers with certified manufacturers, suppliers, and wholesalers for bulk purchasing, custom manufacturing, and commercial trade.",
    dealXRole:
      "DealX Stocks highlights B2B wholesale offer structures, bulk pricing tiers, and manufacturer sourcing listings available on Alibaba for business buyers and resellers.",
    keyFeatures: [
      "Bulk wholesale pricing tiers directly from manufacturers",
      "Custom OEM and ODM manufacturing capabilities",
      "Trade Assurance buyer protection program",
      "Verified supplier badges and factory audit reports",
    ],
    bestFor: "Businesses, e-commerce store owners, bulk buyers, and product developers seeking wholesale sourcing.",
    disclaimer:
      "DealX Stocks is an independent platform and is not owned by or officially affiliated with Alibaba Group Holding Limited.",
    faq: [
      {
        question: "Can I buy single retail items on Alibaba?",
        answer:
          "Alibaba is primarily a B2B wholesale portal requiring Minimum Order Quantities (MOQ). For single-item consumer shopping, AliExpress or Amazon are typically more suitable.",
      },
      {
        question: "How does DealX Stocks assist with Alibaba sourcing?",
        answer:
          "DealX Stocks indexes wholesale price ranges and product categories from Alibaba, allowing businesses to compare manufacturer deals before initiating direct supplier inquiries on Alibaba.com.",
      },
    ],
  },
  aliexpress: {
    id: "mp-aliexpress",
    slug: "aliexpress",
    name: "AliExpress",
    type: "Cross-Border B2C",
    tagline: "Direct Manufacturer Consumer Bargains & Global Shipping",
    overview:
      "AliExpress is a global consumer marketplace enabling international shoppers to buy directly from manufacturers and distributors in China and worldwide at competitive factory-direct prices.",
    dealXRole:
      "DealX Stocks curates trending AliExpress deals, flash discounts, and budget product discoveries across gadgets, apparel, accessories, and home tools.",
    keyFeatures: [
      "Factory-direct pricing on millions of items",
      "Worldwide international shipping options",
      "Buyer Protection coverage on lost or damaged orders",
      "Frequent choice deals and seasonal discount coupons",
    ],
    bestFor: "Budget-conscious consumers looking for affordable electronics, accessories, apparel, and direct manufacturer pricing.",
    disclaimer:
      "DealX Stocks is an independent deal discovery website and is not officially operated by or affiliated with AliExpress.com.",
    faq: [
      {
        question: "How long does delivery take for AliExpress items?",
        answer:
          "Delivery times vary depending on the shipping method selected on AliExpress, ranging from Choice 7-12 day delivery to standard international postal shipping.",
      },
      {
        question: "Are AliExpress products genuine?",
        answer:
          "AliExpress features direct manufacturers and independent sellers. DealX Stocks indexes top-rated items, but buyers should check seller feedback ratings on AliExpress before purchasing.",
      },
    ],
  },
  ebay: {
    id: "mp-ebay",
    slug: "ebay",
    name: "eBay",
    type: "C2C / B2C Auction & Retail",
    tagline: "New, Refurbished & Rare Marketplace Finds",
    overview:
      "eBay is a global commerce pioneer offering buy-it-now retail listings, certified refurbished items, competitive auction listings, and rare collectibles from individual sellers and brand outlets.",
    dealXRole:
      "DealX Stocks aggregates eBay daily deals, brand outlet discounts, certified refurbished offers, and popular auction items into easy-to-browse categories.",
    keyFeatures: [
      "Buy-it-now fixed prices alongside interactive auction listings",
      "eBay Certified Refurbished program with seller warranties",
      "eBay Money Back Guarantee for buyer protection",
      "Direct brand outlets with heavy discount inventory",
    ],
    bestFor: "Shoppers seeking refurbished electronics, brand outlet savings, rare collectibles, and hard-to-find replacement parts.",
    disclaimer:
      "DealX Stocks is an independent aggregator and is not affiliated with or endorsed by eBay Inc.",
    faq: [
      {
        question: "What is the difference between Buy-It-Now and Auction on eBay?",
        answer:
          "Buy-It-Now allows instant purchase at a fixed price, while Auction listings allow buyers to place competitive bids until the listing timer ends.",
      },
      {
        question: "Are eBay refurbished items reliable?",
        answer:
          "Items in the eBay Certified Refurbished program are inspected, cleaned, and tested by qualified refurbishers and typically come with a 1- or 2-year warranty.",
      },
    ],
  },
};
