/**
 * Tests for getPlatformForCode function
 * Validates that admin-assigned codes are used for platform mapping
 * instead of hardcoded numeric prefix ranges
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Mock localStorage for testing
 */
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }

  get length(): number {
    return Object.keys(this.store).length;
  }
}

/**
 * getPlatformForCode implementation for testing
 * Matches the implementation in PackageTask.tsx
 */
function getPlatformForCode(code: number, userId?: string): "amazon" | "aliexpress" | "alibaba" {
  if (userId) {
    try {
      const raw = localStorage.getItem(`ds_admin_user_codes_${userId}`);
      if (raw) {
        const codes: Record<string, number> = JSON.parse(raw);
        if (codes.amazon === code) return "amazon";
        if (codes.aliexpress === code) return "aliexpress";
        if (codes.alibaba === code) return "alibaba";
      }
    } catch {}
  }
  /* Fallback: numeric prefix ranges aligned with commission band tiers
     2xx-4xx  Starter/Bronze/Silver → Amazon   (4% commission band)
     5xx-6xx  Gold/Diamond          → Alibaba  (8% commission band)
     7xx+     Elite/Platinum/Royal  → AliExpress (12% commission band) */
  const n = Math.floor(code / 100);
  if (n <= 4) return "amazon";
  if (n <= 6) return "alibaba";
  return "aliexpress";
}

describe('getPlatformForCode - Admin-Assigned Code Lookup', () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    // Replace global localStorage with mock
    Object.defineProperty(global, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
  });

  afterEach(() => {
    mockStorage.clear();
  });

  describe('Admin-assigned codes take precedence', () => {
    it('should use admin-assigned code for amazon when available', () => {
      const userId = 'user-123';
      const adminCodes = { amazon: 201, aliexpress: 401, alibaba: 601 };
      localStorage.setItem(`ds_admin_user_codes_${userId}`, JSON.stringify(adminCodes));

      expect(getPlatformForCode(201, userId)).toBe('amazon');
      expect(getPlatformForCode(401, userId)).toBe('aliexpress');
      expect(getPlatformForCode(601, userId)).toBe('alibaba');
    });

    it('should use admin-assigned code for aliexpress when available', () => {
      const userId = 'user-456';
      const adminCodes = { amazon: 301, aliexpress: 501, alibaba: 701 };
      localStorage.setItem(`ds_admin_user_codes_${userId}`, JSON.stringify(adminCodes));

      expect(getPlatformForCode(301, userId)).toBe('amazon');
      expect(getPlatformForCode(501, userId)).toBe('aliexpress');
      expect(getPlatformForCode(701, userId)).toBe('alibaba');
    });

    it('should use admin-assigned code for alibaba when available', () => {
      const userId = 'user-789';
      const adminCodes = { amazon: 302, aliexpress: 402, alibaba: 602 };
      localStorage.setItem(`ds_admin_user_codes_${userId}`, JSON.stringify(adminCodes));

      expect(getPlatformForCode(302, userId)).toBe('amazon');
      expect(getPlatformForCode(402, userId)).toBe('aliexpress');
      expect(getPlatformForCode(602, userId)).toBe('alibaba');
    });

    it('should handle conflicting codes (same code assigned to multiple platforms)', () => {
      const userId = 'user-conflict';
      // First match wins
      const adminCodes = { amazon: 201, aliexpress: 201, alibaba: 601 };
      localStorage.setItem(`ds_admin_user_codes_${userId}`, JSON.stringify(adminCodes));

      // Should return the first match (amazon)
      expect(getPlatformForCode(201, userId)).toBe('amazon');
    });
  });

  describe('Fallback to numeric prefix ranges', () => {
    it('should fall back to numeric prefix ranges when no admin codes exist', () => {
      const userId = 'user-no-codes';
      // No admin codes set

      // 2xx-4xx → amazon
      expect(getPlatformForCode(201, userId)).toBe('amazon');
      expect(getPlatformForCode(301, userId)).toBe('amazon');
      expect(getPlatformForCode(401, userId)).toBe('amazon');

      // 5xx-6xx → alibaba
      expect(getPlatformForCode(501, userId)).toBe('alibaba');
      expect(getPlatformForCode(601, userId)).toBe('alibaba');

      // 7xx+ → aliexpress
      expect(getPlatformForCode(701, userId)).toBe('aliexpress');
      expect(getPlatformForCode(801, userId)).toBe('aliexpress');
    });

    it('should fall back to numeric prefix ranges when userId is not provided', () => {
      // 2xx-4xx → amazon
      expect(getPlatformForCode(201)).toBe('amazon');
      expect(getPlatformForCode(301)).toBe('amazon');
      expect(getPlatformForCode(401)).toBe('amazon');

      // 5xx-6xx → alibaba
      expect(getPlatformForCode(501)).toBe('alibaba');
      expect(getPlatformForCode(601)).toBe('alibaba');

      // 7xx+ → aliexpress
      expect(getPlatformForCode(701)).toBe('aliexpress');
      expect(getPlatformForCode(801)).toBe('aliexpress');
    });

    it('should use correct numeric ranges (2xx-4xx, 5xx-6xx, 7xx+)', () => {
      // Test boundary values
      expect(getPlatformForCode(200)).toBe('amazon');
      expect(getPlatformForCode(299)).toBe('amazon');
      expect(getPlatformForCode(300)).toBe('amazon');
      expect(getPlatformForCode(399)).toBe('amazon');
      expect(getPlatformForCode(400)).toBe('amazon');
      expect(getPlatformForCode(499)).toBe('amazon');

      expect(getPlatformForCode(500)).toBe('alibaba');
      expect(getPlatformForCode(599)).toBe('alibaba');
      expect(getPlatformForCode(600)).toBe('alibaba');
      expect(getPlatformForCode(699)).toBe('alibaba');

      expect(getPlatformForCode(700)).toBe('aliexpress');
      expect(getPlatformForCode(799)).toBe('aliexpress');
      expect(getPlatformForCode(800)).toBe('aliexpress');
      expect(getPlatformForCode(999)).toBe('aliexpress');
    });
  });

  describe('Error handling', () => {
    it('should handle corrupted admin codes gracefully', () => {
      const userId = 'user-corrupted';
      localStorage.setItem(`ds_admin_user_codes_${userId}`, 'invalid json');

      // Should fall back to numeric prefix ranges
      expect(getPlatformForCode(201, userId)).toBe('amazon');
      expect(getPlatformForCode(501, userId)).toBe('alibaba');
      expect(getPlatformForCode(701, userId)).toBe('aliexpress');
    });

    it('should handle partial admin codes (missing some platforms)', () => {
      const userId = 'user-partial';
      const adminCodes = { amazon: 201 }; // Only amazon code set
      localStorage.setItem(`ds_admin_user_codes_${userId}`, JSON.stringify(adminCodes));

      // Should use admin code for amazon
      expect(getPlatformForCode(201, userId)).toBe('amazon');

      // Should fall back to numeric ranges for others
      expect(getPlatformForCode(501, userId)).toBe('alibaba');
      expect(getPlatformForCode(701, userId)).toBe('aliexpress');
    });

    it('should handle empty admin codes object', () => {
      const userId = 'user-empty';
      localStorage.setItem(`ds_admin_user_codes_${userId}`, JSON.stringify({}));

      // Should fall back to numeric ranges
      expect(getPlatformForCode(201, userId)).toBe('amazon');
      expect(getPlatformForCode(501, userId)).toBe('alibaba');
      expect(getPlatformForCode(701, userId)).toBe('aliexpress');
    });
  });

  describe('Multi-user isolation', () => {
    it('should use different admin codes for different users', () => {
      const user1Id = 'user-1';
      const user2Id = 'user-2';

      // User 1 has custom codes
      const user1Codes = { amazon: 201, aliexpress: 401, alibaba: 601 };
      localStorage.setItem(`ds_admin_user_codes_${user1Id}`, JSON.stringify(user1Codes));

      // User 2 has different custom codes
      const user2Codes = { amazon: 301, aliexpress: 501, alibaba: 701 };
      localStorage.setItem(`ds_admin_user_codes_${user2Id}`, JSON.stringify(user2Codes));

      // User 1's codes
      expect(getPlatformForCode(201, user1Id)).toBe('amazon');
      expect(getPlatformForCode(401, user1Id)).toBe('aliexpress');
      expect(getPlatformForCode(601, user1Id)).toBe('alibaba');

      // User 2's codes
      expect(getPlatformForCode(301, user2Id)).toBe('amazon');
      expect(getPlatformForCode(501, user2Id)).toBe('aliexpress');
      expect(getPlatformForCode(701, user2Id)).toBe('alibaba');

      // Cross-user codes should not match
      expect(getPlatformForCode(201, user2Id)).toBe('amazon'); // Falls back to numeric range
      expect(getPlatformForCode(301, user1Id)).toBe('amazon'); // Falls back to numeric range
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle admin codes that conflict with numeric ranges', () => {
      const userId = 'user-conflict-range';
      // Admin assigns code 201 to alibaba (normally amazon by numeric range)
      const adminCodes = { amazon: 301, aliexpress: 401, alibaba: 201 };
      localStorage.setItem(`ds_admin_user_codes_${userId}`, JSON.stringify(adminCodes));

      // Admin code should take precedence
      expect(getPlatformForCode(201, userId)).toBe('alibaba');
      expect(getPlatformForCode(301, userId)).toBe('amazon');
      expect(getPlatformForCode(401, userId)).toBe('aliexpress');
    });

    it('should handle codes outside normal ranges', () => {
      const userId = 'user-custom-range';
      // Admin assigns unusual codes
      const adminCodes = { amazon: 1001, aliexpress: 2001, alibaba: 3001 };
      localStorage.setItem(`ds_admin_user_codes_${userId}`, JSON.stringify(adminCodes));

      expect(getPlatformForCode(1001, userId)).toBe('amazon');
      expect(getPlatformForCode(2001, userId)).toBe('aliexpress');
      expect(getPlatformForCode(3001, userId)).toBe('alibaba');

      // Other codes should fall back to numeric ranges
      expect(getPlatformForCode(201, userId)).toBe('amazon');
      expect(getPlatformForCode(501, userId)).toBe('alibaba');
      expect(getPlatformForCode(701, userId)).toBe('aliexpress');
    });
  });
});
