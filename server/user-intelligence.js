/**
 * user-intelligence.js — Advanced Business Intelligence & Fraud Detection Engine v3.0
 *
 * Architecture: COLLECT → VALIDATE → STORE → CORRELATE → AGGREGATE → DETECT → EXPLAIN → CLASSIFY → AUDIT → EXPORT
 *
 * Classification Categories:
 *   REAL          — Verified, engaged, financially active genuine user
 *   LIKELY_REAL   — High-probability genuine user, minor data gaps
 *   SUSPICIOUS    — Anomalous signals, requires monitoring
 *   LIKELY_FAKE   — Strong multi-signal fake/testing indicators
 *   FAKE          — Near-certain fake, automated, or test account
 *   DUPLICATE     — Verified duplicate/multi-account user
 *   MANUAL_REVIEW — Ambiguous; requires human review
 *
 * Scoring Dimensions:
 *   genuineScore   (0–100): Evidence of real human activity, engagement, financial footprint
 *   suspicionScore (0–100): Behavioral, network, and transactional red flags
 *   duplicateScore (0–100): Cross-account entity collision signals
 *
 * Geographic Policy:
 *   Pakistan-origin accounts are flagged S11 (GEO_RESTRICTED_REGION).
 *   This is NOT automatic FAKE classification — it increases suspicion score
 *   and triggers MANUAL_REVIEW unless other genuine signals override.
 */

import crypto from "node:crypto";
import {
  DEFAULT_RISK_CONFIG,
  extractUserSignals,
  computeGenuineScore,
  computeRiskScore,
  computeProgressAuthenticity,
  computeConfidence,
  classifyProfile as riskEngineClassifyProfile,
  isGeoRestrictedCountry,
  isDisposableEmail,
} from "./risk-engine.js";

export const USER_INTEL_SCHEMA_VERSION = "3.5.0";
export const DETECTION_RULE_VERSION = "2026.10-v3.5";
export const CLASSIFICATION_ENGINE_VERSION = "3.5.0";

// ─── In-memory health state ───────────────────────────────────────────────────
let telemetryHealthState = {
  lastEventReceivedAt: null,
  totalEventsIngested: 0,
  eventsLastHour: 0,
  ingestionErrors: 0,
  lastBackfillAt: null,
  activeVisitorsCount: 0,
};

// ─── Rate-limit registry ──────────────────────────────────────────────────────
const telemetryRateLimitMap = new Map();
function cleanRateLimits() {
  const now = Date.now();
  for (const [key, record] of telemetryRateLimitMap.entries()) {
    if (now - record.resetAt > 60_000) telemetryRateLimitMap.delete(key);
  }
}
setInterval(cleanRateLimits, 60_000);

function checkTelemetryRateLimit(ip, maxPerMinute = 120) {
  const now = Date.now();
  const record = telemetryRateLimitMap.get(ip) || { count: 0, resetAt: now + 60_000 };
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + 60_000; }
  record.count += 1;
  telemetryRateLimitMap.set(ip, record);
  return record.count <= maxPerMinute;
}

// ─── Geographic Policy ────────────────────────────────────────────────────────
/** Countries considered geo-restricted for DealXStocks (not primary target market) */
const GEO_RESTRICTED_COUNTRIES = new Set([
  "PK", "Pakistan", "pakistan", "PAK",
  // Add more as policy evolves
]);

/** Pakistani telecom ISP identifiers for ASN-based detection */
const PAKISTAN_ISP_KEYWORDS = ["ptcl", "telenor pakistan", "jazz", "ufone", "zong", "nayatel", "stormfiber", "linkdotnet"];

function isGeoRestricted(country, isp) {
  if (!country && !isp) return false;
  const c = String(country || "").toLowerCase().trim();
  const i = String(isp || "").toLowerCase().trim();
  if (GEO_RESTRICTED_COUNTRIES.has(country)) return true;
  if (c === "pk" || c === "pakistan") return true;
  if (PAKISTAN_ISP_KEYWORDS.some(k => i.includes(k))) return true;
  return false;
}

// ─── Risk Rule to Legacy Reason Code Mapping ──────────────────────────────────
export const RISK_TO_LEGACY_MAP = {
  R01: ["S01"],
  R02: ["S16"],
  R03: ["S13"],
  R04: ["S17"],
  R05: ["S18"],
  R06: ["S14"],
  R07: ["S02", "S03"],
  R08: ["S05", "D06"],
  R09: ["S11"],
  R10: ["S14"],
  R11: ["S09"],
  R12: ["S08", "D07"],
  R13: ["S15"],
  R14: ["S10"],
  R15: ["S06"],
  R16: ["D05"],
};

// ─── Reason Code Registry ─────────────────────────────────────────────────────
export const REASON_CODES = {
  // Enterprise Risk Rules v3.3
  R01: { code: "R01", label: "24h Activity Burst", description: ">5 transactions in any 24h window" },
  R02: { code: "R02", label: "Large Transaction Burst", description: ">3 large transactions (>$300) in 24h window" },
  R03: { code: "R03", label: "Pass-Through Turnaround", description: "Deposit to withdrawal cycle with 0 completed tasks" },
  R04: { code: "R04", label: "Unexplained Balance", description: "Account balance significantly exceeds deposits plus legitimate task earnings" },
  R05: { code: "R05", label: "High Balance Zero Tasks", description: "Account balance >$100 with zero completed platform tasks" },
  R06: { code: "R06", label: "Deposit-Only Account", description: "Account holds deposits but has 0 tasks and 0 withdrawals" },
  R07: { code: "R07", label: "Sub-Human Task Velocity", description: "Tasks completed at impossible speed or with zero timing variance" },
  R08: { code: "R08", label: "Shared Device Cluster", description: "Device fingerprint linked to multiple distinct user accounts" },
  R09: { code: "R09", label: "Geo-Restricted Region", description: "Originates from high-risk or geo-restricted country (Pakistan)" },
  R10: { code: "R10", label: "Unverified Identity Footprint", description: "Unverified email with missing KYC and low historical footprint" },
  R11: { code: "R11", label: "Fresh Account High Velocity", description: "Account <3 days old executing large financial transactions" },
  R12: { code: "R12", label: "Referral Farm Cluster", description: "Circular referral or multi-account referral chain on shared network" },
  R13: { code: "R13", label: "Structuring & Uniform Amounts", description: "Suspiciously uniform repeated transaction amounts (bot pattern)" },
  R14: { code: "R14", label: "Support Abuse / Dispute", description: "Dispute or chargeback indicators logged in customer support" },
  R15: { code: "R15", label: "Shared Network Collision", description: "IP address observed across 5+ independent accounts" },
  R16: { code: "R16", label: "Shared Wallet Collision", description: "Withdrawal wallet address shared with another account" },
  // Progress Authenticity Codes (A01 – A17)
  A01: { code: "A01", label: "Sub-Human Completion Duration", description: "Completed faster than plausible minimum duration (<15s)" },
  A02: { code: "A02", label: "Machine-Regular Intervals", description: "Inter-completion intervals coefficient of variation < 0.15 (robotic rhythm)" },
  A03: { code: "A03", label: "Burst Activity", description: ">10 tasks in 10 minutes or entire history compressed into 1–2 days then silence" },
  A04: { code: "A04", label: "No Circadian Rhythm", description: "Active across >=20 hours of day without normal circadian rest period" },
  A05: { code: "A05", label: "Zero-Variance Daily Output", description: "Identical daily completed task count and earnings for >=7 consecutive days" },
  A06: { code: "A06", label: "Repeated Second/Minute Offset", description: "Completions mechanically aligned to identical second/minute interval offset" },
  A07: { code: "A07", label: "Impossible Output vs Age", description: "Total tasks or earnings exceeds account_age_days × daily_task_limit" },
  A08: { code: "A08", label: "Impossible Tier Progression", description: "Platform tier milestone reached faster than system minimum elapsed duration" },
  A09: { code: "A09", label: "Implausible Earning Ratio", description: "Earnings-to-task ratio exceeds plausible configured task reward limit" },
  A10: { code: "A10", label: "Direct-API Task Completion", description: "Completion event without corresponding start event, session token, or handshake" },
  A11: { code: "A11", label: "Session Duration Deficit", description: "Total session duration is less than sum of minimum required task durations" },
  A12: { code: "A12", label: "Counter vs Ledger Mismatch", description: "Platform progress summary counters deviate significantly from raw ledger documents" },
  A13: { code: "A13", label: "Replayed / Duplicate Task IDs", description: "Identical task ID completed multiple times without cooldown/re-assignment" },
  A14: { code: "A14", label: "Unbacked Balance / Admin Credit", description: "Balance or earnings changed without legitimate task ledger entry" },
  A15: { code: "A15", label: "Low Provenance Coverage", description: "Completion records lack verifiable telemetry (sessionId, deviceId, IP)" },
  A16: { code: "A16", label: "Volatile IP/Device Switching", description: "IP addresses or device fingerprints alternating between consecutive task completions" },
  A17: { code: "A17", label: "Cohort Progress Synchronization", description: "Synchronized task completion sequence and timestamp offsets across cohort accounts" },
  // Suspicion Codes (Legacy)
  S01: { code: "S01", label: "Activity Burst", description: "Unusually high action frequency in a short temporal window" },
  S02: { code: "S02", label: "Repetitive Behavior", description: "Identical action sequences repeated mechanically" },
  S03: { code: "S03", label: "Low Timing Variability", description: "Sub-human inter-event timing coefficient" },
  S04: { code: "S04", label: "Account Creation Burst", description: "Multiple accounts from same device/network in quick succession" },
  S05: { code: "S05", label: "Shared Device Cluster", description: "Device fingerprint associated with 3+ distinct accounts" },
  S06: { code: "S06", label: "Shared Network Cluster", description: "IP address spans multiple accounts (non-NAT)" },
  S07: { code: "S07", label: "Synthetic Profile Pattern", description: "Profile data exhibits bot-generated or synthetic patterns" },
  S08: { code: "S08", label: "Referral Loop", description: "Self-referral or circular referral cluster detected" },
  S09: { code: "S09", label: "Rapid Transaction Velocity", description: "High-value transactions executed immediately after registration" },
  S10: { code: "S10", label: "Coordinated Anomaly", description: "Multiple concurrent independent high-risk signals" },
  S11: { code: "S11", label: "Geo-Restricted Region", description: "Account originated from a geo-restricted region (Pakistan)" },
  S12: { code: "S12", label: "Test Account Pattern", description: "Username/email contains test keywords or test behavioral patterns" },
  S13: { code: "S13", label: "Instant Deposit-Withdraw Cycle", description: "Deposit followed by immediate withdrawal within minutes" },
  S14: { code: "S14", label: "Zero Engagement", description: "No completed tasks or meaningful platform activity" },
  S15: { code: "S15", label: "Micro-Transaction Flooding", description: "Excessive micro-transactions in short window — common in test/farm accounts" },
  S16: { code: "S16", label: "High-Value Velocity Anomaly", description: "3+ large transactions ($300+) or excessive transactions clustered in short window" },
  S17: { code: "S17", label: "Balance & Task Incoherence", description: "Account balance significantly exceeds deposits plus legitimate task earnings" },
  S18: { code: "S18", label: "Zero Task Disqualification", description: "Account holds financial balance or deposits but has 0 completed platform tasks" },
  // Duplicate Codes
  D01: { code: "D01", label: "Exact Identifier Match", description: "Exact match across normalized primary identity fields" },
  D02: { code: "D02", label: "Duplicate Email", description: "Identical normalized email or alias detected" },
  D03: { code: "D03", label: "Shared Phone Number", description: "Identical normalized phone across accounts" },
  D04: { code: "D04", label: "Strong Entity Match", description: "Extensive overlap across profile and operational metadata" },
  D05: { code: "D05", label: "Shared Wallet Address", description: "Same withdrawal wallet linked to multiple accounts" },
  D06: { code: "D06", label: "Device Overlap", description: "Accounts share verified device fingerprint" },
  D07: { code: "D07", label: "Referral Farm Cluster", description: "Circular referral chain across 3+ suspicious accounts" },
};

// ─── Utility Helpers ──────────────────────────────────────────────────────────
export function maskSensitive(str, type = "general") {
  if (!str) return "";
  const s = String(str).trim();
  if (type === "wallet") {
    return s.length <= 10 ? s : `${s.slice(0, 6)}...${s.slice(-4)}`;
  }
  if (type === "ip") {
    if (s.includes(".")) {
      const parts = s.split(".");
      return `${parts[0]}.${parts[1]}.***.***`;
    }
    return s.slice(0, 8) + ":****:****";
  }
  if (type === "email") {
    const at = s.indexOf("@");
    if (at <= 2) return `***${s.slice(at)}`;
    return `${s.slice(0, 2)}***${s.slice(at - 1)}`;
  }
  if (type === "phone") {
    if (s.length <= 5) return "*****";
    return `${s.slice(0, 3)}****${s.slice(-2)}`;
  }
  return s;
}

export function normalizeIdentity(val) {
  if (!val) return "";
  return String(val).trim().toLowerCase();
}

export function extractClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip) return ip;
  }
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "127.0.0.1";
}

// ─── Advanced Transaction Velocity Analysis ───────────────────────────────────
/**
 * Analyze deposit/withdrawal patterns for fraud signals.
 * Returns velocity scores and flags.
 */
function analyzeTransactionVelocity(deposits, withdrawals, accountAgeDays) {
  const flags = [];
  let velocityRisk = 0;

  const allTxns = [
    ...deposits.map(d => ({ ...d, type: "deposit", ts: Date.parse(d.createdAt || d.date || d.timestamp || "") || 0 })),
    ...withdrawals.map(w => ({ ...w, type: "withdrawal", ts: Date.parse(w.createdAt || w.date || w.timestamp || "") || 0 })),
  ].filter(t => t.ts > 0).sort((a, b) => a.ts - b.ts);

  if (allTxns.length === 0) return { velocityRisk: 0, flags: [], analysisData: {} };

  const now = Date.now();
  const oneDayMs = 86_400_000;
  const oneHourMs = 3_600_000;

  // 1. Transactions within first 24h of account lifetime
  const first24h = allTxns.filter(t => t.ts <= (allTxns[0]?.ts + oneDayMs));
  if (first24h.length >= 5) {
    velocityRisk += 40;
    flags.push("S09"); // Rapid Transaction Velocity
    if (first24h.length >= 10) {
      velocityRisk += 20;
      flags.push("S15"); // Micro-Transaction Flooding
    }
  }

  // 2. Any transactions within first 60 minutes of account creation
  const accountCreatedTs = allTxns[0]?.ts || now;
  const withinFirstHour = allTxns.filter(t => (t.ts - accountCreatedTs) < oneHourMs && (t.ts - accountCreatedTs) >= 0);
  if (withinFirstHour.length >= 2) {
    velocityRisk += 30;
    if (!flags.includes("S09")) flags.push("S09");
  }

  // 3. Instant deposit-then-withdraw cycle (deposit → withdrawal within 30 minutes)
  for (const dep of deposits) {
    const depTs = Date.parse(dep.createdAt || dep.date || dep.timestamp || "") || 0;
    if (!depTs) continue;
    const quickWithdraw = withdrawals.some(w => {
      const wTs = Date.parse(w.createdAt || w.date || w.timestamp || "") || 0;
      return wTs > depTs && (wTs - depTs) < 30 * 60_000; // within 30 minutes
    });
    if (quickWithdraw) {
      velocityRisk += 35;
      flags.push("S13"); // Instant Deposit-Withdraw Cycle
      break;
    }
  }

  // 4. Micro-transaction flooding: >5 transactions in any 1-hour window
  if (allTxns.length >= 5) {
    for (let i = 0; i < allTxns.length; i++) {
      const windowEnd = allTxns[i].ts + oneHourMs;
      const inWindow = allTxns.filter(t => t.ts >= allTxns[i].ts && t.ts <= windowEnd);
      if (inWindow.length >= 6) {
        if (!flags.includes("S15")) {
          velocityRisk += 25;
          flags.push("S15");
        }
        break;
      }
    }
  }

  // 5. Total transactions vs account age ratio (testing accounts do many txns in few days)
  const totalTxns = deposits.length + withdrawals.length;
  const txnsPerDay = accountAgeDays > 0 ? totalTxns / accountAgeDays : totalTxns;
  let txnFrequencyRisk = 0;
  if (txnsPerDay > 20) txnFrequencyRisk = 35;
  else if (txnsPerDay > 10) txnFrequencyRisk = 20;
  else if (txnsPerDay > 5) txnFrequencyRisk = 10;

  velocityRisk += txnFrequencyRisk;

  // 6. Large transaction velocity & clustering (>3 large transactions >= $300, or within short window)
  const largeTxns = allTxns.filter(t => (Number(t.amount) || 0) >= 300);
  let hasLargeVelocityAnomaly = false;
  if (largeTxns.length >= 3) {
    // Check if 3 or more large transactions occurred within a 48-hour window
    for (let i = 0; i < largeTxns.length - 2; i++) {
      if ((largeTxns[i + 2].ts - largeTxns[i].ts) <= 48 * oneHourMs) {
        hasLargeVelocityAnomaly = true;
        velocityRisk += 35;
        if (!flags.includes("S16")) flags.push("S16"); // High-Value Velocity Anomaly
        break;
      }
    }
    // If user has >= 5 large transactions without proven history
    if (!hasLargeVelocityAnomaly && largeTxns.length >= 5) {
      velocityRisk += 20;
      if (!flags.includes("S16")) flags.push("S16");
    }
  }

  // 7. Same-day / 24h transaction clustering (>5 transactions in any 24h window)
  let maxTxnsIn24h = 0;
  for (let i = 0; i < allTxns.length; i++) {
    const windowEnd = allTxns[i].ts + oneDayMs;
    const count = allTxns.filter(t => t.ts >= allTxns[i].ts && t.ts <= windowEnd).length;
    if (count > maxTxnsIn24h) maxTxnsIn24h = count;
  }
  if (maxTxnsIn24h >= 5) {
    velocityRisk += 25;
    if (!flags.includes("S09")) flags.push("S09");
    if (!flags.includes("S15")) flags.push("S15");
  }

  // Amount consistency checks: unrealistically uniform amounts are bot-generated
  const amounts = [...deposits.map(d => Number(d.amount) || 0), ...withdrawals.map(w => Number(w.amount) || 0)]
    .filter(a => a > 0);
  if (amounts.length >= 3) {
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const variance = amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / amounts.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1; // coefficient of variation
    if (cv < 0.05 && amounts.length >= 5) {
      velocityRisk += 20; // Suspiciously uniform amounts
      if (!flags.includes("S03")) flags.push("S03");
    }
  }

  return {
    velocityRisk: Math.min(100, velocityRisk),
    flags: [...new Set(flags)],
    analysisData: {
      totalTransactions: totalTxns,
      transactionsFirst24h: first24h.length,
      transactionsFirstHour: withinFirstHour.length,
      maxTransactionsIn24h: maxTxnsIn24h,
      largeTransactionsCount: largeTxns.length,
      txnsPerDay: Number(txnsPerDay.toFixed(2)),
      depositCount: deposits.length,
      withdrawalCount: withdrawals.length,
      amountCoeffVariation: amounts.length > 0 ?
        (() => {
          const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
          const variance = amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / amounts.length;
          return mean > 0 ? Number((Math.sqrt(variance) / mean).toFixed(3)) : 1;
        })() : null,
    },
  };
}

// ─── Core Scoring & Classification Engine ────────────────────────────────────
/**
 * Multi-dimensional evidence scoring engine.
 * Applies BI-grade heuristics across 8 signal families.
 */
/**
 * Multi-dimensional evidence scoring engine v3.3.
 * Delegates core risk & classification to risk-engine.js and correlates cross-account entity collisions.
 */
export function evaluateProfile(profile, allProfiles = [], config = DEFAULT_RISK_CONFIG) {
  // Use risk-engine v3.3 for core multi-signal classification
  const classifyResult = riskEngineClassifyProfile(profile, {
    allProfiles,
    humanRiskLabel: profile.humanRiskLabel,
    rawDeposits: profile.rawDeposits,
    rawWithdrawals: profile.rawWithdrawals,
  }, config);

  // Compute duplicate entity score & related accounts
  const normEmail = profile.normalizedEmail || normalizeIdentity(profile.email);
  const normPhone = profile.normalizedPhone || normalizeIdentity(profile.phone);
  const normWallet = normalizeIdentity(profile.walletAddress);
  const userDevs = new Set(profile.devices || []);
  const userIps = new Set(profile.ips || []);
  const relatedAccounts = new Set();

  let duplicateScore = 0;
  for (const other of allProfiles) {
    if (other.userId === profile.userId) continue;
    let matched = false;
    // Shared device
    if (userDevs.size > 0 && (other.devices || []).some(d => userDevs.has(d))) {
      duplicateScore += 25;
      matched = true;
    }
    // Shared wallet
    if (normWallet && normWallet.length > 4 && normalizeIdentity(other.walletAddress) === normWallet) {
      duplicateScore += 50;
      matched = true;
    }
    // Shared email
    if (normEmail && normEmail.length > 3 && (other.normalizedEmail || normalizeIdentity(other.email)) === normEmail) {
      duplicateScore += 50;
      matched = true;
    }
    // Shared phone
    if (normPhone && normPhone.length > 4 && (other.normalizedPhone || normalizeIdentity(other.phone)) === normPhone) {
      duplicateScore += 35;
      matched = true;
    }
    // Shared IP
    if (userIps.size > 0 && (other.ips || []).some(ip => userIps.has(ip))) {
      duplicateScore += 5;
    }
    if (matched) {
      relatedAccounts.add(other.userId);
    }
  }
  duplicateScore = Math.min(100, duplicateScore);

  // Cross-reference circular referral loops
  if (profile.referredByUserId) {
    const referrer = allProfiles.find(p => p.userId === profile.referredByUserId);
    if (referrer && referrer.referredByUserId === profile.userId) {
      relatedAccounts.add(referrer.userId);
      duplicateScore = Math.min(100, duplicateScore + 30);
    }
  }

  // Map triggered R-codes to legacy reason codes for backward compatibility
  const allReasonCodes = new Set(classifyResult.reasonCodes);
  for (const rCode of classifyResult.reasonCodes) {
    const legacyList = RISK_TO_LEGACY_MAP[rCode] || [];
    for (const leg of legacyList) {
      allReasonCodes.add(leg);
    }
  }

  const evidencePositive = (classifyResult.positiveSignals || []).map(
    s => `${s.group}: ${s.detail} (+${s.points} pts)`
  );
  const evidenceArtificial = (classifyResult.authenticity?.triggeredRules || []).map(
    a => `${a.code} [${a.strength}]: ${a.description} (${a.evidence})`
  );
  const evidenceNegative = [
    ...(classifyResult.negativeSignals || []).map(
      n => `${n.code} (${n.label}): ${n.description} [+${n.points} risk]`
    ),
    ...evidenceArtificial,
  ];

  const geoRestricted = isGeoRestrictedCountry(profile.country, profile.isp);

  return {
    classification: classifyResult.classification,
    automatedClassification: classifyResult.classification,
    confidence: classifyResult.confidence,
    decisionReason: classifyResult.decisionReason,
    genuineScore: classifyResult.genuineScore,
    suspicionScore: classifyResult.riskScore,
    riskScore: classifyResult.riskScore,
    duplicateScore,
    dataCoverage: classifyResult.dataCoverage,
    authenticity: classifyResult.authenticity,
    geoPolicy: classifyResult.geoPolicy,
    realGatesStatus: classifyResult.realGatesStatus,
    allRealGatesPass: classifyResult.allRealGatesPass,
    balanceReconciliation: classifyResult.balanceReconciliation,
    reasonCodes: Array.from(allReasonCodes),
    relatedAccounts: Array.from(relatedAccounts),
    clusterId: relatedAccounts.size > 0 ? `cluster-${Array.from(relatedAccounts)[0].slice(0, 8)}` : null,
    evidencePositive,
    evidenceNegative,
    positiveSignals: classifyResult.positiveSignals,
    negativeSignals: classifyResult.negativeSignals,
    geoRestricted,
    isTestAccount: Boolean(profile.isTestAccount),
    evidenceMode: classifyResult.evidenceMode || "LEGACY",
    reviewPriority: classifyResult.reviewPriority || "NONE",
    tags: classifyResult.tags || [],
    behaviorGatesStatus: classifyResult.behaviorGatesStatus,
    allBehaviorGatesPass: classifyResult.allBehaviorGatesPass,
    verificationGatesStatus: classifyResult.verificationGatesStatus,
    allVerificationGatesPass: classifyResult.allVerificationGatesPass,
    scoreVersion: config.score_version || "2026.10-v3.5",
    lastAnalyzedAt: new Date().toISOString(),
  };
}

// ─── Service Factory ──────────────────────────────────────────────────────────
export function createUserIntelligenceService({
  firestoreDb,
  saveFirebaseDoc,
  getFirebaseDoc,
  listFirebaseDocs,
  deleteFirebaseDoc,
  broadcastDataChange,
  readCollectionFiltered,
}) {
  const COLLECTIONS = {
    events: "telemetryEvents",
    profiles: "userIntelligenceProfiles",
    devices: "userDevices",
    consents: "telemetryConsents",
    audits: "classificationAuditLogs",
    config: "userIntelligenceConfig",
    riskLabels: "userRiskLabels",
    lock: "userIntelligenceLock",
  };

  const userRecomputeCoalesceMap = new Map();

  // ── Enterprise Risk Config & Dynamic Thresholds ───────────────────
  let activeConfig = { ...DEFAULT_RISK_CONFIG };
  let configLoaded = false;

  async function getConfig() {
    if (!configLoaded) {
      try {
        const res = await getFirebaseDoc(COLLECTIONS.config, "global");
        if (res && res.ok && res.data) {
          activeConfig = {
            ...DEFAULT_RISK_CONFIG,
            ...res.data,
            genuine_weights: { ...DEFAULT_RISK_CONFIG.genuine_weights, ...(res.data.genuine_weights || {}) },
            real_gates: { ...DEFAULT_RISK_CONFIG.real_gates, ...(res.data.real_gates || {}) },
            matrix_boundaries: { ...DEFAULT_RISK_CONFIG.matrix_boundaries, ...(res.data.matrix_boundaries || {}) },
            risk_rules: { ...DEFAULT_RISK_CONFIG.risk_rules, ...(res.data.risk_rules || {}) },
          };
        }
      } catch (err) {
        console.warn("[UserIntel] Failed to load userIntelligenceConfig from Firestore, using defaults:", err.message);
      }
      configLoaded = true;
    }
    return activeConfig;
  }

  async function updateConfig(newConfig, adminUser = {}) {
    const current = await getConfig();
    activeConfig = {
      ...current,
      ...newConfig,
      score_version: newConfig.score_version || current.score_version || "2026.10-v3.3",
      updated_at: new Date().toISOString(),
      updated_by: adminUser.username || adminUser.id || "super_admin",
    };
    await saveFirebaseDoc(COLLECTIONS.config, "global", activeConfig);
    broadcastDataChange(COLLECTIONS.config, "global");
    return activeConfig;
  }

  // ── Debounced User Recompute Queue ────────────────────────────────
  const recomputeDebounceMap = new Map();

  function scheduleUserRecompute(userId, delayMs = 1500) {
    if (!userId || userId === "guest") return;
    if (recomputeDebounceMap.has(userId)) {
      clearTimeout(recomputeDebounceMap.get(userId));
    }
    const timer = setTimeout(async () => {
      recomputeDebounceMap.delete(userId);
      try {
        await recomputeUserProfile(userId);
      } catch (err) {
        console.warn(`[UserIntel] Background recompute failed for ${userId}:`, err.message);
      }
    }, delayMs);
    recomputeDebounceMap.set(userId, timer);
  }

  // ── Event Ingestion ───────────────────────────────────────────────
  async function ingestTelemetryEvents(events, clientIp, userAgent) {
    const nowIso = new Date().toISOString();
    const ingestedList = [];

    for (const raw of events) {
      if (!raw || typeof raw !== "object") continue;
      const eventId = String(raw.event_id || `evt-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
      const eventType = String(raw.event_type || "generic_action").trim();
      const userId = raw.user_id ? String(raw.user_id).trim() : null;
      const visitorId = raw.anonymous_visitor_id
        ? String(raw.anonymous_visitor_id).trim()
        : `vis-${crypto.randomBytes(8).toString("hex")}`;
      const deviceId = raw.device_record_id ? String(raw.device_record_id).trim() : null;
      const sessionHash = raw.session_id_hash ? String(raw.session_id_hash).trim() : null;

      const eventDoc = {
        event_id: eventId,
        event_type: eventType,
        server_timestamp_utc: nowIso,
        client_timestamp_utc: raw.client_timestamp_utc || null,
        user_id: userId,
        anonymous_visitor_id: visitorId,
        session_id_hash: sessionHash,
        device_record_id: deviceId,
        page: raw.page || raw.path || "/",
        route: raw.route || raw.page || "/",
        referrer: raw.referrer || "",
        request_id: `req-${crypto.randomBytes(4).toString("hex")}`,
        ip_reference: clientIp,
        user_agent: userAgent || "",
        consent_state: raw.consent_state || "granted",
        app_version: raw.app_version || "1.0.0",
        schema_version: USER_INTEL_SCHEMA_VERSION,
        metadata: raw.metadata || {},
      };

      await saveFirebaseDoc(COLLECTIONS.events, eventId, eventDoc);
      ingestedList.push(eventDoc);
      telemetryHealthState.totalEventsIngested += 1;
      telemetryHealthState.eventsLastHour += 1;
      telemetryHealthState.lastEventReceivedAt = nowIso;

      if (deviceId) {
        await updateDeviceRecord(deviceId, {
          userId, visitorId, clientIp, userAgent,
          platform: raw.metadata?.platform,
          screen: raw.metadata?.screen,
          language: raw.metadata?.language,
          timezone: raw.metadata?.timezone,
          lastSeenAt: nowIso,
        });
      }

      if (userId && userId !== "guest") {
        await updateProfileFromEvent(userId, eventDoc);
        scheduleUserRecompute(userId, 3000);
      }
    }

    if (ingestedList.length > 0) {
      broadcastDataChange(COLLECTIONS.events, ingestedList[0].event_id);
    }
    return ingestedList;
  }

  // ── Device Record Updater ─────────────────────────────────────────
  async function updateDeviceRecord(deviceId, payload) {
    try {
      const res = await getFirebaseDoc(COLLECTIONS.devices, deviceId);
      const existing = res.ok && res.data ? res.data : {
        device_record_id: deviceId,
        first_seen_at: payload.lastSeenAt,
        accounts_per_device: 0,
        users_seen: [],
        ips_seen: [],
        activity_count: 0,
      };

      const usersSeen = new Set(existing.users_seen || []);
      if (payload.userId && payload.userId !== "guest") usersSeen.add(payload.userId);
      const ipsSeen = new Set(existing.ips_seen || []);
      if (payload.clientIp) ipsSeen.add(payload.clientIp);

      const updated = {
        ...existing,
        device_record_id: deviceId,
        last_seen_at: payload.lastSeenAt,
        platform: payload.platform || existing.platform,
        screen: payload.screen || existing.screen,
        language: payload.language || existing.language,
        timezone: payload.timezone || existing.timezone,
        user_agent: payload.userAgent || existing.user_agent,
        users_seen: Array.from(usersSeen),
        ips_seen: Array.from(ipsSeen),
        accounts_per_device: usersSeen.size,
        activity_count: (existing.activity_count || 0) + 1,
        is_shared_device: usersSeen.size >= 2,
        high_concentration: usersSeen.size >= 3,
        updated_at: payload.lastSeenAt,
      };

      await saveFirebaseDoc(COLLECTIONS.devices, deviceId, updated);
    } catch (err) {
      console.warn("Failed to update device record:", err.message);
    }
  }

  // ── Rolling Profile Updater (from telemetry events) ───────────────
  async function updateProfileFromEvent(userId, eventDoc) {
    try {
      const res = await getFirebaseDoc(COLLECTIONS.profiles, userId);
      const existing = res.ok && res.data ? res.data : {
        userId,
        createdAt: eventDoc.server_timestamp_utc,
        eventCount: 0,
        devices: [],
        ips: [],
        lastSeenAt: eventDoc.server_timestamp_utc,
      };

      const devices = new Set(existing.devices || []);
      if (eventDoc.device_record_id) devices.add(eventDoc.device_record_id);
      const ips = new Set(existing.ips || []);
      if (eventDoc.ip_reference) ips.add(eventDoc.ip_reference);

      const updated = {
        ...existing,
        userId,
        eventCount: (existing.eventCount || 0) + 1,
        devices: Array.from(devices),
        ips: Array.from(ips),
        lastSeenAt: eventDoc.server_timestamp_utc,
        lastPage: eventDoc.page,
        updatedAt: eventDoc.server_timestamp_utc,
      };

      await saveFirebaseDoc(COLLECTIONS.profiles, userId, updated);
    } catch (err) {
      console.warn("Failed to update user intelligence profile from event:", err.message);
    }
  }

  // ── Full Profile Refresh (Backfill Engine) ────────────────────────
  /**
   * Reads live Firestore data, runs advanced BI scoring on every user,
   * and persists updated intelligence profiles with concurrency lock.
   */
  async function refreshAllProfiles(options = {}) {
    const lockDoc = await getFirebaseDoc(COLLECTIONS.lock, "backfill").catch(() => null);
    const nowIso = new Date().toISOString();
    if (lockDoc?.ok && lockDoc.data?.locked) {
      const lockAgeMs = Date.now() - (Date.parse(lockDoc.data.lockedAt) || 0);
      if (lockAgeMs < 10 * 60_000 && !options.force) {
        throw new Error(`Backfill already in progress by ${lockDoc.data.lockedBy || 'system'}. Please wait.`);
      }
    }
    await saveFirebaseDoc(COLLECTIONS.lock, "backfill", { locked: true, lockedAt: nowIso, lockedBy: options.adminUsername || "super_admin" });

    try {
      const rawUsers = await listFirebaseDocs("users");
      const rawDeposits = await listFirebaseDocs("deposits");
      const rawWithdrawals = await listFirebaseDocs("withdrawals");
      const rawTaskSessions = await listFirebaseDocs("taskSessions");
      const rawTaskCompletions = await listFirebaseDocs("taskCompletions");
      const rawOrders = await listFirebaseDocs("orders");
      const rawSupportTickets = await listFirebaseDocs("supportTickets");
      const rawSupportConversations = await listFirebaseDocs("supportConversations");
      const rawSupportMessages = await listFirebaseDocs("supportMessages");
      const rawDevices = await listFirebaseDocs(COLLECTIONS.devices);
      const rawRiskLabels = await listFirebaseDocs(COLLECTIONS.riskLabels).catch(() => []);
      const existingProfiles = await listFirebaseDocs(COLLECTIONS.profiles);

      const labelsByUser = new Map();
      for (const lbl of rawRiskLabels) {
        if (lbl.userId) labelsByUser.set(lbl.userId, lbl);
      }

      const now = Date.now();

      // Index financials & tasks by userId
      const depositsByUser = new Map();
      for (const d of rawDeposits) {
        const uid = d.userId || d.user_id || d.uid;
        if (!uid) continue;
        const list = depositsByUser.get(uid) || [];
        list.push(d);
        depositsByUser.set(uid, list);
      }

      const withdrawalsByUser = new Map();
      for (const w of rawWithdrawals) {
        const uid = w.userId || w.user_id || w.uid;
        if (!uid) continue;
        const list = withdrawalsByUser.get(uid) || [];
        list.push(w);
        withdrawalsByUser.set(uid, list);
      }

      const tasksByUser = new Map();
      for (const ts of rawTaskSessions) {
        const uid = ts.userId || ts.user_id || ts.uid;
        if (!uid) continue;
        const list = tasksByUser.get(uid) || [];
        list.push(ts);
        tasksByUser.set(uid, list);
      }

      const taskCompletionsByUser = new Map();
      for (const tc of rawTaskCompletions) {
        const uid = tc.userId || tc.user_id || tc.uid;
        if (!uid) continue;
        const list = taskCompletionsByUser.get(uid) || [];
        list.push(tc);
        taskCompletionsByUser.set(uid, list);
      }

      const ordersByUser = new Map();
      for (const o of rawOrders) {
        const uid = o.userId || o.user_id || o.uid;
        if (!uid) continue;
        const list = ordersByUser.get(uid) || [];
        list.push(o);
        ordersByUser.set(uid, list);
      }

      // Index customer support interactions
      const supportTicketsByUser = new Map();
      for (const t of rawSupportTickets) {
        const uid = t.userId || t.user_id || t.uid;
        if (!uid) continue;
        const list = supportTicketsByUser.get(uid) || [];
        list.push(t);
        supportTicketsByUser.set(uid, list);
      }

      const supportConvsByUser = new Map();
      for (const c of rawSupportConversations) {
        const uid = c.userId || c.user_id || c.id;
        if (!uid) continue;
        const list = supportConvsByUser.get(uid) || [];
        list.push(c);
        supportConvsByUser.set(uid, list);
      }

      const supportMsgsByUser = new Map();
      for (const m of rawSupportMessages) {
        const uid = m.senderId || m.userId;
        if (!uid) continue;
        const list = supportMsgsByUser.get(uid) || [];
        list.push(m);
        supportMsgsByUser.set(uid, list);
      }

      // Index devices by userId
      const devicesByUser = new Map();
      for (const dev of rawDevices) {
        for (const uId of dev.users_seen || []) {
          const list = devicesByUser.get(uId) || [];
          list.push(dev.device_record_id);
          devicesByUser.set(uId, list);
        }
      }

      const existingMap = new Map();
      for (const p of existingProfiles) {
        existingMap.set(p.userId, p);
      }

      const profilesToEvaluate = [];
      for (const u of rawUsers) {
        const uId = u.id;
        if (!uId) continue;

        const ex = existingMap.get(uId) || {};
        const userDeps = depositsByUser.get(uId) || [];
        const userWds = withdrawalsByUser.get(uId) || [];
        const userTasks = tasksByUser.get(uId) || [];
        const userCompletions = taskCompletionsByUser.get(uId) || [];
        const userOrders = ordersByUser.get(uId) || [];
        const userTickets = supportTicketsByUser.get(uId) || [];
        const userConvs = supportConvsByUser.get(uId) || [];
        const userMsgs = supportMsgsByUser.get(uId) || [];

        const userDevs = Array.from(new Set([
          ...(ex.devices || []),
          ...(devicesByUser.get(uId) || []),
        ]));

        const createdTime = Date.parse(
          u.createdAt || u.registrationDate || u.date || u.created_at || ""
        ) || (now - 86400000);
        const ageDays = Math.max(0, Math.floor((now - createdTime) / 86_400_000));

        const totalDepAmount = userDeps.reduce((s, d) => s + (Number(d.amount) || 0), 0);
        const totalWdAmount = userWds.reduce((s, w) => s + (Number(w.amount) || 0), 0);

        const accountBalance = Number(u.balance || 0);
        const earnings = Number(u.earnings || 0);

        const sessionTasksCompleted = userTasks.filter(t =>
          t.status === "completed" ||
          t.status === "approved" ||
          (t.tasksCompleted && Number(t.tasksCompleted) > 0)
        ).reduce((sum, t) => sum + (Number(t.tasksCompleted) || 1), 0);
        const completionDocsCount = userCompletions.filter(c => c.status === "completed" || !c.status).length;
        const completedOrdersCount = userOrders.filter(o => o.status === "completed" || o.status === "approved").length;
        const completedTasks = Math.max(sessionTasksCompleted, completionDocsCount, completedOrdersCount);

        const sessionDates = new Set(
          userTasks
            .map(s => String(s.createdAt || s.startedAt || s.date || "").slice(0, 10))
            .filter(d => d.length === 10)
        );
        const sessionDatesCount = sessionDates.size;

        const supportTicketsCount = userTickets.length;
        const supportConversationsCount = userConvs.length;
        const supportMessagesCount = userMsgs.length;
        const hasSupportActivity = (supportTicketsCount + supportConversationsCount + supportMessagesCount) > 0;

        const walletAddress =
          u.withdrawalAddress || u.walletAddress || u.wallet ||
          userWds.find(w => w.address || w.walletAddress)?.address ||
          userWds.find(w => w.address || w.walletAddress)?.walletAddress || "";

        const txVelocityAnalysis = analyzeTransactionVelocity(userDeps, userWds, ageDays);

        const profile = {
          ...ex,
          userId: uId,
          username: u.username || u.name || "User",
          name: u.name || u.username || "User",
          email: u.email || "",
          normalizedEmail: normalizeIdentity(u.email),
          phone: u.phone || u.phoneNumber || "",
          normalizedPhone: normalizeIdentity(u.phone || u.phoneNumber),
          country: u.country || u.location || ex.country || "",
          isp: u.isp || ex.isp || "",
          createdAt: new Date(createdTime).toISOString(),
          accountAgeDays: ageDays,
          status: u.status || "active",
          emailVerified: Boolean(u.emailVerified || u.email_verified),
          phoneVerified: Boolean(u.phoneVerified || u.phone_verified),
          kycStatus: u.kycStatus || u.kyc_status || "unverified",
          devices: userDevs,
          devicesCount: userDevs.length,
          ips: Array.from(new Set([...(ex.ips || []), ...(u.lastLoginIp ? [u.lastLoginIp] : [])])),
          ipsCount: (ex.ips || []).length || (u.lastLoginIp ? 1 : 0),
          walletAddress,
          referralCode: u.referralCode || u.referral_code || "",
          referredBy: u.referredBy || u.referralCodeUsed || u.referred_by || "",
          referredByUserId: u.referredByUserId || u.referred_by_user_id || "",
          accountBalance,
          earnings,
          bonusBalance: Number(u.bonusBalance || 0),
          depositsCount: userDeps.length,
          totalDepositAmount: totalDepAmount,
          withdrawalsCount: userWds.length,
          totalWithdrawalAmount: totalWdAmount,
          completedTasksCount: completedTasks,
          taskSessionsCount: userTasks.length,
          sessionDatesCount,
          supportTicketsCount,
          supportConversationsCount,
          supportMessagesCount,
          hasSupportActivity,
          txVelocityAnalysis,
          eventCount: ex.eventCount || (userDeps.length + userWds.length + userTasks.length + 5),
          lastSeenAt: ex.lastSeenAt || u.lastLoginAt || u.last_login_at || new Date(createdTime).toISOString(),
          isTestAccount: Boolean(
            u.isTestAccount || u.is_test ||
            (u.username || "").toLowerCase().includes("test") ||
            (u.email || "").toLowerCase().includes("test@")
          ),
          rawTaskCompletions: userCompletions,
          rawTaskSessions: userTasks,
          rawDeposits: userDeps,
          rawWithdrawals: userWds,
          rawOrders: userOrders,
          humanRiskLabel: labelsByUser.get(uId) || null,
        };

        profilesToEvaluate.push(profile);
      }

      const currentRiskConfig = await getConfig();
      const evaluatedProfiles = [];
      for (const p of profilesToEvaluate) {
        const evaluation = evaluateProfile(p, profilesToEvaluate, currentRiskConfig);
        const finalProfile = {
          ...p,
          ...evaluation,
          schemaVersion: USER_INTEL_SCHEMA_VERSION,
          ruleVersion: DETECTION_RULE_VERSION,
          updatedAt: new Date().toISOString(),
        };

        const {
          rawTaskCompletions, rawTaskSessions, rawDeposits, rawWithdrawals, rawOrders,
          ...profileToSave
        } = finalProfile;

        evaluatedProfiles.push(finalProfile);
        await saveFirebaseDoc(COLLECTIONS.profiles, p.userId, profileToSave);
      }

      telemetryHealthState.lastBackfillAt = new Date().toISOString();
      broadcastDataChange(COLLECTIONS.profiles, "bulk_refresh");
      return evaluatedProfiles;
    } finally {
      await saveFirebaseDoc(COLLECTIONS.lock, "backfill", { locked: false, releasedAt: new Date().toISOString() }).catch(() => {});
    }
  }

  // ── Single User Profile Recomputer ────────────────────────────────
  async function recomputeUserProfile(userId, options = {}) {
    if (!userId || userId === "guest") return null;

    const now = Date.now();
    const lastRecomputed = userRecomputeCoalesceMap.get(userId) || 0;
    if (!options.force && (now - lastRecomputed) < 5 * 60_000) {
      const cached = await getFirebaseDoc(COLLECTIONS.profiles, userId);
      if (cached.ok && cached.data) return cached.data;
    }

    const userRes = await getFirebaseDoc("users", userId);
    if (!userRes.ok || !userRes.data) return null;
    const u = userRes.data;

    const [
      userDeps,
      userWds,
      userTasks,
      userCompletions,
      userOrders,
      userTickets,
      userConvs,
      userMsgs,
      existingProfileRes,
      existingProfiles,
    ] = await Promise.all([
      readCollectionFiltered ? readCollectionFiltered("deposits", [["userId", "==", userId]]).catch(() => []) : [],
      readCollectionFiltered ? readCollectionFiltered("withdrawals", [["userId", "==", userId]]).catch(() => []) : [],
      readCollectionFiltered ? readCollectionFiltered("taskSessions", [["userId", "==", userId]]).catch(() => []) : [],
      readCollectionFiltered ? readCollectionFiltered("taskCompletions", [["userId", "==", userId]]).catch(() => []) : [],
      readCollectionFiltered ? readCollectionFiltered("orders", [["userId", "==", userId]]).catch(() => []) : [],
      readCollectionFiltered ? readCollectionFiltered("supportTickets", [["userId", "==", userId]]).catch(() => []) : [],
      readCollectionFiltered ? readCollectionFiltered("supportConversations", [["userId", "==", userId]]).catch(() => []) : [],
      readCollectionFiltered ? readCollectionFiltered("supportMessages", [["senderId", "==", userId]]).catch(() => []) : [],
      getFirebaseDoc(COLLECTIONS.profiles, userId).catch(() => ({ ok: false })),
      listFirebaseDocs(COLLECTIONS.profiles).catch(() => []),
      getFirebaseDoc(COLLECTIONS.riskLabels, userId).catch(() => ({ ok: false })),
    ]);
    const humanRiskLabel = userRiskLabelRes?.ok ? userRiskLabelRes.data : null;

    const ex = existingProfileRes.ok && existingProfileRes.data ? existingProfileRes.data : {};
    const createdTime = Date.parse(u.createdAt || u.registrationDate || u.date || "") || (now - 86400000);
    const ageDays = Math.max(0, Math.floor((now - createdTime) / 86_400_000));
    const totalDepAmount = (userDeps || []).reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const totalWdAmount = (userWds || []).reduce((s, w) => s + (Number(w.amount) || 0), 0);
    const accountBalance = Number(u.balance || 0);
    const earnings = Number(u.earnings || 0);

    const sessionTasksCompleted = (userTasks || []).filter(t =>
      t.status === "completed" || t.status === "approved" || (t.tasksCompleted && Number(t.tasksCompleted) > 0)
    ).reduce((sum, t) => sum + (Number(t.tasksCompleted) || 1), 0);
    const completionDocsCount = (userCompletions || []).filter(c => c.status === "completed" || !c.status).length;
    const completedOrdersCount = (userOrders || []).filter(o => o.status === "completed" || o.status === "approved").length;
    const completedTasks = Math.max(sessionTasksCompleted, completionDocsCount, completedOrdersCount);

    const sessionDates = new Set(
      (userTasks || []).map(s => String(s.createdAt || s.startedAt || s.date || "").slice(0, 10)).filter(d => d.length === 10)
    );
    const sessionDatesCount = sessionDates.size;
    const supportTicketsCount = (userTickets || []).length;
    const supportConversationsCount = (userConvs || []).length;
    const supportMessagesCount = (userMsgs || []).length;
    const hasSupportActivity = (supportTicketsCount + supportConversationsCount + supportMessagesCount) > 0;

    const walletAddress = u.withdrawalAddress || u.walletAddress || u.wallet ||
      (userWds || []).find(w => w.address || w.walletAddress)?.address ||
      (userWds || []).find(w => w.address || w.walletAddress)?.walletAddress || "";

    const txVelocityAnalysis = analyzeTransactionVelocity(userDeps || [], userWds || [], ageDays);

    const profile = {
      ...ex,
      userId,
      username: u.username || u.name || "User",
      name: u.name || u.username || "User",
      email: u.email || "",
      normalizedEmail: normalizeIdentity(u.email),
      phone: u.phone || u.phoneNumber || "",
      normalizedPhone: normalizeIdentity(u.phone || u.phoneNumber),
      country: u.country || u.location || ex.country || "",
      isp: u.isp || ex.isp || "",
      createdAt: new Date(createdTime).toISOString(),
      accountAgeDays: ageDays,
      status: u.status || "active",
      emailVerified: Boolean(u.emailVerified || u.email_verified),
      phoneVerified: Boolean(u.phoneVerified || u.phone_verified),
      kycStatus: u.kycStatus || u.kyc_status || "unverified",
      devices: Array.from(new Set([...(ex.devices || []), ...(u.lastDeviceId ? [u.lastDeviceId] : [])])),
      devicesCount: (ex.devices || []).length,
      ips: Array.from(new Set([...(ex.ips || []), ...(u.lastLoginIp ? [u.lastLoginIp] : [])])),
      ipsCount: (ex.ips || []).length,
      walletAddress,
      referralCode: u.referralCode || "",
      referredBy: u.referredBy || "",
      referredByUserId: u.referredByUserId || "",
      accountBalance,
      earnings,
      bonusBalance: Number(u.bonusBalance || 0),
      depositsCount: (userDeps || []).length,
      totalDepositAmount: totalDepAmount,
      withdrawalsCount: (userWds || []).length,
      totalWithdrawalAmount: totalWdAmount,
      completedTasksCount: completedTasks,
      taskSessionsCount: (userTasks || []).length,
      sessionDatesCount,
      supportTicketsCount,
      supportConversationsCount,
      supportMessagesCount,
      hasSupportActivity,
      txVelocityAnalysis,
      eventCount: ex.eventCount || ((userDeps || []).length + (userWds || []).length + (userTasks || []).length + 5),
      lastSeenAt: ex.lastSeenAt || u.lastLoginAt || new Date(createdTime).toISOString(),
      isTestAccount: Boolean(u.isTestAccount || (u.username || "").toLowerCase().includes("test") || (u.email || "").toLowerCase().includes("test@")),
      rawTaskCompletions: userCompletions || [],
      rawTaskSessions: userTasks || [],
      rawDeposits: userDeps || [],
      rawWithdrawals: userWds || [],
      rawOrders: userOrders || [],
      humanRiskLabel,
    };

    const currentRiskConfig = await getConfig();
    const evaluation = evaluateProfile(profile, existingProfiles || [], currentRiskConfig);

    const finalProfile = {
      ...profile,
      ...evaluation,
      schemaVersion: USER_INTEL_SCHEMA_VERSION,
      ruleVersion: DETECTION_RULE_VERSION,
      updatedAt: new Date().toISOString(),
    };

    delete finalProfile.rawTaskCompletions;
    delete finalProfile.rawTaskSessions;
    delete finalProfile.rawDeposits;
    delete finalProfile.rawWithdrawals;
    delete finalProfile.rawOrders;

    const prevGenuine = ex.genuineScore ?? -1;
    const prevRisk = ex.riskScore ?? ex.suspicionScore ?? -1;
    const prevClass = ex.classification || "";
    const scoreDiff = Math.abs(finalProfile.genuineScore - prevGenuine) + Math.abs(finalProfile.riskScore - prevRisk);
    const classChanged = finalProfile.classification !== prevClass;

    if (scoreDiff >= 1 || classChanged || options.force || !ex.lastAnalyzedAt) {
      await saveFirebaseDoc(COLLECTIONS.profiles, userId, finalProfile);
      broadcastDataChange(COLLECTIONS.profiles, userId);
    }

    userRecomputeCoalesceMap.set(userId, now);
    return finalProfile;
  }

  // ── Gold Set Ground Truth Labels ──────────────────────────────────
  async function saveUserRiskLabel(userId, adminUser, verdict, notes = "") {
    if (!userId) throw new Error("userId is required.");
    const validVerdicts = ["organic", "artificial", "fake"];
    const normVerdict = String(verdict || "").toLowerCase().trim();
    if (!validVerdicts.includes(normVerdict)) {
      throw new Error(`Invalid verdict "${verdict}". Must be one of: organic, artificial, fake.`);
    }

    const profileRes = await getFirebaseDoc(COLLECTIONS.profiles, userId);
    const profile = profileRes.ok ? profileRes.data : {};
    const nowIso = new Date().toISOString();

    const labelDoc = {
      id: userId,
      userId,
      verdict: normVerdict,
      notes: String(notes || "").trim(),
      reviewerId: adminUser.id || adminUser.username || "super_admin",
      reviewerName: adminUser.username || adminUser.name || "Super Admin",
      labeledAt: nowIso,
      scoreSnapshot: {
        genuineScore: profile.genuineScore ?? 0,
        riskScore: profile.riskScore ?? profile.suspicionScore ?? 0,
        authenticityScore: profile.authenticity?.score ?? 100,
        classification: profile.classification || "MANUAL_REVIEW",
        confidence: profile.confidence ?? 0.5,
      },
    };

    await saveFirebaseDoc(COLLECTIONS.riskLabels, userId, labelDoc);
    broadcastDataChange(COLLECTIONS.riskLabels, userId);
    return labelDoc;
  }

  async function listUserRiskLabels() {
    return listFirebaseDocs(COLLECTIONS.riskLabels);
  }

  async function getGoldSetMetrics() {
    const [profiles, labels] = await Promise.all([
      listFirebaseDocs(COLLECTIONS.profiles),
      listFirebaseDocs(COLLECTIONS.riskLabels),
    ]);

    const profileMap = new Map();
    for (const p of profiles) profileMap.set(p.userId, p);

    let tpReal = 0;
    let fpReal = 0;
    let fnReal = 0;
    let tnReal = 0;

    let tpArtificial = 0;
    let fpArtificial = 0;
    let fnArtificial = 0;

    const evaluatedLabels = [];
    for (const lbl of labels) {
      const p = profileMap.get(lbl.userId);
      if (!p) continue;

      const modelClass = p.classification || "MANUAL_REVIEW";
      const isModelReal = modelClass === "REAL";
      const isModelArtificial = modelClass === "SUSPICIOUS" || (p.authenticity && p.authenticity.isArtificial);
      const isHumanOrganic = lbl.verdict === "organic";
      const isHumanArtificial = lbl.verdict === "artificial";
      const isHumanFake = lbl.verdict === "fake";

      if (isHumanOrganic) {
        if (isModelReal) tpReal++;
        else fnReal++;
      } else {
        if (isModelReal) fpReal++;
        else tnReal++;
      }

      if (isHumanArtificial) {
        if (isModelArtificial) tpArtificial++;
        else fnArtificial++;
      } else {
        if (isModelArtificial) fpArtificial++;
      }

      evaluatedLabels.push({
        userId: lbl.userId,
        verdict: lbl.verdict,
        modelClass,
        isAgreement: (isHumanOrganic && (modelClass === "REAL" || modelClass === "LIKELY_REAL")) ||
                     (isHumanArtificial && (modelClass === "SUSPICIOUS" || modelClass === "LIKELY_FAKE")) ||
                     (isHumanFake && (modelClass === "FAKE" || modelClass === "LIKELY_FAKE")),
        notes: lbl.notes,
        reviewerName: lbl.reviewerName,
        labeledAt: lbl.labeledAt,
      });
    }

    const totalEvaluated = evaluatedLabels.length;
    const realTotal = tpReal + fpReal;
    const realPrecision = realTotal > 0 ? tpReal / realTotal : 1.0;
    const realRecall = (tpReal + fnReal) > 0 ? tpReal / (tpReal + fnReal) : 0;

    let ciLower = 0;
    let ciUpper = 1.0;
    if (realTotal > 0) {
      const z = 1.96;
      const n = realTotal;
      const p = realPrecision;
      const denominator = 1 + (z * z) / n;
      const centre = p + (z * z) / (2 * n);
      const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
      ciLower = Number(Math.max(0, (centre - margin) / denominator).toFixed(3));
      ciUpper = Number(Math.min(1.0, (centre + margin) / denominator).toFixed(3));
    }

    const sampleReal = profiles.filter(p => p.classification === "REAL").slice(0, 30).map(p => p.userId);
    const sampleLikelyReal = profiles.filter(p => p.classification === "LIKELY_REAL").slice(0, 30).map(p => p.userId);
    const sampleSuspicious = profiles.filter(p => p.classification === "SUSPICIOUS").slice(0, 30).map(p => p.userId);
    const sampleMovedToSuspicious = profiles.filter(p => p.classification === "SUSPICIOUS" && (p.reasonCodes || []).some(c => c.startsWith("A"))).slice(0, 20).map(p => p.userId);

    return {
      totalLabeled: totalEvaluated,
      realPrecision: Number(realPrecision.toFixed(3)),
      realPrecisionConfidenceInterval: {
        lower: ciLower,
        upper: ciUpper,
        confidenceLevel: "95%",
      },
      realRecall: Number(realRecall.toFixed(3)),
      confusionMatrix: {
        real: { tp: tpReal, fp: fpReal, fn: fnReal, tn: tnReal },
        artificial: { tp: tpArtificial, fp: fpArtificial, fn: fnArtificial },
      },
      sampleSizeNote: totalEvaluated < 30
        ? "Sample size is currently <30 labels; human gold-set labeling is actively accumulating to achieve high statistical power."
        : "Sample size meets statistical validity requirements for precision validation.",
      recommendedSampling: {
        realCohort: sampleReal,
        likelyRealCohort: sampleLikelyReal,
        suspiciousCohort: sampleSuspicious,
        movedToSuspiciousCohort: sampleMovedToSuspicious,
      },
      labels: evaluatedLabels,
    };
  }

  // ── Consent Recording ─────────────────────────────────────────────
  async function recordConsentEvent(payload, clientIp) {
    const consentId = `cst-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const nowIso = new Date().toISOString();
    const doc = {
      consent_id: consentId,
      user_id: payload.userId || null,
      anonymous_visitor_id: payload.visitorId || null,
      categories: payload.categories || {
        necessary: true,
        security: true,
        analytics: true,
        fraud_prevention: true,
        marketing: false,
      },
      decision: payload.decision || "accepted_all",
      policy_version: "2026.2",
      ip_reference: maskSensitive(clientIp, "ip"),
      timestamp_utc: nowIso,
    };
    await saveFirebaseDoc(COLLECTIONS.consents, consentId, doc);
    return doc;
  }

  // ── Super Admin Classification Override ───────────────────────────
  async function overrideClassification(userId, adminAccount, newClassification, reasonNotes) {
    const res = await getFirebaseDoc(COLLECTIONS.profiles, userId);
    if (!res.ok || !res.data) throw new Error("User intelligence profile not found.");

    const prevProfile = res.data;
    const nowIso = new Date().toISOString();
    const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    const auditRecord = {
      id: auditId,
      timestamp_utc: nowIso,
      admin_id: adminAccount.id || adminAccount.username || "super_admin",
      admin_username: adminAccount.username || "Super Admin",
      target_user_id: userId,
      previous_classification: prevProfile.classification,
      new_classification: newClassification,
      reason_notes: reasonNotes || "",
      automated_classification: prevProfile.automatedClassification || prevProfile.classification,
      scores_snapshot: {
        genuine: prevProfile.genuineScore,
        suspicion: prevProfile.suspicionScore,
        duplicate: prevProfile.duplicateScore,
      },
    };

    const updatedProfile = {
      ...prevProfile,
      classification: newClassification,
      adminFinalClassification: newClassification,
      manualReviewStatus: "COMPLETED",
      reviewedBy: adminAccount.username,
      reviewedAt: nowIso,
      reviewNotes: reasonNotes,
      updatedAt: nowIso,
    };

    await saveFirebaseDoc(COLLECTIONS.audits, auditId, auditRecord);
    await saveFirebaseDoc(COLLECTIONS.profiles, userId, updatedProfile);
    broadcastDataChange(COLLECTIONS.profiles, userId);

    return { success: true, profile: updatedProfile, audit: auditRecord };
  }

  // ── Multi-Sheet XLSX-Compatible CSV Export ────────────────────────
  /**
   * Generates a structured multi-category export.
   * Returns: { format: 'csv'|'json', byCategory: Map, combined: string }
   */
  function buildExportPayload(profiles, format = "csv") {
    const CATEGORIES = ["REAL", "LIKELY_REAL", "SUSPICIOUS", "LIKELY_FAKE", "FAKE", "DUPLICATE", "MANUAL_REVIEW"];

    const headers = [
      "User ID", "Name", "Email", "Phone", "Country", "Registration Date",
      "Account Age (Days)", "Classification", "Confidence", "Genuine Score",
      "Suspicion Score", "Duplicate Score", "Reason Codes",
      "Email Verified", "Phone Verified", "KYC Status",
      "Account Balance ($)", "Task Earnings ($)",
      "Total Deposits", "Deposit Amount ($)", "Total Withdrawals", "Withdrawal Amount ($)",
      "Completed Tasks", "Task Sessions", "Support Activity",
      "Devices Count", "IPs Count", "Wallet Address",
      "Related Accounts", "Geo Restricted", "Is Test Account",
      "Last Analyzed", "Evidence (+)", "Evidence (-)",
    ];

    function escCsv(val) {
      if (val === null || val === undefined) return "";
      const s = String(val).replace(/"/g, '""');
      if (s.includes(",") || s.includes("\n") || s.includes('"')) return `"${s}"`;
      return s;
    }

    function profileToRow(p) {
      return [
        p.userId, p.name, maskSensitive(p.email, "email"),
        maskSensitive(p.phone, "phone"), p.country,
        p.createdAt ? p.createdAt.slice(0, 10) : "",
        p.accountAgeDays,
        p.classification, (p.confidence * 100).toFixed(0) + "%",
        p.genuineScore, p.suspicionScore, p.duplicateScore,
        (p.reasonCodes || []).join("; "),
        p.emailVerified ? "Yes" : "No",
        p.phoneVerified ? "Yes" : "No",
        p.kycStatus || "unverified",
        (p.accountBalance || 0).toFixed(2),
        (p.earnings || 0).toFixed(2),
        p.depositsCount || 0,
        (p.totalDepositAmount || 0).toFixed(2),
        p.withdrawalsCount || 0,
        (p.totalWithdrawalAmount || 0).toFixed(2),
        p.completedTasksCount || 0,
        p.taskSessionsCount || 0,
        p.hasSupportActivity ? `Yes (${p.supportTicketsCount || 0}t / ${p.supportMessagesCount || 0}m)` : "None",
        p.devicesCount || (p.devices || []).length || 0,
        p.ipsCount || (p.ips || []).length || 0,
        maskSensitive(p.walletAddress, "wallet"),
        (p.relatedAccounts || []).join("; "),
        p.geoRestricted ? "YES" : "No",
        p.isTestAccount ? "YES" : "No",
        p.lastAnalyzedAt ? p.lastAnalyzedAt.slice(0, 19).replace("T", " ") : "",
        (p.evidencePositive || []).join(" | "),
        (p.evidenceNegative || []).join(" | "),
      ].map(escCsv);
    }

    if (format === "json") {
      const byCategory = {};
      for (const cat of CATEGORIES) {
        byCategory[cat] = profiles
          .filter(p => p.classification === cat)
          .map(p => ({
            userId: p.userId,
            name: p.name,
            email: maskSensitive(p.email, "email"),
            country: p.country,
            classification: p.classification,
            confidence: p.confidence,
            genuineScore: p.genuineScore,
            suspicionScore: p.suspicionScore,
            duplicateScore: p.duplicateScore,
            reasonCodes: p.reasonCodes,
            accountBalance: p.accountBalance,
            earnings: p.earnings,
            depositsCount: p.depositsCount,
            totalDepositAmount: p.totalDepositAmount,
            withdrawalsCount: p.withdrawalsCount,
            totalWithdrawalAmount: p.totalWithdrawalAmount,
            completedTasksCount: p.completedTasksCount,
            taskSessionsCount: p.taskSessionsCount,
            hasSupportActivity: p.hasSupportActivity,
            supportTicketsCount: p.supportTicketsCount,
            supportMessagesCount: p.supportMessagesCount,
            devicesCount: p.devicesCount,
            geoRestricted: p.geoRestricted,
            isTestAccount: p.isTestAccount,
            evidencePositive: p.evidencePositive,
            evidenceNegative: p.evidenceNegative,
            relatedAccounts: p.relatedAccounts,
            createdAt: p.createdAt,
            lastAnalyzedAt: p.lastAnalyzedAt,
          }));
      }
      return { format: "json", payload: JSON.stringify({ export_version: "3.1", generated_at: new Date().toISOString(), categories: byCategory }, null, 2) };
    }

    // Multi-section CSV: each category separated by a blank row and section header
    const BOM = "\uFEFF";
    let csv = BOM;
    csv += `# DealXStocks User Intelligence Export — Generated: ${new Date().toISOString()}\n`;
    csv += `# Schema Version: ${USER_INTEL_SCHEMA_VERSION} | Rules Version: ${DETECTION_RULE_VERSION}\n\n`;

    for (const cat of CATEGORIES) {
      const catProfiles = profiles.filter(p => p.classification === cat);
      csv += `## ── ${cat} ACCOUNTS (${catProfiles.length}) ──\n`;
      csv += headers.map(escCsv).join(",") + "\n";
      for (const p of catProfiles) {
        csv += profileToRow(p).join(",") + "\n";
      }
      csv += "\n";
    }

    return { format: "csv", payload: csv };
  }

  return {
    ingestTelemetryEvents,
    recordConsentEvent,
    refreshAllProfiles,
    recomputeUserProfile,
    scheduleUserRecompute,
    overrideClassification,
    saveUserRiskLabel,
    listUserRiskLabels,
    getGoldSetMetrics,
    getConfig,
    updateConfig,
    evaluateProfile: (profile, allProfiles) => evaluateProfile(profile, allProfiles, activeConfig),
    buildExportPayload,
    checkTelemetryRateLimit,
    getHealthState: () => ({
      ...telemetryHealthState,
      serverTimeUtc: new Date().toISOString(),
      schemaVersion: USER_INTEL_SCHEMA_VERSION,
      rulesVersion: DETECTION_RULE_VERSION,
      engineVersion: CLASSIFICATION_ENGINE_VERSION,
      configScoreVersion: activeConfig.score_version,
    }),
  };
}
