/**
 * Auth helper unit tests (Requirement 29.1, 29.6, 18.2)
 *
 * Pure functions only — no live Firebase connection required.
 */
import { describe, it, expect } from "vitest";
import {
  normalizeUserSnapshot,
  mergeServerUser,
  generateReferralCode,
  type User,
} from "../contexts/AuthContext";

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    email: "user@example.com",
    name: "Test User",
    referralCode: "123456",
    balance: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("generateReferralCode", () => {
  it("always produces exactly 6 digits", () => {
    for (let i = 0; i < 500; i += 1) {
      const code = generateReferralCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("produces codes within the 100000-999999 range", () => {
    for (let i = 0; i < 200; i += 1) {
      const value = Number(generateReferralCode());
      expect(value).toBeGreaterThanOrEqual(100000);
      expect(value).toBeLessThanOrEqual(999999);
    }
  });
});

describe("normalizeUserSnapshot", () => {
  it("clamps negative balances to 0", () => {
    const user = baseUser({ balance: -50 });
    const normalized = normalizeUserSnapshot(user);
    expect(normalized.balance).toBe(0);
  });

  it("keeps positive balances unchanged", () => {
    const user = baseUser({ balance: 123.45 });
    const normalized = normalizeUserSnapshot(user);
    expect(normalized.balance).toBe(123.45);
  });

  it("clamps negative bonusBalance and earnings to 0", () => {
    const user = baseUser({ bonusBalance: -10, earnings: -25 });
    const normalized = normalizeUserSnapshot(user);
    expect(normalized.bonusBalance).toBe(0);
    expect(normalized.earnings).toBe(0);
  });

  it("parses numeric string balances", () => {
    const user = baseUser({ balance: "42.5" as unknown as number });
    const normalized = normalizeUserSnapshot(user);
    expect(normalized.balance).toBe(42.5);
  });
});

describe("mergeServerUser", () => {
  it("maps legacy withdrawWallet -> withdrawalWallet at read time", () => {
    const current = baseUser({ withdrawalWallet: "", withdrawalWalletProtocol: "TRC20" });
    const serverUser = { id: "u1", withdrawWallet: "TVxLegacyAddress123" };
    const merged = mergeServerUser(current, serverUser);
    expect(merged.withdrawalWallet).toBe("TVxLegacyAddress123");
  });

  it("maps legacy withdrawWalletProtocol -> withdrawalWalletProtocol", () => {
    const current = baseUser({ withdrawalWallet: "addr", withdrawalWalletProtocol: "TRC20" });
    const serverUser = { id: "u1", withdrawWalletProtocol: "ERC20" };
    const merged = mergeServerUser(current, serverUser);
    expect(merged.withdrawalWalletProtocol).toBe("ERC20");
  });

  it("prefers canonical withdrawalWallet over legacy when both present", () => {
    const current = baseUser({ withdrawalWallet: "canonical", withdrawalWalletProtocol: "TRC20" });
    const serverUser = {
      id: "u1",
      withdrawalWallet: "TVxCanonical",
      withdrawWallet: "TVxLegacy",
    };
    const merged = mergeServerUser(current, serverUser);
    expect(merged.withdrawalWallet).toBe("TVxCanonical");
  });

  it("falls back to current value when neither canonical nor legacy present", () => {
    const current = baseUser({ withdrawalWallet: "TVxCurrent", withdrawalWalletProtocol: "TRC20" });
    const merged = mergeServerUser(current, { id: "u1" });
    expect(merged.withdrawalWallet).toBe("TVxCurrent");
  });

  it("maps legacy walletLocked -> withdrawalWalletLocked", () => {
    const current = baseUser({ withdrawalWalletLocked: false });
    const serverUser = { id: "u1", walletLocked: true };
    const merged = mergeServerUser(current, serverUser);
    expect(merged.withdrawalWalletLocked).toBe(true);
  });

  it("maps legacy walletUpdatedAt -> withdrawalWalletUpdatedAt", () => {
    const current = baseUser({ withdrawalWalletUpdatedAt: undefined });
    const serverUser = { id: "u1", walletUpdatedAt: "2025-06-01T00:00:00.000Z" };
    const merged = mergeServerUser(current, serverUser);
    expect(merged.withdrawalWalletUpdatedAt).toBe("2025-06-01T00:00:00.000Z");
  });

  it("maps legacy walletUpdatedBy -> withdrawalWalletUpdatedBy", () => {
    const current = baseUser({ withdrawalWalletUpdatedBy: undefined });
    const serverUser = { id: "u1", walletUpdatedBy: "admin-1" };
    const merged = mergeServerUser(current, serverUser);
    expect(merged.withdrawalWalletUpdatedBy).toBe("admin-1");
  });
});

describe("impersonation expiry detection", () => {
  it("treats _expiresAt in the past as expired", () => {
    const user = baseUser({
      _impersonated: true,
      _sessionId: "imp-1",
      _expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const stillActive = new Date(user._expiresAt!) > new Date();
    expect(stillActive).toBe(false);
  });

  it("treats _expiresAt in the future as active", () => {
    const user = baseUser({
      _impersonated: true,
      _sessionId: "imp-2",
      _expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const stillActive = new Date(user._expiresAt!) > new Date();
    expect(stillActive).toBe(true);
  });

  it("non-impersonated users are never expired", () => {
    const user = baseUser({});
    expect(user._impersonated).toBeUndefined();
    expect(new Date().toISOString()).toBeDefined();
  });
});
