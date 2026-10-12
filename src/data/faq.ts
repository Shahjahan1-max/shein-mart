/**
 * FAQ data — shared source of truth for the homepage FAQ section, the /faq
 * page, and the FAQPage JSON-LD schema. Values must match visible copy.
 */

import type { FaqItem } from "../lib/seo/jsonld";

export const HOMEPAGE_FAQS: FaqItem[] = [
  {
    question: "How does DealX Stocks help me find the best prices?",
    answer:
      "We aggregate real product listings from Amazon, Alibaba, AliExpress and eBay into one place. Every product card shows live price, original (strikethrough) price, discount percentage, rating and review count, so you can compare deals at a glance before visiting the marketplace.",
  },
  {
    question: "Are the product links affiliate links?",
    answer:
      "Yes. When you click through to a marketplace, it may be an affiliate redirect. That means DealX Stocks can earn a small commission at no extra cost to you. Prices and availability are always confirmed on the official marketplace checkout page.",
  },
  {
    question: "Is there a cost to use DealX Stocks?",
    answer:
      "No. Browsing products, categories and deals is completely free. You can also register an account to earn income by completing simple task packages, which is how the platform funds itself.",
  },
  {
    question: "Do you ship products or handle returns?",
    answer:
      "No. DealX Stocks is a discovery platform — we do not stock or ship inventory. Orders, shipping and returns are handled entirely by the marketplace you buy from (Amazon, Alibaba, AliExpress, eBay). Check each marketplace's policy before ordering.",
  },
  {
    question: "How can I earn money on the platform?",
    answer:
      "Register an account and complete task packages in your dashboard. Each package has a defined structure and payout. Track your earnings, deposits and withdrawals from the wallet section of your account.",
  },
  {
    question: "How do I know a discount is real?",
    answer:
      "We only surface deals where the compare (original) price is genuinely higher than the sale price, and we show the exact discount percentage on the card. A product is only listed in /deals when it carries a verified 5%+ discount.",
  },
];

export const ALL_FAQS: FaqItem[] = HOMEPAGE_FAQS;
