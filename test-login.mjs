import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Import db module
const { listFirebaseCollection, firebaseEnabled } = await import("./db.js");

console.log("Firebase enabled:", firebaseEnabled());
console.log("Checking adminAccounts collection...\n");

const result = await listFirebaseCollection("adminAccounts");
console.log("Result:", JSON.stringify(result, null, 2));

if (result.ok && result.data && result.data.length > 0) {
  console.log("\n✅ Found", result.data.length, "admin accounts:");
  result.data.forEach((account, i) => {
    console.log(`\n[${i + 1}] ${account.username} (${account.role})`);
    console.log("  Email:", account.email);
    console.log("  Password hash:", account.password ? account.password.substring(0, 30) + "..." : "MISSING");
    console.log("  Created:", account.createdAt);
  });
} else {
  console.log("\n❌ No admin accounts found or error:", result.error);
}

process.exit(0);
