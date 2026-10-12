/**
 * Trust & Transparency Framework Data for DealX Stocks.
 * Fact-based content definitions for Methodology, Data Sources, Trust Center, Transparency, Editorial Policy, Press, Careers, Support, Report Issue, Feedback.
 */

export interface TrustFrameworkSection {
  id: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  metaDescription: string;
  overview: string[];
  keyPrinciples: { title: string; detail: string }[];
  faqs: { question: string; answer: string }[];
}

export const TRUST_FRAMEWORK: Record<string, TrustFrameworkSection> = {
  methodology: {
    id: "methodology",
    title: "Platform Methodology & Deal Aggregation Standards",
    subtitle: "How DealX Stocks evaluates, indexes, categorizes, and updates e-commerce deals.",
    lastUpdated: "2026-08-08",
    metaDescription:
      "Explore the rigorous technical methodology used by DealX Stocks to aggregate e-commerce listings, verify discounts, and maintain data integrity.",
    overview: [
      "DealX Stocks follows a systematic, technology-driven methodology to collect, structure, and display deal information from global e-commerce platforms.",
      "Our goal is to provide shoppers with an objective, transparent window into available deals across major online marketplaces without manufacturing false savings or subjective hype.",
    ],
    keyPrinciples: [
      {
        title: "1. Data Normalization",
        detail:
          "Product feeds from disparate marketplaces are standardized into uniform fields: title, category, price, list price, seller rating, and direct marketplace URL.",
      },
      {
        title: "2. Objective Price Calculation",
        detail:
          "Discounts are calculated against recent verifiable list prices. We do not invent arbitrary original prices to fabricate higher savings percentages.",
      },
      {
        title: "3. Outbound Link Integrity",
        detail:
          "All external links lead directly to official product listings on destination merchant websites (Amazon, Alibaba, AliExpress, eBay).",
      },
      {
        title: "4. Continuous Catalog Auditing",
        detail:
          "Automated link checks and community issue reports identify out-of-stock items or expired promotions for rapid catalog updates.",
      },
    ],
    faqs: [
      {
        question: "Does DealX Stocks manually test every physical product?",
        answer: "No. DealX Stocks is a deal aggregation platform that indexes digital product data, user ratings, and pricing specs across major platforms.",
      },
      {
        question: "How are promotional deals selected for featured sections?",
        answer: "Deals are featured based on objective factors: verified discount depth, seller reputation rating, product popularity, and catalog category balance.",
      },
    ],
  },
  "data-sources": {
    id: "data-sources",
    title: "Data Sources & Aggregation Transparency",
    subtitle: "Where DealX Stocks product listings come from and how data freshness is maintained.",
    lastUpdated: "2026-08-08",
    metaDescription:
      "Understand the public data sources, affiliate networks, and marketplace API connections powering DealX Stocks.",
    overview: [
      "DealX Stocks relies exclusively on legitimate, public data sources to build its deal index.",
      "We source information directly from e-commerce marketplace APIs, official affiliate program feeds, seller catalog exports, and public web indexes.",
    ],
    keyPrinciples: [
      {
        title: "Amazon Associates & API",
        detail: "Public item metadata, pricing information, and product detail images for Amazon listings.",
      },
      {
        title: "Alibaba B2B Feed & Trade Directory",
        detail: "Wholesale category data, minimum order quantities (MOQ), and manufacturer directory profiles.",
      },
      {
        title: "AliExpress Portals API",
        detail: "Direct manufacturer deal listings, Choice promotion feeds, and global shipping attributes.",
      },
      {
        title: "eBay Partner Network (EPN)",
        detail: "Daily deal listings, brand outlet inventory, and certified refurbished catalog feeds.",
      },
    ],
    faqs: [
      {
        question: "Do you harvest private seller or user data?",
        answer: "No. DealX Stocks indexes public product listings only. We never access private customer account information or internal merchant seller databases.",
      },
    ],
  },
  trust: {
    id: "trust",
    title: "DealX Stocks Trust Center",
    subtitle: "Our commitment to safety, transparency, anti-scam protection, and data accuracy.",
    lastUpdated: "2026-08-08",
    metaDescription:
      "Discover the trust standards, anti-scam safeguards, and privacy controls implemented at DealX Stocks.",
    overview: [
      "Building user trust is the foundation of DealX Stocks. As an independent deal discovery platform, we prioritize radical transparency over aggressive marketing.",
      "We strictly adhere to FTC disclosure guidelines, Google E-E-A-T standards, and anti-scam web policies.",
    ],
    keyPrinciples: [
      {
        title: "Zero Fake Reviews Policy",
        detail: "We never manufacture artificial customer reviews, fake star ratings, or inflated user testimonials.",
      },
      {
        title: "Transparent Affiliate Attribution",
        detail: "All affiliate links are clearly disclosed so users understand how the platform sustains free operations.",
      },
      {
        title: "No Direct Payment Processing",
        detail: "Because payments occur on established external merchants, your credit card and financial data remain safe with official marketplace checkout systems.",
      },
      {
        title: "Community Reporting Infrastructure",
        detail: "Users can report incorrect pricing or suspect listings 24/7 for swift review and removal.",
      },
    ],
    faqs: [
      {
        question: "Is DealX Stocks a safe website?",
        answer: "Yes. DealX Stocks uses HTTPS SSL encryption, contains no malware, and links directly to verified global e-commerce portals.",
      },
    ],
  },
  transparency: {
    id: "transparency",
    title: "Transparency & Governance Disclosures",
    subtitle: "Full disclosure of business operations, monetization, and ownership principles.",
    lastUpdated: "2026-08-08",
    metaDescription:
      "Review DealX Stocks' business model, affiliate monetization structure, and governance policies.",
    overview: [
      "We believe digital consumers deserve total clarity regarding how free web tools generate revenue.",
      "DealX Stocks operates on a transparent referral business model. Below is an exhaustive breakdown of our operational practices.",
    ],
    keyPrinciples: [
      {
        title: "Affiliate Commissions",
        detail: "When shoppers purchase products after clicking a DealX Stocks link, destination merchants pay us a small referral percentage. The price you pay is identical.",
      },
      {
        title: "Editorial Independence",
        detail: "Commission rates do not dictate product ranking. Products are ordered by category relevance, discount depth, and user popularity.",
      },
      {
        title: "Marketplace Independence",
        detail: "DealX Stocks is not owned or operated by Amazon, Alibaba, AliExpress, or eBay.",
      },
    ],
    faqs: [
      {
        question: "Does clicking an affiliate link cost me extra money?",
        answer: "No. Product prices remain exactly the same whether you visit the merchant directly or click through DealX Stocks.",
      },
    ],
  },
  "editorial-policy": {
    id: "editorial-policy",
    title: "Editorial & Content Quality Standards",
    subtitle: "How our guides, reviews, and shopping playbooks are written and verified.",
    lastUpdated: "2026-08-08",
    metaDescription:
      "Read DealX Stocks' editorial policy regarding content creation, factual verification, updates, and author accountability.",
    overview: [
      "Our editorial content is crafted to help consumers navigate complex e-commerce marketplaces with confidence.",
      "Every buying guide, comparison chart, and methodology article undergoes strict factual review before publication.",
    ],
    keyPrinciples: [
      {
        title: "Fact-Based Research",
        detail: "Articles cite documented marketplace policies, verified specs, and official platform documentation.",
      },
      {
        title: "Regular Content Revisions",
        detail: "Guides are updated periodically to ensure recommendations reflect current e-commerce rules and pricing realities.",
      },
      {
        title: "Clear Corrections Policy",
        detail: "If an error or outdated claim is discovered, we promptly update the text with clear modification timestamps.",
      },
    ],
    faqs: [
      {
        question: "Who writes DealX Stocks shopping guides?",
        answer: "Guides are authored by experienced e-commerce research specialists and reviewed by our senior technical editorial team.",
      },
    ],
  },
  press: {
    id: "press",
    title: "Press & Media Center",
    subtitle: "Official media kit, brand assets, press releases, and inquiry contacts.",
    lastUpdated: "2026-08-08",
    metaDescription:
      "Official press resources, news releases, brand guidelines, and media contact channels for DealX Stocks.",
    overview: [
      "Welcome to the DealX Stocks Press Center. Journalists, industry analysts, and media creators can find official facts, brand guidelines, and contact channels here.",
    ],
    keyPrinciples: [
      {
        title: "Brand Name Usage",
        detail: "The official brand name is formatted as 'DealX Stocks' (with space between DealX and Stocks).",
      },
      {
        title: "Core Elevator Pitch",
        detail: "DealX Stocks is an independent global deal aggregation and e-commerce product discovery platform indexing offers across Amazon, Alibaba, AliExpress, and eBay.",
      },
      {
        title: "Media Inquiries",
        detail: "For interview requests, platform commentary, or media kit assets, contact press@dealstocks.com.",
      },
    ],
    faqs: [
      {
        question: "Where can I download high-resolution DealX Stocks logos?",
        answer: "Media kit graphics and vector SVG brand logos can be requested via press@dealstocks.com.",
      },
    ],
  },
  careers: {
    id: "careers",
    title: "Careers at DealX Stocks",
    subtitle: "Build the future of transparent global e-commerce deal aggregation.",
    lastUpdated: "2026-08-08",
    metaDescription:
      "Explore career opportunities, remote engineering roles, and team values at DealX Stocks.",
    overview: [
      "At DealX Stocks, we are building technology that helps global shoppers discover verified deals and make smarter e-commerce purchasing decisions.",
      "We operate as a distributed, remote-first team committed to code quality, data integrity, and user trust.",
    ],
    keyPrinciples: [
      {
        title: "Remote First Culture",
        detail: "Flexible working hours with team members collaborating across global time zones.",
      },
      {
        title: "Engineering Excellence",
        detail: "We value clean TypeScript, performant Web APIs, automated testing, and sound architecture.",
      },
      {
        title: "User Trust Focus",
        detail: "We prioritize user privacy, transparent disclosures, and data accuracy above short-term growth hacks.",
      },
    ],
    faqs: [
      {
        question: "How do I apply for open positions at DealX Stocks?",
        answer: "Review active postings or submit your resume and GitHub profile directly to careers@dealstocks.com.",
      },
    ],
  },
};
