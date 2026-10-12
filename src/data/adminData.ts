export const SUSPENSION_APPEAL_SUBJECT = "Account suspended - appeal";

export type UserStatus = "active" | "suspended" | "pending";
export type TxStatus = "pending" | "approved" | "rejected" | "completed";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type OrderStatus = "pending" | "assigned" | "in_progress" | "completed" | "reassignment_requested";

export interface OrderRecord {
  [key: string]: unknown;
  id: string;
  userId: string;
  userName: string;
  platformId: string;
  platformName: string;
  status: OrderStatus;
  createdAt: string;
  assignedAt?: string;
  completedAt?: string;
  previousAdCodeId?: string;
  isDeclinedReassignment?: boolean;
  declinedAt?: string;
  declineReason?: string;
  movedFromPlatform?: string;
  movedFromPlatformName?: string;
  requestedPlatform?: string;
  requestedPlatformName?: string;
  commissionRate?: number;
  requiredTasks?: number;
  totalTasks?: number;
}

export interface AdminUserRecord {
  [key: string]: unknown;
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  balance: number;
  earnings: number;
  referrals: number;
  referralCode: string;
  referredBy?: string;
  referredByUserId?: string;
  status: UserStatus;
  registeredAt: string;
  lastActive: string;
}

export interface DepositRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  protocol: string;
  txHash: string;
  date: string;
  status: TxStatus;
}

export interface WithdrawalRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  protocol: string;
  walletAddress: string;
  date: string;
  status: TxStatus;
  note?: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
  date: string;
  status: TicketStatus;
  reply?: string;
  type?: "general" | "appeal" | "extra_task" | "wallet_change";
  walletChange?: {
    currentWallet?: string;
    requestedWallet?: string;
    protocol?: string;
    status?: "pending" | "approved" | "rejected";
  };
  is_deleted?: boolean;
  user_deleted?: boolean;
}

export interface ExtraTaskApproval {
  approved: boolean;
  rejected: boolean;
  limit: number;
  requestedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
}

export interface WalletConfig {
  id: string;
  label: string;
  network: string;
  address: string;
  qrImage?: string;
}

export interface ContactChannel {
  id: string;
  platform: "Telegram" | "Email" | "WhatsApp" | "Other";
  title: string;
  link: string;
  enabled: boolean;
}

export interface PlatformSettings {
  siteName: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  requireReferralCodeOnSignup?: boolean;
  depositEnabled: boolean;
  withdrawalEnabled: boolean;
  withdrawalRequiresCompletedTasks?: boolean;
  requiredCompletedTasksCount?: number;
  depositProofRequired?: boolean;
  minDepositAmount: number;
  minWithdrawalAmount: number;
  referralBonus: number;
  referralLevel1Threshold?: number;
  referralLevel2Threshold?: number;
  referralLevel3Threshold?: number;
  welcomeBonusEnabled: boolean;
  welcomeBonusAmount: number;
  telegramSupport: string;
  emailSupport: string;
  announcementText: string;
  announcementEnabled: boolean;
  companyLogo: string;
  companyEmail: string;
  showLiveChat: boolean;
  showSupportEmail: boolean;
  showLanguageToggle: boolean;
  brandStripVisible: boolean;
  brandStripItems: { amazon: boolean; alibaba: boolean; aliexpress: boolean; ebay: boolean };
  extraTaskEnabled: boolean;
  platformAdCodes: { amazon: string; alibaba: string; aliexpress: string };
  amazonMinTaskBalance: number;
  amazonMinBalanceRequired: boolean;
  wallets: WalletConfig[];
  contacts: ContactChannel[];
  depositQr: string;
  loaderEnabled: boolean;
  loaderColor: string;
  loaderSize: "small" | "medium" | "large";
  loaderText: string;
  loaderTextColor: string;
  withdrawalTaxEnabled: boolean;
  withdrawalTaxType: "fixed" | "percentage";
  withdrawalTaxValue: number;
  depositBonusEnabled: boolean;
  depositBonusType: "fixed" | "percentage";
  depositBonusValue: number;
  adminDefaultTheme: "light" | "dark" | "system";
  userDefaultTheme: "light" | "dark" | "system";
  defaultViewMode?: "desktop" | "mobile";
  bandSwitchingEnabled: boolean;
  amazonBandMax: number;
  alibabaBandMin: number;
  alibabaBandMax: number;
  aliexpressBandMin: number;
  amazonCommissionRate: number;
  alibabaCommissionRate: number;
  aliexpressCommissionRate: number;
  showImpersonationBanner: boolean;
  panelTheme?: "default" | "ocean" | "forest" | "sunset" | "ruby";
  siteFavicon?: string;
  withdrawQr?: string;
  platformLogos?: Record<string, string>;
  /** When true, the Cloud Service Alert banner is shown on all pages. Super Admin only. */
  firebaseAlertEnabled?: boolean;
}

export interface ImpersonationSession {
  id: string;
  adminId: string;
  adminUsername: string;
  userId: string;
  userName: string;
  userEmail: string;
  startedAt: string;
  expiresAt: string;
  endedAt?: string | null;
  revoked?: boolean;
}

export type AuditAction =
  | "IMPERSONATE_START"
  | "IMPERSONATE_END"
  | "TICKET_DELETE_ADMIN"
  | "TICKET_DELETE_ON_BEHALF";

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminUsername: string;
  userId: string;
  userName: string;
  action: AuditAction;
  meta?: Record<string, string>;
  timestamp: string;
}

export interface ExtraTask {
  id: string;
  title: string;
  description: string;
  reward: number;
  status: "active" | "inactive";
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  siteName: "DealX Stocks",
  maintenanceMode: false,
  registrationEnabled: true,
  requireReferralCodeOnSignup: false,
  depositEnabled: true,
  depositProofRequired: true,
  withdrawalEnabled: true,
  withdrawalRequiresCompletedTasks: true,
  requiredCompletedTasksCount: 25,
  minDepositAmount: 10,
  minWithdrawalAmount: 20,
  referralBonus: 5,
  referralLevel1Threshold: 10000,
  referralLevel2Threshold: 20000,
  referralLevel3Threshold: 50000,
  welcomeBonusEnabled: false,
  welcomeBonusAmount: 0,
  telegramSupport: "https://t.me/customerservice_160",
  emailSupport: "support@dealstocks.com",
  announcementText: "Welcome to DealX Stocks - your global earning platform!",
  announcementEnabled: true,
  companyLogo: "",
  companyEmail: "support@dealstocks.com",
  showLiveChat: true,
  showSupportEmail: true,
  showLanguageToggle: true,
  brandStripVisible: true,
  brandStripItems: { amazon: true, alibaba: true, aliexpress: true, ebay: true },
  extraTaskEnabled: false,
  platformAdCodes: { amazon: "", alibaba: "", aliexpress: "" },
  amazonMinTaskBalance: 20,
  amazonMinBalanceRequired: true,
  wallets: [],
  contacts: [
    { id: "c1", platform: "Telegram", title: "Live Chat", link: "https://t.me/customerservice_160", enabled: true },
    { id: "c2", platform: "Email", title: "Email Support", link: "support@dealstocks.com", enabled: true },
  ],
  depositQr: "",
  loaderEnabled: true,
  loaderColor: "#2cd136",
  loaderSize: "medium",
  loaderText: "Earn & Invest be a Enterprenuer",
  loaderTextColor: "",
  withdrawalTaxEnabled: false,
  withdrawalTaxType: "fixed",
  withdrawalTaxValue: 0,
  depositBonusEnabled: false,
  depositBonusType: "fixed",
  depositBonusValue: 0,
  adminDefaultTheme: "light",
  userDefaultTheme: "light",
  defaultViewMode: "desktop",
  bandSwitchingEnabled: true,
  amazonBandMax: 499,
  alibabaBandMin: 500,
  alibabaBandMax: 899,
  aliexpressBandMin: 900,
  amazonCommissionRate: 4,
  alibabaCommissionRate: 8,
  aliexpressCommissionRate: 12,
  showImpersonationBanner: false,
  panelTheme: "default",
  siteFavicon: "",
  withdrawQr: "",
  platformLogos: {},
  firebaseAlertEnabled: false,
};

export function computeWithdrawalTax(amount: number, settings: PlatformSettings): number {
  if (!settings.withdrawalTaxEnabled || settings.withdrawalTaxValue <= 0) return 0;
  if (settings.withdrawalTaxType === "percentage") {
    return Math.min(amount, parseFloat(((amount * settings.withdrawalTaxValue) / 100).toFixed(2)));
  }
  return Math.min(amount, settings.withdrawalTaxValue);
}

export function computeDepositBonus(amount: number, settings: PlatformSettings): number {
  if (!settings.depositBonusEnabled || settings.depositBonusValue <= 0) return 0;
  if (settings.depositBonusType === "percentage") {
    return parseFloat(((amount * settings.depositBonusValue) / 100).toFixed(2));
  }
  return settings.depositBonusValue;
}

export const SEED_USERS: AdminUserRecord[] = [];
export const SEED_DEPOSITS: DepositRecord[] = [];
export const SEED_WITHDRAWALS: WithdrawalRecord[] = [];
export const SEED_TICKETS: SupportTicket[] = [];

export function loadAllOrders(): OrderRecord[] { return []; }
export function saveAllOrders(): void {}
export function getUserPlatformOrder(): OrderRecord | null { return null; }
export function createPendingOrder(userId: string, userName: string, platformId: string, platformName: string): OrderRecord {
  return { id: `ord-${Date.now()}`, userId, userName, platformId, platformName, status: "pending", createdAt: new Date().toISOString() };
}
export function updateOrderStatus(): void {}
export function assignOrder(): void {}
export function createReassignmentRequest(userId: string, userName: string, platformId: string, platformName: string, previousAdCodeId: string | null): OrderRecord {
  return { id: `req-${Date.now()}`, userId, userName, platformId, platformName, status: "reassignment_requested", createdAt: new Date().toISOString(), previousAdCodeId: previousAdCodeId ?? undefined };
}
export function resetPlatformProgress(): void {}
export function declineReassignmentRequest(): void {}
export function approveReassignmentRequest(): OrderRecord | null { return null; }
export function loadExtraTaskApproval(): ExtraTaskApproval { return { approved: false, rejected: false, limit: 10 }; }
export function saveExtraTaskApproval(): void {}
export function loadImpersonationSessions(): ImpersonationSession[] { return []; }
export function createImpersonationSession(adminId: string, adminUsername: string, userId: string, userName: string, userEmail: string): ImpersonationSession {
  const now = new Date();
  return { id: `imp-${Date.now()}`, adminId, adminUsername, userId, userName, userEmail, startedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString() };
}
export function endImpersonationSession(): void {}
export function isImpersonationValid(session: ImpersonationSession): boolean {
  return !session.revoked && !session.endedAt && new Date(session.expiresAt) > new Date();
}
export function loadAuditLogs(): AdminAuditLog[] { return []; }
export function appendAuditLog(): void {}
export function loadExtraTasks(): ExtraTask[] { return []; }
export function saveExtraTasks(): void {}
export function seedExtraTasksIfEmpty(): void {}
export function createExtraTask(data: Omit<ExtraTask, "id" | "createdAt" | "updatedAt">): ExtraTask {
  const now = new Date().toISOString();
  return { ...data, id: `et-${Date.now()}`, createdAt: now, updatedAt: now };
}
export function updateExtraTask(): void {}
export function deleteExtraTask(): void {}
export function assignExtraTask(): void {}
export function getExtraTasksForUser(): ExtraTask[] { return []; }
export function countPendingOrders(): number { return 0; }
export function countPendingTransactions(): number { return 0; }
export function countOpenTickets(): number { return 0; }
export function countPendingScheduled(): number { return 0; }
export function countPendingExtraTaskRequests(): number { return 0; }
export function countPendingNextTaskRequests(): number { return 0; }
export function loadAdminSettings(): PlatformSettings { return { ...DEFAULT_SETTINGS }; }
export function saveAdminSettings(): void {}
export function patchAdminSettings(): void {}
export function getActivePlatformId(balance: number): string {
  if (balance >= DEFAULT_SETTINGS.aliexpressBandMin) return "aliexpress";
  if (balance >= DEFAULT_SETTINGS.alibabaBandMin) return "alibaba";
  return "amazon";
}
export function getPersistedActivePlatform(_userId: string, balance: number): string { return getActivePlatformId(balance); }
export function getPlatformCommissionRate(platformId: string, fallback = 4): number {
  if (platformId === "amazon") return DEFAULT_SETTINGS.amazonCommissionRate;
  if (platformId === "alibaba") return DEFAULT_SETTINGS.alibabaCommissionRate;
  if (platformId === "aliexpress") return DEFAULT_SETTINGS.aliexpressCommissionRate;
  return fallback;
}
export function movePlatformOrder(): void {}
export function getMovedAwayOrder(): OrderRecord | null { return null; }
export function getActiveOrderOnOtherPlatform(): OrderRecord | null { return null; }
export function getPlatformAccess(user: { balance: number }, platformId: string): boolean {
  return getActivePlatformId(user.balance) === platformId;
}
export function checkAndPersistUnlocks(): void {}
