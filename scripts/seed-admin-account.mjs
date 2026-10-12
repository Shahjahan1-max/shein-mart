import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(appRoot, "..");
const dryRun = !process.argv.includes("--apply");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(item => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : "";
}

async function main() {
  parseEnvFile(path.join(workspaceRoot, ".env"));
  parseEnvFile(path.join(appRoot, ".env"));
  parseEnvFile(path.join(appRoot, ".env.production"));

  const required = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Missing Firebase env: ${missing.join(", ")}`);

  const id = argValue("id") || process.env.ADMIN_SEED_ID || "";
  const email = argValue("email") || process.env.ADMIN_SEED_EMAIL || "";
  const username = argValue("username") || email;
  const password = argValue("password") || process.env.ADMIN_SEED_PASSWORD || "";
  const role = argValue("role") || process.env.ADMIN_SEED_ROLE || "superadmin";

  if (!id || !email || !password) {
    throw new Error(
      "Admin credentials are required. Provide them via CLI flags (--id, --email, --password) or env (ADMIN_SEED_ID, ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD). No hardcoded defaults are permitted."
    );
  }
  if (password.length < 12) {
    throw new Error("Admin password must be at least 12 characters. Refusing to seed weak credentials.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("ADMIN_SEED_EMAIL must be a valid email address.");
  }

  const { salt, hash } = hashPassword(password);

  const adminAccount = {
    id,
    username,
    email,
    role,
    password: `scrypt:${salt}:${hash}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const db = await import("../db.js");
  if (!db.firebaseEnabled()) {
    throw new Error("Firebase is not initialized. Check service account env values.");
  }

  console.log(`${dryRun ? "Dry run" : "Uploading"} adminAccounts/${adminAccount.id} to project ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`Credentials source: ${process.argv.some(a => a.startsWith("--email")) ? "CLI flags" : "environment variables"}.`);
  if (dryRun) {
    console.log(JSON.stringify({ ...adminAccount, password: "<redacted>" }, null, 2));
    console.log("No writes made. Run with --apply to upload.");
    return;
  }

  const result = await db.saveFirebaseDoc("adminAccounts", adminAccount.id, adminAccount);
  if (!result.ok) throw new Error(result.error || "Failed to save admin account.");
  await db.db.collection("adminAccounts").doc(adminAccount.id).set({
    passwordHash: admin.firestore.FieldValue.delete(),
    password_hash: admin.firestore.FieldValue.delete(),
  }, { merge: true });
  console.log("Admin account seed completed.");
}

function hashPassword(password) {
  // Matches the server's scrypt scheme (crypto.scryptSync, 64-byte, hex salt).
  // Stored as `scrypt:<salt>:<hash>` so verifyAdminPassword can check it.
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

main().catch(error => {
  console.error(error?.message || error);
  process.exit(1);
});
