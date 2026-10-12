import { useMemo, useCallback } from "react";
import { useAdmin } from "../../contexts/AdminContext";
import {
  ROLE_DEFINITIONS,
  hasPermission,
  permissionsForRole,
} from "../../data/superAdminData";
import type { Permission, SuperAdminRole } from "../../types/super-admin";

/**
 * useSuperAdmin
 * RBAC hook layered on top of the existing admin session. The effective role
 * is derived from the admin's stored role, mapping legacy admin roles onto the
 * Super Admin role matrix:
 *   - "superadmin" / "owner"            → super_admin
 *   - "admin"                           → platform_admin
 *   - "finance" / "financemanager"      → finance_manager
 *   - everything else                   → support_manager
 */
const LEGACY_ROLE_MAP: Record<string, SuperAdminRole> = (() => {
  const raw: Record<string, SuperAdminRole> = {
    superadmin: "super_admin",
    owner: "super_admin",
    super_admin: "super_admin",
    admin: "platform_admin",
    platform_admin: "platform_admin",
    finance: "finance_manager",
    financemanager: "finance_manager",
    finance_manager: "finance_manager",
    marketplace: "marketplace_manager",
    marketplace_manager: "marketplace_manager",
    seo: "seo_operations_manager",
    seo_operations_manager: "seo_operations_manager",
    support_manager: "support_manager",
    support_agent: "support_agent",
  };
  // Normalize keys so lookups are case/separator agnostic ("Platform Admin" → platformadmin)
  const normalized: Record<string, SuperAdminRole> = {};
  for (const [key, role] of Object.entries(raw)) {
    normalized[key.toLowerCase().replace(/[\s_-]/g, "")] = role;
  }
  return normalized;
})();

export function normalizeRole(rawRole?: string): SuperAdminRole | undefined {
  if (!rawRole) return undefined;
  const key = rawRole.toLowerCase().replace(/[\s_-]/g, "");
  const exact = LEGACY_ROLE_MAP[key];
  if (exact) return exact;
  if (key.includes("superadmin") || key.includes("owner")) return "super_admin";
  if (key.includes("finance")) return "finance_manager";
  if (key.includes("marketplace")) return "marketplace_manager";
  if (key.includes("seo")) return "seo_operations_manager";
  if (key.includes("support")) return "support_manager";
  return "support_manager";
}

export function useSuperAdmin() {
  const { admin, isAdmin } = useAdmin();

  const role = useMemo<SuperAdminRole | undefined>(() => normalizeRole(admin?.role), [admin?.role]);

  const roleDefinition = useMemo(() => (role ? ROLE_DEFINITIONS[role] : undefined), [role]);

  const permissions = useMemo<Permission[]>(
    () => (role ? permissionsForRole(role) : []),
    [role],
  );

  const can = useCallback(
    (permission: Permission) => hasPermission(role, permission),
    [role],
  );

  const isSuperAdmin = role === "super_admin";
  const isPlatformAdmin = role === "platform_admin" || role === "super_admin";

  return {
    admin,
    isAdmin,
    role,
    roleDefinition,
    permissions,
    can,
    isSuperAdmin,
    isPlatformAdmin,
  };
}

export default useSuperAdmin;
