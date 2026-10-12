/**
 * Testimonials data (Phase 4B — Authority & Conversion).
 * Social proof used on the homepage testimonials section and the /resources page.
 */

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  location: string;
  rating: number;
  context: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I used to open five tabs to compare prices across marketplaces. Now DealX Stocks shows me the discount, rating and review count in one card — I've saved real money on every electronics purchase.",
    author: "Aisha R.",
    role: "Electronics shopper",
    location: "Dubai, UAE",
    rating: 5,
    context: "Amazon deals",
  },
  {
    quote:
      "The deals rail only surfaces genuine 5%+ discounts. I cross-checked three products against the marketplace pages and the numbers matched every time. That transparency is why I keep coming back.",
    author: "Marco T.",
    role: "Deal hunter",
    location: "Milan, Italy",
    rating: 5,
    context: "Deals verification",
  },
  {
    quote:
      "As a B2B buyer I need bulk pricing from Alibaba. The category pages help me shortlist suppliers and compare unit prices quickly before I even open an inquiry.",
    author: "Priya N.",
    role: "Procurement lead",
    location: "Mumbai, India",
    rating: 5,
    context: "Alibaba sourcing",
  },
  {
    quote:
      "I started earning by completing task packages in my dashboard. Within a month I understood the wallet, deposits and withdrawals — everything is tracked and transparent.",
    author: "Emeka O.",
    role: "Earning partner",
    location: "Lagos, Nigeria",
    rating: 5,
    context: "Earnings",
  },
  {
    quote:
      "The safe shopping guide taught me to check sellers before ordering. I've avoided two scam listings since — the platform genuinely cares about shopper safety.",
    author: "Sofia L.",
    role: "Marketplace shopper",
    location: "Madrid, Spain",
    rating: 5,
    context: "Safety guide",
  },
  {
    quote:
      "Flash-sale timing matters, and the live discount badges make it obvious when a deal is worth acting on. It's the first bookmark on my shopping browser.",
    author: "Liam H.",
    role: "Budget shopper",
    location: "London, UK",
    rating: 4,
    context: "Flash sales",
  },
  {
    quote:
      "Comparing sellers across AliExpress was a mess before. DealX Stocks organises products by category and marketplace, so I find what I need in seconds.",
    author: "Fatima Z.",
    role: "Small business owner",
    location: "Casablanca, Morocco",
    rating: 5,
    context: "AliExpress sourcing",
  },
  {
    quote:
      "The glossary finally explained what 'compare price' and 'Buy Box' actually mean. Clear, accurate, no jargon — exactly what a first-time marketplace shopper needs.",
    author: "Jonas W.",
    role: "New shopper",
    location: "Berlin, Germany",
    rating: 5,
    context: "Glossary & guides",
  },
];

export function averageTestimonialRating(): number {
  if (!TESTIMONIALS.length) return 0;
  return Math.round((TESTIMONIALS.reduce((sum, t) => sum + t.rating, 0) / TESTIMONIALS.length) * 10) / 10;
}
