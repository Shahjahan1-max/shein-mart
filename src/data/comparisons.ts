/**
 * Comparison data (Phase 3B — SEO Features).
 * Marketplace comparison table used on /marketplaces and decision trees.
 */

export interface ComparisonColumn {
  id: string;
  label: string;
}

export interface ComparisonRow {
  attribute: string;
  values: Record<string, string>;
  /** Optional note rendered under the attribute name. */
  note?: string;
}

export const MARKETPLACE_COMPARISON: {
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
} = {
  columns: [
    { id: "amazon", label: "Amazon" },
    { id: "alibaba", label: "Alibaba" },
    { id: "aliexpress", label: "AliExpress" },
    { id: "ebay", label: "eBay" },
  ],
  rows: [
    {
      attribute: "Best for",
      values: {
        amazon: "Consumer products with fast delivery",
        alibaba: "B2B wholesale & bulk orders",
        aliexpress: "Budget-friendly cross-border shopping",
        ebay: "Used, collectible & unique items",
      },
    },
    {
      attribute: "Typical discount",
      values: {
        amazon: "5–30%",
        alibaba: "10–50% (volume)",
        aliexpress: "20–60%",
        ebay: "5–40%",
      },
    },
    {
      attribute: "Delivery speed",
      values: {
        amazon: "1–5 days (Prime)",
        alibaba: "2–6 weeks",
        aliexpress: "1–4 weeks",
        ebay: "2–10 days",
      },
    },
    {
      attribute: "Buyer protection",
      values: {
        amazon: "A-to-z Guarantee",
        alibaba: "Trade Assurance",
        aliexpress: "Purchase Protection",
        ebay: "Money Back Guarantee",
      },
    },
    {
      attribute: "Returns",
      values: {
        amazon: "30 days",
        alibaba: "Negotiable per order",
        aliexpress: "15 days",
        ebay: "30 days",
      },
    },
    {
      attribute: "Shipping cost",
      values: {
        amazon: "Free with Prime",
        alibaba: "Quoted per shipment",
        aliexpress: "Often free on deals",
        ebay: "Varies by seller",
      },
    },
  ],
};

export interface DecisionNode {
  id: string;
  question: string;
  choices: { label: string; recommendation: string; next?: string }[];
}

/** Simple "which marketplace" decision tree. */
export const MARKETPLACE_DECISION_TREE: DecisionNode[] = [
  {
    id: "start",
    question: "What are you buying?",
    choices: [
      { label: "Bulk / wholesale quantities", recommendation: "Alibaba is built for B2B wholesale with Trade Assurance protection.", next: "volume" },
      { label: "A single consumer product", recommendation: "Amazon or eBay are ideal for single, in-stock consumer items.", next: "single" },
      { label: "Budget items from abroad", recommendation: "AliExpress excels for low-cost cross-border items.", next: "budget" },
    ],
  },
  {
    id: "volume",
    question: "What's your typical order size?",
    choices: [
      { label: "Container / pallet scale", recommendation: "Alibaba with Trade Assurance and supplier verification is your best fit." },
      { label: "Small batches", recommendation: "AliExpress offers smaller minimum order quantities at good prices." },
    ],
  },
  {
    id: "single",
    question: "What matters most?",
    choices: [
      { label: "Fast delivery", recommendation: "Amazon with Prime shipping is the fastest option." },
      { label: "Unique or second-hand items", recommendation: "eBay is unmatched for used, rare and collectible products." },
    ],
  },
  {
    id: "budget",
    question: "How fast do you need it?",
    choices: [
      { label: "Not in a hurry", recommendation: "AliExpress offers the lowest prices with longer delivery windows." },
      { label: "Within days", recommendation: "Amazon is a better fit for speed, even at a slightly higher price." },
    ],
  },
];
