/**
 * user-intelligence-config.js — Enterprise Risk & Classification Configuration v3.5
 *
 * Configurable thresholds, weights, real gates, flag families, and combo multipliers.
 * Can be loaded from Firestore (`userIntelligenceConfig` / `global`) or fall back to defaults.
 */

export const DEFAULT_RISK_CONFIG = {
  score_version: "2026.10-v3.5",
  updated_at: new Date().toISOString(),
  updated_by: "system_init",

  // ── Telemetry Rollout & Evidence Modes ─────────────────────────────────────
  telemetryGoLiveAt: "2026-10-15T00:00:00.000Z",
  evidence_modes: {
    telemetry_min_provenance: 0.50, // >=50% provenance qualifies for TELEMETRY mode
    legacy_max_provenance: 0.30,    // <30% evaluates under LEGACY mode
  },

  // ── Genuine Score Group Weights (Total Max = 100) ──────────────────────────
  genuine_weights: {
    identity: 15,                  // Phone (4), KYC (6) — email is unpenalized since registration lacks verification flow
    age_consistency: 15,           // Account age tenure (90d=15, 30d=11, 14d=8, 7d=5, 3d=2)
    activity: 15,                  // Distinct active days in 30/90d (10d=15, 5d=10, 3d=6, 1d=3)
    tasks_earnings_legitimacy: 20, // Verified completed tasks & progression
    financial_behavior: 20,        // Deposits + legitimate task-backed withdrawal + on-chain anchors (+5)
    support: 5,                    // Customer support engagement (Neutral 0 if none, +3 to +5 if human-quality active)
    device_network_hygiene: 10,    // Unique dedicated device (5) + Clean non-shared IP (5)
  },

  // ── Real Gates Separation: Behavior vs Verification ────────────────────────
  // Behavior gates: Required for LIKELY_REAL (and for REAL).
  behavior_gates: {
    min_account_age_days: 14,               // Established tenure
    min_completed_tasks: 10,                // Has completed >=10 tasks
    min_distinct_active_days: 8,            // Recorded activity on >=5 distinct days
    require_reconciled_balance: true,       // Balance matches ledger within tolerance
    max_tolerance_balance_variance: 15.0,   // USD tolerance (or 2% of balance)
    prohibit_strong_artificial_flags: true, // No STRONG artificial flags allowed
  },

  // Verification gates: Separate from behavior. Missing verification caps at LIKELY_REAL.
  verification_gates: {
    require_verified_identity: false,       // Platform has NO email verification on signup; marked UNAVAILABLE
    email_verification_available: false,    // Feature flag: set true once email confirmation flow is deployed
    min_provenance_coverage: 0.50,          // Required for model-only REAL in TELEMETRY mode
    prohibit_shared_device_cluster: true,   // Dedicated hardware fingerprint
  },

  // Backward-compatible real_gates reference
  real_gates: {
    min_account_age_days: 14,
    min_completed_tasks: 10,
    min_distinct_active_days: 8,
    min_authenticity_score: 70,
    min_provenance_coverage: 0.50,
    require_verified_identity: false,
    require_reconciled_balance: true,
    max_tolerance_balance_variance: 15.0,
    prohibit_shared_device_cluster: true,
    prohibit_strong_artificial_flags: true,
  },

  // ── Correlated Flag Families (Limits false-positive compound soft flags) ────
  flag_families: {
    BURST_EARNINGS: ["A03", "A09"],
    TIMING_RHYTHM: ["A01", "A02", "A04", "A05", "A06"],
    LEDGER_PROVENANCE: ["A10", "A11", "A12", "A13", "A14"],
    NETWORK_COHORT: ["A16", "A17"],
  },
  min_independent_soft_families_for_suspicion: 3,

  // ── Classification Matrix Boundaries ───────────────────────────────────────
  matrix_boundaries: {
    real_min_genuine: 75,
    real_max_risk: 15,
    real_min_coverage: 0.50,

    likely_real_min_genuine: 50,
    likely_real_max_risk: 30,

    suspicious_min_risk: 40,
    suspicious_max_risk: 59,

    likely_fake_min_risk: 60,
    likely_fake_max_risk: 79,

    fake_min_risk: 80,
  },

  // ── Confidence & Coverage Thresholds ───────────────────────────────────────
  min_confidence_threshold: 0.50,
  min_data_coverage_threshold: 0.40,

  // ── Transaction Velocity Thresholds ─────────────────────────────────────────
  large_transaction_threshold: 300.0, // USD
  velocity_24h_burst_count: 5,
  velocity_large_24h_burst_count: 3,

  // ── Progress Authenticity Thresholds (A01 - A17) ───────────────────────────
  authenticity_thresholds: {
    min_plausible_task_duration_seconds: 10, // A01: Below 10s is sub-human/automated
    machine_regular_cv_threshold: 0.15,      // A02: CV of intervals < 0.15 over >=10 tasks
    burst_tasks_window_minutes: 5,           // A03: Burst window (DealXStocks tasks are 25/pack)
    burst_tasks_limit: 30,                   // A03: >30 tasks in 5 min (<10s/task without reading ad)
    circadian_active_hours_threshold: 20,    // A04: Activity in >=20 of 24 hours
    circadian_min_quiet_gap_hours: 4,        // A04: Expected >=4h quiet sleep window
    zero_variance_consecutive_days: 7,       // A05: Identical count for >=7 days
    daily_task_limit_default: 50,            // A07: Platform daily task limit (2 packages)
    daily_reward_limit_default: 150.0,       // A07: Plausible daily reward ceiling
    max_plausible_task_reward: 200.0,        // A09: Population p90 is $64/task; >$200 is implausible
    min_provenance_coverage_real: 0.50,      // A15: Provenance requirement
  },

  // ── Progress Authenticity Rules (A01 – A17) ─────────────────────────────────
  authenticity_rules: {
    A01: { code: "A01", strength: "STRONG", points: 35, family: "TIMING_RHYTHM", label: "Sub-Human Completion Duration", description: "Completed faster than plausible minimum duration (<10s)" },
    A02: { code: "A02", strength: "STRONG", points: 30, family: "TIMING_RHYTHM", label: "Machine-Regular Intervals", description: "Inter-completion intervals coefficient of variation < 0.15 (robotic rhythm)" },
    A03: { code: "A03", strength: "SOFT", points: 15, family: "BURST_EARNINGS", label: "Sub-Human Burst Velocity", description: ">30 tasks in 5 minutes (<10s per task without viewing ad content)" },
    A04: { code: "A04", strength: "SOFT", points: 15, family: "TIMING_RHYTHM", label: "No Circadian Rhythm", description: "Active across >=20 of 24 hours without natural >=4h sleep rest gap" },
    A05: { code: "A05", strength: "SOFT", points: 15, family: "TIMING_RHYTHM", label: "Zero-Variance Daily Output", description: "Identical daily completed task count and earnings for >=7 consecutive days" },
    A06: { code: "A06", strength: "SOFT", points: 10, family: "TIMING_RHYTHM", label: "Repeated Second/Minute Offset", description: "Completions locked to identical second or minute timestamps across multiple tasks" },
    A07: { code: "A07", strength: "STRONG", points: 40, family: "BURST_EARNINGS", label: "Impossible Output vs Age", description: "Total tasks or earnings exceeds account_age_days × daily_task_limit" },
    A08: { code: "A08", strength: "STRONG", points: 35, family: "BURST_EARNINGS", label: "Impossible Tier Progression", description: "Platform tier or level reached faster than physical minimum allowable time" },
    A09: { code: "A09", strength: "SOFT", points: 15, family: "BURST_EARNINGS", label: "Implausible Earning Ratio", description: "Average task reward >$200/task conflicting with platform catalog payout tables" },
    A10: { code: "A10", strength: "STRONG", points: 40, family: "LEDGER_PROVENANCE", label: "Direct-API Task Completion", description: "Task completed without corresponding start event, session token, or telemetry handshake" },
    A11: { code: "A11", strength: "SOFT", points: 15, family: "LEDGER_PROVENANCE", label: "Session Duration Deficit", description: "Completions without session overlap or session duration < sum of min task durations" },
    A12: { code: "A12", strength: "STRONG", points: 35, family: "LEDGER_PROVENANCE", label: "Counter vs Ledger Mismatch", description: "Summary counters in platformProgress/user profile do not match individual completion docs" },
    A13: { code: "A13", strength: "STRONG", points: 40, family: "LEDGER_PROVENANCE", label: "Replayed / Duplicate Task IDs", description: "Identical task ID completed more times than allowed or commission deviates from config" },
    A14: { code: "A14", strength: "STRONG", points: 40, family: "LEDGER_PROVENANCE", label: "Unbacked Balance / Admin Credit", description: "Balance or earnings changed without legitimate task ledger entry (manual/admin credit)" },
    A15: { code: "A15", strength: "SOFT", points: 10, family: "LEDGER_PROVENANCE", label: "Low Provenance Coverage", description: "Progress events lack client telemetry linkage (sessionId, deviceId, ip, userAgent)" },
    A16: { code: "A16", strength: "SOFT", points: 15, family: "NETWORK_COHORT", label: "Volatile IP/Device Switching", description: "IP address or device fingerprint switching rapidly between consecutive task completions" },
    A17: { code: "A17", strength: "STRONG", points: 45, family: "NETWORK_COHORT", label: "Cohort Progress Synchronization", description: "Near-identical progress timeline, task sequences, and offsets across multiple accounts" },
  },

  // ── Risk Rules Points & Definitions (R01 – R16) ─────────────────────────────
  risk_rules: {
    R01: { code: "R01", label: "24h Activity Burst", points: 15, description: ">5 transactions in any 24h window" },
    R02: { code: "R02", label: "Large Transaction Burst", points: 20, description: ">3 large transactions (>$300) in 24h window" },
    R03: { code: "R03", label: "Pass-Through Turnaround", points: 25, description: "Deposit to withdrawal cycle with 0 completed tasks" },
    R04: { code: "R04", label: "Unexplained Balance", points: 30, description: "Account balance significantly exceeds deposits plus legitimate task earnings" },
    R05: { code: "R05", label: "High Balance Zero Tasks", points: 20, description: "Account balance >$100 with zero completed platform tasks" },
    R06: { code: "R06", label: "Deposit-Only Account", points: 15, description: "Account holds deposits but has 0 tasks and 0 withdrawals" },
    R07: { code: "R07", label: "Sub-Human Task Velocity", points: 20, description: "Tasks completed at impossible speed or with zero timing variance" },
    R08: { code: "R08", label: "Shared Device Cluster", points: 25, description: "Device fingerprint linked to multiple distinct user accounts" },
    R09: { code: "R09", label: "Geo-Restricted Region (Policy)", points: 0, description: "Originates from high-risk or geo-restricted country (Pakistan) — Tracked as policy flag (0 fraud points)" },
    R10: { code: "R10", label: "Identity Discrepancy", points: 10, description: "Explicit KYC rejection or conflicting identity footprint" },
    R11: { code: "R11", label: "Fresh Account High Velocity", points: 15, description: "Account <3 days old executing large financial transactions" },
    R12: { code: "R12", label: "Referral Farm Cluster", points: 20, description: "Circular referral or multi-account referral chain on shared network" },
    R13: { code: "R13", label: "Structuring & Uniform Amounts", points: 10, description: "Suspiciously uniform repeated transaction amounts (bot pattern)" },
    R14: { code: "R14", label: "Support Abuse / Dispute", points: 15, description: "Dispute or chargeback indicators logged in customer support" },
    R15: { code: "R15", label: "Shared Network Collision", points: 10, description: "IP address observed across 5+ independent accounts" },
    R16: { code: "R16", label: "Shared Wallet Collision", points: 30, description: "Withdrawal wallet address shared with another account" },
  },

  // ── Multi-Rule Combo Multipliers ───────────────────────────────────────────
  combo_multipliers: [
    { rules: ["R03", "R05"], multiplier: 1.25, label: "Pass-Through Zero Tasks Combo" },
    { rules: ["R04", "R08"], multiplier: 1.30, label: "Multi-Account Unexplained Balance Combo" },
    { rules: ["R02", "R11"], multiplier: 1.20, label: "Rapid High-Value Velocity on Fresh Account" },
    { rules: ["R08", "R16"], multiplier: 1.35, label: "Sybil Farm: Shared Device and Shared Wallet" },
  ],
};
