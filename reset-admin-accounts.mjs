import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const { db: firestoreDb, firebaseEnabled } = await import("./db.js");

if (!firebaseEnabled() || !firestoreDb) {
  console.error("Firebase not initialized");
  process.exit(1);
}

console.log("Resetting admin accounts...\n");

// Get all admin accounts
const snapshot = await firestoreDb.collection("adminAccounts").get();
console.log(`Found ${snapshot.size} admin accounts. Deleting all...\n`);

let deleted = 0;
for (const doc of snapshot.docs) {
  try {
    await doc.ref.delete();
    deleted++;
    console.log(`✓ Deleted: ${doc.id}`);
  } catch (e) {
    console.error(`✗ Failed: ${doc.id}`, e.message);
  }
}

console.log(`\nDeleted ${deleted} accounts.\n`);

// Hash password function
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

// Create new accounts
const newAccounts = [
  {
    id: "admin-superadmin",
    username: "adtsofttech",
    email: "adtsofttech@gmail.com",
    role: "superadmin",
    password: "Admin@123456",
  },
  {
    id: "admin-user",
    username: "admin",
    email: "admin@dealxstocks.com",
    role: "admin",
    password: "Admin@123456",
  },
];

console.log("Creating new admin accounts...\n");

const now = new Date().toISOString();
for (const account of newAccounts) {
  const accountData = {
    id: account.id,
    username: account.username,
    email: account.email,
    role: account.role,
    password: String(account.password),
    createdAt: now,
    updatedAt: now,
  };

  try {
    await firestoreDb.collection("adminAccounts").doc(account.id).set(accountData);
    console.log(`✓ Created: ${account.username} (${account.role})`);
    console.log(`  Email: ${account.email}`);
    console.log(`  ID: ${account.id}`);
    console.log();
  } catch (e) {
    console.error(`✗ Failed: ${account.username}`, e.message);
  }
}

console.log("✅ Admin accounts reset successfully!");
console.log("\nCredentials:");
console.log("─────────────────────────────────────────────");
console.log("Super Admin:   adtsofttech / Admin@123456");
console.log("Admin:         admin / Admin@123456");
console.log("─────────────────────────────────────────────");

process.exit(0);
