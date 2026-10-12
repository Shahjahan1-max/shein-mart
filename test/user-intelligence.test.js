/**
 * user-intelligence.test.js — Enterprise Test Suite for Fraud Risk Engine v3.4
 *
 * Verifies:
 * 1. All 12 canonical behavioral archetypes from specifications:
 *    - Archetype 1: Organic Active Earner -> REAL
 *    - Archetype 2: Script Task-Farmer (Machine-Regular CV < 0.15) -> SUSPICIOUS (A02)
 *    - Archetype 3: Burst Farmer (>10 tasks in 10 min) -> SUSPICIOUS (A03)
 *    - Archetype 4: Direct-API Completion (No sessions/tokens) -> SUSPICIOUS (A10)
 *    - Archetype 5: Counter vs Ledger Mismatch -> SUSPICIOUS (A12)
 *    - Archetype 6: Seeded / Admin-Credited Balance -> SUSPICIOUS / LIKELY_FAKE (A14)
 *    - Archetype 7: Impossible Progress vs Account Age -> SUSPICIOUS (A07)
 *    - Archetype 8: Cohort Clone / Synchronized -> LIKELY_FAKE (A17)
 *    - Archetype 9: Deposit-Only User (Rahad Hasan pattern) -> MANUAL_REVIEW / SUSPICIOUS
 *    - Archetype 10: Brand-New User -> MANUAL_REVIEW
 *    - Archetype 11: Dormant Real User -> LIKELY_REAL
 *    - Archetype 12: High-Value Legit Investor -> REAL
 * 2. Sybil hardware cluster -> FAKE
 * 3. Pass-through turnaround -> SUSPICIOUS / LIKELY_FAKE
 * 4. Boundary tests for thresholds & gapless matrix verification
 */

import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RISK_CONFIG } from "../server/user-intelligence-config.js";
import {
  extractUserSignals,
  computeGenuineScore,
  computeRiskScore,
  classifyProfile,
  computeProgressAuthenticity,
} from "../server/risk-engine.js";

// Helper to evaluate a raw profile fixture with optional context
function evaluateFixture(rawProfile, allProfiles = [], config = DEFAULT_RISK_CONFIG, extraContext = {}) {
  const context = { allProfiles, ...extraContext };
  const signals = extractUserSignals(rawProfile, context);
  const genuineResult = computeGenuineScore(signals, config);
  const riskResult = computeRiskScore(signals, config);
  const evaluation = classifyProfile(signals, genuineResult, riskResult, config);
  return { signals, genuineResult, riskResult, evaluation };
}

// ── Archetype 1: Organic Active Earner -> REAL ─────────────────────────────────
test("Archetype 1: Organic Active Earner -> REAL", () => {
  const now = Date.now();
  const rawCompletions = [];
  const rawSessions = [];

  for (let s = 0; s < 12; s++) {
    rawSessions.push({
      id: `sess-${s}`,
      userId: "user-organic-1",
      tasksCompleted: 2,
      status: "completed",
      createdAt: new Date(now - (30 - s * 2) * 86400000).toISOString(),
    });
  }

  for (let i = 0; i < 25; i++) {
    const sessionIdx = Math.floor(i / 2);
    const started = new Date(now - (30 - sessionIdx * 2) * 86400000).toISOString();
    const completed = new Date(now - (30 - sessionIdx * 2) * 86400000 + 45000).toISOString();
    rawCompletions.push({
      id: `tc-${i}`,
      taskId: `task-unique-${i}`,
      sessionId: `sess-${sessionIdx}`,
      assignmentId: `asg-${i}`,
      startedAt: started,
      completedAt: completed,
      createdAt: completed,
      status: "completed",
    });
  }

  const profile = {
    userId: "user-organic-1",
    username: "sarah_miller",
    name: "Sarah Miller",
    email: "sarah.miller@gmail.com",
    emailVerified: true,
    phoneVerified: true,
    country: "United States",
    accountAgeDays: 45,
    completedTasksCount: 25,
    earnings: 12.5,
    depositsCount: 3,
    totalDepositAmount: 200.0,
    withdrawalsCount: 1,
    totalWithdrawalAmount: 150.0,
    accountBalance: 62.5, // 200 + 12.5 - 150 = 62.5 (Perfect reconciliation!)
    taskSessionsCount: 12,
    sessionDatesCount: 9,
    hasSupportActivity: true,
    supportTicketsCount: 1,
    supportMessagesCount: 3,
    devices: ["device-unique-sarah"],
    ips: ["192.0.2.1"],
    rawTaskCompletions: rawCompletions,
    rawTaskSessions: rawSessions,
  };

  const { evaluation } = evaluateFixture(profile);
  assert.equal(evaluation.classification, "REAL", "Organic active earner must be classified as REAL");
  assert.ok(evaluation.genuineScore >= 80, `Genuine score should be >= 80, got ${evaluation.genuineScore}`);
  assert.ok(evaluation.riskScore <= 15, `Risk score should be <= 15, got ${evaluation.riskScore}`);
  assert.ok(evaluation.allRealGatesPass, "All Real gates must pass");
  assert.ok(evaluation.confidence >= 0.70, "Confidence should be high");
  assert.equal(evaluation.authenticity.isArtificial, false, "Must not be flagged artificial");
});

// ── Archetype 2: Script Task-Farmer (Machine Regular CV < 0.15) -> SUSPICIOUS ──
test("Archetype 2: Script Task-Farmer (Machine-Regular Intervals CV < 0.15) -> SUSPICIOUS (A02)", () => {
  const baseTs = Date.now() - 3600000;
  const rawCompletions = [];
  // 15 completions spaced exactly 60.0 seconds apart (+- 0.5s) -> robotic rhythm
  for (let i = 0; i < 15; i++) {
    const ts = baseTs + (i * 60000);
    rawCompletions.push({
      id: `script-tc-${i}`,
      taskId: `task-item-${i}`,
      sessionId: "script-session-1",
      assignmentId: `script-asg-${i}`,
      startedAt: new Date(ts - 30000).toISOString(),
      completedAt: new Date(ts).toISOString(),
      createdAt: new Date(ts).toISOString(),
    });
  }

  const profile = {
    userId: "user-script-farmer",
    username: "kevin_farmer_99",
    email: "kevin99@myrealmail.com",
    emailVerified: true,
    accountAgeDays: 25,
    completedTasksCount: 15,
    earnings: 7.5,
    accountBalance: 7.5,
    taskSessionsCount: 1,
    sessionDatesCount: 1,
    devices: ["dev-kevin-1"],
    ips: ["198.51.100.99"],
    rawTaskCompletions: rawCompletions,
  };

  const { evaluation } = evaluateFixture(profile);
  assert.notEqual(evaluation.classification, "REAL", "Bot farmer must NEVER be REAL");
  assert.notEqual(evaluation.classification, "LIKELY_REAL", "Bot farmer must NEVER be LIKELY_REAL");
  assert.equal(evaluation.classification, "SUSPICIOUS", "Bot farmer must be SUSPICIOUS");
  assert.ok(evaluation.reasonCodes.includes("A02"), "Must trigger A02 Machine-Regular Intervals");
  assert.ok(evaluation.authenticity.hasStrongFlag, "Must have strong artificial flag");
});

// ── Archetype 3: Burst Farmer (>10 tasks in 10 minutes) -> SUSPICIOUS ──────────
test("Archetype 3: Burst Farmer (>10 tasks in 10 min) -> SUSPICIOUS (A03)", () => {
  const baseTs = Date.now() - 600000;
  const rawCompletions = [];
  // 12 completions in 4 minutes (burst)
  for (let i = 0; i < 12; i++) {
    const ts = baseTs + (i * 20000); // 20s apart
    rawCompletions.push({
      id: `burst-tc-${i}`,
      taskId: `task-${i}`,
      sessionId: `sess-${i}`,
      assignmentId: `asg-${i}`,
      startedAt: new Date(ts - 16000).toISOString(),
      completedAt: new Date(ts).toISOString(),
      createdAt: new Date(ts).toISOString(),
    });
  }

  const profile = {
    userId: "user-burst-farmer",
    username: "quick_earner_jack",
    email: "jack@fastspeed.com",
    emailVerified: true,
    accountAgeDays: 30,
    completedTasksCount: 12,
    earnings: 6.0,
    accountBalance: 6.0,
    taskSessionsCount: 2,
    sessionDatesCount: 1,
    hasSubHumanDuration: true,
    devices: ["dev-jack"],
    ips: ["203.0.113.88"],
    rawTaskCompletions: rawCompletions,
  };

  const { evaluation } = evaluateFixture(profile);
  assert.notEqual(evaluation.classification, "REAL", "Burst farmer cannot be REAL");
  assert.ok(["SUSPICIOUS", "LIKELY_FAKE"].includes(evaluation.classification), `Must be SUSPICIOUS, got ${evaluation.classification}`);
  assert.ok(evaluation.reasonCodes.includes("A03") || evaluation.reasonCodes.includes("A01"));
});

// ── Archetype 4: Direct-API Completion (No sessions/tokens) -> SUSPICIOUS ──────
test("Archetype 4: Direct-API Completion (No sessions/tokens) -> SUSPICIOUS (A10)", () => {
  const rawCompletions = [];
  for (let i = 0; i < 10; i++) {
    rawCompletions.push({
      id: `api-tc-${i}`,
      taskId: `task-${i}`,
      status: "completed",
      completedAt: new Date().toISOString(),
    });
  }

  const profile = {
    userId: "user-direct-api",
    username: "terminal_client",
    email: "terminal@client.org",
    emailVerified: true,
    accountAgeDays: 25,
    completedTasksCount: 10,
    earnings: 5.0,
    accountBalance: 5.0,
    taskSessionsCount: 0,
    sessionDatesCount: 0,
    devices: ["dev-term"],
    ips: ["192.0.2.55"],
    rawTaskCompletions: rawCompletions,
    rawTaskSessions: [],
  };

  const { evaluation } = evaluateFixture(profile);
  assert.notEqual(evaluation.classification, "REAL", "Direct-API user must NEVER be REAL");
  assert.notEqual(evaluation.classification, "LIKELY_REAL", "Direct-API user must NEVER be LIKELY_REAL");
  assert.equal(evaluation.classification, "SUSPICIOUS", "Direct-API user must be SUSPICIOUS");
  assert.ok(evaluation.reasonCodes.includes("A10"), "Must trigger A10 Direct-API flag");
});

// ── Archetype 5: Counter != Ledger Mismatch -> SUSPICIOUS ──────────────────────
test("Archetype 5: Counter != Ledger Mismatch (Claimed > Raw Docs) -> SUSPICIOUS (A12)", () => {
  const rawCompletions = [
    { id: "tc-single", taskId: "t-1", sessionId: "s-1", completedAt: new Date().toISOString() },
  ];

  const profile = {
    userId: "user-ledger-tamper",
    username: "counter_manipulator",
    email: "manipulator@web.com",
    emailVerified: true,
    accountAgeDays: 30,
    completedTasksCount: 50,
    earnings: 25.0,
    accountBalance: 25.0,
    taskSessionsCount: 1,
    sessionDatesCount: 1,
    devices: ["dev-manip"],
    ips: ["192.0.2.66"],
    hasCounterLedgerMismatch: true,
    rawTaskCompletions: rawCompletions,
  };

  const { evaluation } = evaluateFixture(profile);
  assert.notEqual(evaluation.classification, "REAL", "Ledger tamperer cannot be REAL");
  assert.equal(evaluation.classification, "SUSPICIOUS", "Must be SUSPICIOUS");
  assert.ok(evaluation.reasonCodes.includes("A12"), "Must trigger A12 Counter vs Ledger mismatch");
});

// ── Archetype 6: Seeded / Admin-Credited Balance -> SUSPICIOUS / LIKELY_FAKE ───
test("Archetype 6: Seeded / Admin-Credited Balance (Unbacked Balance) -> SUSPICIOUS / LIKELY_FAKE (A14)", () => {
  const profile = {
    userId: "user-admin-seeded",
    username: "unbacked_holder",
    email: "holder@unbacked.com",
    emailVerified: true,
    accountAgeDays: 15,
    completedTasksCount: 0,
    earnings: 0.0,
    depositsCount: 0,
    totalDepositAmount: 0.0,
    withdrawalsCount: 0,
    totalWithdrawalAmount: 0.0,
    accountBalance: 500.0,
    hasUnbackedBalance: true,
    devices: ["dev-holder"],
    ips: ["192.0.2.77"],
  };

  const { evaluation } = evaluateFixture(profile);
  assert.notEqual(evaluation.classification, "REAL", "Unbacked balance cannot be REAL");
  assert.ok(
    ["SUSPICIOUS", "LIKELY_FAKE", "FAKE"].includes(evaluation.classification),
    `Unbacked balance must be flagged, got ${evaluation.classification}`
  );
  assert.ok(evaluation.reasonCodes.includes("A14") || evaluation.reasonCodes.includes("R04") || evaluation.reasonCodes.includes("R05"));
});

// ── Archetype 7: Impossible Progress vs Account Age -> SUSPICIOUS ──────────────
test("Archetype 7: Impossible Progress vs Account Age -> SUSPICIOUS (A07)", () => {
  const profile = {
    userId: "user-impossible-progress",
    username: "rapid_progress_mark",
    email: "rapid@usermail.com",
    emailVerified: true,
    accountAgeDays: 2,
    completedTasksCount: 200,
    earnings: 100.0,
    accountBalance: 100.0,
    taskSessionsCount: 2,
    sessionDatesCount: 2,
    devices: ["dev-rapid"],
    ips: ["192.0.2.88"],
  };

  const { evaluation } = evaluateFixture(profile);
  assert.notEqual(evaluation.classification, "REAL", "Impossible progress account cannot be REAL");
  assert.equal(evaluation.classification, "SUSPICIOUS", "Must be SUSPICIOUS");
  assert.ok(evaluation.reasonCodes.includes("A07"), "Must trigger A07 Impossible Progress vs Age");
});

// ── Archetype 8: Cohort Clone / Synchronized -> LIKELY_FAKE ────────────────────
test("Archetype 8: Cohort Clone (Synchronized Completions Across Accounts) -> LIKELY_FAKE (A17)", () => {
  const cloneProfile = {
    userId: "user-clone-1",
    username: "sybil_worker_1",
    email: "worker1@sybilnet.org",
    emailVerified: true,
    accountAgeDays: 25,
    completedTasksCount: 20,
    earnings: 10.0,
    accountBalance: 10.0,
    isCohortClone: true,
    hasSubHumanDuration: true,
    isDirectApi: true,
    devices: ["shared-dev-cluster"],
    ips: ["192.0.2.99"],
  };

  const { evaluation } = evaluateFixture(cloneProfile);
  assert.equal(evaluation.classification, "LIKELY_FAKE", "Cohort clone with multiple strong flags must be LIKELY_FAKE");
  assert.ok(evaluation.reasonCodes.includes("A17"), "Must trigger A17 Cohort Synchronization");
});

// ── Archetype 9: Deposit-Only User (Rahad Hasan pattern) ───────────────────────
test("Archetype 9: Deposit-Only User (Rahad Hasan pattern) -> Capped at MANUAL_REVIEW / SUSPICIOUS (NEVER REAL)", () => {
  const profile = {
    userId: "user-deposit-only-rahad",
    username: "rahad_hasan",
    name: "Rahad Hasan",
    email: "rahad@gmail.com",
    emailVerified: false,
    country: "Bangladesh",
    accountAgeDays: 32,
    completedTasksCount: 0,
    earnings: 0.0,
    depositsCount: 8,
    totalDepositAmount: 3571.53,
    withdrawalsCount: 0,
    totalWithdrawalAmount: 0.0,
    accountBalance: 3571.53,
    taskSessionsCount: 0,
    sessionDatesCount: 0,
    devices: ["device-rahad"],
    ips: ["203.0.113.5"],
  };

  const { evaluation } = evaluateFixture(profile);
  assert.notEqual(evaluation.classification, "REAL", "Deposit-only account must NEVER be REAL");
  assert.notEqual(evaluation.classification, "LIKELY_REAL", "Deposit-only account must NEVER be LIKELY_REAL");
  assert.ok(
    ["SUSPICIOUS", "MANUAL_REVIEW"].includes(evaluation.classification),
    `Deposit-only user must be SUSPICIOUS or MANUAL_REVIEW, received: ${evaluation.classification}`
  );
  assert.ok(evaluation.reasonCodes.includes("R06") || evaluation.reasonCodes.includes("R10"));
});

// ── Archetype 10: Brand-New User (Fresh signup, zero data) ────────────────────
test("Archetype 10: Brand-New User (Fresh signup, zero data) -> MANUAL_REVIEW", () => {
  const profile = {
    userId: "user-fresh-1",
    username: "john_doe",
    name: "John Doe",
    email: "john@example.com",
    accountAgeDays: 0,
    completedTasksCount: 0,
    depositsCount: 0,
    withdrawalsCount: 0,
    accountBalance: 0,
    devices: [],
    ips: [],
  };

  const { evaluation } = evaluateFixture(profile);
  assert.equal(evaluation.classification, "MANUAL_REVIEW", "New user without data must route to MANUAL_REVIEW");
  assert.equal(evaluation.decisionReason, "FRESH_ACCOUNT_NO_ACTIVITY");
});

// ── Archetype 11: Dormant Real User -> LIKELY_REAL ─────────────────────────────
test("Archetype 11: Dormant Real User -> LIKELY_REAL", () => {
  const profile = {
    userId: "user-dormant-1",
    username: "mark_twain",
    name: "Mark Twain",
    email: "mark@classics.org",
    emailVerified: true,
    phoneVerified: true, // +3 pts -> Genuine = 62 >= 60
    country: "Canada",
    accountAgeDays: 120,
    completedTasksCount: 15,
    earnings: 7.5,
    depositsCount: 1,
    totalDepositAmount: 50.0,
    withdrawalsCount: 0,
    totalWithdrawalAmount: 0.0,
    accountBalance: 57.5, // 50 + 7.5 = 57.5 (Reconciled)
    taskSessionsCount: 6, // Fails real gate min 8 active days
    sessionDatesCount: 5,
    devices: ["unique-device-mark"],
    ips: ["198.51.100.12"],
  };

  const { evaluation } = evaluateFixture(profile);
  // Fails active days gate (5 < 8), but has strong genuine signals (62) & 0 fraud flags
  assert.equal(evaluation.classification, "LIKELY_REAL", "Dormant user with honest history should be LIKELY_REAL");
  assert.equal(evaluation.allRealGatesPass, false, "Real gate for active days should not pass");
});

// ── Archetype 12: High-Value Legit Investor -> REAL ───────────────────────────
test("Archetype 12: High-Value Legit Investor -> REAL", () => {
  const profile = {
    userId: "user-investor-alex",
    username: "alexander_v",
    name: "Alexander Vance",
    email: "alex@enterprise.com",
    emailVerified: true,
    kycStatus: "verified",
    country: "Germany",
    accountAgeDays: 60,
    completedTasksCount: 20,
    earnings: 300.0, // High VIP yield backed by $5000 deposit
    depositsCount: 5,
    totalDepositAmount: 5000.0,
    withdrawalsCount: 2,
    totalWithdrawalAmount: 2500.0,
    accountBalance: 2800.0, // 5000 + 300 - 2500 = 2800 (Reconciled!)
    taskSessionsCount: 15,
    sessionDatesCount: 10,
    devices: ["unique-device-alex"],
    ips: ["198.51.100.2"],
  };

  const { evaluation } = evaluateFixture(profile);
  assert.equal(evaluation.classification, "REAL", "High-value legitimate investor must be REAL");
  assert.ok(evaluation.allRealGatesPass, "All real gates must pass");
  assert.equal(evaluation.authenticity.isArtificial, false, "Investor tasks are not artificial");
});

// ── Archetype 13: Multi-Account Cluster on Same Device -> FAKE ────────────────
test("Archetype 13: Multi-Account Cluster on Same Device -> FAKE", () => {
  const deviceId = "shared-hardware-device-999";
  const cluster = [
    { userId: "u-1", username: "sybil1", email: "sybil1@test.com", devices: [deviceId], accountBalance: 500, totalDepositAmount: 10, earnings: 0 },
    { userId: "u-2", username: "sybil2", email: "sybil2@test.com", devices: [deviceId], accountBalance: 500, totalDepositAmount: 10, earnings: 0 },
    { userId: "u-3", username: "sybil3", email: "sybil3@test.com", devices: [deviceId], accountBalance: 500, totalDepositAmount: 10, earnings: 0 },
  ];

  const { evaluation } = evaluateFixture(cluster[0], cluster);
  assert.equal(evaluation.classification, "FAKE", "Confirmed multi-account cluster with unexplained funds must be FAKE");
  assert.ok(evaluation.riskScore >= 80, "Risk score should be >= 80");
});

// ── Archetype 14: Pass-Through Turnaround -> SUSPICIOUS / LIKELY_FAKE ──────────
test("Archetype 14: Pass-Through Turnaround (Deposit -> Instant Withdrawal with 0 tasks) -> SUSPICIOUS / LIKELY_FAKE", () => {
  const profile = {
    userId: "user-passthrough-turnaround",
    username: "quick_cash",
    email: "quick@mail.com",
    emailVerified: true,
    accountAgeDays: 5,
    completedTasksCount: 0,
    depositsCount: 1,
    totalDepositAmount: 1000.0,
    withdrawalsCount: 1,
    totalWithdrawalAmount: 1000.0,
    accountBalance: 0.0,
    isPassThrough: true,
    devices: ["dev-quick"],
    ips: ["192.0.2.77"],
  };

  const { evaluation } = evaluateFixture(profile);
  assert.ok(
    ["SUSPICIOUS", "LIKELY_FAKE", "FAKE", "MANUAL_REVIEW"].includes(evaluation.classification),
    `Pass-through without tasks cannot be genuine, got ${evaluation.classification}`
  );
  assert.ok(evaluation.reasonCodes.includes("R03"), "Must trigger R03 Pass-Through rule");
});

// ── Matrix Completeness & Boundary Check ───────────────────────────────────────
test("Matrix Completeness & Boundary Check (No Nulls / Undefined)", () => {
  const testCoordinates = [
    { g: 90, r: 10 },
    { g: 75, r: 25 },
    { g: 50, r: 45 },
    { g: 30, r: 65 },
    { g: 10, r: 85 },
    { g: 70, r: 50 }, // Conflicting
    { g: 20, r: 10 }, // Matrix gap
  ];

  const allowedClasses = new Set(["REAL", "LIKELY_REAL", "SUSPICIOUS", "LIKELY_FAKE", "FAKE", "MANUAL_REVIEW"]);

  for (const { g, r } of testCoordinates) {
    const fakeSignals = {
      dataCoverage: 0.85,
      accountAgeDays: 20,
      completedTasks: 5,
      withdrawalsCount: 1,
      sessionDatesCount: 6,
      balanceReconciled: true,
      sharedDeviceCount: 0,
      isTestAccount: false,
      isDepositOnly: false,
    };
    const genuineRes = { genuineScore: g, positiveSignals: [] };
    const riskRes = { riskScore: r, triggeredCodes: [], triggeredRules: [] };
    const result = classifyProfile(fakeSignals, genuineRes, riskRes);

    assert.ok(result.classification, "Must return a classification");
    assert.ok(allowedClasses.has(result.classification), `Classification ${result.classification} must be one of the 6 valid classes`);
    assert.ok(typeof result.confidence === "number", "Confidence must be a number");
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// RISK ENGINE v3.5 SPECIFICATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Test 1: Legacy organic account with 0 provenance -> LIKELY_REAL (tag UNVERIFIED_PROVENANCE)
test("v3.5 - 1: Legacy organic account with 0 provenance and unverified email -> LIKELY_REAL (tag UNVERIFIED_PROVENANCE)", () => {
  const profile = {
    userId: "legacy-organic-1",
    username: "john_legacy",
    name: "John Legacy",
    email: "john@example.com",
    emailVerified: false, // Standard for 100% of DealXStocks users
    country: "United Kingdom",
    accountAgeDays: 45,
    completedTasksCount: 30,
    earnings: 30.0,
    depositsCount: 3,
    totalDepositAmount: 150.0,
    withdrawalsCount: 1,
    totalWithdrawalAmount: 50.0,
    accountBalance: 130.0, // 150 + 30 - 50 = 130 (Reconciled)
    taskSessionsCount: 0, // No legacy session telemetry
    sessionDatesCount: 12,
    provenanceCoverage: 0.0, // 0% provenance
    devices: ["device-legacy-unique"],
    ips: ["198.51.100.55"],
  };

  const { evaluation } = evaluateFixture(profile);
  assert.equal(evaluation.classification, "LIKELY_REAL", "Legacy organic account should be LIKELY_REAL, not MANUAL_REVIEW");
  assert.equal(evaluation.evidenceMode, "LEGACY");
  assert.ok(evaluation.tags.includes("UNVERIFIED_PROVENANCE"), "Must contain UNVERIFIED_PROVENANCE tag");
  assert.notEqual(evaluation.classification, "MANUAL_REVIEW", "Must not be dumped into MANUAL_REVIEW");
});

// ── Test 2: Legacy account with A14 (unbacked balance) -> SUSPICIOUS / LIKELY_FAKE
test("v3.5 - 2: Legacy account with A14 (unbacked balance) -> SUSPICIOUS / LIKELY_FAKE", () => {
  const profile = {
    userId: "legacy-unbacked-1",
    username: "bad_ledger_user",
    name: "Bad Ledger",
    email: "bad@example.com",
    emailVerified: false,
    country: "Nigeria",
    accountAgeDays: 20,
    completedTasksCount: 15,
    earnings: 20.0,
    depositsCount: 0,
    totalDepositAmount: 0.0,
    withdrawalsCount: 0,
    totalWithdrawalAmount: 0.0,
    accountBalance: 2500.0, // Unbacked balance: 2500 vs expected 20!
    provenanceCoverage: 0.0,
    hasUnbackedBalance: true,
    devices: ["dev-unbacked"],
    ips: ["198.51.100.99"],
  };

  const { evaluation } = evaluateFixture(profile);
  assert.ok(
    ["SUSPICIOUS", "LIKELY_FAKE", "FAKE"].includes(evaluation.classification),
    `Legacy mode does not excuse unbacked balance, got ${evaluation.classification}`
  );
  assert.ok(evaluation.reasonCodes.includes("A14") || evaluation.authenticity.triggeredCodes.includes("A14"), "Must trigger A14 flag");
});

// ── Test 3: Two correlated SOFT flags (A03 + A09) alone -> does NOT flip account to SUSPICIOUS
test("v3.5 - 3: Two correlated SOFT flags (A03 + A09) alone -> does NOT flip account to SUSPICIOUS", () => {
  const profile = {
    userId: "user-batch-earner",
    username: "batch_earner",
    name: "Batch Earner",
    email: "batch@example.com",
    emailVerified: false,
    country: "United States",
    accountAgeDays: 30,
    completedTasksCount: 35,
    earnings: 300.0,
    depositsCount: 1,
    totalDepositAmount: 100.0,
    withdrawalsCount: 0,
    totalWithdrawalAmount: 0.0,
    accountBalance: 400.0,
    sessionDatesCount: 10,
    taskSessionsCount: 5,
    hasBurstTasks: true, // Triggers A03 (BURST_EARNINGS family)
    hasImplausibleEarningRatio: true, // Triggers A09 (BURST_EARNINGS family)
    devices: ["dev-batch-1"],
    ips: ["198.51.100.101"],
  };

  const { evaluation } = evaluateFixture(profile);
  // Both A03 and A09 are in BURST_EARNINGS -> only 1 independent family -> isArtificial = false
  assert.equal(evaluation.authenticity.independentSoftFamiliesCount, 1, "Should only have 1 independent family");
  assert.equal(evaluation.authenticity.isArtificial, false, "Correlated soft flags must not mark artificial");
  assert.notEqual(evaluation.classification, "SUSPICIOUS", "Must not flip to SUSPICIOUS on correlated soft flags alone");
});

// ── Test 4: Three independent SOFT flags (A03, A04, A16) -> DOES flip to SUSPICIOUS
test("v3.5 - 4: Three independent SOFT flags (A03, A04, A16) -> DOES flip to SUSPICIOUS", () => {
  const profile = {
    userId: "user-tri-soft-flagged",
    username: "multi_soft_user",
    name: "Multi Soft",
    email: "multisoft@example.com",
    emailVerified: false,
    country: "United States",
    accountAgeDays: 30,
    completedTasksCount: 35,
    earnings: 50.0,
    depositsCount: 1,
    totalDepositAmount: 100.0,
    withdrawalsCount: 0,
    totalWithdrawalAmount: 0.0,
    accountBalance: 150.0,
    sessionDatesCount: 10,
    taskSessionsCount: 5,
    hasBurstTasks: true, // A03 -> BURST_EARNINGS
    hasNoCircadianRhythm: true, // A04 -> TIMING_RHYTHM
    hasVolatileIpSwitching: true, // A16 -> NETWORK_COHORT
    devices: ["dev-tri-1"],
    ips: ["198.51.100.102"],
  };

  const { evaluation } = evaluateFixture(profile);
  assert.equal(evaluation.authenticity.independentSoftFamiliesCount, 3, "Should have 3 independent soft families");
  assert.equal(evaluation.authenticity.isArtificial, true, ">=3 independent soft families must mark artificial");
  assert.equal(evaluation.classification, "SUSPICIOUS", "Must flip to SUSPICIOUS");
  assert.ok(evaluation.tags.includes("ARTIFICIAL_PROGRESS"), "Must include ARTIFICIAL_PROGRESS tag");
});

// ── Test 5: Telemetry-era organic account (provenance >= 50%) -> passes Real gates -> REAL
test("v3.5 - 5: Telemetry-era organic account (provenance >= 50%) -> passes Real gates -> REAL", () => {
  const now = Date.now();
  const rawCompletions = [];
  const rawSessions = [];

  for (let s = 0; s < 10; s++) {
    rawSessions.push({
      id: `sess-tel-${s}`,
      userId: "user-telemetry-1",
      tasksCompleted: 3,
      status: "completed",
      createdAt: new Date(now - (30 - s * 2) * 86400000).toISOString(),
    });
  }

  for (let i = 0; i < 30; i++) {
    const sessionIdx = Math.floor(i / 3);
    const started = new Date(now - (30 - sessionIdx * 2) * 86400000).toISOString();
    const completed = new Date(now - (30 - sessionIdx * 2) * 86400000 + 45000).toISOString();
    rawCompletions.push({
      id: `tc-tel-${i}`,
      taskId: `task-tel-${i}`,
      sessionId: `sess-tel-${sessionIdx}`,
      taskSessionToken: `hmac-token-${i}`,
      assignmentId: `asg-${i}`,
      startedAt: started,
      completedAt: completed,
      createdAt: completed,
      status: "completed",
    });
  }

  const profile = {
    userId: "user-telemetry-1",
    username: "telemetry_user",
    name: "Telemetry Organic",
    email: "telemetry@example.com",
    emailVerified: false,
    phoneVerified: true,
    country: "United Kingdom",
    accountAgeDays: 45,
    completedTasksCount: 30,
    earnings: 25.0,
    depositsCount: 3,
    totalDepositAmount: 200.0,
    withdrawalsCount: 1,
    totalWithdrawalAmount: 100.0,
    accountBalance: 125.0, // Reconciled
    taskSessionsCount: 10,
    sessionDatesCount: 10,
    devices: ["dev-tel-unique"],
    ips: ["198.51.100.103"],
    rawTaskCompletions: rawCompletions,
    rawTaskSessions: rawSessions,
  };

  const { evaluation } = evaluateFixture(profile);
  assert.equal(evaluation.evidenceMode, "TELEMETRY", "Must be in TELEMETRY mode");
  assert.ok(evaluation.authenticity.provenanceCoverage >= 0.50, "Provenance coverage must be >= 50%");
  assert.equal(evaluation.classification, "REAL", "Telemetry-era organic user must be REAL");
  assert.equal(evaluation.allRealGatesPass, true, "All Real gates must pass");
});

// ── Test 6: Legacy account with human label 'organic' in gold set -> REAL (tag HUMAN_VERIFIED_REAL)
test("v3.5 - 6: Legacy account with human label 'organic' in gold set -> REAL (tag HUMAN_VERIFIED_REAL)", () => {
  const profile = {
    userId: "user-legacy-human-labeled",
    username: "jasmin02",
    name: "Jasmin",
    email: "jasmin@example.com",
    emailVerified: false,
    country: "Germany",
    accountAgeDays: 40,
    completedTasksCount: 25,
    earnings: 25.0,
    depositsCount: 1,
    totalDepositAmount: 50.0,
    withdrawalsCount: 0,
    totalWithdrawalAmount: 0.0,
    accountBalance: 75.0,
    sessionDatesCount: 9,
    taskSessionsCount: 0,
    provenanceCoverage: 0.0, // Legacy
    devices: ["dev-jasmin"],
    ips: ["198.51.100.104"],
  };

  const humanContext = {
    humanRiskLabel: {
      verdict: "organic",
      labeledBy: "admin@dealxstocks.com",
      labeledAt: new Date().toISOString(),
      notes: "Audited manually: genuine user",
    },
  };

  const { evaluation } = evaluateFixture(profile, [], DEFAULT_RISK_CONFIG, humanContext);
  assert.equal(evaluation.classification, "REAL", "Human label 'organic' must promote to REAL");
  assert.equal(evaluation.decisionReason, "HUMAN_VERIFIED_ORGANIC");
  assert.ok(evaluation.tags.includes("HUMAN_VERIFIED_REAL"), "Must contain HUMAN_VERIFIED_REAL tag");
  assert.equal(evaluation.isHumanVerified, true, "isHumanVerified flag must be true");
});

