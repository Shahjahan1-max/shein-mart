/**
 * Legal page content definitions for DealX Stocks.
 * Real, readable, human-friendly legal copy adhering to e-commerce and affiliate guidelines.
 */

export interface LegalPageContent {
  slug: string;
  title: string;
  lastUpdated: string;
  metaDescription: string;
  sections: {
    heading: string;
    content: string[];
    bullets?: string[];
  }[];
}

export const LEGAL_PAGES: Record<string, LegalPageContent> = {
  "privacy-policy": {
    slug: "privacy-policy",
    title: "Privacy Policy",
    lastUpdated: "2026-08-08",
    metaDescription:
      "Understand how DealX Stocks collects, uses, and safeguards user data across our e-commerce deal aggregation and discovery services.",
    sections: [
      {
        heading: "1. Information We Collect",
        content: [
          "DealX Stocks respects user privacy. We collect minimal technical data necessary to operate, maintain, and optimize our platform.",
          "Data collected includes standard server log files (IP addresses, browser type, operating system, timestamp, referring URL) and user interaction data on catalog pages.",
        ],
        bullets: [
          "Log Data: IP address, browser headers, referring pages.",
          "Usage Data: Pages visited, click-through paths to destination marketplaces.",
          "Contact Data: Email address and query content provided voluntarily via support channels.",
        ],
      },
      {
        heading: "2. How We Use Information",
        content: [
          "We use collected information strictly to evaluate platform performance, prevent abuse, optimize catalog aggregation algorithms, and respond to user inquiry tickets.",
          "We do NOT sell, rent, or trade personal identification data to third-party marketing companies.",
        ],
      },
      {
        heading: "3. Cookies and Tracking Technologies",
        content: [
          "DealX Stocks uses functional cookies and browser local storage to maintain session states, dark/light theme preferences, and navigational history.",
          "External e-commerce platforms linked from our website (e.g. Amazon, Alibaba, AliExpress, eBay) may use their own cookies when you visit their destinations.",
        ],
      },
      {
        heading: "4. Third-Party Marketplace Links",
        content: [
          "Our service contains links to third-party e-commerce sites. If you click on a third-party link, you will be directed to that site.",
          "We strongly advise you to review the Privacy Policy of every site you visit. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites or services.",
        ],
      },
      {
        heading: "5. Data Security & Contact",
        content: [
          "We employ standard HTTPS encryption and access control security protocols to safeguard user data.",
          "For privacy inquiries, data deletion requests, or questions regarding this policy, please contact privacy@dealstocks.com.",
        ],
      },
    ],
  },
  "terms-of-service": {
    slug: "terms-of-service",
    title: "Terms of Service",
    lastUpdated: "2026-08-08",
    metaDescription:
      "Terms and conditions governing the use of DealX Stocks deal aggregation and product discovery platform.",
    sections: [
      {
        heading: "1. Acceptance of Terms",
        content: [
          "By accessing or using DealX Stocks (dealxstocks.com), you agree to be bound by these Terms of Service and all applicable laws and regulations.",
          "If you do not agree with any part of these terms, you are prohibited from using or accessing this platform.",
        ],
      },
      {
        heading: "2. Nature of Service",
        content: [
          "DealX Stocks operates exclusively as an online deal aggregator, product discovery engine, and e-commerce resource platform.",
          "DealX Stocks is NOT a seller, retailer, distributor, or manufacturer of any physical products listed on the platform.",
        ],
        bullets: [
          "Transactions: All purchases occur on third-party marketplace websites.",
          "Pricing: Listed prices are subject to real-time changes on target marketplaces.",
          "Product Fulfillment: Order shipping, warranties, and returns are handled solely by the originating vendor.",
        ],
      },
      {
        heading: "3. Intellectual Property Rights",
        content: [
          "All proprietary code, branding, layouts, logos, and original written content on DealX Stocks are the property of DealX Stocks Ltd.",
          "Product names, trademarks, brand logos, and external listing images referenced on this site belong to their respective trademark owners.",
        ],
      },
      {
        heading: "4. User Conduct and Abuse Prevention",
        content: [
          "Users agree not to engage in scraping, automated data harvesting, denial-of-service attacks, or malicious disruption of the DealX Stocks platform.",
        ],
      },
      {
        heading: "5. Limitation of Liability",
        content: [
          "In no event shall DealX Stocks or its affiliates be liable for any damages arising out of the use or inability to use the materials on DealX Stocks, even if notified orally or in writing of the possibility of such damage.",
        ],
      },
    ],
  },
  "cookie-policy": {
    slug: "cookie-policy",
    title: "Cookie Policy",
    lastUpdated: "2026-08-08",
    metaDescription:
      "Learn about the cookies and local storage technology used on DealX Stocks to enhance user experience.",
    sections: [
      {
        heading: "1. What Are Cookies?",
        content: [
          "Cookies are small text files placed on your browser or device when you visit a website. They help the website recognize your device and store user settings.",
        ],
      },
      {
        heading: "2. How DealX Stocks Uses Cookies",
        content: [
          "We use essential cookies and browser storage for:",
        ],
        bullets: [
          "Essential Functionality: Remembering user preferences, theme choices, and language settings.",
          "Security: Protecting user sessions and preventing fraudulent activity.",
          "Performance Analytics: Measuring aggregate page load speed and site usability.",
        ],
      },
      {
        heading: "3. Managing Cookie Preferences",
        content: [
          "You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, some portions of our service may not function properly.",
        ],
      },
    ],
  },
  "disclaimer": {
    slug: "disclaimer",
    title: "General Disclaimer",
    lastUpdated: "2026-08-08",
    metaDescription:
      "General legal disclaimer regarding product pricing, deal availability, third-party marketplaces, and site content on DealX Stocks.",
    sections: [
      {
        heading: "1. Information Accuracy Disclaimer",
        content: [
          "The information provided on DealX Stocks is for general informational and shopping research purposes only.",
          "While we strive to maintain accurate deal pricing, merchant details, and product descriptions, e-commerce marketplace prices fluctuate rapidly. We cannot guarantee that product pricing or stock availability displayed on DealX Stocks will remain identical when you visit the seller's marketplace listing.",
        ],
      },
      {
        heading: "2. No Direct Sales or Guarantees",
        content: [
          "DealX Stocks does not sell, ship, warrant, or guarantee any products.",
          "Any purchase made by following external marketplace links is strictly between you and the third-party merchant. We recommend reviewing merchant ratings and return policies before completing a transaction.",
        ],
      },
    ],
  },
  "affiliate-disclosure": {
    slug: "affiliate-disclosure",
    title: "Affiliate & Advertising Disclosure",
    lastUpdated: "2026-08-08",
    metaDescription:
      "Full disclosure of affiliate relationships, commission structures, and monetization transparency on DealX Stocks.",
    sections: [
      {
        heading: "1. FTC Affiliate Disclosure Compliance",
        content: [
          "DealX Stocks participates in affiliate marketing programs. Some of the outbound links on product deal pages, comparison tables, and buying guides are referral/affiliate links.",
          "If you click an affiliate link and make a purchase on a destination marketplace (such as Amazon, Alibaba, AliExpress, or eBay), DealX Stocks may receive a small referral commission at NO extra cost to you.",
        ],
      },
      {
        heading: "2. How Commission Impacts Our Content",
        content: [
          "Our editorial recommendations, deal listings, and category rankings are driven by price evaluation, product relevance, and objective marketplace metrics — NOT by commission rates.",
          "We never publish fake reviews, fabricated ratings, or inflated price savings to trick users into clicking affiliate links.",
        ],
      },
    ],
  },
  "marketplace-disclosure": {
    slug: "marketplace-disclosure",
    title: "Marketplace Independence Disclosure",
    lastUpdated: "2026-08-08",
    metaDescription:
      "Clarification of DealX Stocks' independent status and relationship with Amazon, Alibaba, AliExpress, eBay, and other e-commerce platforms.",
    sections: [
      {
        heading: "1. Platform Independence",
        content: [
          "DealX Stocks is an independent deal aggregation platform.",
          "DealX Stocks is NOT owned by, operated by, affiliated with, sponsored by, or officially endorsed by Amazon.com, Inc., Alibaba Group Holding Ltd., AliExpress.com, eBay Inc., or any of their parent companies or subsidiaries.",
        ],
      },
      {
        heading: "2. Trademark Attribution",
        content: [
          "Amazon, Alibaba, AliExpress, eBay, and all associated logos, brand names, and product titles are registered trademarks of their respective copyright holders.",
          "Their inclusion on DealX Stocks is solely for descriptive and comparison purposes.",
        ],
      },
    ],
  },
  "data-accuracy": {
    slug: "data-accuracy",
    title: "Data Accuracy & Pricing Policy",
    lastUpdated: "2026-08-08",
    metaDescription:
      "Learn how DealX Stocks collects, updates, and verifies deal pricing, product specifications, and marketplace links.",
    sections: [
      {
        heading: "1. Deal Refresh & Verification Frequency",
        content: [
          "Product prices, discount percentages, and seller listings are indexed from public marketplace datasets and updated periodically.",
          "Because external merchants update prices dynamically based on stock levels and flash sales, price differences may occasionally occur between DealX Stocks and the destination website.",
        ],
      },
      {
        heading: "2. Reporting Price Discrepancies",
        content: [
          "We encourage users to report any expired deals or inaccurate pricing. You can submit a report via our Report Issue page (/report-issue) or contact support@dealstocks.com.",
        ],
      },
    ],
  },
};
