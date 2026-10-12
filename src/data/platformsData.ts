// TODO: [BACKEND] Replace with API call: GET /api/platforms
// Admin controls this data from the admin panel > Platforms screen

export type VipLevel = 1 | 2 | 3;

export interface Platform {
  id: string;
  name: string;
  logo: "amazon" | "alibaba" | "aliexpress";
  vipLevel: VipLevel;
  balanceMin: number;
  balanceMax: number | null;
  commission: number;
  description: string;
  isActive: boolean;
  // Task stats — per-user, eventually from API
  todayTime: number;
  totalCommission: string;
  cashGap: string;
  yesterdayBuyCommission: string;
  yesterdayTeamCommission: string;
}

export const PLATFORMS_DATA: Platform[] = [
  {
    id: "amazon",
    name: "Amazon",
    logo: "amazon",
    vipLevel: 1,
    balanceMin: 20,
    balanceMax: 499,
    commission: 4,
    description: "Start with basic product orders and earn entry-level commissions on Amazon's global marketplace.",
    isActive: true,
    todayTime: 0,
    totalCommission: "0.00",
    cashGap: "0",
    yesterdayBuyCommission: "0",
    yesterdayTeamCommission: "0",
  },
  {
    id: "alibaba",
    name: "Alibaba",
    logo: "alibaba",
    vipLevel: 2,
    balanceMin: 500,
    balanceMax: 899,
    commission: 8,
    description: "Unlock higher commissions with Alibaba's wholesale marketplace for sourcing and bulk orders.",
    isActive: true,
    todayTime: 0,
    totalCommission: "0.00",
    cashGap: "0",
    yesterdayBuyCommission: "0",
    yesterdayTeamCommission: "0",
  },
  {
    id: "aliexpress",
    name: "AliExpress",
    logo: "aliexpress",
    vipLevel: 3,
    balanceMin: 900,
    balanceMax: null,
    commission: 12,
    description: "Elite-tier commissions for top members on AliExpress's cross-border retail platform.",
    isActive: true,
    todayTime: 0,
    totalCommission: "0.00",
    cashGap: "0",
    yesterdayBuyCommission: "0",
    yesterdayTeamCommission: "0",
  },
];
