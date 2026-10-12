/**
 * Super Admin Types
 * Enterprise-grade type definitions for the Super Admin Platform
 */

// Role hierarchy levels
export type SuperAdminRole = 
  | 'super_admin'
  | 'platform_admin'
  | 'finance_manager'
  | 'marketplace_manager'
  | 'seo_operations_manager'
  | 'support_manager'
  | 'support_agent';

// Permission keys
export type Permission = 
  // User management
  | 'users.view'
  | 'users.edit'
  | 'users.delete'
  | 'users.impersonate'
  | 'users.export'
  // Wallet management
  | 'wallet.view'
  | 'wallet.approve'
  | 'wallet.reject'
  | 'wallet.lock'
  | 'wallet.unlock'
  | 'wallet.export'
  // Order management
  | 'orders.view'
  | 'orders.edit'
  | 'orders.approve'
  | 'orders.reject'
  | 'orders.refund'
  | 'orders.export'
  // Service management
  | 'services.view'
  | 'services.create'
  | 'services.edit'
  | 'services.delete'
  | 'services.approve'
  | 'services.reject'
  // Marketplace management
  | 'marketplaces.view'
  | 'marketplaces.create'
  | 'marketplaces.edit'
  | 'marketplaces.delete'
  | 'marketplaces.configure'
  // SEO services
  | 'seo_services.view'
  | 'seo_services.create'
  | 'seo_services.edit'
  | 'seo_services.delete'
  | 'seo_services.approve'
  | 'seo_services.reject'
  | 'seo_services.assign'
  // Admin management
  | 'admins.view'
  | 'admins.create'
  | 'admins.edit'
  | 'admins.delete'
  | 'admins.assign_role'
  // Platform settings
  | 'settings.view'
  | 'settings.edit'
  | 'settings.global'
  // Feature flags
  | 'feature_flags.view'
  | 'feature_flags.edit'
  | 'feature_flags.schedule'
  // Security
  | 'security.view'
  | 'security.audit_logs'
  | 'security.lock_account'
  | 'security.unlock_account'
  | 'security.manage_mfa'
  // Feature flags
  | 'feature_flags.view'
  | 'feature_flags.edit'
  | 'feature_flags.schedule'
  // Analytics
  | 'analytics.view'
  | 'analytics.export'
  // CMS
  | 'cms.view'
  | 'cms.create'
  | 'cms.edit'
  | 'cms.delete'
  | 'cms.publish'
  // Notifications
  | 'notifications.view'
  | 'notifications.send'
  | 'notifications.schedule'
  // AI Governance
  | 'ai_governance.view'
  | 'ai_governance.edit'
  | 'ai_governance.test'
  // System
  | 'system.maintenance'
  | 'system.backup'
  | 'system.restore'
  | 'system.feature_flags'
  // Audit
  | 'audit.view'
  | 'audit.export'
  | 'audit.search';

// Role definition
export interface RoleDefinition {
  id: SuperAdminRole;
  name: string;
  description: string;
  permissions: Permission[];
  inheritsFrom?: SuperAdminRole[];
  level: number; // 1 = highest (super_admin), higher numbers = lower privilege
  color: string;
  icon: string;
}

// Admin user
export interface SuperAdminUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: SuperAdminRole;
  permissions: Permission[];
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  lastLogin?: string;
  createdAt: string;
  createdBy: string;
  mfaEnabled: boolean;
  sessionTimeout: number;
  ipWhitelist?: string[];
}

// Platform settings
export interface PlatformSettings {
  // Brand
  siteName: string;
  siteDescription: string;
  companyLogo: string;
  favicon: string;
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  
  // SEO
  defaultMetaTitle: string;
  defaultMetaDescription: string;
  defaultMetaImage: string;
  
  // Support
  telegramSupport: string;
  emailSupport: string;
  phoneSupport?: string;
  liveChatEnabled: boolean;
  
  // Platform
  maintenanceMode: boolean;
  maintenanceMessage: string;
  registrationEnabled: boolean;
  emailVerificationRequired: boolean;
  phoneVerificationRequired: boolean;
  
  // Regional
  defaultCurrency: string;
  supportedCurrencies: string[];
  defaultLanguage: string;
  supportedLanguages: string[];
  defaultTimezone: string;
  
  // Wallet
  withdrawalEnabled: boolean;
  withdrawalRequiresCompletedTasks: boolean;
  requiredCompletedTasksCount: number;
  minWithdrawalAmount: number;
  withdrawalTaxEnabled: boolean;
  withdrawalTaxType: 'fixed' | 'percentage';
  withdrawalTaxValue: number;
  depositEnabled: boolean;
  minDepositAmount: number;
  
  // Marketplace
  amazonBandMax: number;
  alibabaBandMin: number;
  alibabaBandMax: number;
  aliexpressBandMin: number;
  bandSwitchingEnabled: boolean;
  
  // Feature flags
  features: Record<string, boolean>;
  
  // Security
  sessionTimeout: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  mfaRequiredForAdmins: boolean;
  mfaRequiredForUsers: boolean;
  
  // Notifications
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  
  // Limits
  maxFileUploadSize: number;
  maxImageDimensions: { width: number; height: number };
  apiRateLimit: number;
  
  // Audit
  auditLogRetentionDays: number;
  auditLogEnabled: boolean;
}

// Feature flag
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  environment: 'development' | 'staging' | 'production' | 'all';
  rolloutPercentage: number;
  targetRoles?: SuperAdminRole[];
  targetUsers?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags: string[];
}

// Marketplace configuration
export interface MarketplaceConfig {
  id: string;
  name: string;
  code: string;
  displayName: string;
  description: string;
  logo: string;
  color: string;
  enabled: boolean;
  status: 'active' | 'inactive' | 'maintenance' | 'deprecated';
  apiEndpoint: string;
  apiVersion: string;
  apiCredentials: {
    clientId?: string;
    clientSecret?: string;
    apiKey?: string;
  };
  webhookUrl?: string;
  supportedCountries: string[];
  supportedCurrencies: string[];
  commissionRate: number;
  minOrderValue: number;
  maxOrderValue: number;
  features: {
    seoServices: boolean;
    ppcManagement: boolean;
    reviewManagement: boolean;
    inventorySync: boolean;
    orderSync: boolean;
    analytics: boolean;
  };
  sla: {
    uptime: number;
    responseTime: number;
    supportHours: string;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// SEO Service configuration
export interface SEOServiceConfig {
  id: string;
  name: string;
  code: string;
  description: string;
  category: 'technical' | 'content' | 'link_building' | 'local' | 'marketplace' | 'international';
  marketplace: string[];
  pricing: {
    model: 'monthly' | 'project' | 'hourly' | 'performance';
    basePrice: number;
    currency: string;
    setupFee?: number;
    minimumCommitment?: number;
  };
  features: string[];
  deliverables: string[];
  timeline: string;
  requirements: string[];
  assignedTeam?: string[];
  status: 'active' | 'inactive' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: SuperAdminRole;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'user' | 'wallet' | 'order' | 'service' | 'marketplace' | 'setting' | 'security' | 'system';
  metadata?: Record<string, unknown>;
  rollbackReference?: string;
}

// Health check
export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency?: number;
  lastChecked: string;
  details?: Record<string, unknown>;
  uptime: number;
}

// System metrics
export interface SystemMetrics {
  timestamp: string;
  users: {
    total: number;
    active: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  sellers: {
    total: number;
    active: number;
    pending: number;
  };
  wallet: {
    totalBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    pendingWithdrawals: number;
  };
  orders: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
  };
  requests: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  marketplace: Record<string, {
    activeSessions: number;
    completedToday: number;
    revenue: number;
  }>;
  seoServices: {
    active: number;
    completed: number;
    revenue: number;
  };
  support: {
    openTickets: number;
    avgResponseTime: number;
    satisfaction: number;
  };
  performance: {
    avgApiLatency: number;
    errorRate: number;
    uptime: number;
  };
}

// Alert
export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical' | 'success';
  title: string;
  message: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  metadata?: Record<string, unknown>;
}

// Navigation item
export interface SuperAdminNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  badge?: string;
  badgeColor?: string;
  children?: SuperAdminNavItem[];
  requiredPermissions?: Permission[];
  roles?: SuperAdminRole[];
  divider?: boolean;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
}

// Pagination
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

// Export for React
import React from 'react';