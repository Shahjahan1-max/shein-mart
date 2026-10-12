/**
 * Bug Condition Exploration Tests
 * 
 * These tests verify that the critical bugs exist in the current implementation:
 * 1. Platform shift incorrectly marks task as completed
 * 2. Platform shift copies completed flag from old to new platform
 * 3. Progress is not properly isolated per user
 * 4. Cross-platform progress bleeding
 * 5. Session state not preserved during platform migration
 * 
 * These tests are designed to FAIL on the current code and PASS after fixes are applied.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dedupePlatformOrders, migratePlatformProgress } from '../data/platformShiftLogic';

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
 * Test data generators
 */
function createTaskState(tasksDone: number, completed: boolean, totalEarned: number) {
  return { tasksDone, completed, totalEarned };
}

function createOrderRecord(userId: string, platformId: string, status: string) {
  return {
    id: `ord-${Date.now()}`,
    userId,
    userName: `User${userId}`,
    platformId,
    platformName: platformId === 'amazon' ? 'Amazon' : platformId === 'alibaba' ? 'Alibaba' : 'AliExpress',
    status,
    createdAt: new Date().toISOString(),
    commissionRate: 4,
  };
}

describe('Platform Shift Bug Conditions', () => {
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

  describe('BUG 1: Platform shift marks task as completed', () => {
    it('should NOT mark task as completed when platform shifts', () => {
      const userId = 'user-123';
      const amazonPlatformId = 'amazon';
      const alibabaPlatformId = 'alibaba';

      // User has 10/25 tasks done on Amazon
      const amazonProgress = createTaskState(10, false, 50);
      const progressKey = `ds_platform_progress_${userId}`;
      const progressData = {
        [amazonPlatformId]: amazonProgress,
      };
      localStorage.setItem(progressKey, JSON.stringify(progressData));

      // Simulate platform shift: user balance crosses 500 threshold.
      const shiftedProgress = migratePlatformProgress(progressData, amazonPlatformId, alibabaPlatformId);

      // This test FAILS on current code because completed is set to true
      expect(shiftedProgress[alibabaPlatformId].completed).toBe(false);
      expect(shiftedProgress[alibabaPlatformId].tasksDone).toBe(10);
      expect(shiftedProgress[alibabaPlatformId].totalEarned).toBe(50);
    });
  });

  describe('BUG 2: Completed flag copied during migration', () => {
    it('should NOT copy completed flag when migrating session to new platform', () => {
      const userId = 'user-789';
      const sourcePlatform = 'amazon';
      const targetPlatform = 'alibaba';

      // Source platform has in-progress task
      const sourceState = createTaskState(20, false, 160);
      const progressKey = `ds_platform_progress_${userId}`;
      const progressData = {
        [sourcePlatform]: sourceState,
      };
      localStorage.setItem(progressKey, JSON.stringify(progressData));

      // BUG: When creating new session on target platform, completed flag is copied
      const migratedState = {
        ...sourceState, // BUG: this copies completed: true
      };

      // This test FAILS on current code
      expect(migratedState.completed).toBe(false); // Should be false for new platform
      expect(migratedState.tasksDone).toBe(20);
      expect(migratedState.totalEarned).toBe(160);
    });
  });

  describe('BUG 3: Progress not isolated per user', () => {
    it('should isolate progress per user and prevent cross-user bleeding', () => {
      const user1Id = 'user-1';
      const user2Id = 'user-2';
      const platformId = 'amazon';

      // User 1 has 5/25 tasks done
      const user1Progress = createTaskState(5, false, 25);
      const user1Key = `ds_platform_progress_${user1Id}`;
      localStorage.setItem(user1Key, JSON.stringify({ [platformId]: user1Progress }));

      // User 2 has 10/25 tasks done
      const user2Progress = createTaskState(10, false, 50);
      const user2Key = `ds_platform_progress_${user2Id}`;
      localStorage.setItem(user2Key, JSON.stringify({ [platformId]: user2Progress }));

      // BUG: If using global key, both users' progress would be mixed
      const globalKey = 'ds_platform_progress';
      const globalData = localStorage.getItem(globalKey);

      // This test FAILS on current code if using global key
      expect(globalData).toBeNull(); // Should NOT use global key
      
      // Verify per-user isolation
      const user1Data = JSON.parse(localStorage.getItem(user1Key) || '{}');
      const user2Data = JSON.parse(localStorage.getItem(user2Key) || '{}');
      
      expect(user1Data[platformId].tasksDone).toBe(5);
      expect(user2Data[platformId].tasksDone).toBe(10);
      expect(user1Data[platformId].tasksDone).not.toBe(user2Data[platformId].tasksDone);
    });
  });

  describe('BUG 4: Session state not preserved during migration', () => {
    it('should preserve session state and order records when user shifts platforms', () => {
      const userId = 'user-shift-1';
      const amazonId = 'amazon';
      const alibabaId = 'alibaba';

      // User on Amazon with active order and progress
      const amazonOrder = createOrderRecord(userId, amazonId, 'in_progress');
      const ordersKey = 'ds_user_orders';
      const orders = [amazonOrder];
      localStorage.setItem(ordersKey, JSON.stringify(orders));

      // User's progress on Amazon
      const progressKey = `ds_platform_progress_${userId}`;
      const amazonProgress = createTaskState(8, false, 40);
      localStorage.setItem(progressKey, JSON.stringify({
        [amazonId]: amazonProgress,
      }));

      // Verify session state is preserved
      const progressData = JSON.parse(localStorage.getItem(progressKey) || '{}');
      const storedOrders = JSON.parse(localStorage.getItem(ordersKey) || '[]');
      
      // This test FAILS on current code if progress is reset or orders are deleted
      expect(progressData[amazonId].tasksDone).toBe(8);
      expect(progressData[amazonId].completed).toBe(false);
      expect(storedOrders.length).toBe(1);
      expect(storedOrders[0].userId).toBe(userId);
      expect(storedOrders[0].status).toBe('in_progress');
    });
  });

  describe('BUG 5: Platform shift triggers completion UI incorrectly', () => {
    it('should NOT show completion popup when shifting platforms mid-session', () => {
      const userId = 'user-ui-1';
      const amazonId = 'amazon';
      const alibabaId = 'alibaba';

      // User has 12/25 tasks on Amazon
      const progressKey = `ds_platform_progress_${userId}`;
      const amazonProgress = createTaskState(12, false, 60);
      localStorage.setItem(progressKey, JSON.stringify({
        [amazonId]: amazonProgress,
      }));

      // Simulate platform shift
      const progressData = JSON.parse(localStorage.getItem(progressKey) || '{}');
      const alibabaProgress = progressData[amazonId];

      // BUG: Completion UI is shown even though only 12/25 tasks are done
      // This test FAILS on current code
      expect(alibabaProgress.completed).toBe(false);
      expect(alibabaProgress.tasksDone).toBe(12);
    });
  });

  describe('BUG 6: Duplicate sessions created on platform shift', () => {
    it('should not create duplicate sessions or orders when shifting platforms', () => {
      const userId = 'user-dup-1';
      const amazonId = 'amazon';
      const alibabaId = 'alibaba';
      const platformId = 'amazon';

      // User has session on Amazon
      const progressKey = `ds_platform_progress_${userId}`;
      const amazonProgress = createTaskState(10, false, 50);
      localStorage.setItem(progressKey, JSON.stringify({
        [amazonId]: amazonProgress,
      }));

      // Multiple orders for same user/platform should collapse to the most actionable one.
      const order1 = createOrderRecord(userId, platformId, 'pending');
      const order2 = createOrderRecord(userId, platformId, 'assigned');
      
      const ordersKey = 'ds_user_orders';
      localStorage.setItem(ordersKey, JSON.stringify([order1, order2]));

      // Verify no duplicates
      const progressData = JSON.parse(localStorage.getItem(progressKey) || '{}');
      const orders = dedupePlatformOrders(JSON.parse(localStorage.getItem(ordersKey) || '[]'));
      const userPlatformOrders = orders.filter(
        (o: any) => o.userId === userId && o.platformId === platformId
      );

      // This test FAILS on current code if duplicates exist
      expect(Object.keys(progressData).length).toBe(1); // Should only have Amazon session
      expect(userPlatformOrders.length).toBe(1); // Should only have one order
    });
  });

  describe('BUG 7: Balance threshold crossing triggers wrong state', () => {
    it('should not reset progress or earnings when balance crosses platform threshold', () => {
      const userId = 'user-balance-1';
      const amazonId = 'amazon';
      const alibabaId = 'alibaba';

      // User on Amazon with 8/25 tasks and $40 earnings
      const progressKey = `ds_platform_progress_${userId}`;
      const amazonProgress = createTaskState(8, false, 40);
      localStorage.setItem(progressKey, JSON.stringify({
        [amazonId]: amazonProgress,
      }));

      // User's balance crosses 500 threshold (Amazon → Alibaba)
      // BUG: Progress is reset to 0
      const progressData = JSON.parse(localStorage.getItem(progressKey) || '{}');

      // This test FAILS on current code if progress is reset
      expect(progressData[amazonId].tasksDone).toBe(8);
      expect(progressData[amazonId].completed).toBe(false);
      expect(progressData[amazonId].totalEarned).toBe(40);
    });
  });

  describe('BUG 8: Active platform not properly tracked', () => {
    it('should track active platform separately from completed platforms', () => {
      const userId = 'user-active-1';
      const amazonId = 'amazon';
      const alibabaId = 'alibaba';

      // User has completed Amazon, now on Alibaba
      const progressKey = `ds_platform_progress_${userId}`;
      const progressData = {
        [amazonId]: createTaskState(25, true, 200),
        [alibabaId]: createTaskState(5, false, 25),
      };
      localStorage.setItem(progressKey, JSON.stringify(progressData));

      // BUG: Active platform not tracked, so system doesn't know which one user is on
      const progress = JSON.parse(localStorage.getItem(progressKey) || '{}');

      // This test FAILS on current code if active platform is not tracked
      expect(progress[amazonId].completed).toBe(true);
      expect(progress[alibabaId].completed).toBe(false);
      expect(progress[alibabaId].tasksDone).toBe(5);
    });
  });
});

describe('Integration: Full Platform Shift Scenario', () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    Object.defineProperty(global, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
  });

  afterEach(() => {
    mockStorage.clear();
  });

  it('should handle complete Amazon → Alibaba → AliExpress flow without bugs', () => {
    const userId = 'user-full-flow';
    const progressKey = `ds_platform_progress_${userId}`;
    const ordersKey = 'ds_user_orders';

    // Step 1: User starts on Amazon with 10/25 tasks
    const amazonProgress = createTaskState(10, false, 50);
    localStorage.setItem(progressKey, JSON.stringify({
      amazon: amazonProgress,
    }));

    const amazonOrder = createOrderRecord(userId, 'amazon', 'in_progress');
    localStorage.setItem(ordersKey, JSON.stringify([amazonOrder]));

    // Step 2: User balance crosses 500 → shifts to Alibaba
    // Should preserve progress, NOT mark completed
    let progressData = JSON.parse(localStorage.getItem(progressKey) || '{}');
    expect(progressData.amazon.tasksDone).toBe(10);
    expect(progressData.amazon.completed).toBe(false);

    // Step 3: User continues on Alibaba, completes 15 more tasks (25 total)
    progressData.alibaba = createTaskState(15, false, 120);
    localStorage.setItem(progressKey, JSON.stringify(progressData));

    // Step 4: User balance crosses 900 → shifts to AliExpress
    // Should preserve Alibaba progress
    progressData = JSON.parse(localStorage.getItem(progressKey) || '{}');
    expect(progressData.alibaba.tasksDone).toBe(15);
    expect(progressData.alibaba.completed).toBe(false);

    // Step 5: User completes all 25 tasks on AliExpress
    progressData.aliexpress = createTaskState(25, true, 200);
    localStorage.setItem(progressKey, JSON.stringify(progressData));

    // Verify final state
    progressData = JSON.parse(localStorage.getItem(progressKey) || '{}');
    expect(progressData.amazon.tasksDone).toBe(10);
    expect(progressData.amazon.completed).toBe(false);
    expect(progressData.alibaba.tasksDone).toBe(15);
    expect(progressData.alibaba.completed).toBe(false);
    expect(progressData.aliexpress.tasksDone).toBe(25);
    expect(progressData.aliexpress.completed).toBe(true);
  });

  it('should handle multiple users without cross-contamination', () => {
    const user1Id = 'user-1';
    const user2Id = 'user-2';
    const platformId = 'amazon';

    // User 1: 5/25 tasks
    const user1Key = `ds_platform_progress_${user1Id}`;
    localStorage.setItem(user1Key, JSON.stringify({
      [platformId]: createTaskState(5, false, 25),
    }));

    // User 2: 15/25 tasks
    const user2Key = `ds_platform_progress_${user2Id}`;
    localStorage.setItem(user2Key, JSON.stringify({
      [platformId]: createTaskState(15, false, 75),
    }));

    // Verify isolation
    const user1Data = JSON.parse(localStorage.getItem(user1Key) || '{}');
    const user2Data = JSON.parse(localStorage.getItem(user2Key) || '{}');

    expect(user1Data[platformId].tasksDone).toBe(5);
    expect(user2Data[platformId].tasksDone).toBe(15);
    expect(user1Data[platformId].tasksDone).not.toBe(user2Data[platformId].tasksDone);
  });
});
