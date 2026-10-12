import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const dotenvCandidates = [
  path.join(process.cwd(), ".env"),
  path.join(appRoot, ".env"),
  path.join(appRoot, "dist", ".env"),
  path.join(appRoot, "..", ".env"),
];

for (const envPath of Array.from(new Set(dotenvCandidates))) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const {
  db: firestoreDb,
  saveFirebaseDoc,
  getFirebaseDoc,
  listFirebaseCollection,
  deleteFirebaseDoc,
  readCollectionFiltered,
} = await import("../db.js");

const { createUserIntelligenceService } = await import("../server/user-intelligence.js");

async function listFirebaseDocs(collectionName) {
  const res = await listFirebaseCollection(collectionName).catch(() => ({ ok: false, data: [] }));
  return Array.isArray(res?.data) ? res.data : [];
}

async function runLiveBackfill() {
  console.log("================================================================================");
  console.log("       DEALXSTOCKS RISK ENGINE v3.4 — LIVE FIRESTORE BACKFILL EXECUTION          ");
  console.log("================================================================================");

  if (!firestoreDb) {
    console.error("Firestore DB connection failed!");
    process.exit(1);
  }

  // 1. Snapshot BEFORE state
  console.log("\n[1/4] Fetching pre-migration profiles from Firestore (userIntelligenceProfiles)...");
  const beforeProfiles = await listFirebaseDocs("userIntelligenceProfiles");
  console.log(`Found ${beforeProfiles.length} existing user intelligence profiles.`);

  const beforeMap = new Map();
  const beforeDistribution = {};

  for (const p of beforeProfiles) {
    const cls = p.classification || "UNCLASSIFIED";
    beforeDistribution[cls] = (beforeDistribution[cls] || 0) + 1;
    beforeMap.set(p.userId, {
      userId: p.userId,
      username: p.username || p.name || "Unknown",
      email: p.email || "",
      classification: cls,
      genuineScore: p.genuineScore ?? 0,
      riskScore: p.riskScore ?? p.suspicionScore ?? 0,
      confidence: p.confidence ?? 0.5,
      reasonCodes: p.reasonCodes || [],
      authenticityScore: p.authenticity?.score ?? null,
      provenanceCoverage: p.authenticity?.provenanceCoverage ?? null,
    });
  }

  console.log("Pre-migration Class Distribution:", beforeDistribution);

  // 2. Initialize Engine & Execute Full Recompute
  console.log("\n[2/4] Initializing Risk Engine v3.4 service & executing refreshAllProfiles()...");
  const userIntelService = createUserIntelligenceService({
    firestoreDb,
    saveFirebaseDoc,
    getFirebaseDoc,
    listFirebaseDocs,
    deleteFirebaseDoc,
    broadcastDataChange: () => {},
    readCollectionFiltered: (...args) => readCollectionFiltered(...args),
  });

  const startTime = Date.now();
  const refreshedProfiles = await userIntelService.refreshAllProfiles({
    adminUsername: "Super Admin (Risk Engine v3.4 Migration)",
  });
  const durationMs = Date.now() - startTime;
  console.log(`Successfully recomputed ${refreshedProfiles.length} user profiles in ${(durationMs / 1000).toFixed(2)}s.`);

  // 3. Analyze Post-Migration Results & Transitions
  console.log("\n[3/4] Computing migration transition matrix & shift analysis (v3.5)...");
  const afterDistribution = {};
  const transitionMatrix = {};
  const movedFromReal = [];
  const movedToSuspicious = [];
  const artificialFlagsTriggered = {};
  const evidenceModeDistribution = {};
  const reviewPriorityDistribution = {};
  const tagsDistribution = {};
  const allTransitions = [];

  for (const post of refreshedProfiles) {
    const postCls = post.classification || "UNCLASSIFIED";
    afterDistribution[postCls] = (afterDistribution[postCls] || 0) + 1;

    const evMode = post.evidenceMode || "LEGACY";
    evidenceModeDistribution[evMode] = (evidenceModeDistribution[evMode] || 0) + 1;

    if (postCls === "MANUAL_REVIEW") {
      const rp = post.reviewPriority || "LOW";
      reviewPriorityDistribution[rp] = (reviewPriorityDistribution[rp] || 0) + 1;
    }

    if (Array.isArray(post.tags)) {
      for (const t of post.tags) {
        tagsDistribution[t] = (tagsDistribution[t] || 0) + 1;
      }
    }

    const pre = beforeMap.get(post.userId) || {
      classification: "NEW_USER",
      genuineScore: 0,
      riskScore: 0,
      confidence: 0,
      reasonCodes: [],
      authenticityScore: null,
      provenanceCoverage: null,
    };

    const preCls = pre.classification;
    const transitionKey = `${preCls} -> ${postCls}`;
    transitionMatrix[transitionKey] = (transitionMatrix[transitionKey] || 0) + 1;

    const classChanged = preCls !== postCls;

    // Track artificial progress flags triggered (A01 - A17)
    const reasons = post.reasonCodes || [];
    for (const r of reasons) {
      if (r.startsWith("A")) {
        artificialFlagsTriggered[r] = (artificialFlagsTriggered[r] || 0) + 1;
      }
    }

    const record = {
      userId: post.userId,
      username: post.username || post.name,
      email: post.email,
      preClass: preCls,
      postClass: postCls,
      classChanged,
      evidenceMode: evMode,
      reviewPriority: post.reviewPriority || "NONE",
      tags: post.tags || [],
      preGenuine: pre.genuineScore,
      postGenuine: post.genuineScore,
      preRisk: pre.riskScore,
      postRisk: post.riskScore,
      postConfidence: post.confidence,
      authenticityScore: post.authenticity?.score ?? 100,
      provenanceCoverage: post.authenticity?.provenanceCoverage ?? 100,
      isArtificial: post.authenticity?.isArtificial ?? false,
      artificialFlags: post.authenticity?.triggeredFlags || [],
      reasonCodes: post.reasonCodes || [],
      accountBalance: post.accountBalance,
      completedTasks: post.completedTasksCount,
      earnings: post.earnings,
      depositsCount: post.depositsCount,
      totalDepositAmount: post.totalDepositAmount,
      withdrawalsCount: post.withdrawalsCount,
      totalWithdrawalAmount: post.totalWithdrawalAmount,
      accountAgeDays: post.accountAgeDays,
    };

    allTransitions.push(record);

    if (preCls === "REAL" && postCls !== "REAL") {
      movedFromReal.push(record);
    }

    if (postCls === "SUSPICIOUS" && (post.authenticity?.isArtificial || reasons.some(r => r.startsWith("A")))) {
      movedToSuspicious.push(record);
    }
  }

  console.log("\n================================================================================");
  console.log("                      RISK ENGINE v3.5 MIGRATION SUMMARY                        ");
  console.log("================================================================================");
  console.log("Total Profiles Processed:", refreshedProfiles.length);
  console.log("Execution Duration:", `${(durationMs / 1000).toFixed(2)}s`);
  console.log("\nPre-Migration Class Distribution:");
  console.table(beforeDistribution);
  console.log("\nPost-Migration (v3.5) Class Distribution:");
  console.table(afterDistribution);
  console.log("\nEvidence Mode Distribution:");
  console.table(evidenceModeDistribution);
  console.log("\nMANUAL_REVIEW Priority Triage Distribution:");
  console.table(reviewPriorityDistribution);
  console.log("\nTags Assigned Distribution:");
  console.table(tagsDistribution);
  console.log("\nClass Transition Matrix (Old Class -> New Class):");
  console.table(transitionMatrix);

  console.log("\nArtificial Progress Flags (A01 - A17) Frequency:");
  console.table(artificialFlagsTriggered);

  // 4. Save results to JSON file
  const reportPath = path.join(__dirname, "backfill-results.json");
  const reportData = {
    timestamp: new Date().toISOString(),
    engineVersion: "2026.10-v3.5",
    durationMs,
    totalProfiles: refreshedProfiles.length,
    beforeDistribution,
    afterDistribution,
    evidenceModeDistribution,
    reviewPriorityDistribution,
    tagsDistribution,
    transitionMatrix,
    artificialFlagsTriggered,
    movedFromReal,
    movedToSuspicious,
    allTransitions: allTransitions.slice(0, 200),
  };

  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), "utf8");
  console.log(`\n[4/4] Full migration report written to: ${reportPath}`);
  console.log("================================================================================");
}

runLiveBackfill().catch(err => {
  console.error("Backfill failed with error:", err);
  process.exit(1);
});
