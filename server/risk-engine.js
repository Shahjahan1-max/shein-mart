/**
 * risk-engine.js — Multi-Signal Business Intelligence & Fraud Analytics Engine v3.5
 *
 * Implements:
 * - Two Evidence Modes: TELEMETRY (provenance >= 50%) vs LEGACY (< 30%)
 * - Correlated Flag Families (BURST_EARNINGS, TIMING_RHYTHM, LEDGER_PROVENANCE, NETWORK_COHORT)
 * - Calibrated A03 (batch task aware) and A09 (population payout aware)
 * - Separation of Behavior Gates (tasks, age, active days, balance) from Verification Gates (provenance, hardware)
 * - Human Ground-Truth Gold Set integration (human-labeled organic -> REAL)
 * - External Anchors (tx hashes, on-chain recording, admin-approved withdrawals, wallet clustering)
 * - Review Priority Triage for MANUAL_REVIEW (HIGH, MEDIUM, LOW)
 */

export { DEFAULT_RISK_CONFIG } from "./user-intelligence-config.js";
import { DEFAULT_RISK_CONFIG } from "./user-intelligence-config.js";

// ── Disposable Email Domains Check ───────────────────────────────────────────
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com", "yopmail.com", "guerrillamail.com", "10minutemail.com",
  "tempmail.com", "trashmail.com", "sharklasers.com", "getairmail.com",
  "dispostable.com", "fakemailgenerator.com", "temp-mail.org",
]);

// ── Geographic Restrictions (Non-Target Markets / Policy Notice Only) ─────────
const GEO_RESTRICTED_COUNTRIES = new Set(["pk", "pakistan", "pak"]);
const PAKISTAN_ISP_KEYWORDS = ["ptcl", "telenor pakistan", "jazz", "ufone", "zong", "nayatel", "stormfiber", "linkdotnet"];

export function isGeoRestrictedCountry(country, isp = "") {
  if (!country && !isp) return false;
  const c = String(country || "").toLowerCase().trim();
  const i = String(isp || "").toLowerCase().trim();
  if (GEO_RESTRICTED_COUNTRIES.has(c)) return true;
  if (PAKISTAN_ISP_KEYWORDS.some(k => i.includes(k))) return true;
  return false;
}

export function isDisposableEmail(email = "") {
  const parts = String(email || "").toLowerCase().trim().split("@");
  if (parts.length < 2) return false;
  return DISPOSABLE_EMAIL_DOMAINS.has(parts[1]);
}

// ─── 1. Signal Extraction & External Anchors ──────────────────────────────────
export function extractUserSignals(profile, context = {}) {
  const allProfiles = context.allProfiles || [];
  const now = Date.now();
  const oneDayMs = 86_400_000;

  const userId = String(profile.userId || profile.id || "");
  const accountAgeDays = Math.max(0, Number(profile.accountAgeDays || 0));
  const createdAtMs = Date.parse(profile.createdAt || "") || (now - accountAgeDays * oneDayMs);

  // A. Identity (Email verification is UNAVAILABLE on DealXStocks signup)
  const email = String(profile.email || "").toLowerCase().trim();
  const emailVerified = Boolean(profile.emailVerified || profile.email_verified);
  const phoneVerified = Boolean(profile.phoneVerified || profile.phone_verified);
  const kycStatus = String(profile.kycStatus || profile.kyc_status || "unverified").toLowerCase();
  const isKycVerified = ["verified", "approved"].includes(kycStatus);
  const disposableEmail = isDisposableEmail(email);
  const country = String(profile.country || "").trim();
  const isGeoRestricted = isGeoRestrictedCountry(country, profile.isp);

  // Test account detection by name/email/flags
  const username = String(profile.username || profile.name || "").toLowerCase();
  const testKeywords = ["test", "fake", "dummy", "demo", "bot", "auto", "trial", "qa", "staging", "dev", "admin_test"];
  const isTestAccount = Boolean(
    profile.isTestAccount || profile.is_test ||
    testKeywords.some(k => email.includes(k) || username.includes(k))
  );

  // B. Tasks & Earnings
  const completedTasks = Math.max(0, Number(profile.completedTasksCount || 0));
  const earnings = Math.max(0, Number(profile.earnings || 0));
  const taskSessionsCount = Math.max(0, Number(profile.taskSessionsCount || 0));
  const sessionDatesCount = Math.max(0, Number(profile.sessionDatesCount || 0));

  // C. Financials & External Anchors (Deposits & Withdrawals)
  const rawDeps = profile.rawDeposits || context.rawDeposits || [];
  const rawWds = profile.rawWithdrawals || context.rawWithdrawals || [];

  const depositsCount = Math.max(0, Number(profile.depositsCount ?? rawDeps.length ?? 0));
  const totalDepositAmount = Math.max(0, Number(profile.totalDepositAmount ?? rawDeps.reduce((s, d) => s + (Number(d.amount) || 0), 0)));
  const withdrawalsCount = Math.max(0, Number(profile.withdrawalsCount ?? rawWds.length ?? 0));
  const totalWithdrawalAmount = Math.max(0, Number(profile.totalWithdrawalAmount ?? rawWds.reduce((s, w) => s + (Number(w.amount) || 0), 0)));
  const balance = Math.max(0, Number(profile.accountBalance ?? profile.balance ?? 0));
  const bonusBalance = Math.max(0, Number(profile.bonusBalance ?? profile.rawBonusBalance ?? 0));
  const totalFees = Math.max(0, Number(profile.totalFees ?? 0));
  const netFlow = totalDepositAmount - totalWithdrawalAmount;

  // External Anchor 1: Approved/Paid withdrawals count
  const approvedWithdrawalsCount = rawWds.filter(w =>
    ["approved", "completed", "paid"].includes(String(w.status || "").toLowerCase())
  ).length;

  // External Anchor 2: On-chain transaction hashes
  const validTxHashes = rawDeps.map(d => String(d.hash || d.transactionHash || d.txHash || "").trim())
    .filter(h => h && h !== "NO_HASH" && h.length > 8);
  const hasOnChainDepositAnchor = validTxHashes.length > 0;

  // D. Mathematical Balance Reconciliation
  // Expected Balance = Deposits + Legitimate Verified Task Earnings + Bonuses - Withdrawals - Fees
  const expectedBalance = Math.max(0, (totalDepositAmount + earnings + bonusBalance) - totalWithdrawalAmount - totalFees);
  const balanceVariance = Math.abs(balance - expectedBalance);
  const balanceExcess = Math.max(0, balance - expectedBalance);
  const reconciliationTolerance = Math.max(15.0, balance * 0.02);
  const balanceReconciled = balanceExcess <= reconciliationTolerance;

  // E. Transaction Velocity & Burst Analysis
  const txVelocity = profile.txVelocityAnalysis || { velocityRisk: 0, flags: [], analysisData: {} };
  const txData = txVelocity.analysisData || {};
  const maxTxnsIn24h = Math.max(0, Number(txData.maxTransactionsIn24h || txData.transactionsFirst24h || 0));
  const largeTxnsCount = Math.max(0, Number(txData.largeTransactionsCount || 0));
  const txnsPerDay = Number(txData.txnsPerDay || (accountAgeDays > 0 ? (depositsCount + withdrawalsCount) / accountAgeDays : 0));

  // Pass-through detection: deposit followed by withdrawal with 0 tasks completed
  const isPassThrough = depositsCount >= 1 && withdrawalsCount >= 1 && completedTasks === 0;

  // Deposit-only account: holds deposits, 0 tasks, 0 withdrawals
  const isDepositOnly = depositsCount >= 1 && completedTasks === 0 && withdrawalsCount === 0;

  // Fresh account large transaction: age < 3 days and deposit/withdrawal >= 300
  const isFreshAccountLargeTx = accountAgeDays < 3 && (totalDepositAmount >= 300 || totalWithdrawalAmount >= 300);

  // F. Customer Support
  const supportTicketsCount = Math.max(0, Number(profile.supportTicketsCount || 0));
  const supportConversationsCount = Math.max(0, Number(profile.supportConversationsCount || 0));
  const supportMessagesCount = Math.max(0, Number(profile.supportMessagesCount || 0));
  const hasSupportActivity = Boolean(
    profile.hasSupportActivity ||
    (supportTicketsCount + supportConversationsCount + supportMessagesCount) > 0
  );

  // G. Cross-Entity Device, IP & Wallet Clusters
  const userDevices = new Set(profile.devices || []);
  const userIps = new Set(profile.ips || []);
  const walletAddress = String(profile.walletAddress || "").trim().toLowerCase();

  let sharedDeviceCount = 0;
  let sharedIpCount = 0;
  let sharedWalletCount = 0;
  const relatedAccounts = new Set();

  if (allProfiles.length > 0) {
    for (const other of allProfiles) {
      if (other.userId === userId) continue;
      if ((other.devices || []).some(d => userDevices.has(d))) {
        sharedDeviceCount += 1;
        relatedAccounts.add(other.userId);
      }
      if ((other.ips || []).some(ip => userIps.has(ip))) {
        sharedIpCount += 1;
        relatedAccounts.add(other.userId);
      }
      if (walletAddress && walletAddress.length > 4 && String(other.walletAddress || "").toLowerCase() === walletAddress) {
        sharedWalletCount += 1;
        relatedAccounts.add(other.userId);
      }
    }
  }

  // H. Referral Graph
  const referredByUserId = String(profile.referredByUserId || "").trim();
  let circularReferral = false;
  if (referredByUserId && allProfiles.length > 0) {
    const parent = allProfiles.find(p => p.userId === referredByUserId);
    if (parent && String(parent.referredByUserId || "").trim() === userId) {
      circularReferral = true;
      relatedAccounts.add(referredByUserId);
    }
  }

  // I. Data Coverage Calculation (0.0 to 1.0)
  const coveragePoints = [
    Boolean(email),
    Boolean(country),
    accountAgeDays >= 0,
    depositsCount >= 0,
    completedTasks >= 0,
    (userDevices.size > 0 || userIps.size > 0),
    typeof balance === "number",
  ];
  const dataCoverage = Number((coveragePoints.filter(Boolean).length / coveragePoints.length).toFixed(2));

  // J. Raw collections & context passthrough
  const rawCompletions = profile.rawTaskCompletions || context.rawTaskCompletions || [];
  const rawSessions = profile.rawTaskSessions || context.rawTaskSessions || [];
  const humanRiskLabel = profile.humanRiskLabel || context.humanRiskLabel || null;

  return {
    userId,
    accountAgeDays,
    createdAtMs,
    email,
    emailVerified,
    phoneVerified,
    isKycVerified,
    kycStatus,
    disposableEmail,
    country,
    isGeoRestricted,
    isTestAccount,
    completedTasks,
    earnings,
    bonusBalance,
    totalFees,
    taskSessionsCount,
    sessionDatesCount,
    depositsCount,
    totalDepositAmount,
    withdrawalsCount,
    totalWithdrawalAmount,
    approvedWithdrawalsCount,
    hasOnChainDepositAnchor,
    validTxHashes,
    balance,
    netFlow,
    expectedBalance,
    balanceVariance,
    balanceExcess,
    reconciliationTolerance,
    balanceReconciled,
    maxTxnsIn24h,
    largeTxnsCount,
    txnsPerDay,
    isPassThrough,
    isDepositOnly,
    isFreshAccountLargeTx,
    supportTicketsCount,
    supportConversationsCount,
    supportMessagesCount,
    hasSupportActivity,
    userDevices: Array.from(userDevices),
    userIps: Array.from(userIps),
    walletAddress,
    sharedDeviceCount,
    sharedIpCount,
    sharedWalletCount,
    relatedAccounts: Array.from(relatedAccounts),
    circularReferral,
    dataCoverage,
    humanRiskLabel,
    rawProfile: profile,
    rawCompletions,
    rawSessions,
    rawDeposits: rawDeps,
    rawWithdrawals: rawWds,
    rawContext: context,
  };
}

// ─── 2. Progress Authenticity Score (0–100, Higher = More Organic) ───────────
export function computeProgressAuthenticity(signals, rawCompletions = [], rawSessions = [], context = {}, config = DEFAULT_RISK_CONFIG) {
  const rules = config.authenticity_rules || DEFAULT_RISK_CONFIG.authenticity_rules;
  const thresholds = config.authenticity_thresholds || DEFAULT_RISK_CONFIG.authenticity_thresholds;
  const flagFamilies = config.flag_families || DEFAULT_RISK_CONFIG.flag_families;
  const triggeredRules = [];
  const triggeredCodes = new Set();
  let deductions = 0;

  const completions = Array.isArray(rawCompletions) ? rawCompletions : (signals.rawCompletions || []);
  const sessions = Array.isArray(rawSessions) ? rawSessions : (signals.rawSessions || []);
  const profile = context.profile || signals.rawProfile || {};

  // If account has 0 completed tasks, authenticity is default neutral (100)
  if (signals.completedTasks === 0 && completions.length === 0) {
    return {
      authenticityScore: 100,
      provenanceCoverage: 1.0,
      evidenceMode: "LEGACY",
      evidenceLevel: "LEGACY",
      confidenceLabel: "NEUTRAL_NO_TASKS",
      triggeredRules: [],
      triggeredCodes: [],
      strongCount: 0,
      softCount: 0,
      independentSoftFamiliesCount: 0,
      isArtificial: false,
      hasStrongArtificialFlag: false,
      note: "NO_TASKS_PERFORMED",
    };
  }

  // Calculate Provenance Coverage (A15)
  let recordsWithFullTelemetry = 0;
  const totalEvaluatedRecords = completions.length > 0 ? completions.length : (signals.completedTasks > 0 ? signals.completedTasks : 0);

  if (completions.length > 0) {
    for (const c of completions) {
      const hasSession = Boolean(c.sessionId || c.taskSessionId || c.assignmentId);
      const hasTimestamp = Boolean(c.completedAt || c.createdAt || c.timestamp);
      if (hasSession && hasTimestamp) {
        recordsWithFullTelemetry += 1;
      }
    }
  } else if (profile.provenanceCoverage !== undefined) {
    recordsWithFullTelemetry = Math.round(Number(profile.provenanceCoverage) * totalEvaluatedRecords);
  } else if (profile.rawTaskCompletions === undefined && context.rawTaskCompletions === undefined && signals.taskSessionsCount > 0) {
    recordsWithFullTelemetry = totalEvaluatedRecords;
  }

  const provenanceCoverage = totalEvaluatedRecords > 0
    ? Number((recordsWithFullTelemetry / totalEvaluatedRecords).toFixed(2))
    : (profile.provenanceCoverage !== undefined ? Number(profile.provenanceCoverage) : 0.85);

  const evidenceMode = (provenanceCoverage >= (config.evidence_modes?.telemetry_min_provenance || 0.50))
    ? "TELEMETRY"
    : "LEGACY";

  function trigger(ruleKey, evidence) {
    const r = rules[ruleKey];
    if (!r) return;
    if (triggeredCodes.has(r.code)) return;
    triggeredCodes.add(r.code);
    deductions += r.points;
    triggeredRules.push({
      code: r.code,
      strength: r.strength,
      family: r.family || "GENERAL",
      points: r.points,
      label: r.label,
      description: r.description,
      evidence: String(evidence),
    });
  }

  // ── A01 (STRONG): Sub-Human Completion Duration (<10s)
  if (profile.hasSubHumanDuration) {
    trigger("A01", "Task completed in sub-human duration (<10s)");
  } else if (completions.length > 0) {
    const minPlausibleMs = (thresholds.min_plausible_task_duration_seconds || 10) * 1000;
    for (const c of completions) {
      if (c.startedAt && c.completedAt) {
        const dur = Date.parse(c.completedAt) - Date.parse(c.startedAt);
        if (dur > 0 && dur < minPlausibleMs) {
          trigger("A01", `Task ${c.taskId || c.id || "task"} completed in ${(dur / 1000).toFixed(1)}s (<${thresholds.min_plausible_task_duration_seconds}s threshold)`);
          break;
        }
      }
    }
  }

  // ── A02 (STRONG): Machine-Regular Intervals (CV < 0.15 over >=10 completions)
  if (profile.hasMachineRegularIntervals) {
    trigger("A02", "Inter-completion intervals coefficient of variation < 0.15 (robotic machine regular rhythm)");
  } else if (completions.length >= 10) {
    const sorted = [...completions].map(c => Date.parse(c.completedAt || c.createdAt || c.date || "")).filter(t => t > 0).sort((a, b) => a - b);
    if (sorted.length >= 10) {
      const gaps = [];
      for (let i = 1; i < sorted.length; i++) {
        const gapSec = (sorted[i] - sorted[i - 1]) / 1000;
        if (gapSec > 0 && gapSec < 3600) gaps.push(gapSec);
      }
      if (gaps.length >= 8) {
        const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        const variance = gaps.reduce((s, g) => s + Math.pow(g - mean, 2), 0) / gaps.length;
        const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
        if (cv < (thresholds.machine_regular_cv_threshold || 0.15)) {
          trigger("A02", `Inter-completion intervals CV = ${cv.toFixed(3)} (< 0.15 over ${gaps.length} tasks, mean gap ${mean.toFixed(1)}s)`);
        }
      }
    }
  }

  // ── A03 (SOFT): Sub-Human Burst Velocity (>30 tasks in 5 min)
  // DealXStocks tasks come in 25-task batches. Doing 25 tasks in 15-20 min is normal human activity.
  if (profile.hasBurstTasks) {
    trigger("A03", "Sub-human task burst velocity (>30 tasks in 5 minutes)");
  } else if (completions.length > 25) {
    const windowMs = (thresholds.burst_tasks_window_minutes || 5) * 60_000;
    const sorted = [...completions].map(c => Date.parse(c.completedAt || c.createdAt || "")).filter(t => t > 0).sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      const end = sorted[i] + windowMs;
      const count = sorted.filter(t => t >= sorted[i] && t <= end).length;
      if (count > (thresholds.burst_tasks_limit || 30)) {
        trigger("A03", `${count} tasks completed within 5 minutes (<10s/task sub-human rate)`);
        break;
      }
    }
  }

  // ── A04 (SOFT): No Circadian Rhythm (Active in >=20 of 24h, no >=4h sleep gap)
  if (profile.hasNoCircadianRhythm) {
    trigger("A04", "Activity recorded across >=20 hours of day without normal circadian rest period");
  } else if (completions.length >= 20) {
    const hours = new Set(completions.map(c => {
      const ts = Date.parse(c.completedAt || c.createdAt || "");
      return ts > 0 ? new Date(ts).getUTCHours() : null;
    }).filter(h => h !== null));
    if (hours.size >= (thresholds.circadian_active_hours_threshold || 20)) {
      trigger("A04", `Task completions distributed across ${hours.size} distinct hours of day without >=4h sleep rest gap`);
    }
  }

  // ── A05 (SOFT): Zero-Variance Daily Output
  if (profile.hasZeroVarianceDays) {
    trigger("A05", "Identical daily completed task count and earnings for >=7 consecutive days");
  }

  // ── A06 (SOFT): Repeated Second/Minute Offset
  if (profile.hasRepeatedTimestampOffset) {
    trigger("A06", "Completions mechanically aligned to identical second/minute interval offset");
  }

  // ── A07 (STRONG): Impossible Output vs Account Age
  const dailyLimit = thresholds.daily_task_limit_default || 50;
  const maxPlausibleTasks = Math.max(1, signals.accountAgeDays) * dailyLimit;
  const dailyRewardLimit = thresholds.daily_reward_limit_default || 150.0;
  const maxPlausibleEarnings = Math.max(1, signals.accountAgeDays) * dailyRewardLimit;

  if (profile.hasImpossibleProgress || (signals.completedTasks > maxPlausibleTasks && signals.completedTasks >= 25)) {
    trigger("A07", `Completed ${signals.completedTasks} tasks in ${signals.accountAgeDays} day(s) (exceeds theoretical platform maximum of ${maxPlausibleTasks} tasks)`);
  } else if (signals.earnings > maxPlausibleEarnings && signals.accountAgeDays < 2 && signals.earnings > 500) {
    trigger("A07", `Accumulated \$${signals.earnings.toFixed(2)} earnings in ${signals.accountAgeDays} day(s) (exceeds plausible quota \$${maxPlausibleEarnings.toFixed(2)})`);
  }

  // ── A08 (STRONG): Impossible Tier/Level Progression
  if (profile.hasImpossibleTierProgression) {
    trigger("A08", "Platform VIP/Tier milestone reached faster than system minimum elapsed duration");
  }

  // ── A09 (SOFT): Implausible Earning Ratio
  // Population median reward is $63.74/task; >$200/task is implausible unless VIP deposit >= $1000
  if (profile.hasImplausibleEarningRatio) {
    trigger("A09", "Earnings-to-task ratio exceeds plausible configured task reward limit");
  } else if (signals.completedTasks > 0 && signals.earnings > 0) {
    const avgPerTask = signals.earnings / signals.completedTasks;
    const maxPlausiblePerTask = signals.totalDepositAmount >= 1000 ? 500.0 : (thresholds.max_plausible_task_reward || 200.0);
    if (avgPerTask > maxPlausiblePerTask && signals.completedTasks >= 5) {
      trigger("A09", `Average task payout (\$${avgPerTask.toFixed(2)}/task) severely conflicts with platform catalog ceiling (\$${maxPlausiblePerTask.toFixed(2)}/task)`);
    }
  }

  // ── A10 (STRONG): Direct-API Task Completion
  if (profile.isDirectApi) {
    trigger("A10", "Direct-API execution: completion event without corresponding start event, session token, or handshake");
  } else if (completions.length >= 5 && sessions.length === 0) {
    trigger("A10", `${completions.length} task completions recorded without any corresponding taskSession doc or start handshake`);
  }

  // ── A11 (SOFT): Session Duration Deficit
  if (profile.hasSessionDurationDeficit) {
    trigger("A11", "Total session duration is less than sum of minimum required task durations");
  }

  // ── A12 (STRONG): Counter vs Ledger Mismatch
  if (profile.counterLedgerMismatch) {
    trigger("A12", "Platform progress summary counters deviate significantly from raw ledger documents");
  } else if (completions.length > 0 && signals.completedTasks > completions.length * 2 && signals.completedTasks > 10) {
    trigger("A12", `Profile counter claims ${signals.completedTasks} tasks, but only ${completions.length} records exist in raw taskCompletions ledger`);
  }

  // ── A13 (STRONG): Replayed / Duplicate Task IDs
  if (profile.hasReplayedTasks) {
    trigger("A13", "Identical task ID completed multiple times without cooldown/re-assignment");
  }

  // ── A14 (STRONG): Unbacked Balance / Admin Credit Without Ledger Entry
  if (profile.hasUnbackedBalance) {
    trigger("A14", "Balance excess not explained by verified deposits or completed tasks (unbacked admin/manual credit)");
  } else if (!signals.balanceReconciled && signals.balanceExcess > Math.max(100.0, signals.reconciliationTolerance * 2)) {
    trigger("A14", `Account balance exceeds ledger (deposits + verified task earnings) by \$${signals.balanceExcess.toFixed(2)} with no corresponding transaction`);
  }

  // ── A15 (SOFT): Low Provenance Coverage
  if (signals.completedTasks > 0 && provenanceCoverage < (thresholds.min_provenance_coverage_real || 0.50)) {
    trigger("A15", `Only ${Math.round(provenanceCoverage * 100)}% of completion records contain verifiable telemetry (sessionId, deviceId, IP)`);
  }

  // ── A16 (SOFT): Volatile IP/Device Switching
  if (profile.hasVolatileIpSwitching) {
    trigger("A16", "Rotating IP addresses or device fingerprints alternating between consecutive task completions");
  }

  // ── A17 (STRONG): Cohort Progress Synchronization
  if (profile.isCohortClone || profile.hasCohortCloning) {
    trigger("A17", "Synchronized task completion sequence and timestamp offsets detected matching another cohort account");
  }

  // Calculate final authenticity score bounded [0, 100]
  const rawAuthenticityScore = Math.max(0, Math.min(100, 100 - deductions));
  const strongRules = triggeredRules.filter(r => r.strength === "STRONG");
  const softRules = triggeredRules.filter(r => r.strength === "SOFT");
  const strongCount = strongRules.length;
  const softCount = softRules.length;

  // Group soft flags into independent families
  const triggeredSoftFamilies = new Set();
  for (const sr of softRules) {
    for (const [familyName, familyCodes] of Object.entries(flagFamilies)) {
      if (familyCodes.includes(sr.code)) {
        triggeredSoftFamilies.add(familyName);
      }
    }
  }
  const independentSoftFamiliesCount = triggeredSoftFamilies.size;
  const minIndependentFamilies = config.min_independent_soft_families_for_suspicion || 3;

  // Artificial progress criteria (v3.5):
  // Authenticity < 50 OR any STRONG artificial flag OR >= 3 independent SOFT families
  const hasStrongArtificialFlag = strongCount >= 1;
  const isArtificial = rawAuthenticityScore < 50 || hasStrongArtificialFlag || (independentSoftFamiliesCount >= minIndependentFamilies);

  // Authenticity display & evidence level discount in LEGACY mode
  const isLowEvidence = (evidenceMode === "LEGACY" && provenanceCoverage < 0.30);
  const confidenceLabel = isLowEvidence ? "LOW_EVIDENCE" : "STANDARD";
  const authenticityScore = isLowEvidence
    ? Math.round(rawAuthenticityScore * (0.6 + provenanceCoverage * 0.4))
    : rawAuthenticityScore;

  return {
    authenticityScore,
    rawAuthenticityScore,
    provenanceCoverage,
    evidenceMode,
    evidenceLevel: evidenceMode,
    confidenceLabel,
    triggeredRules,
    triggeredCodes: Array.from(triggeredCodes),
    strongCount,
    softCount,
    independentSoftFamiliesCount,
    triggeredSoftFamilies: Array.from(triggeredSoftFamilies),
    isArtificial,
    hasStrongArtificialFlag,
    hasStrongFlag: hasStrongArtificialFlag,
    strongRules,
    softRules,
  };
}

// ─── 3. Weighted Genuine Score (0–100) ─────────────────────────────────────────
export function computeGenuineScore(signals, config = DEFAULT_RISK_CONFIG) {
  const weights = config.genuine_weights || DEFAULT_RISK_CONFIG.genuine_weights;
  const breakdown = {};
  const positiveSignals = [];

  const authenticityResult = signals.authenticityResult || computeProgressAuthenticity(
    signals,
    signals.rawCompletions || [],
    signals.rawSessions || [],
    { profile: signals.rawProfile },
    config
  );
  const isArtificial = authenticityResult.isArtificial;

  // 1. Identity (Max: 15)
  let identityScore = 0;
  if (signals.emailVerified) {
    identityScore += 7;
    positiveSignals.push({ group: "identity", points: 7, label: "Email Verified", description: "Cryptographically verified email address" });
  }
  if (signals.phoneVerified) {
    identityScore += 3;
    positiveSignals.push({ group: "identity", points: 3, label: "Phone Verified", description: "Verified mobile telephone number" });
  }
  if (signals.isKycVerified) {
    identityScore += 5;
    positiveSignals.push({ group: "identity", points: 5, label: "KYC Verified", description: "Government identity verification approved" });
  }
  breakdown.identity = Math.min(weights.identity || 15, identityScore);

  // 2. Age & Consistency (Max: 15)
  let ageScore = 0;
  if (signals.accountAgeDays >= 90) ageScore = 15;
  else if (signals.accountAgeDays >= 30) ageScore = 11;
  else if (signals.accountAgeDays >= 14) ageScore = 8;
  else if (signals.accountAgeDays >= 7) ageScore = 5;
  else if (signals.accountAgeDays >= 3) ageScore = 2;

  if (ageScore > 0) {
    positiveSignals.push({
      group: "age_consistency",
      points: ageScore,
      label: `Account Tenure (${signals.accountAgeDays}d)`,
      description: `Established platform history of ${signals.accountAgeDays} days`,
    });
  }
  breakdown.age_consistency = Math.min(weights.age_consistency, ageScore);

  // 3. Activity Footprint (Max: 15)
  let activityScore = 0;
  const activeDays = Math.max(signals.sessionDatesCount, signals.taskSessionsCount > 0 ? 1 : 0);
  if (activeDays >= 10) activityScore = 15;
  else if (activeDays >= 5) activityScore = 10;
  else if (activeDays >= 3) activityScore = 6;
  else if (activeDays >= 1) activityScore = 3;

  if (activityScore > 0) {
    positiveSignals.push({
      group: "activity",
      points: activityScore,
      label: `Active Sessions (${signals.taskSessionsCount})`,
      description: `User recorded activity over ${activeDays} distinct day(s)`,
    });
  }
  breakdown.activity = Math.min(weights.activity, activityScore);

  // 4. Tasks & Earnings Legitimacy (Max: 20) — Award if not artificial
  let tasksScore = 0;
  if (!isArtificial) {
    if (signals.completedTasks >= 50) tasksScore = 20;
    else if (signals.completedTasks >= 25) tasksScore = 16;
    else if (signals.completedTasks >= 10) tasksScore = 12;
    else if (signals.completedTasks >= 3) tasksScore = 8;
    else if (signals.completedTasks >= 1) tasksScore = 4;
  }

  if (tasksScore > 0) {
    positiveSignals.push({
      group: "tasks_earnings_legitimacy",
      points: tasksScore,
      label: `Completed Tasks (${signals.completedTasks})`,
      description: `Completed ${signals.completedTasks} organic platform tasks, earning \$${signals.earnings.toFixed(2)}`,
    });
  }
  breakdown.tasks_earnings_legitimacy = Math.min(weights.tasks_earnings_legitimacy, tasksScore);

  // 5. Financial Behavior & External Anchors (Max: 25)
  let financialScore = 0;
  if (signals.depositsCount >= 3 && signals.completedTasks >= 3 && !isArtificial) {
    financialScore += 10;
    positiveSignals.push({
      group: "financial_behavior",
      points: 10,
      label: `Task-Backed Deposits (${signals.depositsCount})`,
      description: `Deposited \$${signals.totalDepositAmount.toFixed(2)} with corresponding organic task progress`,
    });
  } else if (signals.depositsCount >= 1 && signals.completedTasks >= 1 && !isArtificial) {
    financialScore += 5;
    positiveSignals.push({
      group: "financial_behavior",
      points: 5,
      label: "Active Financial Engagement",
      description: `Verified deposit with active organic task engagement`,
    });
  }

  if (signals.withdrawalsCount >= 1 && signals.completedTasks >= 5 && !isArtificial) {
    financialScore += 10;
    positiveSignals.push({
      group: "financial_behavior",
      points: 10,
      label: "Legitimate Task-Backed Withdrawal",
      description: `Completed withdrawals (\$${signals.totalWithdrawalAmount.toFixed(2)}) following organic task completion`,
    });
  }

  // External Anchor bonus: Admin-approved withdrawal (+5)
  if (signals.approvedWithdrawalsCount >= 1) {
    financialScore += 5;
    positiveSignals.push({
      group: "financial_behavior",
      points: 5,
      label: "Admin-Verified Withdrawal",
      description: `Account has ${signals.approvedWithdrawalsCount} administrative approved/paid withdrawal event(s)`,
    });
  }

  // External Anchor bonus: On-chain deposit hash (+5)
  if (signals.hasOnChainDepositAnchor) {
    financialScore += 5;
    positiveSignals.push({
      group: "financial_behavior",
      points: 5,
      label: "On-Chain Transaction Anchor",
      description: `Blockchain transaction hash verified on external ledger`,
    });
  }

  breakdown.financial_behavior = Math.min(weights.financial_behavior, financialScore);

  // 6. Customer Support Engagement (Max: 5)
  let supportScore = 0;
  if (signals.hasSupportActivity) {
    supportScore = Math.min(5, Math.max(2, (signals.supportTicketsCount * 2) + (signals.supportMessagesCount > 0 ? 3 : 0)));
    positiveSignals.push({
      group: "support",
      points: supportScore,
      label: "Customer Support Communication",
      description: `Active tickets (${signals.supportTicketsCount}) and chat messages (${signals.supportMessagesCount}) confirming organic communication`,
    });
  }
  breakdown.support = Math.min(weights.support, supportScore);

  // 7. Device & Network Hygiene (Max: 10)
  let hygieneScore = 0;
  if (signals.sharedDeviceCount === 0 && signals.userDevices.length >= 1) {
    hygieneScore += 5;
    positiveSignals.push({ group: "device_network_hygiene", points: 5, label: "Dedicated Device", description: "Unique device hardware fingerprint without multi-account collision" });
  }
  if (signals.sharedIpCount < 3 && signals.userIps.length >= 1) {
    hygieneScore += 5;
    positiveSignals.push({ group: "device_network_hygiene", points: 5, label: "Clean Network", description: "Non-clustered IP address connection" });
  }
  breakdown.device_network_hygiene = Math.min(weights.device_network_hygiene, hygieneScore);

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  const genuineScore = Math.max(0, Math.min(100, Math.round(total)));

  return {
    genuineScore,
    breakdown,
    positiveSignals,
    authenticityResult,
  };
}

// ─── 4. Risk Score (0–100) & Triggered Rules ──────────────────────────────────
export function computeRiskScore(signals, config = DEFAULT_RISK_CONFIG) {
  const rules = config.risk_rules || DEFAULT_RISK_CONFIG.risk_rules;
  const triggeredRules = [];
  const triggeredCodes = new Set();
  let rawRiskPoints = 0;

  // R01: >5 transactions in 24h
  if (signals.maxTxnsIn24h > (config.velocity_24h_burst_count || 5)) {
    const r = rules.R01;
    rawRiskPoints += r.points;
    triggeredCodes.add(r.code);
    triggeredRules.push({
      code: r.code,
      label: r.label,
      points: r.points,
      evidence: `${signals.maxTxnsIn24h} transactions executed within a 24-hour temporal window`,
    });
  }

  // R02: >3 large transactions (>$300) in 24h
  if (signals.largeTxnsCount >= (config.velocity_large_24h_burst_count || 3)) {
    const r = rules.R02;
    rawRiskPoints += r.points;
    triggeredCodes.add(r.code);
    triggeredRules.push({
      code: r.code,
      label: r.label,
      points: r.points,
      evidence: `${signals.largeTxnsCount} large transactions (>=\$${config.large_transaction_threshold}) executed`,
    });
  }

  // R03: Pass-Through Turnaround (Deposit -> Withdrawal with 0 tasks)
  if (signals.isPassThrough) {
    const r = rules.R03;
    rawRiskPoints += r.points;
    triggeredCodes.add(r.code);
    triggeredRules.push({
      code: r.code,
      label: r.label,
      points: r.points,
      evidence: `Deposit followed by withdrawal turnaround without completing platform tasks`,
    });
  }

  // R04: Unexplained Balance
  if (!signals.balanceReconciled && signals.balanceExcess > 50.0) {
    const r = rules.R04;
    rawRiskPoints += r.points;
    triggeredCodes.add(r.code);
    triggeredRules.push({
      code: r.code,
      label: r.label,
      points: r.points,
      evidence: `Balance (\$${signals.balance.toFixed(2)}) exceeds expected formula (\$${signals.expectedBalance.toFixed(2)}) by \$${signals.balanceExcess.toFixed(2)}`,
    });
  }

  // R05: High Balance Zero Tasks
  if (signals.balance > 100.0 && signals.completedTasks === 0) {
    const r = rules.R05;
    rawRiskPoints += r.points;
    triggeredCodes.add(r.code);
    triggeredRules.push({
      code: r.code,
      label: r.label,
      points: r.points,
      evidence: `Holding \$${signals.balance.toFixed(2)} balance with 0 completed platform tasks`,
    });
  }

  // R06: Deposit-Only Account (deposits > 0, tasks == 0, withdrawals == 0)
  if (signals.isDepositOnly) {
    const r = rules.R06;
    rawRiskPoints += r.points;
    triggeredCodes.add(r.code);
    triggeredRules.push({
      code: r.code,
      label: r.label,
      points: r.points,
      evidence: `Account holds ${signals.depositsCount} deposit(s) but has 0 tasks completed and 0 withdrawals`,
    });
  }

  // R08: Shared Device Cluster
  if (signals.sharedDeviceCount >= 1) {
    const r = rules.R08;
    const scaledPoints = r.points + Math.min(20, (signals.sharedDeviceCount - 1) * 5);
    rawRiskPoints += scaledPoints;
    triggeredCodes.add(r.code);
    triggeredRules.push({
      code: r.code,
      label: r.label,
      points: scaledPoints,
      evidence: `Device hardware fingerprint shared across ${signals.sharedDeviceCount + 1} distinct user accounts`,
    });
  }

  // R09: Geo-Restricted Region (Notice only, 0 points)
  if (signals.isGeoRestricted) {
    const r = rules.R09;
    rawRiskPoints += r.points;
    triggeredCodes.add(r.code);
    triggeredRules.push({
      code: r.code,
      label: r.label,
      points: r.points,
      evidence: `Account registration originates from geo-restricted region (${signals.country || "Pakistan"}) — 0 fraud points`,
    });
  }

  // R10: Identity Discrepancy (Only fire on explicit KYC rejection or disposable email spoofing)
  if (signals.kycStatus === "rejected" || (signals.disposableEmail && signals.totalDepositAmount > 500)) {
    const r = rules.R10;
    rawRiskPoints += r.points;
    triggeredCodes.add(r.code);
    triggeredRules.push({
      code: r.code,
      label: r.label,
      points: r.points,
      evidence: `Identity verification discrepancy: ${signals.kycStatus === "rejected" ? "KYC rejected" : "disposable email with high-value transactions"}`,
    });
  }

  // R11: Fresh Account High Velocity
  if (signals.isFreshAccountLargeTx) {
    const r = rules.R11;
    rawRiskPoints += r.points;
    triggeredCodes.add(r.code);
    triggeredRules.push({
      code: r.code,
      label: r.label,
      points: r.points,
      evidence: `High-value financial transaction executed within first ${signals.accountAgeDays} days of registration`,
    });
  }

  // R12: Referral Farm Cluster
  if (signals.circularReferral) {
    const r = rules.R12;
    rawRiskPoints += r.points;
    triggeredCodes.add(r.code);
    triggeredRules.push({
      code: r.code,
      label: r.label,
      points: r.points,
      evidence: `Circular referral detected — account and referrer mutually referred each other`,
    });
  }

  // R15: Shared Network Collision
  if (signals.sharedIpCount >= 5) {
    const r = rules.R15;
    rawRiskPoints += r.points;
    triggeredCodes.add(r.code);
    triggeredRules.push({
      code: r.code,
      label: r.label,
      points: r.points,
      evidence: `IP address seen across ${signals.sharedIpCount + 1} distinct user accounts`,
    });
  }

  // R16: Shared Wallet Collision
  if (signals.sharedWalletCount >= 1) {
    const r = rules.R16;
    rawRiskPoints += r.points;
    triggeredCodes.add(r.code);
    triggeredRules.push({
      code: r.code,
      label: r.label,
      points: r.points,
      evidence: `Withdrawal wallet address shared with ${signals.sharedWalletCount} other account(s)`,
    });
  }

  // Apply Combo Multipliers
  let comboMultiplier = 1.0;
  const appliedCombos = [];
  for (const combo of (config.combo_multipliers || DEFAULT_RISK_CONFIG.combo_multipliers)) {
    if (combo.rules.every(code => triggeredCodes.has(code))) {
      comboMultiplier = Math.max(comboMultiplier, combo.multiplier);
      appliedCombos.push(combo.label);
    }
  }

  const finalRiskPoints = Math.round(rawRiskPoints * comboMultiplier);
  const riskScore = Math.max(0, Math.min(100, finalRiskPoints));

  return {
    riskScore,
    triggeredRules,
    triggeredCodes: Array.from(triggeredCodes),
    comboMultiplier,
    appliedCombos,
  };
}

// ─── 5. Dynamic Confidence Calculation ────────────────────────────────────────
export function computeConfidence(signals, genuineScore, riskScore, provisionalClass, config = DEFAULT_RISK_CONFIG, provenanceCoverage = 1.0) {
  const dataCoverage = signals.dataCoverage;

  let boundaryDistance = 0.5;
  if (provisionalClass === "REAL" || provisionalClass === "LIKELY_REAL") {
    const distFromGenuine = Math.max(0, genuineScore - 50) / 50;
    const distFromRisk = Math.max(0, 30 - riskScore) / 30;
    boundaryDistance = (distFromGenuine + distFromRisk) / 2;
  } else if (provisionalClass === "FAKE" || provisionalClass === "LIKELY_FAKE") {
    boundaryDistance = Math.min(1.0, Math.max(0, riskScore - 60) / 40);
  } else if (provisionalClass === "SUSPICIOUS") {
    const distFromEdges = Math.min(riskScore - 40, 59 - riskScore);
    boundaryDistance = Math.max(0, distFromEdges / 10);
  }

  const scoreSpread = Math.abs(genuineScore - riskScore) / 100;
  const signalAgreement = scoreSpread;

  // History & Tenure Factor
  const historyFactor = Math.min(1.0, (signals.accountAgeDays / 21) * 0.6 + (signals.completedTasks > 0 ? 0.4 : 0));

  // In LEGACY mode, do not penalize confidence to the point of demoting organic users to MANUAL_REVIEW!
  const evidenceMode = signals.evidenceMode || "LEGACY";
  let factor4 = 0.5;
  if (evidenceMode === "TELEMETRY") {
    factor4 = Math.max(0.1, Math.min(1.0, Number(provenanceCoverage || 1.0)));
  } else {
    const activeDays = Math.max(signals.sessionDatesCount || 0, signals.taskSessionsCount > 0 ? 1 : 0);
    factor4 = Math.min(1.0, (signals.accountAgeDays / 21) * 0.5 + (activeDays / 5) * 0.5);
  }

  let rawConfidence =
    (dataCoverage * 0.35) +
    (boundaryDistance * 0.25) +
    (signalAgreement * 0.20) +
    (factor4 * 0.20);

  rawConfidence = Math.max(0.35, Math.min(0.99, Number(rawConfidence.toFixed(2))));
  return rawConfidence;
}

// ─── 6. Classification Pipeline & Real Gates (v3.5) ───────────────────────────
export function classifyProfile(signals, genuineResult, riskResult, config = DEFAULT_RISK_CONFIG, adminOverride = null) {
  if (!genuineResult || typeof genuineResult.genuineScore !== "number") {
    const context = (genuineResult && typeof genuineResult === "object") ? genuineResult : {};
    const cfg = (riskResult && typeof riskResult === "object" && riskResult.matrix_boundaries) ? riskResult : (config || DEFAULT_RISK_CONFIG);
    const extracted = extractUserSignals(signals, context);
    const gRes = computeGenuineScore(extracted, cfg);
    const rRes = computeRiskScore(extracted, cfg);
    return classifyProfile(extracted, gRes, rRes, cfg, context.adminOverride || adminOverride);
  }

  const genuineScore = genuineResult.genuineScore;
  const riskScore = riskResult.riskScore;
  const triggeredCodes = new Set(riskResult.triggeredCodes);
  const matrix = config.matrix_boundaries || DEFAULT_RISK_CONFIG.matrix_boundaries;

  // Extract Progress Authenticity
  const authenticityResult = genuineResult.authenticityResult || signals.authenticityResult || computeProgressAuthenticity(
    signals,
    signals.rawCompletions || [],
    signals.rawSessions || [],
    { profile: signals.rawProfile },
    config
  );
  const authenticityScore = authenticityResult.authenticityScore;
  const provenanceCoverage = authenticityResult.provenanceCoverage;
  const hasStrongArtificial = authenticityResult.hasStrongArtificialFlag;
  const isArtificial = authenticityResult.isArtificial;
  const evidenceMode = authenticityResult.evidenceMode || "LEGACY";

  for (const aCode of authenticityResult.triggeredCodes) {
    triggeredCodes.add(aCode);
  }

  // Separate Gates: Behavior vs Verification
  const bg = config.behavior_gates || DEFAULT_RISK_CONFIG.behavior_gates;
  const vg = config.verification_gates || DEFAULT_RISK_CONFIG.verification_gates;

  const behaviorGatesStatus = {
    accountAge: signals.accountAgeDays >= (bg.min_account_age_days || 14),
    completedTasks: signals.completedTasks >= (bg.min_completed_tasks || 10),
    activeDays: signals.sessionDatesCount >= (bg.min_distinct_active_days || 8),
    balanceReconciled: Boolean(signals.balanceReconciled),
    noStrongArtificialFlag: !hasStrongArtificial,
    noHighRiskFlag: !triggeredCodes.has("R03") && !triggeredCodes.has("R04") && !triggeredCodes.has("R08") && !triggeredCodes.has("R16"),
  };
  const allBehaviorGatesPass = Object.values(behaviorGatesStatus).every(Boolean);

  const verificationGatesStatus = {
    provenanceCoverage: provenanceCoverage >= (vg.min_provenance_coverage || 0.50),
    noSharedDevice: signals.sharedDeviceCount === 0,
    emailVerified: vg.email_verification_available ? Boolean(signals.emailVerified) : "UNAVAILABLE",
  };
  const allVerificationGatesPass = verificationGatesStatus.provenanceCoverage && verificationGatesStatus.noSharedDevice;

  const realGatesStatus = {
    ...behaviorGatesStatus,
    ...verificationGatesStatus,
  };
  const allRealGatesPass = allBehaviorGatesPass && allVerificationGatesPass;

  const tags = [];
  let classification = "MANUAL_REVIEW";
  let reason = "UNRESOLVED_MATRIX_EVALUATION";
  let reviewPriority = "LOW";

  // ── Step 0: Human Ground-Truth Gold Set Override (Highest Truth) ──────────
  const humanLabel = signals.humanRiskLabel || signals.rawContext?.humanRiskLabel || null;
  if (humanLabel && humanLabel.verdict) {
    const verdict = String(humanLabel.verdict).toLowerCase().trim();
    if (verdict === "organic") {
      classification = "REAL";
      reason = "HUMAN_VERIFIED_ORGANIC";
      tags.push("HUMAN_VERIFIED_REAL");
    } else if (verdict === "artificial") {
      classification = "SUSPICIOUS";
      reason = "HUMAN_VERIFIED_ARTIFICIAL";
      tags.push("HUMAN_VERIFIED_ARTIFICIAL");
    } else if (verdict === "fake") {
      classification = "FAKE";
      reason = "HUMAN_VERIFIED_FAKE";
      tags.push("HUMAN_VERIFIED_FAKE");
    }

    return {
      classification,
      confidence: 1.0,
      decisionReason: reason,
      genuineScore,
      riskScore,
      evidenceMode,
      reviewPriority: "RESOLVED",
      tags,
      isHumanVerified: true,
      humanLabel,
      dataCoverage: signals.dataCoverage,
      authenticity: authenticityResult,
      geoPolicy: {
        isRestricted: signals.isGeoRestricted,
        country: signals.country,
        isp: signals.isp,
        note: signals.isGeoRestricted ? "Geo-restricted region policy flag" : "Standard region",
      },
      realGatesStatus,
      allRealGatesPass,
      behaviorGatesStatus,
      allBehaviorGatesPass,
      verificationGatesStatus,
      allVerificationGatesPass,
      reasonCodes: Array.from(triggeredCodes),
      positiveSignals: genuineResult.positiveSignals,
      negativeSignals: riskResult.triggeredRules,
      balanceReconciliation: {
        balance: signals.balance,
        expectedBalance: signals.expectedBalance,
        deposits: signals.totalDepositAmount,
        verifiedEarnings: signals.earnings,
        bonuses: signals.bonusBalance,
        withdrawals: signals.totalWithdrawalAmount,
        fees: signals.totalFees,
        variance: signals.balanceVariance,
        excess: signals.balanceExcess,
        tolerance: signals.reconciliationTolerance,
        reconciled: signals.balanceReconciled,
      },
    };
  }

  // ── Step 1: Admin Override ────────────────────────────────────────────────
  if (adminOverride?.classification && adminOverride.status === "COMPLETED") {
    return {
      classification: adminOverride.classification,
      confidence: 1.0,
      genuineScore,
      riskScore,
      evidenceMode,
      reviewPriority: "OVERRIDDEN",
      isOverridden: true,
      overrideReason: adminOverride.notes || "Admin override",
      tags: ["ADMIN_OVERRIDDEN"],
      reasonCodes: Array.from(triggeredCodes),
      realGatesStatus,
      allRealGatesPass,
      behaviorGatesStatus,
      allBehaviorGatesPass,
      verificationGatesStatus,
      allVerificationGatesPass,
      authenticity: authenticityResult,
      geoPolicy: {
        isRestricted: signals.isGeoRestricted,
        country: signals.country,
        isp: signals.isp,
        note: signals.isGeoRestricted ? "Geo-restricted region policy flag" : "Standard region",
      },
      balanceReconciliation: {
        balance: signals.balance,
        expectedBalance: signals.expectedBalance,
        variance: signals.balanceVariance,
        excess: signals.balanceExcess,
        tolerance: signals.reconciliationTolerance,
        reconciled: signals.balanceReconciled,
      },
    };
  }

  // ── Step 2: Hard-FAKE Rules ───────────────────────────────────────────────
  if (signals.isTestAccount) {
    classification = "FAKE";
    reason = "TEST_ACCOUNT_FLAGGED";
  } else if (signals.sharedDeviceCount >= 2 && !signals.balanceReconciled && signals.balanceExcess > 100) {
    classification = "FAKE";
    reason = "CONFIRMED_MULTI_ACCOUNT_CLUSTER_UNEXPLAINED_BALANCE";
  } else if (authenticityResult.strongCount >= 3 || (hasStrongArtificial && (signals.sharedDeviceCount >= 1 || signals.isPassThrough))) {
    classification = "LIKELY_FAKE";
    reason = "COORDINATED_ARTIFICIAL_PROGRESS_CLUSTER";
  }
  // ── Step 3: Hard Artificial Progress -> Capped at SUSPICIOUS ─────────────
  else if (isArtificial) {
    classification = "SUSPICIOUS";
    reason = "ARTIFICIAL_PROGRESS_DETECTED";
    tags.push("ARTIFICIAL_PROGRESS");
  }
  // ── Step 4: High Risk Score Classifications ───────────────────────────────
  else if (riskScore >= matrix.fake_min_risk) { // >= 80
    classification = "FAKE";
    reason = "EXTREME_RISK_SCORE";
  } else if (riskScore >= matrix.likely_fake_min_risk) { // 60–79
    classification = "LIKELY_FAKE";
    reason = "ELEVATED_RISK_SCORE";
  } else if (riskScore >= matrix.suspicious_min_risk) { // 40–59
    classification = "SUSPICIOUS";
    reason = "MODERATE_RISK_SCORE";
  }
  // ── Step 5: Conflicting Evidence (Genuine >= 60 AND Risk >= 40) ───────────
  else if (genuineScore >= 60 && riskScore >= 40) {
    classification = "MANUAL_REVIEW";
    reason = "CONFLICTING_SIGNALS";
    reviewPriority = "MEDIUM";
  }
  // ── Step 6: Organic Qualification (REAL / LIKELY_REAL) ───────────────────
  else if (genuineScore >= matrix.real_min_genuine && riskScore <= matrix.real_max_risk && allBehaviorGatesPass) {
    if (evidenceMode === "TELEMETRY" && allVerificationGatesPass) {
      classification = "REAL";
      reason = "ALL_REAL_GATES_PASSED";
    } else {
      // In LEGACY mode or missing provenance, cap at LIKELY_REAL with UNVERIFIED_PROVENANCE tag
      classification = "LIKELY_REAL";
      reason = "STRONG_ORGANIC_BEHAVIOR_LEGACY";
      tags.push("UNVERIFIED_PROVENANCE");
    }
  } else if (
    genuineScore >= matrix.likely_real_min_genuine &&
    riskScore <= matrix.likely_real_max_risk &&
    !hasStrongArtificial &&
    !triggeredCodes.has("R03") &&
    !triggeredCodes.has("R04") &&
    !triggeredCodes.has("R08") &&
    !triggeredCodes.has("R16") &&
    signals.balanceReconciled
  ) {
    classification = "LIKELY_REAL";
    reason = "STRONG_GENUINE_SIGNALS";
    if (evidenceMode === "LEGACY") tags.push("UNVERIFIED_PROVENANCE");
  } else if (signals.accountAgeDays < 1 && signals.depositsCount === 0 && signals.completedTasks === 0) {
    classification = "MANUAL_REVIEW";
    reason = "FRESH_ACCOUNT_NO_ACTIVITY";
    reviewPriority = "LOW";
  } else if (signals.dataCoverage < (config.min_data_coverage_threshold || 0.40)) {
    classification = "MANUAL_REVIEW";
    reason = "INSUFFICIENT_DATA";
    reviewPriority = "LOW";
  } else {
    classification = "MANUAL_REVIEW";
    reason = "REMAINING_MATRIX_GAP";
    reviewPriority = "LOW";
  }

  // ── Step 7: Hard Caps Enforcement ─────────────────────────────────────────
  // Cap A: Deposit-only account -> maximum allowed class is MANUAL_REVIEW / SUSPICIOUS
  if (signals.isDepositOnly && (classification === "REAL" || classification === "LIKELY_REAL")) {
    classification = "MANUAL_REVIEW";
    reason = "CAPPED_BY_DEPOSIT_ONLY_STATUS";
    reviewPriority = "LOW";
  }

  // Cap B: Artificial progress cannot be REAL or LIKELY_REAL
  if (isArtificial && (classification === "REAL" || classification === "LIKELY_REAL")) {
    classification = "SUSPICIOUS";
    reason = "CAPPED_BY_ARTIFICIAL_PROGRESS";
  }

  // Cap C: Pass-through turnaround cannot be REAL or LIKELY_REAL
  if (signals.isPassThrough && (classification === "REAL" || classification === "LIKELY_REAL")) {
    classification = "SUSPICIOUS";
    reason = "CAPPED_BY_PASS_THROUGH_FLAG";
  }

  // ── Step 8: Compute Confidence ────────────────────────────────────────────
  let confidence = computeConfidence(signals, genuineScore, riskScore, classification, config, provenanceCoverage);
  if (isArtificial) {
    confidence = Math.max(confidence, 0.75);
  }

  // Low confidence downgrade is ONLY for genuinely uncertain cases, NOT for organic accounts passing behavior gates
  if (confidence < (config.min_confidence_threshold || 0.50) && classification !== "FAKE" && classification !== "LIKELY_REAL" && !isArtificial) {
    if (classification !== "MANUAL_REVIEW") {
      classification = "MANUAL_REVIEW";
      reason = "ROUTED_BY_LOW_CONFIDENCE";
      reviewPriority = "LOW";
    }
  }

  // ── Step 9: MANUAL_REVIEW Priority Assignment (Triage Queue) ─────────────
  if (classification === "MANUAL_REVIEW") {
    if (triggeredCodes.has("A14") || triggeredCodes.has("A07") || (signals.balance > 5000 && !signals.balanceReconciled)) {
      reviewPriority = "HIGH";
    } else if (genuineScore >= 50 && riskScore >= 35) {
      reviewPriority = "MEDIUM";
    } else {
      reviewPriority = "LOW";
    }
  }

  return {
    classification,
    confidence,
    decisionReason: reason,
    genuineScore,
    riskScore,
    evidenceMode,
    reviewPriority: classification === "MANUAL_REVIEW" ? reviewPriority : "NONE",
    tags,
    dataCoverage: signals.dataCoverage,
    authenticity: authenticityResult,
    geoPolicy: {
      isRestricted: signals.isGeoRestricted,
      country: signals.country,
      isp: signals.isp,
      note: signals.isGeoRestricted ? "Geo-restricted region policy flag (0 fraud risk points)" : "Standard region",
    },
    realGatesStatus,
    allRealGatesPass,
    behaviorGatesStatus,
    allBehaviorGatesPass,
    verificationGatesStatus,
    allVerificationGatesPass,
    reasonCodes: Array.from(triggeredCodes),
    positiveSignals: genuineResult.positiveSignals,
    negativeSignals: riskResult.triggeredRules,
    balanceReconciliation: {
      balance: signals.balance,
      expectedBalance: signals.expectedBalance,
      deposits: signals.totalDepositAmount,
      verifiedEarnings: signals.earnings,
      bonuses: signals.bonusBalance,
      withdrawals: signals.totalWithdrawalAmount,
      fees: signals.totalFees,
      variance: signals.balanceVariance,
      excess: signals.balanceExcess,
      tolerance: signals.reconciliationTolerance,
      reconciled: signals.balanceReconciled,
    },
  };
}
