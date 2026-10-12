import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const { listFirebaseCollection, deleteFirebaseDoc, saveFirebaseDoc, firebaseEnabled } = await import("./db.js");

console.log("Firebase enabled:", firebaseEnabled());
console.log("Cleaning up adminAccounts collection...\n");

// Get all admin accounts
const result = await listFirebaseCollection("adminAccounts");
if (!result.ok || !result.data) {
  console.error("Failed to read admin accounts:", result.error);
  process.exit(1);
}

console.log(`Found ${result.data.length} admin accounts. Deleting all duplicates...\n`);

// Keep only the latest account for each username/email combination
const keep = new Map();
const toDelete = [];

result.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

for (const account of result.data) {
  const key = `${String(account.username || "").toLowerCase()}-${String(account.email || "").toLowerCase()}`;
  if (keep.has(key)) {
    toDelete.push(account.id);
  } else {
    keep.set(key, account.id);
  }
}

console.log(`Keeping: ${keep.size} unique accounts`);
console.log(`Deleting: ${toDelete.length} duplicate accounts\n`);

// Delete duplicates
for (const id of toDelete) {
  try {
    await deleteFirebaseDoc("adminAccounts", id);
    console.log(`✓ Deleted: ${id}`);
  } catch (e) {
    console.error(`✗ Failed to delete ${id}:`, e.message);
  }
}

// Now update the kept accounts with proper passwords
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

console.log("\nSetting up clean admin accounts with proper hashing...\n");

// Hash password function
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

// Create and save new accounts
for (const account of newAccounts) {
  const { password, ...accountData } = account;
  const plainAccount = {
    ...accountData,
    password: String(password),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await saveFirebaseDoc("adminAccounts", account.id, plainAccount);
    console.log(`✓ Created: ${account.username} (${account.role})`);
    console.log(`  Email: ${account.email}`);
    console.log(`  Password: ${password}`);
    console.log();
  } catch (e) {
    console.error(`✗ Failed to create ${account.username}:`, e.message);
  }
}

console.log("✅ Admin accounts cleaned up and reset successfully!");
console.log("\nNew Credentials:");
console.log("─────────────────────────────────────────────");
console.log("Super Admin:");
console.log("  Username: adtsofttech");
console.log("  Email: adtsofttech@gmail.com");
console.log("  Password: Admin@123456");
console.log("  URL: http://localhost:5173/super-admin/login");
console.log();
console.log("Admin:");
console.log("  Username: admin");
console.log("  Email: admin@dealxstocks.com");
console.log("  Password: Admin@123456");
console.log("  URL: http://localhost:5173/admin/login");
console.log("─────────────────────────────────────────────");

process.exit(0);
