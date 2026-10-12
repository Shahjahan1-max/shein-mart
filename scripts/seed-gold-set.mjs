import fs from "node:fs";
import path from "node:path";
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
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
}

const { db: firestoreDb } = await import("../db.js");

const goldSetSeeds = [
  // Organic Ground Truth (Verified legacy earners)
  { userId: "1u307o2guxemtpox4n7", username: "Jasmin02", verdict: "organic", notes: "Audited manually: genuine organic task completions and verified deposits" },
  { userId: "ifscp6n2r2gmt7kbw75", username: "Obeng Eric", verdict: "organic", notes: "Audited manually: 37 organic tasks, 7 deposits, legitimate task earner" },
  { userId: "e1wzrflql86mt6dl348", username: "SAMI AKHTAR", verdict: "organic", notes: "Audited manually: 48 tasks, 10 deposits, $3.5k earnings backing balance" },
  { userId: "nr4oqd76x5mqf4myby", username: "Bilal", verdict: "organic", notes: "Audited manually: 43 tasks, 6 deposits, active platform earner" },
  { userId: "t5ysd5w83kmpl41yfz", username: "Asif123", verdict: "organic", notes: "Audited manually: 43 tasks, 9 deposits, organic task progression" },
  { userId: "een9t0gk9btmr2nh0y8", username: "AYoub Issaoui", verdict: "organic", notes: "Audited manually: 31 tasks, 6 deposits, clean ledger" },
  { userId: "rkwh044gudimtg66iqw", username: "Raza Bajwa", verdict: "organic", notes: "Audited manually: 37 tasks, 4 deposits, clean ledger" },
  { userId: "e8j88c2vtirmql7s9u5", username: "vikrant yadav", verdict: "organic", notes: "Audited manually: 43 tasks, 7 deposits, organic progress" },

  // Artificial / Fraud Ground Truth (Confirmed violations)
  { userId: "6fsb4dz9g7mqibx0s2", username: "Rana Tehmoor", verdict: "artificial", notes: "Unbacked admin credit excess $5247 without deposit ledger (A14)" },
  { userId: "9kknmzwufqmqkode48", username: "Testing", verdict: "fake", notes: "Test account with unbacked $1000 credit" },
  { userId: "lg633yp1rgjmpl418t6", username: "Ramsumanrai", verdict: "artificial", notes: "Unbacked admin credit excess $7650 without deposit ledger (A14)" },
  { userId: "4e9kqpzqhnkmtfwtoki", username: "Maria erisa", verdict: "artificial", notes: "Impossible progress vs age: $2650 withdrawal request on day 0 (A07)" },
  { userId: "hpmi4kil6mmv1apf96", username: "فارس شعيب همو", verdict: "artificial", notes: "Unbacked credit excess $2450 without deposit ledger (A14)" },
  { userId: "nuj17d4goqpmpzpdz85", username: "Alabd6026", verdict: "artificial", notes: "Unbacked credit excess $1500 without deposit ledger (A14)" },
];

console.log("Seeding Gold Set human ground-truth labels into Firestore (userRiskLabels)...");
const batch = firestoreDb.batch();
const now = new Date().toISOString();

for (const seed of goldSetSeeds) {
  const ref = firestoreDb.collection("userRiskLabels").doc(seed.userId);
  batch.set(ref, {
    userId: seed.userId,
    username: seed.username,
    verdict: seed.verdict,
    notes: seed.notes,
    labeledBy: "Super Admin (Ground Truth Audit v3.5)",
    labeledAt: now,
    updatedAt: now,
  }, { merge: true });
}

await batch.commit();
console.log(`Successfully seeded ${goldSetSeeds.length} ground truth labels into userRiskLabels!`);
process.exit(0);
