/**
 * Case Studies & Data Methodology for DealX Stocks.
 * STRICT REGULATORY COMPLIANCE: Absolutely ZERO fake metrics, fake client logos, or fabricated ROI claims.
 * Explains platform benchmarking methodology and clearly marks future seller case studies as "Coming Soon".
 */

export interface CaseStudyBenchmark {
  slug: string;
  title: string;
  category: string;
  summary: string;
  status: "Published Methodology" | "Coming Soon (Awaiting Verified Business Case Studies)";
  methodologyFocus: string[];
  metricsMeasured: string[];
  isVerifiedRealData: boolean;
}

export const CASE_STUDIES_DATA: CaseStudyBenchmark[] = [
  {
    slug: "deal-aggregation-efficiency-benchmark",
    title: "Marketplace Indexing & Deal Aggregation Performance Benchmark",
    category: "Technical Methodology",
    summary:
      "A technical analysis of how automated product feed indexing reduces price discovery time for shoppers across multi-platform e-commerce catalogs.",
    status: "Published Methodology",
    methodologyFocus: [
      "Catalog indexing speed across API endpoints",
      "Taxonomy mapping precision for consumer electronics and home goods",
      "Outbound referral link validation and error rate monitoring",
    ],
    metricsMeasured: [
      "Average catalog refresh latency",
      "Category classification accuracy percentage",
      "System link uptime reliability score",
    ],
    isVerifiedRealData: true,
  },
  {
    slug: "merchant-growth-case-studies",
    title: "Verified Merchant Growth & E-Commerce Case Studies",
    category: "Merchant Success",
    summary:
      "Future documented case studies evaluating merchant referral traffic, conversion rates, and cross-border discovery efficiency.",
    status: "Coming Soon (Awaiting Verified Business Case Studies)",
    methodologyFocus: [
      "Referral traffic attribution modeling",
      "Marketplace merchant visibility benchmarks",
    ],
    metricsMeasured: [
      "Verified click-through volume",
      "Conversion tracking compliance",
    ],
    isVerifiedRealData: false,
  },
];
