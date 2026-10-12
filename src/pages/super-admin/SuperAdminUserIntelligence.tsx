import { useState, useEffect, useMemo, useCallback } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  Eye,
  Smartphone,
  Globe,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  FileCode,
  Loader2,
  X,
  TrendingDown,
  TrendingUp,
  MapPin,
  Zap,
  AlertCircle,
  BarChart3,
  FlaskConical,
  Layers,
  Wallet,
  Calendar,
  Filter,
  ArrowUpDown,
  Award,
  Sparkles,
  Tag,
  CheckCheck,
} from "lucide-react";
import { api } from "../../lib/apiClient";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface TxVelocityAnalysis {
  velocityRisk: number;
  flags: string[];
  analysisData: {
    totalTransactions: number;
    transactionsFirst24h: number;
    transactionsFirstHour: number;
    txnsPerDay: number;
    depositCount: number;
    withdrawalCount: number;
    amountCoeffVariation: number | null;
  };
}

export interface UserIntelligenceProfile {
  userId: string;
  username: string;
  name: string;
  email: string;
  normalizedEmail?: string;
  phone: string;
  country: string;
  isp?: string;
  createdAt: string;
  accountAgeDays: number;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  kycStatus: string;
  devices: string[];
  devicesCount: number;
  ips: string[];
  ipsCount: number;
  walletAddress?: string;
  referralCode?: string;
  referredBy?: string;
  referredByUserId?: string;
  depositsCount: number;
  totalDepositAmount: number;
  withdrawalsCount: number;
  totalWithdrawalAmount: number;
  completedTasksCount: number;
  accountBalance?: number;
  earnings?: number;
  taskSessionsCount?: number;
  sessionDatesCount?: number;
  supportTicketsCount?: number;
  supportConversationsCount?: number;
  supportMessagesCount?: number;
  hasSupportActivity?: boolean;
  txVelocityAnalysis?: TxVelocityAnalysis;
  eventCount: number;
  genuineScore: number;
  suspicionScore: number;
  riskScore?: number;
  duplicateScore: number;
  classification: "REAL" | "LIKELY_REAL" | "SUSPICIOUS" | "LIKELY_FAKE" | "FAKE" | "DUPLICATE" | "MANUAL_REVIEW";
  automatedClassification?: string;
  adminFinalClassification?: string;
  confidence: number;
  decisionReason?: string;
  reasonCodes: string[];
  relatedAccounts: string[];
  clusterId?: string | null;
  evidencePositive?: string[];
  evidenceNegative?: string[];
  positiveSignals?: Array<{ group: string; points: number; maxPoints: number; detail: string }>;
  negativeSignals?: Array<{ code: string; label: string; points: number; description: string }>;
  balanceReconciliation?: {
    balance: number;
    expectedBalance: number;
    variance: number;
    excess: number;
    tolerance?: number;
    reconciled: boolean;
  };
  authenticity?: {
    score: number;
    provenanceCoverage: number;
    isArtificial: boolean;
    hasStrongFlag: boolean;
    strongCount: number;
    softCount: number;
    triggeredRules: Array<{
      code: string;
      strength: string;
      points: number;
      label: string;
      description: string;
      evidence: string;
    }>;
  };
  geoPolicy?: {
    isRestricted: boolean;
    country?: string;
    isp?: string;
    note?: string;
  };
  realGatesStatus?: {
    verifiedIdentity: boolean;
    accountAge: boolean;
    completedTasks: boolean;
    activeDays: boolean;
    balanceReconciled: boolean;
    authenticityScore?: boolean;
    provenanceCoverage?: boolean;
    noHighFlag: boolean;
    noStrongArtificialFlag?: boolean;
    noSharedDevice: boolean;
  };
  behaviorGatesStatus?: {
    accountAge: boolean;
    completedTasks: boolean;
    activeDays: boolean;
    balanceReconciled: boolean;
    noStrongArtificialFlag: boolean;
    noHighRiskFlag: boolean;
  };
  verificationGatesStatus?: {
    provenanceCoverage: boolean;
    noSharedDevice: boolean;
    emailVerified: boolean | string;
  };
  allBehaviorGatesPass?: boolean;
  allVerificationGatesPass?: boolean;
  allRealGatesPass?: boolean;
  evidenceMode?: "TELEMETRY" | "LEGACY";
  reviewPriority?: "HIGH" | "MEDIUM" | "LOW" | "NONE" | "RESOLVED" | "OVERRIDDEN";
  tags?: string[];
  isHumanVerified?: boolean;
  approvedWithdrawalsCount?: number;
  hasOnChainDepositAnchor?: boolean;
  dataCoverage?: number;
  geoRestricted?: boolean;
  isTestAccount?: boolean;
  manualReviewStatus?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  scoreVersion?: string;
  lastAnalyzedAt: string;
}

export interface TelemetryEventDoc {
  event_id: string;
  event_type: string;
  server_timestamp_utc: string;
  client_timestamp_utc?: string;
  page?: string;
  route?: string;
  device_record_id?: string;
  ip_reference?: string;
  metadata?: Record<string, unknown>;
}

export interface DeviceRecordDoc {
  device_record_id: string;
  platform?: string;
  screen?: string;
  language?: string;
  timezone?: string;
  accounts_per_device: number;
  users_seen?: string[];
  last_seen_at?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CLASSIFICATION_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; icon: string; label: string }
> = {
  REAL: {
    bg: "bg-emerald-500/10 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-300 dark:border-emerald-800",
    icon: "✓",
    label: "Real",
  },
  LIKELY_REAL: {
    bg: "bg-green-500/10 dark:bg-green-950/40",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-300 dark:border-green-800",
    icon: "≈",
    label: "Likely Real",
  },
  SUSPICIOUS: {
    bg: "bg-amber-500/10 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-300 dark:border-amber-800",
    icon: "!",
    label: "Suspicious",
  },
  LIKELY_FAKE: {
    bg: "bg-orange-500/10 dark:bg-orange-950/40",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-300 dark:border-orange-800",
    icon: "⚠",
    label: "Likely Fake",
  },
  FAKE: {
    bg: "bg-red-500/10 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-300 dark:border-red-800",
    icon: "✗",
    label: "Fake",
  },
  DUPLICATE: {
    bg: "bg-purple-500/10 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-300 dark:border-purple-800",
    icon: "⊕",
    label: "Duplicate",
  },
  MANUAL_REVIEW: {
    bg: "bg-blue-500/10 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-300 dark:border-blue-800",
    icon: "?",
    label: "Review",
  },
};

const REASON_CODE_LABELS: Record<string, string> = {
  // Progress Authenticity Rules v3.4 (A01 - A17)
  A01: "Sub-Human Completion Duration (<15s)",
  A02: "Machine-Regular Intervals (CV < 0.15)",
  A03: "Burst / Concentrated Activity",
  A04: "No Circadian Rest Pattern",
  A05: "Zero-Variance Daily Output",
  A06: "Repeated Second/Minute Offset",
  A07: "Impossible Output vs Age",
  A08: "Impossible Tier Progression",
  A09: "Implausible Earning Ratio",
  A10: "Direct-API Task Completion",
  A11: "Session Duration Deficit",
  A12: "Counter vs Ledger Mismatch",
  A13: "Replayed / Duplicate Task IDs",
  A14: "Unbacked Balance / Admin Credit",
  A15: "Low Provenance Coverage (<80%)",
  A16: "Volatile IP/Device Switching",
  A17: "Cohort Progress Synchronization",
  // New Enterprise Risk Rules v3.4
  R01: "24h Activity Burst",
  R02: "Large Transaction Burst",
  R03: "Pass-Through Turnaround",
  R04: "Unexplained Balance",
  R05: "High Balance Zero Tasks",
  R06: "Deposit-Only Account",
  R07: "Sub-Human Task Velocity",
  R08: "Shared Device Cluster",
  R09: "Geo-Restricted Region (PK - Policy)",
  R10: "Unverified Identity Footprint",
  R11: "Fresh Account High Velocity",
  R12: "Referral Farm Cluster",
  R13: "Structuring & Uniform Amounts",
  R14: "Support Abuse / Dispute",
  R15: "Shared Network Collision",
  R16: "Shared Wallet Collision",
  // Legacy Suspicion Codes
  S01: "Activity Burst",
  S02: "Repetitive Behavior",
  S03: "Low Timing Variability",
  S04: "Account Creation Burst",
  S05: "Shared Device Cluster",
  S06: "Shared Network Cluster",
  S07: "Synthetic Profile",
  S08: "Referral Loop",
  S09: "Rapid Transaction Velocity",
  S10: "Coordinated Anomaly",
  S11: "Geo-Restricted Region (PK)",
  S12: "Test Account Pattern",
  S13: "Instant Deposit-Withdraw Cycle",
  S14: "Zero Engagement",
  S15: "Micro-Transaction Flooding",
  S16: "High-Value Velocity Anomaly",
  S17: "Balance Incoherence",
  S18: "Zero Task Disqualification",
  D01: "Exact ID Match",
  D02: "Duplicate Email",
  D03: "Shared Phone",
  D04: "Strong Entity Match",
  D05: "Shared Wallet",
  D06: "Device Overlap",
  D07: "Referral Farm Cluster",
};

// ── Mini Helpers ───────────────────────────────────────────────────────────────
function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-slate-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
      <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function ClassificationPill({ cls }: { cls: string }) {
  const conf = CLASSIFICATION_CONFIG[cls] || CLASSIFICATION_CONFIG.MANUAL_REVIEW;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border ${conf.bg} ${conf.text} ${conf.border}`}
    >
      <span className="opacity-80">{conf.icon}</span>
      {conf.label}
    </span>
  );
}

function ReasonBadge({ code }: { code: string }) {
  const isDuplicate = code.startsWith("D") || code === "R16";
  const isHighRisk = ["R03", "R04", "R08", "R16"].includes(code);
  const isStrongArtificial = ["A01", "A02", "A07", "A08", "A10", "A12", "A13", "A14", "A17"].includes(code);
  const isSoftArtificial = code.startsWith("A") && !isStrongArtificial;
  const isGeo = code === "S11" || code === "R09";
  const isTest = code === "S12";
  return (
    <span
      title={REASON_CODE_LABELS[code] || code}
      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
        isStrongArtificial
          ? "bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border-violet-400 dark:border-violet-700 font-black ring-1 ring-violet-500/30"
          : isSoftArtificial
          ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
          : isHighRisk
          ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-black ring-1 ring-rose-400/30"
          : isDuplicate
          ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900"
          : isGeo
          ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-900"
          : isTest
          ? "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900"
          : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900"
      }`}
    >
      {code}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SuperAdminUserIntelligence() {
  const [profiles, setProfiles] = useState<UserIntelligenceProfile[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [classificationFilter, setClassificationFilter] = useState("ALL");
  const [flagFilter, setFlagFilter] = useState("");
  const [sortBy, setSortBy] = useState("riskScore");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // Inspector modal
  const [inspectUser, setInspectUser] = useState<UserIntelligenceProfile | null>(null);
  const [inspectEvents, setInspectEvents] = useState<TelemetryEventDoc[]>([]);
  const [inspectDevices, setInspectDevices] = useState<DeviceRecordDoc[]>([]);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"evidence" | "timeline" | "devices">("evidence");
  const [recomputingUser, setRecomputingUser] = useState(false);

  // Override
  const [overrideClass, setOverrideClass] = useState<string>("");
  const [overrideNotes, setOverrideNotes] = useState<string>("");
  const [savingOverride, setSavingOverride] = useState(false);

  // Backfill
  const [backfilling, setBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<string>("");

  // Gold Set Human Labeling
  const [goldSetVerdict, setGoldSetVerdict] = useState<"organic" | "artificial" | "fake" | "">("");
  const [goldSetNotes, setGoldSetNotes] = useState<string>("");
  const [savingGoldSetLabel, setSavingGoldSetLabel] = useState(false);
  const [currentGoldSetLabel, setCurrentGoldSetLabel] = useState<{
    verdict: string;
    notes?: string;
    reviewerName?: string;
    labeledAt?: string;
  } | null>(null);

  // Gold Set Validation Modal
  const [showGoldSetModal, setShowGoldSetModal] = useState(false);
  const [goldSetMetrics, setGoldSetMetrics] = useState<any | null>(null);
  const [loadingGoldSetMetrics, setLoadingGoldSetMetrics] = useState(false);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(null), 4000);
  }

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Load Data ───────────────────────────────────────────────────────────────
  const fetchProfiles = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        classification: classificationFilter,
        sortBy,
        sortDir,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (flagFilter) params.set("flag", flagFilter);

      const res = await api.get<{
        success: boolean;
        data: UserIntelligenceProfile[];
        kpis: Record<string, number>;
        pagination?: {
          page: number;
          pageSize: number;
          totalItems: number;
          totalPages: number;
          hasMore: boolean;
        };
        total?: number;
      }>(`/api/super-admin/user-intelligence?${params.toString()}`, { requiresAdmin: true });

      if (res?.data) {
        setProfiles(res.data);
        if (res.kpis) setKpis(res.kpis);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
          setTotalItems(res.pagination.totalItems || res.data.length);
        } else {
          const totalCount = res.total ?? res.data.length;
          setTotalItems(totalCount);
          setTotalPages(Math.ceil(totalCount / pageSize) || 1);
        }
      }
    } catch (err: unknown) {
      console.error("Failed to load user intelligence profiles:", err);
      if (!silent) showToast("Error loading intelligence profiles.", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, classificationFilter, flagFilter, sortBy, sortDir]);

  // Trigger fetch when any query dependencies change
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Real-time listener for profile/event changes
  useEffect(() => {
    const handleDataChange = (e: Event) => {
      const detail = (e as CustomEvent<{ collection?: string }>).detail;
      if (
        !detail?.collection ||
        detail.collection === "userIntelligenceProfiles" ||
        detail.collection === "telemetryEvents"
      ) {
        fetchProfiles(true);
      }
    };
    window.addEventListener("ds:data-changed", handleDataChange);
    return () => window.removeEventListener("ds:data-changed", handleDataChange);
  }, [fetchProfiles]);

  // ── Manual Backfill (Full Re-Score) ─────────────────────────────────────────
  async function handleTriggerBackfill() {
    setBackfilling(true);
    setBackfillStatus("Running full intelligence re-scoring across all accounts with Risk Engine v3.3…");
    try {
      const res = await api.post<{ success: boolean; count: number; message: string }>(
        "/api/super-admin/user-intelligence/backfill",
        {},
        { requiresAdmin: true }
      );
      showToast(res?.message || `Intelligence refresh complete. ${res?.count || 0} accounts re-scored.`);
      setBackfillStatus("");
      await fetchProfiles(true);
    } catch (err) {
      console.error("Backfill failed:", err);
      showToast("Analysis refresh failed.", "error");
    } finally {
      setBackfilling(false);
      setTimeout(() => setBackfillStatus(""), 2000);
    }
  }

  // ── Single-User Recompute ───────────────────────────────────────────────────
  async function handleRecomputeSingleUser() {
    if (!inspectUser) return;
    setRecomputingUser(true);
    try {
      const res = await api.post<{ success: boolean; profile: UserIntelligenceProfile }>(
        `/api/super-admin/user-intelligence/recompute/${encodeURIComponent(inspectUser.userId)}`,
        {},
        { requiresAdmin: true }
      );
      if (res?.success && res.profile) {
        setInspectUser(res.profile);
        showToast(`User ${res.profile.username || res.profile.userId} recomputed with latest database records.`);
        await fetchProfiles(true);
      }
    } catch (err) {
      console.error("Recompute user failed:", err);
      showToast("Failed to recompute user profile.", "error");
    } finally {
      setRecomputingUser(false);
    }
  }

  // ── Inspector ───────────────────────────────────────────────────────────────
  async function openInspector(profile: UserIntelligenceProfile) {
    setInspectUser(profile);
    setOverrideClass(profile.classification);
    setOverrideNotes(profile.reviewNotes || "");
    setActiveTab("evidence");
    setInspectLoading(true);
    try {
      const res = await api.get<{
        success: boolean;
        profile: UserIntelligenceProfile;
        events: TelemetryEventDoc[];
        devices: DeviceRecordDoc[];
      }>(`/api/super-admin/user-intelligence/profile/${encodeURIComponent(profile.userId)}`, { requiresAdmin: true });
      if (res?.success) {
        if (res.profile) setInspectUser(res.profile);
        setInspectEvents(res.events || []);
        setInspectDevices(res.devices || []);
      }

      // Fetch user's ground truth label if present
      try {
        const lblsRes = await api.get<{ success: boolean; data: any[] }>("/api/super-admin/user-intelligence/labels", { requiresAdmin: true });
        if (lblsRes?.success && Array.isArray(lblsRes.data)) {
          const found = lblsRes.data.find((l: any) => l.userId === profile.userId);
          if (found) {
            setCurrentGoldSetLabel(found);
            setGoldSetVerdict(found.verdict || "");
            setGoldSetNotes(found.notes || "");
          } else {
            setCurrentGoldSetLabel(null);
            setGoldSetVerdict("");
            setGoldSetNotes("");
          }
        }
      } catch {
        setCurrentGoldSetLabel(null);
      }
    } catch (err) {
      console.error("Failed to load profile details:", err);
    } finally {
      setInspectLoading(false);
    }
  }

  // ── Gold Set Ground Truth Labeling ──────────────────────────────────────────
  async function handleSaveGoldSetLabel() {
    if (!inspectUser || !goldSetVerdict) return;
    setSavingGoldSetLabel(true);
    try {
      const res = await api.post<{ success: boolean; data: any; message: string }>(
        `/api/super-admin/user-intelligence/label/${encodeURIComponent(inspectUser.userId)}`,
        { verdict: goldSetVerdict, notes: goldSetNotes },
        { requiresAdmin: true }
      );
      if (res?.success && res.data) {
        setCurrentGoldSetLabel(res.data);
        showToast(res.message || `Saved ground truth label "${res.data.verdict}".`);
      }
    } catch (err: unknown) {
      console.error("Save gold set label failed:", err);
      showToast("Failed to save ground truth label.", "error");
    } finally {
      setSavingGoldSetLabel(false);
    }
  }

  // ── Gold Set Metrics & Validation Modal ─────────────────────────────────────
  async function handleOpenGoldSetModal() {
    setShowGoldSetModal(true);
    setLoadingGoldSetMetrics(true);
    try {
      const res = await api.get<{ success: boolean; data: any }>(
        "/api/super-admin/user-intelligence/gold-set",
        { requiresAdmin: true }
      );
      if (res?.success && res.data) {
        setGoldSetMetrics(res.data);
      }
    } catch (err) {
      console.error("Failed to load gold set metrics:", err);
      showToast("Failed to load gold set validation metrics.", "error");
    } finally {
      setLoadingGoldSetMetrics(false);
    }
  }

  // ── Classification Override ─────────────────────────────────────────────────
  async function handleSaveOverride() {
    if (!inspectUser) return;
    setSavingOverride(true);
    try {
      const res = await api.post<{ success: boolean; profile: UserIntelligenceProfile }>(
        `/api/super-admin/user-intelligence/classify/${encodeURIComponent(inspectUser.userId)}`,
        { classification: overrideClass, reasonNotes: overrideNotes },
        { requiresAdmin: true }
      );
      if (res?.success) {
        showToast(`Classification updated to ${overrideClass}.`);
        if (res.profile) setInspectUser(res.profile);
        await fetchProfiles(true);
      }
    } catch (err) {
      console.error("Failed to override classification:", err);
      showToast("Failed to save classification override.", "error");
    } finally {
      setSavingOverride(false);
    }
  }

  // ── Accurate Global Category Counts ─────────────────────────────────────────
  const categoryCounts: Record<string, number> = useMemo(() => ({
    ALL: kpis.total ?? totalItems,
    REAL: kpis.real ?? 0,
    LIKELY_REAL: kpis.likelyReal ?? 0,
    SUSPICIOUS: kpis.suspicious ?? 0,
    LIKELY_FAKE: kpis.likelyFake ?? 0,
    FAKE: kpis.fake ?? 0,
    DUPLICATE: kpis.duplicate ?? 0,
    MANUAL_REVIEW: kpis.manualReview ?? 0,
  }), [kpis, totalItems]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SuperAdminLayout title="User Intelligence & Account Integrity">
      <div className="space-y-5">

        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300 ${
              toastType === "error"
                ? "bg-red-900 border border-red-700 text-red-200"
                : "bg-emerald-900 border border-emerald-700 text-emerald-200"
            }`}
          >
            {toastType === "error" ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            )}
            <span>{toast}</span>
          </div>
        )}

        {/* Status Banner */}
        {backfillStatus && (
          <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 rounded-2xl px-5 py-3 text-sm text-purple-700 dark:text-purple-300 font-semibold">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600 shrink-0" />
            <span>{backfillStatus}</span>
          </div>
        )}

        {/* ── Top Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-600/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  User Intelligence & Account Integrity
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                  Risk Engine v3.4
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-medium mt-0.5">
                Progress Authenticity (A01-A17) · Anti-Cheat · Real Gates · Balance Ledger · Gold Set Validation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleOpenGoldSetModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
              title="View ground truth Gold Set metrics, confusion matrix & model precision"
            >
              <Award className="w-4 h-4" />
              <span>Gold Set Validation</span>
            </button>

            <button
              onClick={handleTriggerBackfill}
              disabled={backfilling}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${backfilling ? "animate-spin" : ""}`} />
              <span>{backfilling ? "Analyzing..." : "Refresh Intelligence"}</span>
            </button>

            <a
              href="/api/super-admin/user-intelligence/export?format=csv"
              download
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
              title="Multi-category CSV: REAL, LIKELY_REAL, SUSPICIOUS, FAKE etc. in labeled sections"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </a>

            <a
              href="/api/super-admin/user-intelligence/export?format=json"
              download
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <FileCode className="w-4 h-4" />
              <span>Export JSON</span>
            </a>
          </div>
        </div>

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { key: "ALL", label: "Total", sub: "All Accounts", color: "text-slate-900 dark:text-white", border: "border-slate-200 dark:border-gray-800" },
            { key: "REAL", label: "Real", sub: "Verified Genuine", color: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20" },
            { key: "LIKELY_REAL", label: "Likely Real", sub: "Low Suspicion", color: "text-green-600 dark:text-green-400", border: "border-green-500/20" },
            { key: "SUSPICIOUS", label: "Suspicious", sub: "Signals Present", color: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
            { key: "LIKELY_FAKE", label: "Likely Fake", sub: "Multi-Signal", color: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20" },
            { key: "FAKE", label: "Fake", sub: "Confirmed Fraud", color: "text-red-600 dark:text-red-400", border: "border-red-500/20" },
            { key: "DUPLICATE", label: "Duplicate", sub: "Entity Collision", color: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20" },
            { key: "MANUAL_REVIEW", label: "Review", sub: "Pending Audit", color: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
          ].map(kpi => (
            <button
              key={kpi.key}
              onClick={() => {
                setClassificationFilter(kpi.key);
                setPage(1);
              }}
              className={`p-4 rounded-2xl bg-white dark:bg-gray-900 border text-left transition-all cursor-pointer ${kpi.border} ${
                classificationFilter === kpi.key ? "ring-2 ring-purple-500 ring-offset-1" : "hover:shadow-md"
              }`}
            >
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{kpi.label}</span>
              <p className={`text-2xl font-black mt-1 ${kpi.color}`}>
                {categoryCounts[kpi.key] ?? 0}
              </p>
              <span className="text-[10px] text-slate-400 font-medium">{kpi.sub}</span>
            </button>
          ))}
        </div>

        {/* ── Filter, Search & Sorting Bar ──────────────────────────────────── */}
        <div className="flex flex-col gap-3 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search */}
            <div className="relative w-full md:w-80 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search user, email, country, wallet…"
                className="w-full bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white rounded-xl pl-9 pr-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Filter by Specific Risk Flag */}
            <div className="flex items-center gap-1.5 w-full md:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
              <select
                value={flagFilter}
                onChange={e => {
                  setFlagFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full md:w-56 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Risk Flags</option>
                <option value="R03">R03: Pass-Through Turnaround</option>
                <option value="R04">R04: Unexplained Balance (&gt;$30)</option>
                <option value="R05">R05: High Balance Zero Tasks</option>
                <option value="R06">R06: Deposit-Only Account</option>
                <option value="R08">R08: Shared Device Cluster</option>
                <option value="R09">R09: Geo-Restricted (PK)</option>
                <option value="R16">R16: Shared Wallet Collision</option>
                <option value="S05">S05: Legacy Shared Device</option>
                <option value="S14">S14: Legacy Zero Engagement</option>
              </select>
            </div>

            {/* Sorting */}
            <div className="flex items-center gap-1.5 w-full md:w-auto ml-auto">
              <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="riskScore">Sort: Highest Risk</option>
                <option value="genuineScore">Sort: Highest Genuine</option>
                <option value="accountBalance">Sort: Highest Balance</option>
                <option value="depositsCount">Sort: Most Deposits</option>
                <option value="accountAgeDays">Sort: Account Age</option>
                <option value="createdAt">Sort: Registration Date</option>
              </select>
              <button
                onClick={() => setSortDir(d => (d === "desc" ? "asc" : "desc"))}
                className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-gray-700 text-xs font-bold bg-slate-50 dark:bg-gray-800 text-slate-700 dark:text-gray-300 hover:bg-slate-100 cursor-pointer"
                title={`Sort ${sortDir === "desc" ? "Descending" : "Ascending"}`}
              >
                {sortDir === "desc" ? "↓" : "↑"}
              </button>
            </div>
          </div>

          {/* Classification Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full scrollbar-none pt-1 border-t border-slate-100 dark:border-gray-800">
            {["ALL", "REAL", "LIKELY_REAL", "SUSPICIOUS", "LIKELY_FAKE", "FAKE", "DUPLICATE", "MANUAL_REVIEW"].map(cls => (
              <button
                key={cls}
                onClick={() => {
                  setClassificationFilter(cls);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  classificationFilter === cls
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {cls.replace(/_/g, " ")}
                <span className="opacity-80 font-mono text-[10px]">
                  ({categoryCounts[cls] ?? 0})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Master Intelligence Table ────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-28 gap-4 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <div className="text-center">
                <p className="font-bold text-sm text-slate-600 dark:text-gray-300">Computing Intelligence Analytics</p>
                <p className="text-xs mt-1">Analyzing transactions, Real Gates, reconciliation variance, device clusters…</p>
              </div>
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm">No matching intelligence profiles found.</p>
              <p className="text-xs mt-1">Try resetting filters or click "Refresh Intelligence" to run full scoring.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[1200px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/40 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                    <th className="px-5 py-4">User & Identity</th>
                    <th className="px-5 py-4">Classification</th>
                    <th className="px-5 py-4">Evidence Scores</th>
                    <th className="px-5 py-4">Risk Flags</th>
                    <th className="px-5 py-4">Financials & Variance</th>
                    <th className="px-5 py-4">Tasks</th>
                    <th className="px-5 py-4">Devices / Network</th>
                    <th className="px-5 py-4">Location</th>
                    <th className="px-5 py-4">Age</th>
                    <th className="px-5 py-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800/60 font-medium">
                  {profiles.map(p => {
                    const variance = p.balanceReconciliation?.variance ?? Math.abs((p.accountBalance || 0) - ((p.totalDepositAmount || 0) + (p.earnings || 0) - (p.totalWithdrawalAmount || 0)));
                    const isVarianceAlert = variance > 30;

                    return (
                      <tr key={p.userId} className="hover:bg-slate-50/60 dark:hover:bg-gray-800/30 transition-colors">

                        {/* User Identity */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-white text-sm">
                                {p.name || p.username}
                              </span>
                              {p.isTestAccount && (
                                <span title="Test Account Detected" className="px-1 py-0.5 rounded text-[9px] font-black bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-900">
                                  TEST
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono truncate max-w-[180px]">{p.email}</span>
                            {p.walletAddress && (
                              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                                {p.walletAddress.slice(0, 6)}…{p.walletAddress.slice(-4)}
                              </span>
                            )}
                            <div className="flex items-center gap-1 mt-0.5">
                              {p.emailVerified ? (
                                <span title="Email Verified" className="px-1 py-0.5 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">✓ Email</span>
                              ) : (
                                <span title="Email Not Verified" className="px-1 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-gray-800 text-slate-500">✗ Email</span>
                              )}
                              {p.kycStatus === "verified" || p.kycStatus === "approved" ? (
                                <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">KYC✓</span>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        {/* Classification */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <ClassificationPill cls={p.classification} />
                              {p.evidenceMode && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  p.evidenceMode === "TELEMETRY"
                                    ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                    : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400"
                                }`}>
                                  {p.evidenceMode}
                                </span>
                              )}
                              {p.classification === "MANUAL_REVIEW" && p.reviewPriority && p.reviewPriority !== "NONE" && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                                  p.reviewPriority === "HIGH"
                                    ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse"
                                    : p.reviewPriority === "MEDIUM"
                                    ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                    : "bg-slate-100 dark:bg-gray-800 text-slate-500"
                                }`}>
                                  {p.reviewPriority}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {Math.round((p.confidence || 0) * 100)}% confidence
                            </div>
                            {p.tags && p.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {p.tags.map(t => (
                                  <span key={t} className="text-[8px] font-bold px-1 py-0.2 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-300 rounded border border-purple-200/50 dark:border-purple-800/50">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Evidence Scores */}
                        <td className="px-5 py-3.5">
                          <div className="space-y-1.5 w-36">
                            <div>
                              <div className="flex items-center justify-between text-[10px] mb-0.5">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                  <TrendingUp className="w-3 h-3" /> Genuine
                                </span>
                                <span className="font-extrabold text-slate-700 dark:text-gray-300">{p.genuineScore}</span>
                              </div>
                              <ScoreBar value={p.genuineScore} color="bg-emerald-500" />
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-[10px] mb-0.5">
                                <span className="text-red-500 font-bold flex items-center gap-0.5">
                                  <TrendingDown className="w-3 h-3" /> Risk
                                </span>
                                <span className="font-extrabold text-slate-700 dark:text-gray-300">{p.riskScore ?? p.suspicionScore}</span>
                              </div>
                              <ScoreBar value={p.riskScore ?? p.suspicionScore} color="bg-red-500" />
                            </div>
                            {p.duplicateScore > 0 && (
                              <div>
                                <div className="flex items-center justify-between text-[10px] mb-0.5">
                                  <span className="text-purple-500 font-bold flex items-center gap-0.5">
                                    <Layers className="w-3 h-3" /> Duplicate
                                  </span>
                                  <span className="font-extrabold text-slate-700 dark:text-gray-300">{p.duplicateScore}</span>
                                </div>
                                <ScoreBar value={p.duplicateScore} color="bg-purple-500" />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Risk Flags */}
                        <td className="px-5 py-3.5">
                          {p.reasonCodes && p.reasonCodes.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[190px]">
                              {p.reasonCodes.map(rc => (
                                <ReasonBadge key={rc} code={rc} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">✓ Clean</span>
                          )}
                        </td>

                        {/* Financials & Balance Variance */}
                        <td className="px-5 py-3.5">
                          <div className="space-y-0.5 text-[11px]">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                              <span>Bal: ${(p.accountBalance || 0).toFixed(2)}</span>
                            </div>
                            <div className="text-slate-400">
                              {p.depositsCount || 0}↓ (${(p.totalDepositAmount || 0).toFixed(0)}) · {p.withdrawalsCount || 0}↑
                            </div>
                            {isVarianceAlert ? (
                              <div className="text-[10px] text-red-600 dark:text-red-400 font-bold flex items-center gap-0.5">
                                <AlertCircle className="w-3 h-3" /> Δ ${variance.toFixed(0)} variance
                              </div>
                            ) : (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                ✓ Reconciled
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Tasks & Engagement */}
                        <td className="px-5 py-3.5 text-[11px]">
                          <div className={`font-bold ${p.completedTasksCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                            {p.completedTasksCount || 0} tasks
                          </div>
                          {p.completedTasksCount === 0 && (
                            <div className="text-[10px] text-red-500 font-bold">0 tasks completed</div>
                          )}
                          {p.hasSupportActivity && (
                            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5 mt-0.5">
                              <span>💬 Support active</span>
                            </div>
                          )}
                        </td>

                        {/* Devices & Network */}
                        <td className="px-5 py-3.5">
                          <div className="space-y-0.5 text-[11px] text-slate-600 dark:text-gray-300">
                            <div className="flex items-center gap-1.5">
                              <Smartphone className={`w-3.5 h-3.5 ${(p.devicesCount || 0) > 1 ? "text-amber-500" : "text-slate-400"}`} />
                              <span>{p.devicesCount || 1} device{p.devicesCount !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Globe className={`w-3.5 h-3.5 ${(p.ipsCount || 0) > 3 ? "text-amber-500" : "text-slate-400"}`} />
                              <span>{p.ipsCount || 1} IP{p.ipsCount !== 1 ? "s" : ""}</span>
                            </div>
                            {p.relatedAccounts && p.relatedAccounts.length > 0 && (
                              <div className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                                <Layers className="w-3 h-3" />
                                {p.relatedAccounts.length} linked
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <MapPin className={`w-3.5 h-3.5 shrink-0 ${p.geoRestricted ? "text-red-500" : "text-slate-400"}`} />
                            <div>
                              <span className={`font-bold ${p.geoRestricted ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-gray-300"}`}>
                                {p.country || "Global"}
                              </span>
                              {p.geoRestricted && (
                                <div className="text-[10px] text-red-500 font-black">GEO-RESTRICTED</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Age */}
                        <td className="px-5 py-3.5 text-[11px]">
                          <div className="flex items-center gap-1 text-slate-500">
                            <Calendar className="w-3 h-3" />
                            <span>{p.accountAgeDays}d</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => openInspector(p)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Server-Side Pagination Bar ──────────────────────────────────── */}
          {!loading && totalItems > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 bg-slate-50/50 dark:bg-gray-800/40 border-t border-slate-200 dark:border-gray-800 text-xs">
              <div className="text-slate-500 font-medium">
                Showing <span className="font-bold text-slate-900 dark:text-white">{Math.min(totalItems, (page - 1) * pageSize + 1)}</span> to{" "}
                <span className="font-bold text-slate-900 dark:text-white">{Math.min(totalItems, page * pageSize)}</span> of{" "}
                <span className="font-bold text-slate-900 dark:text-white">{totalItems}</span> accounts
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-400 font-medium text-[11px]">Rows per page:</label>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-gray-200"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-gray-700 font-bold bg-white dark:bg-gray-900 disabled:opacity-40 cursor-pointer"
                    title="First page"
                  >
                    &laquo;
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-gray-700 font-bold bg-white dark:bg-gray-900 disabled:opacity-40 cursor-pointer"
                  >
                    Prev
                  </button>
                  <span className="px-3 py-1 font-mono font-bold text-purple-600 dark:text-purple-400">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-gray-700 font-bold bg-white dark:bg-gray-900 disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-gray-700 font-bold bg-white dark:bg-gray-900 disabled:opacity-40 cursor-pointer"
                    title="Last page"
                  >
                    &raquo;
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Deep-Dive Inspector Modal ────────────────────────────────────── */}
        {inspectUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div
              className="w-full max-w-4xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-purple-600/10 text-purple-600 dark:text-purple-400 border border-purple-600/20">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                      {inspectUser.name || inspectUser.username}
                      {inspectUser.geoRestricted && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" /> GEO-RESTRICTED
                        </span>
                      )}
                      {inspectUser.isTestAccount && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-900 flex items-center gap-0.5">
                          <FlaskConical className="w-3 h-3" /> TEST
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {inspectUser.userId} · {inspectUser.email} · {inspectUser.country || "Global"} · Created {new Date(inspectUser.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRecomputeSingleUser}
                    disabled={recomputingUser}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 transition-colors cursor-pointer"
                    title="Recompute user profile with live data from database"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${recomputingUser ? "animate-spin" : ""}`} />
                    <span>{recomputingUser ? "Recomputing…" : "Recompute User"}</span>
                  </button>

                  <button
                    onClick={() => setInspectUser(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Score Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-slate-100 dark:divide-gray-800 border-b border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="px-4 py-3 text-center">
                  <ClassificationPill cls={inspectUser.classification} />
                  <div className="text-[10px] text-slate-400 mt-1">{Math.round((inspectUser.confidence || 0) * 100)}% dynamic conf.</div>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className={`text-xl font-black ${
                    (inspectUser.authenticity?.score ?? 100) >= 75 ? "text-emerald-600 dark:text-emerald-400" :
                    (inspectUser.authenticity?.score ?? 100) >= 50 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
                  }`}>
                    {inspectUser.authenticity?.score ?? 100}
                  </p>
                  <p className="text-[10px] text-slate-400">Authenticity Score</p>
                  <div className="mt-1">
                    <ScoreBar
                      value={inspectUser.authenticity?.score ?? 100}
                      color={(inspectUser.authenticity?.score ?? 100) >= 75 ? "bg-emerald-500" : (inspectUser.authenticity?.score ?? 100) >= 50 ? "bg-amber-500" : "bg-rose-500"}
                    />
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                    {Math.round((inspectUser.authenticity?.provenanceCoverage ?? 1.0) * 100)}% telemetry
                  </div>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{inspectUser.genuineScore}</p>
                  <p className="text-[10px] text-slate-400">Genuine Score</p>
                  <div className="mt-1"><ScoreBar value={inspectUser.genuineScore} color="bg-emerald-500" /></div>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-xl font-black text-red-600 dark:text-red-400">{inspectUser.riskScore ?? inspectUser.suspicionScore}</p>
                  <p className="text-[10px] text-slate-400">Risk Score</p>
                  <div className="mt-1"><ScoreBar value={inspectUser.riskScore ?? inspectUser.suspicionScore} color="bg-red-500" /></div>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-xl font-black text-purple-600 dark:text-purple-400">{inspectUser.duplicateScore}</p>
                  <p className="text-[10px] text-slate-400">Duplicate Score</p>
                  <div className="mt-1"><ScoreBar value={inspectUser.duplicateScore} color="bg-purple-500" /></div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 dark:border-gray-800 px-6">
                {(["evidence", "timeline", "devices"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 px-4 text-xs font-bold capitalize border-b-2 transition-colors cursor-pointer -mb-px ${
                      activeTab === tab
                        ? "border-purple-600 text-purple-600 dark:text-purple-400"
                        : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-gray-300"
                    }`}
                  >
                    {tab === "evidence" && "Evidence & Anti-Cheat"}
                    {tab === "timeline" && `Server Timeline (${inspectEvents.length})`}
                    {tab === "devices" && `Devices (${inspectDevices.length})`}
                  </button>
                ))}
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto flex-1 space-y-5">

                {/* TAB: Evidence */}
                {activeTab === "evidence" && (
                  <div className="space-y-5">

                    {/* Geo-Policy Regional Notice */}
                    {(inspectUser.geoPolicy?.isRestricted || inspectUser.geoRestricted) && (
                      <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-extrabold text-sky-950 dark:text-sky-100 uppercase text-[11px] tracking-wide">
                            Geo-Restricted Country Policy Notice (R09 / S11)
                          </p>
                          <p className="text-[11px] text-sky-800 dark:text-sky-300 mt-0.5">
                            Account registration originates from {inspectUser.country || "Pakistan"}. This is tracked as a <strong>Regulatory Policy Flag</strong> and adds <strong>0 fraud risk points</strong> to this user's risk score.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Progress Authenticity & Anti-Cheat Evidence (A01 - A17) */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-indigo-600" /> Progress Authenticity & Anti-Cheat Checks (A01–A17)
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            inspectUser.authenticity?.isArtificial
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300"
                          }`}>
                            {inspectUser.authenticity?.isArtificial ? "⚠ ARTIFICIAL PROGRESS DETECTED" : "✓ 100% ORGANIC PROGRESS"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Provenance: {Math.round((inspectUser.authenticity?.provenanceCoverage ?? 1.0) * 100)}%
                          </span>
                        </div>
                      </div>

                      {inspectUser.authenticity?.triggeredRules && inspectUser.authenticity.triggeredRules.length > 0 ? (
                        <div className="space-y-2">
                          {inspectUser.authenticity.triggeredRules.map((rule, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-xs space-y-1">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                                  <ReasonBadge code={rule.code} />
                                  <span>{rule.label}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  rule.strength === "STRONG"
                                    ? "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300"
                                    : "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                                }`}>
                                  {rule.strength} (-{rule.points} pts)
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-gray-400">{rule.description}</p>
                              <div className="text-[10px] font-mono text-slate-700 dark:text-gray-300 bg-slate-50 dark:bg-gray-800/60 p-1.5 rounded-lg border border-slate-100 dark:border-gray-800">
                                <strong className="text-purple-600 dark:text-purple-400">Evidence:</strong> {rule.evidence}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>All event timestamps and task durations demonstrate natural human variance and verified session linkage.</span>
                        </div>
                      )}
                    </div>

                    {/* Real Gates & Behavior Architecture (v3.5) */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" /> Evidence Gates Architecture (v3.5)
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            inspectUser.evidenceMode === "TELEMETRY"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300"
                              : "bg-slate-200 text-slate-800 dark:bg-gray-700 dark:text-gray-300 border border-slate-300"
                          }`}>
                            MODE: {inspectUser.evidenceMode || "LEGACY"}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          inspectUser.classification === "REAL"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300"
                            : inspectUser.classification === "LIKELY_REAL"
                            ? "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300"
                        }`}>
                          {inspectUser.classification === "REAL"
                            ? "✓ REAL (VERIFIED TELEMETRY / GOLD SET)"
                            : inspectUser.classification === "LIKELY_REAL"
                            ? "✓ LIKELY REAL (BEHAVIOR PASSED, UNVERIFIED PROVENANCE)"
                            : "GATES INCOMPLETE"}
                        </span>
                      </div>

                      {/* Behavior Gates (Separate from telemetry) */}
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">A. Behavior Gates (Tenure & Organic Activity)</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                          <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${(inspectUser.behaviorGatesStatus?.accountAge ?? ((inspectUser.accountAgeDays || 0) >= 14)) ? "bg-emerald-50/70 border-emerald-200 text-emerald-800" : "bg-red-50/70 border-red-200 text-red-700"}`}>
                            {(inspectUser.behaviorGatesStatus?.accountAge ?? ((inspectUser.accountAgeDays || 0) >= 14)) ? "✓" : "✗"} Age &ge; 14 Days ({inspectUser.accountAgeDays || 0}d)
                          </div>
                          <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${(inspectUser.behaviorGatesStatus?.completedTasks ?? ((inspectUser.completedTasksCount || 0) >= 10)) ? "bg-emerald-50/70 border-emerald-200 text-emerald-800" : "bg-red-50/70 border-red-200 text-red-700"}`}>
                            {(inspectUser.behaviorGatesStatus?.completedTasks ?? ((inspectUser.completedTasksCount || 0) >= 10)) ? "✓" : "✗"} Tasks &ge; 10 ({inspectUser.completedTasksCount || 0})
                          </div>
                          <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${(inspectUser.behaviorGatesStatus?.activeDays ?? ((inspectUser.sessionDatesCount || 0) >= 8)) ? "bg-emerald-50/70 border-emerald-200 text-emerald-800" : "bg-red-50/70 border-red-200 text-red-700"}`}>
                            {(inspectUser.behaviorGatesStatus?.activeDays ?? ((inspectUser.sessionDatesCount || 0) >= 8)) ? "✓" : "✗"} Active Days &ge; 8 ({inspectUser.sessionDatesCount || 0}d)
                          </div>
                          <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${(inspectUser.behaviorGatesStatus?.balanceReconciled ?? inspectUser.balanceReconciliation?.reconciled) ? "bg-emerald-50/70 border-emerald-200 text-emerald-800" : "bg-red-50/70 border-red-200 text-red-700"}`}>
                            {(inspectUser.behaviorGatesStatus?.balanceReconciled ?? inspectUser.balanceReconciliation?.reconciled) ? "✓" : "✗"} Ledger Reconciled
                          </div>
                          <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${(inspectUser.behaviorGatesStatus?.noStrongArtificialFlag ?? !inspectUser.authenticity?.hasStrongFlag) ? "bg-emerald-50/70 border-emerald-200 text-emerald-800" : "bg-red-50/70 border-red-200 text-red-700"}`}>
                            {(inspectUser.behaviorGatesStatus?.noStrongArtificialFlag ?? !inspectUser.authenticity?.hasStrongFlag) ? "✓" : "✗"} No Strong A-Flag
                          </div>
                          <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${(inspectUser.behaviorGatesStatus?.noHighRiskFlag ?? true) ? "bg-emerald-50/70 border-emerald-200 text-emerald-800" : "bg-red-50/70 border-red-200 text-red-700"}`}>
                            {(inspectUser.behaviorGatesStatus?.noHighRiskFlag ?? true) ? "✓" : "✗"} Clean Risk Rules
                          </div>
                        </div>
                      </div>

                      {/* Verification Gates & External Anchors */}
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">B. Verification Gates & External Anchors (Platform-Independent)</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${((inspectUser.authenticity?.provenanceCoverage ?? 0) >= 0.50) ? "bg-emerald-50/70 border-emerald-200 text-emerald-800" : "bg-slate-100 border-slate-200 text-slate-600"}`}>
                            {((inspectUser.authenticity?.provenanceCoverage ?? 0) >= 0.50) ? "✓" : "○"} Provenance &ge; 50% ({Math.round((inspectUser.authenticity?.provenanceCoverage ?? 0) * 100)}%)
                          </div>
                          <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${(inspectUser.devicesCount <= 1) ? "bg-emerald-50/70 border-emerald-200 text-emerald-800" : "bg-red-50/70 border-red-200 text-red-700"}`}>
                            {(inspectUser.devicesCount <= 1) ? "✓" : "✗"} Dedicated Hardware
                          </div>
                          <div className="p-2 rounded-xl border bg-slate-100/70 border-slate-200 text-slate-600 flex items-center gap-1.5" title="No signup email verification flow exists in platform; marked unavailable with 0 penalty">
                            ○ Email Verif: UNAVAILABLE (0 pts)
                          </div>
                          <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${(inspectUser.approvedWithdrawalsCount && inspectUser.approvedWithdrawalsCount > 0) ? "bg-emerald-50/70 border-emerald-200 text-emerald-800" : "bg-slate-100 border-slate-200 text-slate-600"}`}>
                            {(inspectUser.approvedWithdrawalsCount && inspectUser.approvedWithdrawalsCount > 0) ? "✓" : "○"} Approved Payouts ({inspectUser.approvedWithdrawalsCount || 0})
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mathematical Balance Reconciliation Card */}
                    {inspectUser.balanceReconciliation && (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Balance Reconciliation Math (Formula: Deposits + Verified Earnings + Bonuses - Withdrawals - Fees)
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            inspectUser.balanceReconciliation.reconciled
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300"
                              : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 animate-pulse"
                          }`}>
                            {inspectUser.balanceReconciliation.reconciled ? "✓ BALANCE RECONCILED (WITHIN TOLERANCE)" : `⚠ UNEXPLAINED VARIANCE: $${inspectUser.balanceReconciliation.variance.toFixed(2)}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800">
                            <p className="text-sm font-black text-slate-900 dark:text-white">${inspectUser.balanceReconciliation.balance.toFixed(2)}</p>
                            <p className="text-[10px] text-slate-400">Actual Account Balance</p>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800">
                            <p className="text-sm font-black text-slate-900 dark:text-white">${inspectUser.balanceReconciliation.expectedBalance.toFixed(2)}</p>
                            <p className="text-[10px] text-slate-400">Formula Expected Balance</p>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800">
                            <p className={`text-sm font-black ${!inspectUser.balanceReconciliation.reconciled ? "text-red-600" : "text-emerald-600"}`}>
                              ${inspectUser.balanceReconciliation.variance.toFixed(2)}
                            </p>
                            <p className="text-[10px] text-slate-400">Variance (Tolerance: ${((inspectUser.balanceReconciliation as any).tolerance || 5.0).toFixed(2)})</p>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800">
                            <p className="text-sm font-black text-slate-900 dark:text-white">${(inspectUser.totalDepositAmount || 0).toFixed(2)} / ${(inspectUser.earnings || 0).toFixed(2)}</p>
                            <p className="text-[10px] text-slate-400">Deposits / Task Earnings</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Active Risk Flags */}
                    {inspectUser.reasonCodes && inspectUser.reasonCodes.length > 0 && (
                      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                        <p className="text-xs font-extrabold uppercase text-amber-800 dark:text-amber-400 mb-2">Active Risk Flags</p>
                        <div className="flex flex-wrap gap-2">
                          {inspectUser.reasonCodes.map(rc => (
                            <div key={rc} className="flex items-center gap-1.5">
                              <ReasonBadge code={rc} />
                              <span className="text-[11px] text-slate-600 dark:text-gray-300">{REASON_CODE_LABELS[rc] || rc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Positive Signals Breakdown */}
                    {inspectUser.positiveSignals && inspectUser.positiveSignals.length > 0 && (
                      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                        <p className="text-xs font-extrabold uppercase text-emerald-800 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" /> Positive Genuine Signals Breakdown
                        </p>
                        <div className="space-y-1.5">
                          {inspectUser.positiveSignals.map((sig, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-200">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <strong>{sig.group}:</strong> {sig.detail}
                              </span>
                              <span className="font-mono font-bold shrink-0">+{sig.points} / {sig.maxPoints} pts</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Negative Risk Rules Breakdown */}
                    {inspectUser.negativeSignals && inspectUser.negativeSignals.length > 0 && (
                      <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40">
                        <p className="text-xs font-extrabold uppercase text-red-800 dark:text-red-400 mb-2 flex items-center gap-1.5">
                          <TrendingDown className="w-3.5 h-3.5" /> Risk Rules Triggered Breakdown
                        </p>
                        <div className="space-y-1.5">
                          {inspectUser.negativeSignals.map((rule, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] text-red-800 dark:text-red-200">
                              <span className="flex items-center gap-1.5">
                                <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                <strong>{rule.code} ({rule.label}):</strong> {rule.description}
                              </span>
                              <span className="font-mono font-bold shrink-0 text-red-600">+{rule.points} risk</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transaction Velocity Detail */}
                    {inspectUser.txVelocityAnalysis && (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700">
                        <p className="text-xs font-extrabold uppercase text-slate-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5 text-purple-600" /> Transaction Velocity Analysis
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                          {[
                            { label: "Velocity Risk", value: `${inspectUser.txVelocityAnalysis.velocityRisk}/100`, highlight: inspectUser.txVelocityAnalysis.velocityRisk > 40 },
                            { label: "Total Txns", value: inspectUser.txVelocityAnalysis.analysisData?.totalTransactions ?? "-" },
                            { label: "First 24h", value: inspectUser.txVelocityAnalysis.analysisData?.transactionsFirst24h ?? 0, highlight: (inspectUser.txVelocityAnalysis.analysisData?.transactionsFirst24h ?? 0) >= 5 },
                            { label: "First Hour", value: inspectUser.txVelocityAnalysis.analysisData?.transactionsFirstHour ?? 0, highlight: (inspectUser.txVelocityAnalysis.analysisData?.transactionsFirstHour ?? 0) >= 2 },
                            { label: "Txns/Day", value: inspectUser.txVelocityAnalysis.analysisData?.txnsPerDay?.toFixed(2) ?? "-", highlight: (inspectUser.txVelocityAnalysis.analysisData?.txnsPerDay ?? 0) > 5 },
                            { label: "Amt CoV", value: inspectUser.txVelocityAnalysis.analysisData?.amountCoeffVariation?.toFixed(3) ?? "N/A", highlight: (inspectUser.txVelocityAnalysis.analysisData?.amountCoeffVariation ?? 1) < 0.05 },
                          ].map(m => (
                            <div key={m.label} className={`p-2.5 rounded-xl text-center ${m.highlight ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40" : "bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800"}`}>
                              <p className={`text-sm font-black ${m.highlight ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-white"}`}>{String(m.value)}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{m.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Classification Override */}
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-extrabold uppercase tracking-wide text-slate-800 dark:text-gray-200">
                          Super Admin Classification Override
                        </span>
                        {inspectUser.adminFinalClassification && (
                          <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                            Overridden by {inspectUser.reviewedBy} on {new Date(inspectUser.reviewedAt || "").toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 mb-1">Final Classification:</label>
                          <select
                            value={overrideClass}
                            onChange={e => setOverrideClass(e.target.value)}
                            className="w-full bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                          >
                            <option value="REAL">REAL — Verified Authentic</option>
                            <option value="LIKELY_REAL">LIKELY_REAL — Probable Genuine</option>
                            <option value="SUSPICIOUS">SUSPICIOUS — Keep Flagged</option>
                            <option value="LIKELY_FAKE">LIKELY_FAKE — Probable Bot/Sybil</option>
                            <option value="FAKE">FAKE — Confirmed Fraudulent</option>
                            <option value="DUPLICATE">DUPLICATE — Multi-Account</option>
                            <option value="MANUAL_REVIEW">MANUAL_REVIEW — Under Investigation</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 mb-1">Audit Justification:</label>
                          <input
                            type="text"
                            value={overrideNotes}
                            onChange={e => setOverrideNotes(e.target.value)}
                            placeholder="State reason for manual override…"
                            className="w-full bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-3">
                        <button
                          onClick={handleSaveOverride}
                          disabled={savingOverride || !overrideNotes.trim()}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {savingOverride ? "Saving…" : "Save Classification & Log Audit"}
                        </button>
                      </div>
                    </div>

                    {/* Gold Set Ground Truth Review (Independent Persistence) */}
                    <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span className="text-xs font-black uppercase tracking-wide text-indigo-900 dark:text-indigo-200">
                            Gold Set Ground Truth Label (Model Validation Baseline)
                          </span>
                        </div>
                        {currentGoldSetLabel && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border border-indigo-300">
                            Labeled "{currentGoldSetLabel.verdict.toUpperCase()}" by {currentGoldSetLabel.reviewerName} on {new Date(currentGoldSetLabel.labeledAt || "").toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-gray-400">
                        Human risk labels are persisted in the independent collection <code className="text-indigo-600 font-mono font-bold">userRiskLabels</code> and never overwrite model output. Used to measure true precision and recall.
                      </p>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-gray-300 mb-1.5">Human Ground Truth Verdict:</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {[
                            { value: "organic", label: "🌿 Organic User", desc: "Real human, organic progress" },
                            { value: "artificial", label: "🤖 Artificial Progress", desc: "Bot / script / inflated progress" },
                            { value: "fake", label: "🚫 Fake / Sybil", desc: "Fraudulent clone / multi-account" },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setGoldSetVerdict(opt.value as any)}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                goldSetVerdict === opt.value
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                  : "bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-700 hover:border-indigo-300"
                              }`}
                            >
                              <div className="text-xs font-black">{opt.label}</div>
                              <div className={`text-[10px] mt-0.5 ${goldSetVerdict === opt.value ? "text-indigo-100" : "text-slate-400"}`}>{opt.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-gray-300 mb-1">Human Rationale / Evidence Notes:</label>
                        <input
                          type="text"
                          value={goldSetNotes}
                          onChange={e => setGoldSetNotes(e.target.value)}
                          placeholder="Evidence for this label (e.g. verified ID, script rhythm, duplicate IP)..."
                          className="w-full bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleSaveGoldSetLabel}
                          disabled={savingGoldSetLabel || !goldSetVerdict}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {savingGoldSetLabel ? "Saving Label…" : "Save Ground Truth Label"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: Timeline */}
                {activeTab === "timeline" && (
                  <div>
                    {inspectLoading ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                        Loading server event timeline…
                      </div>
                    ) : inspectEvents.length === 0 ? (
                      <div className="p-6 rounded-xl bg-slate-50 dark:bg-gray-800/40 text-center text-xs text-slate-400">
                        No client telemetry events captured yet. Events populate as the user interacts with the site.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                        {inspectEvents.map(evt => (
                          <div
                            key={evt.event_id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-800 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                {evt.event_type}
                              </span>
                              <span className="text-slate-600 dark:text-gray-300 text-[11px]">{evt.route || evt.page}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              {new Date(evt.server_timestamp_utc).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: Devices */}
                {activeTab === "devices" && (
                  <div>
                    {inspectDevices.length === 0 ? (
                      <div className="p-6 rounded-xl bg-slate-50 dark:bg-gray-800/40 text-center text-xs text-slate-400">
                        No persistent device fingerprints linked yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {inspectDevices.map(dev => (
                          <div
                            key={dev.device_record_id}
                            className={`p-3.5 rounded-xl border space-y-1 text-xs ${
                              dev.accounts_per_device >= 3
                                ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40"
                                : dev.accounts_per_device >= 2
                                ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                                : "bg-slate-50 dark:bg-gray-800/40 border-slate-100 dark:border-gray-800"
                            }`}
                          >
                            <span className="font-mono font-bold text-slate-900 dark:text-white block truncate text-[11px]">
                              {dev.device_record_id}
                            </span>
                            <p className="text-[11px] text-slate-500">
                              {[dev.platform, dev.screen, dev.timezone].filter(Boolean).join(" · ")}
                            </p>
                            <div className="pt-1 flex items-center justify-between text-[10px] font-bold">
                              <span className={dev.accounts_per_device >= 2 ? "text-red-600 dark:text-red-400" : "text-purple-600"}>
                                {dev.accounts_per_device} account{dev.accounts_per_device !== 1 ? "s" : ""} on device
                              </span>
                              <span className="text-slate-400">
                                {dev.last_seen_at ? new Date(dev.last_seen_at).toLocaleDateString() : "-"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/40">
                <div className="text-[11px] text-slate-400 font-mono">
                  Engine: {inspectUser.scoreVersion || "2026.10-v3.4"} · Last analyzed: {inspectUser.lastAnalyzedAt ? new Date(inspectUser.lastAnalyzedAt).toLocaleString() : "—"}
                </div>
                <button
                  onClick={() => setInspectUser(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-200 hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Gold Set Ground Truth Validation Modal ───────────────────────── */}
        {showGoldSetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div
              className="w-full max-w-4xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-600/20">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      Gold Set Ground Truth & Model Accuracy Validation
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-300">
                        Target: REAL Precision &ge; 95%
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Measured statistical accuracy, confusion matrix, and Wilson 95% confidence intervals from independent human review
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowGoldSetModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                {loadingGoldSetMetrics ? (
                  <div className="py-16 text-center text-xs text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Calculating confusion matrix, Wilson confidence bounds, and stratified metrics…
                  </div>
                ) : !goldSetMetrics ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No gold set metrics available.
                  </div>
                ) : (
                  <>
                    {/* Top KPI Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 text-center">
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Total Labels</span>
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{goldSetMetrics.totalEvaluated || 0}</p>
                        <span className="text-[10px] text-slate-400 font-medium">Human ground truth</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-center">
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">REAL Precision</span>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                          {goldSetMetrics.realPrecision ? `${(goldSetMetrics.realPrecision.precision * 100).toFixed(1)}%` : "N/A"}
                        </p>
                        <span className="text-[10px] text-slate-500 font-mono">
                          95% CI: [{((goldSetMetrics.realPrecision?.ci95?.lower ?? 0) * 100).toFixed(1)}%, {((goldSetMetrics.realPrecision?.ci95?.upper ?? 0) * 100).toFixed(1)}%]
                        </span>
                      </div>
                      <div className="p-4 rounded-2xl bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 text-center">
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-green-600 dark:text-green-400">REAL Recall</span>
                        <p className="text-2xl font-black text-green-600 dark:text-green-400 mt-1">
                          {goldSetMetrics.realRecall ? `${(goldSetMetrics.realRecall * 100).toFixed(1)}%` : "N/A"}
                        </p>
                        <span className="text-[10px] text-slate-400 font-medium">Organic identified</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-center">
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-amber-600 dark:text-amber-400">Artificial Detection</span>
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                          {goldSetMetrics.artificialPrecision ? `${(goldSetMetrics.artificialPrecision.precision * 100).toFixed(1)}%` : "N/A"}
                        </p>
                        <span className="text-[10px] text-slate-400 font-medium">Bot precision</span>
                      </div>
                    </div>

                    {/* Statistical Sample Size Advisory Note */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-gray-800/40 border border-slate-200 dark:border-gray-700 text-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-800 dark:text-gray-200">Sampling & Statistical Validity Note:</strong>
                        <p className="text-[11px] text-slate-600 dark:text-gray-400 mt-0.5">
                          {goldSetMetrics.sampleSizeNote}
                        </p>
                      </div>
                    </div>

                    {/* Confusion Matrix Table */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/40 border border-slate-200 dark:border-gray-700 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-gray-300">
                        REAL Classification Confusion Matrix
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-900/40">
                          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{goldSetMetrics.confusionMatrix?.real?.tp ?? 0}</p>
                          <p className="text-[10px] font-bold text-slate-700 dark:text-gray-300">True Positives (TP)</p>
                          <p className="text-[9px] text-slate-400">Organic labeled as REAL</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/40">
                          <p className="text-lg font-black text-red-600 dark:text-red-400">{goldSetMetrics.confusionMatrix?.real?.fp ?? 0}</p>
                          <p className="text-[10px] font-bold text-slate-700 dark:text-gray-300">False Positives (FP)</p>
                          <p className="text-[9px] text-slate-400">Artificial labeled as REAL</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-900/40">
                          <p className="text-lg font-black text-amber-600 dark:text-amber-400">{goldSetMetrics.confusionMatrix?.real?.fn ?? 0}</p>
                          <p className="text-[10px] font-bold text-slate-700 dark:text-gray-300">False Negatives (FN)</p>
                          <p className="text-[9px] text-slate-400">Organic labeled as non-REAL</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700">
                          <p className="text-lg font-black text-slate-700 dark:text-gray-300">{goldSetMetrics.confusionMatrix?.real?.tn ?? 0}</p>
                          <p className="text-[10px] font-bold text-slate-700 dark:text-gray-300">True Negatives (TN)</p>
                          <p className="text-[9px] text-slate-400">Non-organic filtered out</p>
                        </div>
                      </div>
                    </div>

                    {/* Stratified Recommended Sampling Cohorts */}
                    {goldSetMetrics.recommendedSampling && (
                      <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-wide text-indigo-950 dark:text-indigo-200">
                          Stratified Sampling Targets for Calibration
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800">
                            <span className="text-[10px] font-bold text-slate-400 block">REAL Cohort</span>
                            <strong className="text-slate-900 dark:text-white">{goldSetMetrics.recommendedSampling.realCohort?.length ?? 0} accounts</strong>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800">
                            <span className="text-[10px] font-bold text-slate-400 block">LIKELY_REAL Cohort</span>
                            <strong className="text-slate-900 dark:text-white">{goldSetMetrics.recommendedSampling.likelyRealCohort?.length ?? 0} accounts</strong>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800">
                            <span className="text-[10px] font-bold text-slate-400 block">SUSPICIOUS Cohort</span>
                            <strong className="text-slate-900 dark:text-white">{goldSetMetrics.recommendedSampling.suspiciousCohort?.length ?? 0} accounts</strong>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800">
                            <span className="text-[10px] font-bold text-slate-400 block">Moved &rarr; SUSPICIOUS</span>
                            <strong className="text-slate-900 dark:text-white">{goldSetMetrics.recommendedSampling.movedToSuspiciousCohort?.length ?? 0} accounts</strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Existing Human Labels List */}
                    {goldSetMetrics.labels && goldSetMetrics.labels.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-gray-300">
                          Recently Labeled Accounts ({goldSetMetrics.labels.length})
                        </h4>
                        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                          {goldSetMetrics.labels.map((lbl: any) => (
                            <div key={lbl.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-800 flex items-center justify-between text-xs gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  lbl.verdict === "organic"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : lbl.verdict === "artificial"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                    : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                                }`}>
                                  {lbl.verdict}
                                </span>
                                <span className="font-mono text-slate-800 dark:text-gray-200 font-bold">{lbl.userId}</span>
                                {lbl.notes && <span className="text-[11px] text-slate-500 italic truncate max-w-xs">— {lbl.notes}</span>}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                {new Date(lbl.labeledAt).toLocaleDateString()} by {lbl.reviewerName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/40">
                <button
                  onClick={() => setShowGoldSetModal(false)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
