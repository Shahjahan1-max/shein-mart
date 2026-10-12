/**
 * Glossary data (Phase 3B — SEO Features).
 * Marketplace/ecommerce terms with definitions used for the /glossary page
 * and auto-linking within guide and product content.
 */

export interface GlossaryTerm {
  term: string;
  slug: string;
  category: string;
  definition: string;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    term: "A9 Algorithm",
    slug: "a9-algorithm",
    category: "Marketplace SEO",
    definition:
      "Amazon's internal search ranking algorithm. A9 determines how products rank for a given keyword by weighing factors such as relevance, price, availability, conversion rate and sales velocity.",
  },
  {
    term: "Affiliate Link",
    slug: "affiliate-link",
    category: "Earnings",
    definition:
      "A tracked URL that directs shoppers to an external marketplace. When a purchase happens through the link, the platform that published it can earn a commission — at no additional cost to the buyer.",
  },
  {
    term: "Buy Box",
    slug: "buy-box",
    category: "Marketplace SEO",
    definition:
      "The white box on a product page where shoppers click to add an item to their cart. Winning the Buy Box means your listing is the default seller for that product, which dramatically increases conversion.",
  },
  {
    term: "Cashback",
    slug: "cashback",
    category: "Deals",
    definition:
      "A rebate returned to the shopper after a qualifying purchase. Some deal platforms return a portion of the commission earned on a sale back to the buyer as cashback.",
  },
  {
    term: "Compare Price",
    slug: "compare-price",
    category: "Deals",
    definition:
      "The original or 'was' price shown with a strikethrough next to the sale price. A genuine discount exists only when the compare price is higher than the current selling price.",
  },
  {
    term: "Conversion Rate",
    slug: "conversion-rate",
    category: "Metrics",
    definition:
      "The percentage of visitors who complete a desired action — such as clicking through to a marketplace or completing a purchase — out of all visitors who saw the listing.",
  },
  {
    term: "Commission",
    slug: "commission",
    category: "Earnings",
    definition:
      "The fee an affiliate platform earns when a referred customer makes a purchase. Commissions vary by marketplace, product category and whether the deal qualifies.",
  },
  {
    term: "Discount",
    slug: "discount",
    category: "Deals",
    definition:
      "The percentage reduction between a product's compare (original) price and its current sale price. DealX Stocks only surfaces deals with a verified discount of 5% or more.",
  },
  {
    term: "Flash Sale",
    slug: "flash-sale",
    category: "Deals",
    definition:
      "A short-duration promotion with deep discounts that ends after a limited time or once stock runs out. Flash sales typically produce the steepest price drops.",
  },
  {
    term: "Marketplace",
    slug: "marketplace",
    category: "Platforms",
    definition:
      "An online platform that connects third-party sellers with buyers. Amazon, Alibaba, AliExpress and eBay are the largest global marketplaces.",
  },
  {
    term: "Organic Ranking",
    slug: "organic-ranking",
    category: "Marketplace SEO",
    definition:
      "The unpaid position a listing holds in a marketplace's search results. Higher organic rankings come from relevance, sales history, reviews and listing quality — not paid ads.",
  },
  {
    term: "Price Drop",
    slug: "price-drop",
    category: "Deals",
    definition:
      "A reduction in a product's listed price over time. Deal trackers monitor price drops so shoppers can buy at the lowest recorded point.",
  },
  {
    term: "Search Action",
    slug: "search-action",
    category: "SEO",
    definition:
      "A structured data markup (schema.org SearchAction) that lets search engines show a site's internal search box in the search results, driving more crawlable discovery.",
  },
  {
    term: "Structured Data",
    slug: "structured-data",
    category: "SEO",
    definition:
      "Code (usually JSON-LD) added to a page that tells search engines exactly what the content means — products, offers, ratings, FAQs and breadcrumbs — enabling rich results.",
  },
];

export function findGlossaryTerm(slug: string): GlossaryTerm | undefined {
  const normalized = String(slug || "").toLowerCase();
  return GLOSSARY_TERMS.find(t => t.slug === normalized);
}

export function glossaryTermHref(slug: string): string {
  return `/glossary#${slug}`;
}
