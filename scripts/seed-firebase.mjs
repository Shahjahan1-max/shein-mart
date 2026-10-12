import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(appRoot, "..");
const srcDataDir = path.join(workspaceRoot, "frontend", "src", "data");
const dataDir = path.join(workspaceRoot, ".data");
const dryRun = !process.argv.includes("--apply");
const includeRuntime = process.argv.includes("--include-runtime");
const defaultAdminAccount = {
  id: "admin-main",
  username: "admin@gmail.com",
  email: "admin@gmail.com",
  role: "superadmin",
  password: "admin@123",
  createdAt: "2026-05-21T00:00:00.000Z",
  updatedAt: "2026-05-21T00:00:00.000Z",
};

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

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripUndefined(item)])
  );
}

function withMeta(doc) {
  const now = new Date().toISOString();
  return stripUndefined({
    ...doc,
    createdAt: doc.createdAt || now,
    updatedAt: doc.updatedAt || now,
  });
}

async function loadTsDataModule(fileName) {
  const sourcePath = path.join(srcDataDir, fileName);
  const source = fs.readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: sourcePath,
  });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "deal-stocks-seed-"));
  const tempPath = path.join(tempDir, fileName.replace(/\.ts$/, ".mjs"));
  fs.writeFileSync(tempPath, transpiled.outputText, "utf8");
  return import(pathToFileURL(tempPath).href);
}

async function main() {
  parseEnvFile(path.join(workspaceRoot, ".env"));
  parseEnvFile(path.join(appRoot, ".env"));
  parseEnvFile(path.join(appRoot, ".env.production"));

  const required = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing Firebase env: ${missing.join(", ")}`);
  }

  const [
    landingPageData,
    backgroundData,
    adminData,
    platformsData,
    adsData,
    db,
  ] = await Promise.all([
    loadTsDataModule("landingPageData.ts"),
    loadTsDataModule("backgroundData.ts"),
    loadTsDataModule("adminData.ts"),
    loadTsDataModule("platformsData.ts"),
    loadTsDataModule("adsData.ts"),
    import("../db.js"),
  ]);

  if (!db.firebaseEnabled()) {
    throw new Error("Firebase is not initialized. Check service account env values.");
  }

  const productsCatalog = readJson(path.join(srcDataDir, "products.json"), {
    platform: "firebase",
    version: "",
    platforms: [],
  });
  const packagesCatalog = readJson(path.join(srcDataDir, "packages.json"), { packages: [] });
  const marketplaces = readJson(path.join(srcDataDir, "marketplaces.json"), []);
  const languages = readJson(path.join(srcDataDir, "languages.json"), []);
  const runtimeUsers = includeRuntime ? readJson(path.join(dataDir, "users.json"), []) : [];
  const runtimeTaskSessions = includeRuntime ? readJson(path.join(dataDir, "task-sessions.json"), []) : [];

  const docs = [
    {
      collection: "landingPage",
      id: "main",
      data: { id: "main", ...landingPageData.DEFAULT_LANDING_PAGE },
    },
    {
      collection: "settings",
      id: "platform",
      data: { id: "platform", ...adminData.DEFAULT_SETTINGS },
    },
    {
      collection: "catalogs",
      id: "products",
      data: { id: "products", ...productsCatalog },
    },
    {
      collection: "catalogs",
      id: "platforms",
      data: { id: "platforms", platforms: platformsData.PLATFORMS_DATA },
    },
    {
      collection: "catalogs",
      id: "packages",
      data: { id: "packages", packages: packagesCatalog.packages || [] },
    },
    {
      collection: "catalogs",
      id: "adGroups",
      data: { id: "adGroups", groups: adsData.AD_GROUPS },
    },
    {
      collection: "catalogs",
      id: "marketplaces",
      data: { id: "marketplaces", items: marketplaces },
    },
    {
      collection: "catalogs",
      id: "languages",
      data: { id: "languages", items: languages },
    },
    {
      collection: "adminAccounts",
      id: defaultAdminAccount.id,
      data: defaultAdminAccount,
    },
    ...backgroundData.DEFAULT_BACKGROUND_ASSETS.map(asset => ({
      collection: "backgroundAssets",
      id: asset.id,
      data: asset,
    })),
    ...adminData.SEED_USERS.map(user => ({ collection: "users", id: user.id, data: user })),
    ...adminData.SEED_DEPOSITS.map(item => ({ collection: "deposits", id: item.id, data: item })),
    ...adminData.SEED_WITHDRAWALS.map(item => ({ collection: "withdrawals", id: item.id, data: item })),
    ...adminData.SEED_TICKETS.map(item => ({ collection: "supportTickets", id: item.id, data: item })),
    ...runtimeUsers.map(user => ({ collection: "users", id: user.id, data: user })),
    ...runtimeTaskSessions.map(session => ({
      collection: "taskSessions",
      id: session.sessionId || session.id,
      data: session,
    })),
  ].filter(item => item.id);

  console.log(`${dryRun ? "Dry run" : "Uploading"} ${docs.length} Firestore docs to project ${process.env.FIREBASE_PROJECT_ID}`);
  for (const doc of docs) {
    console.log(`- ${doc.collection}/${doc.id}`);
    if (dryRun) continue;
    const result = await db.saveFirebaseDoc(doc.collection, doc.id, withMeta(doc.data));
    if (!result.ok) throw new Error(`${doc.collection}/${doc.id}: ${result.error}`);
    if (doc.collection === "adminAccounts") {
      await db.db.collection(doc.collection).doc(doc.id).set({
        passwordHash: admin.firestore.FieldValue.delete(),
        password_hash: admin.firestore.FieldValue.delete(),
      }, { merge: true });
    }
  }

  if (dryRun) {
    console.log("No writes made. Run with --apply to upload.");
  } else {
    console.log("Firebase seed completed.");
  }
}

main().catch(error => {
  console.error(error?.message || error);
  process.exit(1);
});
