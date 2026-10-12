import seedData from "./packages.json";

export interface PackageTask {
  id: string;
  taskIndex: number;
  title: string;
  category: string;
  description: string;
  image: string;
  orderAmount: number;
  commission: number;
  expectedIncome: number;
  currency: string;
  status: string;
  actionLabel: string;
  productCode: string;
}

export interface AdPackage {
  code: number;
  slug: string;
  title: string;
  type: string;
  deposit: number;
  currency: string;
  taskCount: number;
  status: string;
  isFree: boolean;
  isUnlimited: boolean;
  baseReward: number;
  description: string;
  tags: string[];
  tasks: PackageTask[];
}

export const PACKAGES: AdPackage[] = (seedData as any).packages as AdPackage[];

export function getPackageByCode(code: string | number): AdPackage | undefined {
  return PACKAGES.find(p => String(p.code) === String(code));
}

// Package series groupings
export const SERIES: Record<string, number[]> = {
  "300": [301, 302, 303, 304],
  "400": [401, 402, 403, 404],
  "500": [501, 502, 503, 504],
  "600": [601, 602, 603, 604],
  "700": [701, 702, 703, 704],
};

export function isKillMode(pkg: AdPackage): boolean {
  return pkg.isUnlimited || String(pkg.code).endsWith("4");
}

export function getTierLabel(code: number): string {
  if (code < 400) return "Starter";
  if (code < 500) return "Silver";
  if (code < 600) return "Gold";
  if (code < 700) return "Diamond";
  return "Elite";
}

export function getTierColor(code: number): string {
  if (code < 400) return "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-300";
  if (code < 500) return "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300";
  if (code < 600) return "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-300";
  if (code < 700) return "text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-300";
  return "text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-300";
}
