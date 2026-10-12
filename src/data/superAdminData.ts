import type {
  SuperAdminRole,
  RoleDefinition,
  Permission,
  PlatformSettings,
  FeatureFlag,
  MarketplaceConfig,
  SEOServiceConfig,
  AuditLogEntry,
  SuperAdminUser,
} from "../types/super-admin";

/* ─── Role Registry ──────────────────────────────────────────────── */

export const ROLE_DEFINITIONS: Record<SuperAdminRole, RoleDefinition> = {
  super_admin: {
    id: "super_admin",
    name: "Super Admin",
    description: "Full platform control: configuration, governance, security, and all modules.",
    permissions: [
      "users.view", "users.edit", "users.delete", "users.impersonate", "users.export",
      "wallet.view", "wallet.approve", "wallet.reject", "wallet.lock", "wallet.unlock", "wallet.export",
      "orders.view", "orders.edit", "orders.approve", "orders.reject", "orders.refund", "orders.export",
      "services.view", "services.create", "services.edit", "services.delete", "services.approve", "services.reject",
      "marketplaces.view", "marketplaces.create", "marketplaces.edit", "marketplaces.delete", "marketplaces.configure",
      "seo_services.view", "seo_services.create", "seo_services.edit", "seo_services.delete", "seo_services.approve", "seo_services.reject", "seo_services.assign",
      "admins.view", "admins.create", "admins.edit", "admins.delete", "admins.assign_role",
      "settings.view", "settings.edit", "settings.global",
      "feature_flags.view", "feature_flags.edit", "feature_flags.schedule",
      "security.view", "security.audit_logs", "security.lock_account", "security.unlock_account", "security.manage_mfa",
      "analytics.view", "analytics.export",
      "cms.view", "cms.create", "cms.edit", "cms.delete", "cms.publish",
      "notifications.view", "notifications.send", "notifications.schedule",
      "ai_governance.view", "ai_governance.edit", "ai_governance.test",
      "system.maintenance", "system.backup", "system.restore", "system.feature_flags",
      "audit.view", "audit.export", "audit.search",
    ],
    level: 1,
    color: "purple",
    icon: "ShieldCheck",
  },
  platform_admin: {
    id: "platform_admin",
    name: "Platform Admin",
    description: "Day-to-day platform operations, content, and service management.",
    permissions: [
      "users.view", "users.edit", "users.export",
      "wallet.view",
      "orders.view", "orders.edit", "orders.approve", "orders.reject",
      "services.view", "services.create", "services.edit", "services.approve", "services.reject",
      "marketplaces.view", "marketplaces.create", "marketplaces.edit", "marketplaces.configure",
      "seo_services.view", "seo_services.create", "seo_services.edit", "seo_services.approve", "seo_services.reject", "seo_services.assign",
      "admins.view",
      "settings.view", "settings.edit",
      "feature_flags.view",
      "security.view",
      "analytics.view",
      "cms.view", "cms.create", "cms.edit", "cms.publish",
      "notifications.view", "notifications.send",
      "audit.view",
    ],
    inheritsFrom: [],
    level: 2,
    color: "indigo",
    icon: "Settings",
  },
  finance_manager: {
    id: "finance_manager",
    name: "Finance Manager",
    description: "Wallet, transactions, withdrawals, and financial reporting.",
    permissions: [
      "users.view",
      "wallet.view", "wallet.approve", "wallet.reject", "wallet.lock", "wallet.unlock", "wallet.export",
      "orders.view", "orders.approve", "orders.reject", "orders.refund", "orders.export",
      "settings.view",
      "analytics.view", "analytics.export",
      "audit.view",
    ],
    inheritsFrom: [],
    level: 3,
    color: "emerald",
    icon: "Wallet",
  },
  marketplace_manager: {
    id: "marketplace_manager",
    name: "Marketplace Manager",
    description: "Marketplace integrations, categories, and status management.",
    permissions: [
      "users.view",
      "orders.view", "orders.edit",
      "marketplaces.view", "marketplaces.create", "marketplaces.edit", "marketplaces.delete", "marketplaces.configure",
      "seo_services.view",
      "settings.view",
      "analytics.view",
      "audit.view",
    ],
    inheritsFrom: [],
    level: 4,
    color: "sky",
    icon: "Globe",
  },
  seo_operations_manager: {
    id: "seo_operations_manager",
    name: "SEO Operations Manager",
    description: "SEO services, workflows, deliverables, and reporting.",
    permissions: [
      "users.view",
      "orders.view",
      "seo_services.view", "seo_services.create", "seo_services.edit", "seo_services.delete", "seo_services.approve", "seo_services.reject", "seo_services.assign",
      "services.view",
      "settings.view",
      "analytics.view",
      "audit.view",
    ],
    inheritsFrom: [],
    level: 4,
    color: "orange",
    icon: "Search",
  },
  support_manager: {
    id: "support_manager",
    name: "Support Manager",
    description: "Tickets, FAQs, and support operations.",
    permissions: [
      "users.view",
      "orders.view",
      "settings.view",
      "cms.view", "cms.edit", "cms.publish",
      "notifications.view", "notifications.send",
      "audit.view",
    ],
    inheritsFrom: [],
    level: 5,
    color: "rose",
    icon: "Headphones",
  },
  support_agent: {
    id: "support_agent",
    name: "Support Agent",
    description: "Assigned tickets and support inbox only.",
    permissions: [
      "users.view",
      "orders.view",
      "cms.view",
      "notifications.view",
    ],
    inheritsFrom: ["support_manager"],
    level: 6,
    color: "slate",
    icon: "MessageSquare",
  },
};

export const ALL_ROLES = Object.values(ROLE_DEFINITIONS).sort((a, b) => a.level - b.level);

/* ─── 20 Discovered Admin Pages Registry ────────────────────────── */

export interface AdminPageDefinition {
  key: string;
  label: string;
  route: string;
  category: "Core" | "Operations" | "Tasks & Orders" | "Content & SEO" | "System";
  description: string;
}

export const DISCOVERED_ADMIN_PAGES: AdminPageDefinition[] = [
  { key: "dashboard", label: "Admin Dashboard", route: "/admin", category: "Core", description: "Main operational overview & live activity" },
  { key: "users", label: "Users Management", route: "/admin/users", category: "Core", description: "User accounts, balances, and status control" },
  { key: "teams", label: "Team Management", route: "/admin/teams", category: "Core", description: "Team hierarchy & referral commission tracking" },
  { key: "platforms", label: "Platforms", route: "/admin/platforms", category: "Operations", description: "Platform configuration (Amazon, Alibaba, AliExpress, eBay)" },
  { key: "packages", label: "Task Packages", route: "/admin/packages", category: "Tasks & Orders", description: "Task package creation & code management" },
  { key: "transactions", label: "Transactions", route: "/admin/transactions", category: "Operations", description: "Deposit & withdrawal request management" },
  { key: "extra-tasks", label: "Extra Tasks", route: "/admin/extra-tasks", category: "Tasks & Orders", description: "Admin-assigned extra tasks for users" },
  { key: "audit-log", label: "Audit Log", route: "/admin/audit-log", category: "System", description: "Admin-level operational audit records" },
  { key: "orders", label: "Orders", route: "/admin/orders", category: "Tasks & Orders", description: "Customer order processing & status updates" },
  { key: "records", label: "Task Records", route: "/admin/records", category: "Tasks & Orders", description: "Historical task execution records" },
  { key: "analytics", label: "Analytics", route: "/admin/analytics", category: "Operations", description: "Operational metrics & performance analytics" },
  { key: "notifications", label: "Notifications", route: "/admin/notifications", category: "Operations", description: "Broadcast & user system notifications" },
  { key: "support", label: "Support Tickets", route: "/admin/support", category: "Operations", description: "Customer support chat & ticket workspace" },
  { key: "settings", label: "Platform Settings", route: "/admin/settings", category: "System", description: "Platform rules, limits, and configuration" },
  { key: "ads", label: "Ads Management", route: "/admin/ads", category: "Content & SEO", description: "Ad code task sessions & ad assignments" },
  { key: "password-reset", label: "Password Reset", route: "/admin/password-reset", category: "System", description: "Admin password security updates" },
  { key: "assigned-tasks", label: "Assigned Tasks", route: "/admin/assigned-tasks", category: "Tasks & Orders", description: "Individual task item assignment" },
];

/* ─── Permission Groups (for UI presentation) ───────────────────── */

export const PERMISSION_GROUPS: { label: string; permissions: { key: Permission; label: string }[] }[] = [
  {
    label: "User Management",
    permissions: [
      { key: "users.view", label: "View users" },
      { key: "users.edit", label: "Edit users" },
      { key: "users.delete", label: "Delete users" },
      { key: "users.impersonate", label: "Impersonate users" },
      { key: "users.export", label: "Export user data" },
    ],
  },
  {
    label: "Wallet & Transactions",
    permissions: [
      { key: "wallet.view", label: "View wallets" },
      { key: "wallet.approve", label: "Approve withdrawals" },
      { key: "wallet.reject", label: "Reject withdrawals" },
      { key: "wallet.lock", label: "Lock wallets" },
      { key: "wallet.unlock", label: "Unlock wallets" },
      { key: "wallet.export", label: "Export transactions" },
    ],
  },
  {
    label: "Orders",
    permissions: [
      { key: "orders.view", label: "View orders" },
      { key: "orders.edit", label: "Edit orders" },
      { key: "orders.approve", label: "Approve orders" },
      { key: "orders.reject", label: "Reject orders" },
      { key: "orders.refund", label: "Refund orders" },
      { key: "orders.export", label: "Export orders" },
    ],
  },
  {
    label: "Services",
    permissions: [
      { key: "services.view", label: "View services" },
      { key: "services.create", label: "Create services" },
      { key: "services.edit", label: "Edit services" },
      { key: "services.delete", label: "Delete services" },
      { key: "services.approve", label: "Approve services" },
      { key: "services.reject", label: "Reject services" },
    ],
  },
  {
    label: "Marketplaces",
    permissions: [
      { key: "marketplaces.view", label: "View marketplaces" },
      { key: "marketplaces.create", label: "Create marketplaces" },
      { key: "marketplaces.edit", label: "Edit marketplaces" },
      { key: "marketplaces.delete", label: "Delete marketplaces" },
      { key: "marketplaces.configure", label: "Configure credentials" },
    ],
  },
  {
    label: "SEO Services",
    permissions: [
      { key: "seo_services.view", label: "View SEO services" },
      { key: "seo_services.create", label: "Create SEO services" },
      { key: "seo_services.edit", label: "Edit SEO services" },
      { key: "seo_services.delete", label: "Delete SEO services" },
      { key: "seo_services.approve", label: "Approve SEO services" },
      { key: "seo_services.reject", label: "Reject SEO services" },
      { key: "seo_services.assign", label: "Assign SEO teams" },
    ],
  },
  {
    label: "Admin Management",
    permissions: [
      { key: "admins.view", label: "View admins" },
      { key: "admins.create", label: "Create admins" },
      { key: "admins.edit", label: "Edit admins" },
      { key: "admins.delete", label: "Delete admins" },
      { key: "admins.assign_role", label: "Assign roles" },
    ],
  },
  {
    label: "Settings",
    permissions: [
      { key: "settings.view", label: "View settings" },
      { key: "settings.edit", label: "Edit settings" },
      { key: "settings.global", label: "Global settings" },
    ],
  },
  {
    label: "Feature Flags",
    permissions: [
      { key: "feature_flags.view", label: "View flags" },
      { key: "feature_flags.edit", label: "Edit flags" },
      { key: "feature_flags.schedule", label: "Schedule rollouts" },
    ],
  },
  {
    label: "Security",
    permissions: [
      { key: "security.view", label: "View security" },
      { key: "security.audit_logs", label: "Access audit logs" },
      { key: "security.lock_account", label: "Lock accounts" },
      { key: "security.unlock_account", label: "Unlock accounts" },
      { key: "security.manage_mfa", label: "Manage MFA" },
    ],
  },
  {
    label: "Analytics",
    permissions: [
      { key: "analytics.view", label: "View analytics" },
      { key: "analytics.export", label: "Export analytics" },
    ],
  },
  {
    label: "CMS",
    permissions: [
      { key: "cms.view", label: "View CMS" },
      { key: "cms.create", label: "Create content" },
      { key: "cms.edit", label: "Edit content" },
      { key: "cms.delete", label: "Delete content" },
      { key: "cms.publish", label: "Publish content" },
    ],
  },
  {
    label: "Notifications",
    permissions: [
      { key: "notifications.view", label: "View notifications" },
      { key: "notifications.send", label: "Send notifications" },
      { key: "notifications.schedule", label: "Schedule notifications" },
    ],
  },
  {
    label: "AI Governance",
    permissions: [
      { key: "ai_governance.view", label: "View AI config" },
      { key: "ai_governance.edit", label: "Edit AI config" },
      { key: "ai_governance.test", label: "Test AI prompts" },
    ],
  },
  {
    label: "System",
    permissions: [
      { key: "system.maintenance", label: "Maintenance mode" },
      { key: "system.backup", label: "Create backups" },
      { key: "system.restore", label: "Restore backups" },
      { key: "system.feature_flags", label: "System feature flags" },
    ],
  },
  {
    label: "Audit",
    permissions: [
      { key: "audit.view", label: "View audit trail" },
      { key: "audit.export", label: "Export audit trail" },
      { key: "audit.search", label: "Search audit trail" },
    ],
  },
];

/* ─── Seed / demo data ──────────────────────────────────────────── */

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  siteName: "DealXStocks",
  siteDescription: "International SEO & eCommerce Growth Agency with a marketplace intelligence platform.",
  companyLogo: "",
  favicon: "",
  brandColors: { primary: "#7c3aed", secondary: "#4f46e5", accent: "#f59e0b" },
  defaultMetaTitle: "DealXStocks — SEO & eCommerce Growth",
  defaultMetaDescription: "International SEO services and marketplace intelligence for ambitious eCommerce brands.",
  defaultMetaImage: "",
  telegramSupport: "https://t.me/customerservice_160",
  emailSupport: "support@dealstocks.com",
  phoneSupport: "",
  liveChatEnabled: true,
  maintenanceMode: false,
  maintenanceMessage: "",
  registrationEnabled: true,
  emailVerificationRequired: false,
  phoneVerificationRequired: false,
  defaultCurrency: "USD",
  supportedCurrencies: ["USD", "EUR", "GBP", "PKR"],
  defaultLanguage: "en",
  supportedLanguages: ["en", "ur", "hi"],
  defaultTimezone: "Asia/Karachi",
  withdrawalEnabled: true,
  withdrawalRequiresCompletedTasks: true,
  requiredCompletedTasksCount: 10,
  minWithdrawalAmount: 500,
  withdrawalTaxEnabled: true,
  withdrawalTaxType: "percentage",
  withdrawalTaxValue: 10,
  depositEnabled: true,
  minDepositAmount: 100,
  amazonBandMax: 3,
  alibabaBandMin: 0,
  alibabaBandMax: 3,
  aliexpressBandMin: 0,
  bandSwitchingEnabled: true,
  features: {
    referrals: true,
    packages: true,
    extraTasks: true,
    adCodeTasks: true,
    marketplaceIntelligence: true,
  },
  sessionTimeout: 30,
  maxLoginAttempts: 5,
  lockoutDuration: 15,
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSymbols: false,
  mfaRequiredForAdmins: true,
  mfaRequiredForUsers: false,
  emailNotificationsEnabled: true,
  pushNotificationsEnabled: true,
  smsNotificationsEnabled: false,
  maxFileUploadSize: 5,
  maxImageDimensions: { width: 2048, height: 2048 },
  apiRateLimit: 120,
  auditLogRetentionDays: 90,
  auditLogEnabled: true,
};

export const SEED_FEATURE_FLAGS: FeatureFlag[] = [
  { id: "ff-referrals", name: "Referral Program", description: "Enable user referral & commission flows.", enabled: true, environment: "all", rolloutPercentage: 100, createdAt: "2026-01-05T10:00:00Z", updatedAt: "2026-07-28T09:15:00Z", createdBy: "admin", tags: ["growth"] },
  { id: "ff-packages", name: "Task Packages", description: "Enable task package purchasing.", enabled: true, environment: "all", rolloutPercentage: 100, createdAt: "2026-01-05T10:00:00Z", updatedAt: "2026-07-28T09:15:00Z", createdBy: "admin", tags: ["core"] },
  { id: "ff-extra-tasks", name: "Extra Tasks", description: "Enable admin-assigned extra tasks.", enabled: true, environment: "all", rolloutPercentage: 100, createdAt: "2026-01-05T10:00:00Z", updatedAt: "2026-07-28T09:15:00Z", createdBy: "admin", tags: ["tasks"] },
  { id: "ff-ad-code-tasks", name: "Ad-Code Tasks", description: "Enable ad-code (code-based) task sessions.", enabled: true, environment: "production", rolloutPercentage: 100, createdAt: "2026-02-10T10:00:00Z", updatedAt: "2026-07-28T09:15:00Z", createdBy: "admin", tags: ["tasks"] },
  { id: "ff-marketplace-intel", name: "Marketplace Intelligence", description: "Enable marketplace intelligence dashboards.", enabled: true, environment: "all", rolloutPercentage: 80, targetRoles: ["super_admin", "platform_admin"], createdAt: "2026-03-01T10:00:00Z", updatedAt: "2026-07-30T11:20:00Z", createdBy: "admin", tags: ["analytics"] },
  { id: "ff-new-dashboard", name: "New Dashboard UX", description: "Phased rollout of the redesigned user dashboard.", enabled: false, environment: "production", rolloutPercentage: 0, createdAt: "2026-06-01T10:00:00Z", updatedAt: "2026-07-31T08:00:00Z", createdBy: "admin", tags: ["ux"] },
  { id: "ff-ai-assistant", name: "AI Growth Assistant", description: "Enable AI-powered growth recommendations.", enabled: false, environment: "staging", rolloutPercentage: 25, targetRoles: ["platform_admin"], createdAt: "2026-07-15T10:00:00Z", updatedAt: "2026-07-31T08:00:00Z", createdBy: "admin", tags: ["ai"] },
  { id: "ff-sso", name: "Enterprise SSO", description: "Single sign-on for enterprise clients.", enabled: false, environment: "production", rolloutPercentage: 0, createdAt: "2026-07-20T10:00:00Z", updatedAt: "2026-07-31T08:00:00Z", createdBy: "admin", tags: ["enterprise"] },
];

export const SEED_MARKETPLACES: MarketplaceConfig[] = [
  {
    id: "mp-amazon", name: "Amazon", code: "amazon", displayName: "Amazon", description: "Amazon marketplace intelligence & growth.",
    logo: "", color: "#ff9900", enabled: true, status: "active",
    apiEndpoint: "https://api.amazon.com", apiVersion: "v3", apiCredentials: {},
    supportedCountries: ["US", "UK", "DE", "FR", "IT", "ES", "IN"], supportedCurrencies: ["USD", "GBP", "EUR", "INR"],
    commissionRate: 8, minOrderValue: 50, maxOrderValue: 5000,
    features: { seoServices: true, ppcManagement: true, reviewManagement: true, inventorySync: false, orderSync: true, analytics: true },
    sla: { uptime: 99.9, responseTime: 180, supportHours: "24/7" },
    createdAt: "2026-01-02T10:00:00Z", updatedAt: "2026-07-28T09:00:00Z", createdBy: "admin",
  },
  {
    id: "mp-alibaba", name: "Alibaba", code: "alibaba", displayName: "Alibaba", description: "Alibaba B2B marketplace services.",
    logo: "", color: "#ff6a00", enabled: true, status: "active",
    apiEndpoint: "https://api.alibaba.com", apiVersion: "v2", apiCredentials: {},
    supportedCountries: ["CN", "US", "UK", "DE"], supportedCurrencies: ["CNY", "USD", "EUR", "GBP"],
    commissionRate: 6, minOrderValue: 100, maxOrderValue: 10000,
    features: { seoServices: true, ppcManagement: false, reviewManagement: true, inventorySync: false, orderSync: true, analytics: true },
    sla: { uptime: 99.8, responseTime: 220, supportHours: "Mon–Sat 08:00–20:00" },
    createdAt: "2026-01-02T10:00:00Z", updatedAt: "2026-07-28T09:00:00Z", createdBy: "admin",
  },
  {
    id: "mp-aliexpress", name: "AliExpress", code: "aliexpress", displayName: "AliExpress", description: "AliExpress retail growth services.",
    logo: "", color: "#e42e2e", enabled: true, status: "active",
    apiEndpoint: "https://api.aliexpress.com", apiVersion: "v1", apiCredentials: {},
    supportedCountries: ["US", "UK", "DE", "FR", "ES", "BR"], supportedCurrencies: ["USD", "EUR", "GBP", "BRL"],
    commissionRate: 9, minOrderValue: 30, maxOrderValue: 3000,
    features: { seoServices: true, ppcManagement: true, reviewManagement: false, inventorySync: false, orderSync: true, analytics: true },
    sla: { uptime: 99.7, responseTime: 260, supportHours: "24/7" },
    createdAt: "2026-01-02T10:00:00Z", updatedAt: "2026-07-28T09:00:00Z", createdBy: "admin",
  },
  {
    id: "mp-shopify", name: "Shopify", code: "shopify", displayName: "Shopify", description: "Shopify store SEO & growth.",
    logo: "", color: "#96bf48", enabled: true, status: "active",
    apiEndpoint: "https://api.shopify.com", apiVersion: "2026-01", apiCredentials: {},
    supportedCountries: ["US", "UK", "CA", "AU", "NZ", "IN"], supportedCurrencies: ["USD", "GBP", "CAD", "AUD", "INR"],
    commissionRate: 10, minOrderValue: 100, maxOrderValue: 20000,
    features: { seoServices: true, ppcManagement: true, reviewManagement: true, inventorySync: true, orderSync: true, analytics: true },
    sla: { uptime: 99.95, responseTime: 150, supportHours: "24/7" },
    createdAt: "2026-02-14T10:00:00Z", updatedAt: "2026-07-28T09:00:00Z", createdBy: "admin",
  },
  {
    id: "mp-ebay", name: "eBay", code: "ebay", displayName: "eBay", description: "eBay store optimization.",
    logo: "", color: "#e53238", enabled: true, status: "maintenance",
    apiEndpoint: "https://api.ebay.com", apiVersion: "v1", apiCredentials: {},
    supportedCountries: ["US", "UK", "DE", "AU"], supportedCurrencies: ["USD", "GBP", "EUR", "AUD"],
    commissionRate: 7, minOrderValue: 40, maxOrderValue: 8000,
    features: { seoServices: true, ppcManagement: false, reviewManagement: false, inventorySync: false, orderSync: true, analytics: true },
    sla: { uptime: 99.6, responseTime: 280, supportHours: "Mon–Fri 09:00–18:00" },
    createdAt: "2026-03-10T10:00:00Z", updatedAt: "2026-07-29T14:00:00Z", createdBy: "admin",
  },
  {
    id: "mp-walmart", name: "Walmart", code: "walmart", displayName: "Walmart Marketplace", description: "Walmart Marketplace growth.",
    logo: "", color: "#0071ce", enabled: false, status: "inactive",
    apiEndpoint: "https://developer.walmart.com/api", apiVersion: "v4", apiCredentials: {},
    supportedCountries: ["US", "CA", "MX"], supportedCurrencies: ["USD", "CAD", "MXN"],
    commissionRate: 9, minOrderValue: 60, maxOrderValue: 6000,
    features: { seoServices: true, ppcManagement: false, reviewManagement: false, inventorySync: false, orderSync: false, analytics: false },
    sla: { uptime: 99.5, responseTime: 300, supportHours: "Mon–Fri 09:00–18:00" },
    createdAt: "2026-04-05T10:00:00Z", updatedAt: "2026-07-28T09:00:00Z", createdBy: "admin",
  },
];

export const SEED_SEO_SERVICES: SEOServiceConfig[] = [
  {
    id: "seo-technical", name: "Technical SEO Audit", code: "seo-technical", description: "Full technical SEO audit with prioritized fixes.",
    category: "technical", marketplace: ["shopify", "amazon"],
    pricing: { model: "project", basePrice: 750, currency: "USD", setupFee: 0 },
    features: ["Crawl analysis", "Core Web Vitals", "Site architecture", "Schema markup"], deliverables: ["Audit report", "Fix roadmap", "Schema files"],
    timeline: "2 weeks", requirements: ["Read access to analytics", "CMS access"],
    status: "active", createdAt: "2026-02-01T10:00:00Z", updatedAt: "2026-07-25T09:00:00Z", createdBy: "admin",
  },
  {
    id: "seo-keyword", name: "International Keyword Strategy", code: "seo-keyword", description: "Multi-market keyword research & content mapping.",
    category: "international", marketplace: ["shopify", "amazon", "ebay"],
    pricing: { model: "project", basePrice: 1200, currency: "USD", setupFee: 0 },
    features: ["Market research", "Keyword clustering", "Competitor gap", "Content mapping"], deliverables: ["Keyword matrix", "Content calendar"],
    timeline: "3 weeks", requirements: ["Target markets list"],
    status: "active", createdAt: "2026-02-01T10:00:00Z", updatedAt: "2026-07-25T09:00:00Z", createdBy: "admin",
  },
  {
    id: "seo-content", name: "SEO Content Engine", code: "seo-content", description: "Ongoing SEO content creation and optimization.",
    category: "content", marketplace: ["shopify"],
    pricing: { model: "monthly", basePrice: 900, currency: "USD", setupFee: 300, minimumCommitment: 3 },
    features: ["Blog & landing pages", "Product page optimization", "Internal linking", "AI-assisted drafts"], deliverables: ["8 articles/mo", "Monthly report"],
    timeline: "Ongoing", requirements: ["Brand voice guide"],
    status: "active", createdAt: "2026-02-01T10:00:00Z", updatedAt: "2026-07-25T09:00:00Z", createdBy: "admin",
  },
  {
    id: "seo-link", name: "Authority Link Building", code: "seo-link", description: "White-hat backlink acquisition for international domains.",
    category: "link_building", marketplace: ["shopify", "amazon", "ebay"],
    pricing: { model: "monthly", basePrice: 650, currency: "USD", setupFee: 0, minimumCommitment: 3 },
    features: ["Digital PR", "Guest posts", "Directory quality", "Link reclamation"], deliverables: ["10 links/mo", "Domain report"],
    timeline: "Ongoing", requirements: ["Target pages", "Competitor list"],
    status: "active", createdAt: "2026-03-01T10:00:00Z", updatedAt: "2026-07-25T09:00:00Z", createdBy: "admin",
  },
  {
    id: "seo-marketplace", name: "Marketplace Listing Optimization", code: "seo-marketplace", description: "Amazon/Alibaba/AliExpress listing ranking optimization.",
    category: "marketplace", marketplace: ["amazon", "alibaba", "aliexpress"],
    pricing: { model: "monthly", basePrice: 500, currency: "USD", setupFee: 150, minimumCommitment: 3 },
    features: ["Keyword ranking", "A+ content", "Image optimization", "Review velocity"], deliverables: ["Listing updates", "Ranking tracker"],
    timeline: "Ongoing", requirements: ["Seller central access"],
    status: "active", createdAt: "2026-03-01T10:00:00Z", updatedAt: "2026-07-25T09:00:00Z", createdBy: "admin",
  },
  {
    id: "seo-local", name: "Local SEO Suite", code: "seo-local", description: "Multi-location local SEO for global brands.",
    category: "local", marketplace: ["shopify"],
    pricing: { model: "project", basePrice: 850, currency: "USD", setupFee: 0 },
    features: ["Google Business Profile", "Local citations", "Reviews", "Map pack tracking"], deliverables: ["Local audit", "Citation list"],
    timeline: "4 weeks", requirements: ["Location data"],
    status: "draft", createdAt: "2026-06-01T10:00:00Z", updatedAt: "2026-07-25T09:00:00Z", createdBy: "admin",
  },
];

export const SEED_ADMINS: SuperAdminUser[] = [
  {
    id: "adm-1", email: "admin@dealstocks.com", name: "Alex Morgan", role: "super_admin",
    permissions: ROLE_DEFINITIONS.super_admin.permissions, status: "active",
    lastLogin: "2026-08-02T08:30:00Z", createdAt: "2026-01-01T00:00:00Z", createdBy: "system",
    mfaEnabled: true, sessionTimeout: 30,
  },
  {
    id: "adm-2", email: "finance@dealstocks.com", name: "Sarah Chen", role: "finance_manager",
    permissions: ROLE_DEFINITIONS.finance_manager.permissions, status: "active",
    lastLogin: "2026-08-02T07:45:00Z", createdAt: "2026-02-10T00:00:00Z", createdBy: "adm-1",
    mfaEnabled: true, sessionTimeout: 30,
  },
  {
    id: "adm-3", email: "marketplace@dealstocks.com", name: "Omar Farooq", role: "marketplace_manager",
    permissions: ROLE_DEFINITIONS.marketplace_manager.permissions, status: "active",
    lastLogin: "2026-08-01T18:20:00Z", createdAt: "2026-03-15T00:00:00Z", createdBy: "adm-1",
    mfaEnabled: true, sessionTimeout: 30,
  },
  {
    id: "adm-4", email: "seo@dealstocks.com", name: "Priya Sharma", role: "seo_operations_manager",
    permissions: ROLE_DEFINITIONS.seo_operations_manager.permissions, status: "active",
    lastLogin: "2026-08-02T06:10:00Z", createdAt: "2026-04-01T00:00:00Z", createdBy: "adm-1",
    mfaEnabled: false, sessionTimeout: 30,
  },
  {
    id: "adm-5", email: "support@dealstocks.com", name: "James Wilson", role: "support_manager",
    permissions: ROLE_DEFINITIONS.support_manager.permissions, status: "active",
    lastLogin: "2026-08-01T22:05:00Z", createdAt: "2026-04-20T00:00:00Z", createdBy: "adm-1",
    mfaEnabled: true, sessionTimeout: 30,
  },
  {
    id: "adm-6", email: "ops@dealstocks.com", name: "Mei Lin", role: "platform_admin",
    permissions: ROLE_DEFINITIONS.platform_admin.permissions, status: "suspended",
    lastLogin: "2026-07-29T11:00:00Z", createdAt: "2026-05-10T00:00:00Z", createdBy: "adm-1",
    mfaEnabled: false, sessionTimeout: 30,
  },
];

export const SEED_AUDIT_LOGS: AuditLogEntry[] = [
  { id: "log-1", timestamp: "2026-08-02T08:31:22Z", actorId: "adm-1", actorName: "Alex Morgan", actorRole: "super_admin", action: "settings.update", entityType: "settings", entityId: "platform", oldValue: { maintenanceMode: false }, newValue: { maintenanceMode: true }, ipAddress: "203.0.113.7", severity: "warning", category: "setting" },
  { id: "log-2", timestamp: "2026-08-02T07:48:05Z", actorId: "adm-2", actorName: "Sarah Chen", actorRole: "finance_manager", action: "withdrawal.approve", entityType: "withdrawal", entityId: "w-4412", entityName: "user-9981", oldValue: { status: "pending" }, newValue: { status: "approved" }, ipAddress: "198.51.100.23", severity: "info", category: "wallet" },
  { id: "log-3", timestamp: "2026-08-02T06:15:44Z", actorId: "adm-4", actorName: "Priya Sharma", actorRole: "seo_operations_manager", action: "seo_service.assign", entityType: "seo_service", entityId: "seo-content", entityName: "SEO Content Engine", oldValue: { assignedTeam: [] }, newValue: { assignedTeam: ["team-content"] }, ipAddress: "203.0.113.42", severity: "info", category: "service" },
  { id: "log-4", timestamp: "2026-08-01T22:07:19Z", actorId: "adm-5", actorName: "James Wilson", actorRole: "support_manager", action: "ticket.resolve", entityType: "ticket", entityId: "tkt-2201", entityName: "Withdrawal not received", oldValue: { status: "open" }, newValue: { status: "resolved" }, ipAddress: "192.0.2.88", severity: "info", category: "order" },
  { id: "log-5", timestamp: "2026-08-01T18:25:01Z", actorId: "adm-3", actorName: "Omar Farooq", actorRole: "marketplace_manager", action: "marketplace.maintenance", entityType: "marketplace", entityId: "mp-ebay", entityName: "eBay", oldValue: { status: "active" }, newValue: { status: "maintenance" }, ipAddress: "198.51.100.12", severity: "warning", category: "marketplace" },
  { id: "log-6", timestamp: "2026-08-01T15:00:00Z", actorId: "system", actorName: "System", actorRole: "super_admin", action: "user.lock", entityType: "user", entityId: "user-4455", entityName: "suspicious@user.com", oldValue: { status: "active" }, newValue: { status: "suspended" }, ipAddress: "system", severity: "critical", category: "security" },
  { id: "log-7", timestamp: "2026-08-01T12:40:11Z", actorId: "adm-2", actorName: "Sarah Chen", actorRole: "finance_manager", action: "wallet.unlock", entityType: "wallet", entityId: "user-3321", entityName: "withdrawal-wallet", oldValue: { locked: true }, newValue: { locked: false }, ipAddress: "198.51.100.23", severity: "info", category: "wallet" },
  { id: "log-8", timestamp: "2026-08-01T10:05:33Z", actorId: "adm-1", actorName: "Alex Morgan", actorRole: "super_admin", action: "feature_flag.update", entityType: "feature_flag", entityId: "ff-new-dashboard", entityName: "New Dashboard UX", oldValue: { enabled: true, rolloutPercentage: 15 }, newValue: { enabled: false, rolloutPercentage: 0 }, ipAddress: "203.0.113.7", severity: "info", category: "system" },
];

export const HEALTH_SERVICES = [
  { service: "API Gateway", status: "healthy", latency: 42, uptime: 99.98 },
  { service: "Firestore", status: "healthy", latency: 18, uptime: 99.99 },
  { service: "Authentication", status: "healthy", latency: 61, uptime: 99.97 },
  { service: "Task Engine", status: "degraded", latency: 340, uptime: 99.82 },
  { service: "Notifications", status: "healthy", latency: 120, uptime: 99.94 },
  { service: "AI Assistant", status: "degraded", latency: 890, uptime: 99.40 },
  { service: "Marketplace Sync", status: "healthy", latency: 95, uptime: 99.91 },
  { service: "CDN / Assets", status: "healthy", latency: 24, uptime: 100 },
];

export const SYSTEM_METRICS = {
  users: { total: 12480, active: 8941, newToday: 87, newThisWeek: 512, newThisMonth: 2210 },
  sellers: { total: 132, active: 98, pending: 12 },
  wallet: { totalBalance: 1284500, totalDeposits: 893000, totalWithdrawals: 742100, pendingWithdrawals: 38 },
  orders: { total: 43120, pending: 214, processing: 388, completed: 41290, cancelled: 1228 },
  requests: { total: 5120, pending: 96, approved: 4680, rejected: 344 },
  marketplace: {
    amazon: { activeSessions: 512, completedToday: 210, revenue: 48200 },
    alibaba: { activeSessions: 284, completedToday: 118, revenue: 22100 },
    aliexpress: { activeSessions: 341, completedToday: 164, revenue: 19800 },
    shopify: { activeSessions: 96, completedToday: 41, revenue: 15200 },
  },
  seoServices: { active: 47, completed: 128, revenue: 36500 },
  support: { openTickets: 42, avgResponseTime: 6.4, satisfaction: 4.7 },
  performance: { avgApiLatency: 89, errorRate: 0.42, uptime: 99.97 },
};

export const SEED_ALERTS = [
  { id: "al-1", type: "critical", title: "Task Engine latency spike", message: "P95 latency above 500ms for 12+ minutes. Auto-scaling engaged.", source: "Task Engine", timestamp: "2026-08-02T08:05:00Z", acknowledged: false },
  { id: "al-2", type: "warning", title: "38 pending withdrawals", message: "Withdrawal queue exceeds 24h SLA. Finance review recommended.", source: "Wallet", timestamp: "2026-08-02T07:55:00Z", acknowledged: false },
  { id: "al-3", type: "warning", title: "Failed login attempts", message: "12 failed logins for user-4455 in last hour. Account lockout triggered.", source: "Security", timestamp: "2026-08-02T07:40:00Z", acknowledged: false },
  { id: "al-4", type: "info", title: "AI Assistant degraded", message: "LLM provider latency elevated. Recommendations paused.", source: "AI Assistant", timestamp: "2026-08-02T06:30:00Z", acknowledged: true },
  { id: "al-5", type: "success", title: "Backup completed", message: "Automated daily backup completed successfully (2.4 GB).", source: "System", timestamp: "2026-08-02T03:00:00Z", acknowledged: true },
];

/* ─── Helpers ───────────────────────────────────────────────────── */

export function permissionsForRole(role: SuperAdminRole): Permission[] {
  const def = ROLE_DEFINITIONS[role];
  if (!def) return [];
  const inherited = (def.inheritsFrom ?? []).flatMap(r => permissionsForRole(r));
  return Array.from(new Set([...def.permissions, ...inherited]));
}

export function hasPermission(role: SuperAdminRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  return permissionsForRole(role).includes(permission);
}
