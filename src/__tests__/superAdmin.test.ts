import { describe, it, expect } from "vitest";
import { hasPermission, permissionsForRole, ROLE_DEFINITIONS } from "../data/superAdminData";
import { normalizeRole } from "../hooks/super-admin/useSuperAdmin";

describe("normalizeRole", () => {
  it("maps legacy superadmin role to super_admin", () => {
    expect(normalizeRole("superadmin")).toBe("super_admin");
    expect(normalizeRole("SuperAdmin")).toBe("super_admin");
    expect(normalizeRole("owner")).toBe("super_admin");
  });

  it("maps admin to platform_admin", () => {
    expect(normalizeRole("admin")).toBe("platform_admin");
    expect(normalizeRole("Platform Admin")).toBe("platform_admin");
  });

  it("maps finance roles to finance_manager", () => {
    expect(normalizeRole("finance")).toBe("finance_manager");
    expect(normalizeRole("FinanceManager")).toBe("finance_manager");
  });

  it("maps marketplace roles to marketplace_manager", () => {
    expect(normalizeRole("marketplace")).toBe("marketplace_manager");
    expect(normalizeRole("marketplace_manager")).toBe("marketplace_manager");
  });

  it("maps seo roles to seo_operations_manager", () => {
    expect(normalizeRole("seo")).toBe("seo_operations_manager");
    expect(normalizeRole("SEO Operations Manager")).toBe("seo_operations_manager");
  });

  it("maps support roles to support_manager", () => {
    expect(normalizeRole("support")).toBe("support_manager");
  });

  it("defaults unknown roles to support_manager (least privilege)", () => {
    expect(normalizeRole("mystery_role")).toBe("support_manager");
  });

  it("returns undefined for empty/missing role", () => {
    expect(normalizeRole()).toBeUndefined();
    expect(normalizeRole("")).toBeUndefined();
  });
});

describe("permissionsForRole / hasPermission", () => {
  it("super_admin has every permission in the registry", () => {
    const allPermissions = new Set<string>();
    for (const def of Object.values(ROLE_DEFINITIONS)) {
      for (const p of def.permissions) allPermissions.add(p);
    }
    for (const p of Array.from(allPermissions)) {
      expect(hasPermission("super_admin", p as never), `super_admin should have ${p}`).toBe(true);
    }
  });

  it("finance_manager can approve but not impersonate users", () => {
    expect(hasPermission("finance_manager", "wallet.approve")).toBe(true);
    expect(hasPermission("finance_manager", "wallet.reject")).toBe(true);
    expect(hasPermission("finance_manager", "users.impersonate")).toBe(false);
    expect(hasPermission("finance_manager", "admins.create")).toBe(false);
  });

  it("marketplace_manager cannot touch wallets", () => {
    expect(hasPermission("marketplace_manager", "wallet.approve")).toBe(false);
    expect(hasPermission("marketplace_manager", "marketplaces.configure")).toBe(true);
  });

  it("support_agent cannot access finance or security", () => {
    expect(hasPermission("support_agent", "wallet.view")).toBe(false);
    expect(hasPermission("support_agent", "security.audit_logs")).toBe(false);
    expect(hasPermission("support_agent", "users.view")).toBe(true);
  });

  it("undefined role grants nothing", () => {
    expect(hasPermission(undefined, "users.view")).toBe(false);
  });

  it("permissionsForRole dedupes inherited + own permissions", () => {
    const agentPerms = permissionsForRole("support_agent");
    const set = new Set(agentPerms);
    expect(set.size).toBe(agentPerms.length);
    expect(agentPerms).toContain("users.view");
  });

  it("super_admin permission set includes governance-critical grants", () => {
    const perms = permissionsForRole("super_admin");
    for (const p of ["system.restore", "security.audit_logs", "feature_flags.schedule", "users.impersonate", "ai_governance.test"] as const) {
      expect(perms).toContain(p);
    }
  });
});
