import { classifyProfile } from "../server/risk-engine.js";
import { DEFAULT_RISK_CONFIG } from "../server/user-intelligence-config.js";

console.log("Generating 10,000 synthetic users across all 6 archetypes for benchmark...");
const count = 10_000;
const syntheticUsers = [];

const archetypes = [
  // Archetype 1: Genuine Mature Earner -> REAL
  (i) => ({
    userId: `user_real_${i}`,
    username: `mature_earner_${i}`,
    email: `mature_earner_${i}@gmail.com`,
    emailVerified: true,
    phoneVerified: true,
    kycStatus: "verified",
    country: "United States",
    accountAgeDays: 95,
    completedTasksCount: 45,
    earnings: 300,
    depositsCount: 4,
    totalDepositAmount: 500,
    withdrawalsCount: 2,
    totalWithdrawalAmount: 300,
    accountBalance: 500, // 500 + 300 - 300 = 500 (Perfect reconciliation)
    taskSessionsCount: 20,
    sessionDatesCount: 15,
    hasSupportActivity: true,
    supportTicketsCount: 2,
    supportMessagesCount: 5,
    devices: [`device_unique_${i}`],
    devicesCount: 1,
    ips: [`192.168.1.${i % 250}`],
    ipsCount: 1,
  }),

  // Archetype 2: Promising Organic User -> LIKELY_REAL
  (i) => ({
    userId: `user_likely_real_${i}`,
    username: `growing_user_${i}`,
    email: `growing_user_${i}@gmail.com`,
    emailVerified: true,
    country: "United Kingdom",
    accountAgeDays: 25,
    completedTasksCount: 12,
    earnings: 80,
    depositsCount: 2,
    totalDepositAmount: 150,
    withdrawalsCount: 1,
    totalWithdrawalAmount: 50,
    accountBalance: 180, // 150 + 80 - 50 = 180
    taskSessionsCount: 6,
    sessionDatesCount: 5,
    devices: [`device_growing_${i}`],
    devicesCount: 1,
    ips: [`10.0.0.${i % 250}`],
    ipsCount: 1,
  }),

  // Archetype 3: Deposit-Only / Turnaround -> SUSPICIOUS
  (i) => ({
    userId: `user_suspicious_${i}`,
    username: `turnaround_${i}`,
    email: `turnaround_${i}@hotmail.com`,
    accountAgeDays: 5,
    depositsCount: 1,
    totalDepositAmount: 400,
    withdrawalsCount: 1,
    totalWithdrawalAmount: 400,
    completedTasksCount: 0,
    accountBalance: 0,
    devices: [`device_susp_${i}`],
    devicesCount: 1,
  }),

  // Archetype 4: High Balance Zero Tasks / Bot Pattern -> LIKELY_FAKE
  (i) => ({
    userId: `user_likely_fake_${i}`,
    username: `bot_farmer_${i}`,
    email: `bot_farmer_${i}@tempmail.org`,
    accountAgeDays: 2,
    depositsCount: 0,
    totalDepositAmount: 0,
    completedTasksCount: 0,
    earnings: 0,
    accountBalance: 850, // Massive unexplained injected balance!
    devices: ["device_shared_farm_1"],
    devicesCount: 3,
  }),

  // Archetype 5: Confirmed Multi-Account Sybil Cluster -> FAKE
  (i) => ({
    userId: `user_fake_${i}`,
    username: `test_bot_${i}`,
    email: `test_dummy_${i}@test.com`,
    isTestAccount: true,
    accountAgeDays: 1,
    completedTasksCount: 0,
    accountBalance: 0,
  }),

  // Archetype 6: Brand New Signup (Zero history) -> MANUAL_REVIEW
  (i) => ({
    userId: `user_fresh_${i}`,
    username: `new_visitor_${i}`,
    email: `new_visitor_${i}@gmail.com`,
    accountAgeDays: 0,
    completedTasksCount: 0,
    accountBalance: 0,
  }),
];

for (let i = 0; i < count; i++) {
  const factory = archetypes[i % archetypes.length];
  syntheticUsers.push(factory(i));
}

console.log(`Starting benchmark on ${count.toLocaleString()} synthetic users with Risk Engine v3.3...`);
const start = performance.now();

const distribution = {
  REAL: 0,
  LIKELY_REAL: 0,
  SUSPICIOUS: 0,
  LIKELY_FAKE: 0,
  FAKE: 0,
  MANUAL_REVIEW: 0,
};

for (const user of syntheticUsers) {
  const result = classifyProfile(user, { allProfiles: [] }, DEFAULT_RISK_CONFIG);
  distribution[result.classification] = (distribution[result.classification] || 0) + 1;
}

const elapsedMs = performance.now() - start;
const throughputPerSec = Math.round((count / elapsedMs) * 1000);

console.log("\n=== BENCHMARK PERFORMANCE RESULTS (10,000 Synthetic Users) ===");
console.log(`Total execution time : ${elapsedMs.toFixed(2)} ms (${(elapsedMs / 1000).toFixed(3)}s)`);
console.log(`Throughput           : ${throughputPerSec.toLocaleString()} users/second`);
console.log(`Average latency      : ${(elapsedMs / count).toFixed(4)} ms/user`);
console.log("\nClassification Distribution across all 6 Archetypes:");
for (const [cls, cnt] of Object.entries(distribution)) {
  const pct = ((cnt / count) * 100).toFixed(1);
  console.log(`  - ${cls.padEnd(14)}: ${String(cnt).padStart(6)} (${pct}%)`);
}
