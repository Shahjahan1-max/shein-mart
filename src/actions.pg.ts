// Actions for the dropshipping marketplace.
//
// Model (from the owner): one main store catalog owned by the Admin. Sellers
// register a seller account and add main-store products into their own store.
// Every product carries a profit %: profit = round(base * pct / 100), and the
// buyer price through a seller's store = base + profit. When a seller is
// signed in, their share of an order's profit is credited to that seller;
// otherwise the profit stays with the main store.

import { defineAction, z, type ActionsModule, type Ctx } from "./space-shim";
import { and, asc, desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import * as schema from "./schema.pg";
import { createHash, randomBytes } from "node:crypto";

type Db = ReturnType<Ctx["db"]>;
// --- Password storage: secure hash ONLY, never plain text, never shown ---
// PBKDF2-SHA256 via the Web Crypto global (no host modules allowed in
// action code). Format: pbkdf2$<iterations>$<saltHex>$<hashHex>. No action
// ever returns a stored password or hash; checks happen only on the backend.
const PBKDF2_ITERATIONS = 60000;
function bytesToHex(b: Uint8Array): string { return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join(""); }
function hexToBytes(h: string): Uint8Array { const out = new Uint8Array(h.length / 2); for (let i = 0; i < out.length; i += 1) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); return out; }
async function pbkdf2Hex(plain: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(plain), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" } as never, key, 256);
  return bytesToHex(new Uint8Array(bits));
}
async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Hex(plain, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${hash}`;
}
function isHashedPassword(stored: string): boolean {
  return typeof stored === "string" && stored.startsWith("pbkdf2$");
}
async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!plain || !stored) return false;
  if (isHashedPassword(stored)) {
    const parts = stored.split("$");
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1] ?? "", 10);
    if (!iterations || !parts[2] || !parts[3]) return false;
    try {
      const actual = await pbkdf2Hex(plain, hexToBytes(parts[2]), iterations);
      if (actual.length !== parts[3].length) return false;
      let diff = 0;
      for (let i = 0; i < actual.length; i += 1) diff |= actual.charCodeAt(i) ^ parts[3].charCodeAt(i);
      return diff === 0;
    } catch { return false; }
  }
  // Legacy row created before hashing existed: plain comparison ONLY so
  // the owner can still sign in once; ensurePasswordHashes / login upgrade
  // it to a hash immediately, after which no plain value remains stored.
  return stored === plain;
}

// Login sessions: only the SHA-256 hash of a token is ever stored, so
// a database leak yields no usable session. The raw token is returned
// to the client exactly once, at login.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Login brute-force guard: per-process in-memory state. Render runs a
// single instance of this service, so one process sees every attempt;
// if the service ever scales to multiple instances this must move to
// the database or a shared store.
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const loginFailures = new Map<string, { count: number; lockedUntil: number }>();
function loginLockoutKey(identifier: string): string {
  return identifier.trim().toLowerCase();
}
function isLoginLocked(key: string): boolean {
  const rec = loginFailures.get(key);
  if (!rec) return false;
  if (rec.count < LOGIN_MAX_FAILURES) return false;
  if (rec.lockedUntil > Date.now()) return true;
  // Lockout window passed: start a fresh count.
  loginFailures.delete(key);
  return false;
}
function recordLoginFailure(key: string): void {
  const rec = loginFailures.get(key) ?? { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= LOGIN_MAX_FAILURES) rec.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
  loginFailures.set(key, rec);
}
function clearLoginFailures(key: string): void {
  loginFailures.delete(key);
}

// Session lifetime: 30 days. On issue, expired sessions for the user
// are pruned and live sessions are capped at 10 (oldest dropped first),
// so old devices cannot pile up forever. The dispatcher additionally
// enforces expiry on every request (server.ts).
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_MAX_PER_USER = 10;
async function issueSessionToken(db: Db, userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db
    .delete(schema.userSessions)
    .where(and(eq(schema.userSessions.userId, userId), lt(schema.userSessions.expiresAt, new Date())));
  const live = await db
    .select({ id: schema.userSessions.id })
    .from(schema.userSessions)
    .where(eq(schema.userSessions.userId, userId))
    .orderBy(asc(schema.userSessions.createdAt));
  if (live.length >= SESSION_MAX_PER_USER) {
    const excess = live.slice(0, live.length - (SESSION_MAX_PER_USER - 1));
    for (const row of excess) {
      await db.delete(schema.userSessions).where(eq(schema.userSessions.id, row.id));
    }
  }
  await db.insert(schema.userSessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  return token;
}

// Delete a user's sessions. exceptTokenHash keeps one session alive —
// used by password changes so the device that made the change stays
// signed in while every other device is signed out.
async function invalidateUserSessions(db: Db, userId: number, exceptTokenHash: string | null = null): Promise<void> {
  if (exceptTokenHash) {
    await db.delete(schema.userSessions).where(and(eq(schema.userSessions.userId, userId), ne(schema.userSessions.tokenHash, exceptTokenHash)));
  } else {
    await db.delete(schema.userSessions).where(eq(schema.userSessions.userId, userId));
  }
}

async function getSettingsRow(db: Db) {
  const rows = await db.select().from(schema.settings).limit(1);
  if (rows[0]) return rows[0];
  const inserted = await db
    .insert(schema.settings)
    .values({ id: 1 })
    .returning();
  return inserted[0]!;
}

function profitOf(basePrice: number, pct: number) {
  return Math.round((basePrice * pct) / 100);
}

type BulkSlab = { fromPrice: number; toPrice: number | null; minPercent: number; maxPercent: number };
type BulkArgsLike = {
  scopeType: "all" | "category" | "price_range";
  category?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  mode: "fixed" | "random" | "slabs";
  fixedPercent?: number | null;
  randomMin?: number | null;
  randomMax?: number | null;
  slabs?: BulkSlab[];
};
function bulkRandomInt(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function bulkValidate(a: BulkArgsLike): string | null {
  if (a.scopeType === "category" && (!a.category || !a.category.trim())) return "Category is missing — please choose a category for this bulk update.";
  if (a.scopeType === "price_range") {
    if (a.minPrice === null || a.minPrice === undefined) return "Minimum Price (₹) is missing — please enter the lowest base price for the price range.";
    if (a.maxPrice === null || a.maxPrice === undefined) return "Maximum Price (₹) is missing — please enter the highest base price for the price range.";
    if (a.minPrice < 0) return "Minimum Price (₹) cannot be negative — please enter 0 or more.";
    if (a.maxPrice < 0) return "Maximum Price (₹) cannot be negative — please enter 0 or more.";
    if (a.minPrice > a.maxPrice) return "Price Range is wrong — Minimum Price must be less than or equal to Maximum Price.";
  }
  if (a.mode === "fixed") {
    if (a.fixedPercent === null || a.fixedPercent === undefined) return "Fixed Profit % is missing — please enter the profit % to apply to every product in scope.";
    if (a.fixedPercent < 0 || a.fixedPercent > 100) return "Fixed Profit % must be between 0% and 100% — please enter a value in that range.";
  }
  if (a.mode === "random") {
    if (a.randomMin === null || a.randomMin === undefined) return "Minimum Profit % is missing — please enter the lowest profit % for the random range.";
    if (a.randomMax === null || a.randomMax === undefined) return "Maximum Profit % is missing — please enter the highest profit % for the random range.";
    if (a.randomMin < 0 || a.randomMin > 100) return "Minimum Profit % must be between 0% and 100%.";
    if (a.randomMax < 0 || a.randomMax > 100) return "Maximum Profit % must be between 0% and 100%.";
    if (a.randomMin > a.randomMax) return "Random range is wrong — Minimum Profit % must be less than or equal to Maximum Profit %.";
  }
  if (a.mode === "slabs") {
    if (!a.slabs || a.slabs.length === 0) return "Price Slabs are missing — please add at least one slab (price from–to and profit % range).";
    for (let i = 0; i < a.slabs.length; i += 1) {
      const s = a.slabs[i]!;
      const label = `Slab ${i + 1}`;
      if (s.fromPrice < 0) return `${label}: From Price cannot be negative.`;
      if (s.toPrice !== null && s.toPrice < s.fromPrice) return `${label}: From Price must be less than or equal to To Price.`;
      if (s.minPercent < 0 || s.minPercent > 100) return `${label}: Minimum Profit % must be between 0% and 100%.`;
      if (s.maxPercent < 0 || s.maxPercent > 100) return `${label}: Maximum Profit % must be between 0% and 100%.`;
      if (s.minPercent > s.maxPercent) return `${label}: Minimum Profit % must be less than or equal to Maximum Profit %.`;
    }
  }
  return null;
}
function bulkFilterScope<T extends { category: string; basePrice: number }>(rows: T[], a: BulkArgsLike): T[] {
  if (a.scopeType === "category") return rows.filter((r) => r.category === (a.category ?? ""));
  if (a.scopeType === "price_range") return rows.filter((r) => r.basePrice >= (a.minPrice ?? 0) && r.basePrice <= (a.maxPrice ?? Number.MAX_SAFE_INTEGER));
  return rows;
}
function bulkNewPercent(basePrice: number, a: BulkArgsLike): number | null {
  if (a.mode === "fixed") return a.fixedPercent ?? null;
  if (a.mode === "random") return bulkRandomInt(a.randomMin ?? 0, a.randomMax ?? 0);
  // slabs
  const slab = (a.slabs ?? []).find((s) => basePrice >= s.fromPrice && (s.toPrice === null || basePrice <= s.toPrice));
  if (!slab) return null;
  return bulkRandomInt(slab.minPercent, slab.maxPercent);
}
function bulkScopeLabel(a: BulkArgsLike): string {
  if (a.scopeType === "category") return `Category: ${a.category ?? ""}`;
  if (a.scopeType === "price_range") return `Price Range: ₹${a.minPrice ?? 0} – ₹${a.maxPrice ?? ""}`;
  return "All Products";
}
function bulkModeLabel(a: BulkArgsLike): string {
  if (a.mode === "fixed") return `Fixed ${a.fixedPercent ?? 0}%`;
  if (a.mode === "random") return `Random ${a.randomMin ?? 0}%–${a.randomMax ?? 0}%`;
  return "Price Slabs";
}
function bulkDetail(a: BulkArgsLike): string {
  if (a.mode === "fixed") return `Every product in scope set to ${a.fixedPercent ?? 0}% profit.`;
  if (a.mode === "random") return `Each product got its own random whole % between ${a.randomMin ?? 0}% and ${a.randomMax ?? 0}%.`;
  const parts = (a.slabs ?? []).map((s) => `₹${s.fromPrice}–${s.toPrice === null ? "∞" : `₹${s.toPrice}`} → ${s.minPercent}%–${s.maxPercent}%`);
  return `Price slabs: ${parts.join(" · ")}. Products matching no slab kept their current %.`;
}
const bulkSlabSchema = z.object({ fromPrice: z.number().int().min(0).max(100000000), toPrice: z.number().int().min(0).max(100000000).nullable(), minPercent: z.number().int().min(-100).max(200), maxPercent: z.number().int().min(-100).max(200) });
const bulkRequestSchema = z.object({
  adminId: z.number(),
  scopeType: z.enum(["all", "category", "price_range"]),
  category: z.string().max(60).nullable().optional(),
  minPrice: z.number().int().nullable().optional(),
  maxPrice: z.number().int().nullable().optional(),
  mode: z.enum(["fixed", "random", "slabs"]),
  fixedPercent: z.number().int().nullable().optional(),
  randomMin: z.number().int().nullable().optional(),
  randomMax: z.number().int().nullable().optional(),
  slabs: z.array(bulkSlabSchema).max(4).optional(),
});
const bulkSampleOut = z.object({ id: z.number(), name: z.string(), category: z.string(), basePrice: z.number(), oldPercent: z.number(), newPercent: z.number(), oldBuyerPrice: z.number(), newBuyerPrice: z.number() });
const bulkPreviewResponse = z.object({ ok: z.boolean(), error: z.string().nullable(), count: z.number(), summary: z.string(), samples: z.array(bulkSampleOut) });
const bulkApplyResponse = z.object({ ok: z.boolean(), error: z.string().nullable(), updatedCount: z.number(), summary: z.string() });
const bulkHistoryOut = z.object({ id: z.number(), scopeLabel: z.string(), modeLabel: z.string(), detail: z.string(), affectedCount: z.number(), createdAt: z.string() });

// Normalise an Indian mobile number to its last 10 digits: strips spaces,
// dashes, a leading +91 / 91 country code and a leading 0. Returns "" when
// the input has no usable digits. Kept for legacy rows, which were all
// stored as bare 10-digit Indian numbers.
function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

// Country-aware phone rules. Accounts pick their country at signup, and
// the phone must follow THAT country's format — a Pakistani buyer types
// 03XX XXXXXXX or +92 3XX XXXXXXX, an Indian buyer 98XXX XXXXX or
// +91 …. `national` is the digit count without the dial code and without
// a leading trunk 0. Numbers are stored canonically as dial+national
// (e.g. "923001234567"); accounts created before this change hold bare
// 10-digit Indian numbers, which canonicalise with the India spec.
type PhoneSpec = { dial: string; national: number; example: string };
const COUNTRY_PHONE_SPECS: Record<string, PhoneSpec> = {
  Pakistan: { dial: "92", national: 10, example: "03XX XXXXXXX" },
  India: { dial: "91", national: 10, example: "98XXX XXXXX" },
  Bangladesh: { dial: "880", national: 10, example: "01XXX XXXXXX" },
  "Saudi Arabia": { dial: "966", national: 9, example: "05X XXX XXXX" },
  "United Arab Emirates": { dial: "971", national: 9, example: "05X XXX XXXX" },
  Qatar: { dial: "974", national: 8, example: "XXXX XXXX" },
  Kuwait: { dial: "965", national: 8, example: "XXXX XXXX" },
  Bahrain: { dial: "973", national: 8, example: "XXXX XXXX" },
  Oman: { dial: "968", national: 8, example: "XXXX XXXX" },
  "Türkiye": { dial: "90", national: 10, example: "05XX XXX XX XX" },
  Iran: { dial: "98", national: 10, example: "09XX XXX XXXX" },
};
function phoneSpecFor(country: string | null | undefined): PhoneSpec | null {
  if (!country) return null;
  return COUNTRY_PHONE_SPECS[country.trim()] ?? null;
}
// Canonical stored form for `raw` under `country`'s rules, or "" when the
// number does not fit those rules. Countries without a spec accept any
// plausible international number (7–15 digits) and store the digits.
function canonicalPhone(raw: string | null | undefined, country: string | null | undefined): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  const spec = phoneSpecFor(country);
  if (!spec) return d.length >= 7 && d.length <= 15 ? d : "";
  if (d.length === spec.national + spec.dial.length && d.startsWith(spec.dial)) return d;
  if (d.length === spec.national + 1 && d.startsWith("0")) return spec.dial + d.slice(1);
  if (d.length === spec.national) return spec.dial + d;
  return "";
}
// Every canonical form a login / reset identifier could match: the same
// typed number canonicalised under each known country's rules, plus the
// legacy 10-digit normalisation for accounts stored before countries.
function phoneCandidates(raw: string | null | undefined): string[] {
  const out = new Set<string>();
  for (const c of Object.keys(COUNTRY_PHONE_SPECS)) {
    const v = canonicalPhone(raw, c);
    if (v) out.add(v);
  }
  const generic = canonicalPhone(raw, null);
  if (generic) out.add(generic);
  const legacy = normalizePhone(raw);
  if (legacy) {
    out.add(legacy);
    out.add("91" + legacy);
  }
  return [...out];
}
// Display form with the account's own country code (never a hardcoded
// +91): canonical numbers already carry their dial code; a legacy bare
// 10-digit number is shown with its account country's code (India by
// default, matching how it was collected).
function phoneDisplay(phone: string | null | undefined, country: string | null | undefined): string {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  const spec = phoneSpecFor(country) ?? COUNTRY_PHONE_SPECS["India"]!;
  if (d.length > spec.national && d.startsWith(spec.dial)) return `+${d}`;
  if (d.length === 10) return `+${spec.dial} ${d}`;
  return `+${d}`;
}

// Postal / ZIP code length per country (null = the country has no fixed
// postal-code system, so the field is optional free text).
const COUNTRY_POSTAL_LENGTH: Record<string, number | null> = {
  Pakistan: 5,
  India: 6,
  Bangladesh: 4,
  "Saudi Arabia": 5,
  "United Arab Emirates": null,
  Qatar: null,
  Kuwait: 5,
  Bahrain: null,
  Oman: null,
  "Türkiye": 5,
  Iran: 10,
};
function postalValid(country: string | null | undefined, pin: string): boolean {
  const v = pin.trim();
  const key = (country ?? "").trim();
  const len = key in COUNTRY_POSTAL_LENGTH ? COUNTRY_POSTAL_LENGTH[key] : undefined;
  if (len === undefined) return v.length <= 10; // unlisted country: free-form
  if (len === null) return v.length <= 10; // optional in this country
  return /^\d+$/.test(v) && v.length === len;
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function findUserByPhone(db: Db, candidates: string | string[]) {
  const wanted = new Set((Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean));
  if (wanted.size === 0) return undefined;
  const all = await db.select().from(schema.users);
  return all.find((u) => {
    if (!u.phone) return false;
    if (wanted.has(u.phone)) return true;
    const canon = canonicalPhone(u.phone, u.country ?? "India");
    return canon !== "" && wanted.has(canon);
  });
}

const productOut = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  basePrice: z.number(),
  oldPrice: z.number().nullable(),
  profitPercent: z.number(),
  profitAmount: z.number(),
  buyerPrice: z.number(),
  stock: z.number(),
  imageAsset: z.string().nullable(),
  imageSourceUrl: z.string().nullable(),
  source: z.string(),
});

type ProductRow = typeof schema.products.$inferSelect;

function toProductOut(p: ProductRow) {
  const profitAmount = profitOf(p.basePrice, p.profitPercent);
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    basePrice: p.basePrice,
    oldPrice: p.oldPrice,
    profitPercent: p.profitPercent,
    profitAmount,
    buyerPrice: p.basePrice + profitAmount,
    stock: p.stock,
    imageAsset: p.imageAsset,
    imageSourceUrl: p.imageSourceUrl,
    source: p.catalogSource ?? "curated",
  };
}

const userOut = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  role: z.enum(["buyer", "seller", "admin"]),
  storeName: z.string().nullable(),
  phone: z.string().nullable(),
  country: z.string().nullable(),
  verificationStatus: z.string(),
  photoFileName: z.string().nullable(),
  storeDescription: z.string().nullable(),
  storeLogoFileName: z.string().nullable(),
  // True when a real uploaded file (blob) exists for the profile photo /
  // store logo — older records may hold only a file name. The client uses
  // these flags to decide between fetching the image (getMyDocumentUrl)
  // and showing the initial-letter fallback.
  hasPhotoFile: z.boolean(),
  hasLogoFile: z.boolean(),
  mustChangePassword: z.boolean(),
});

type UserRow = typeof schema.users.$inferSelect;

function toUserOut(u: UserRow) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    storeName: u.storeName,
    phone: u.phone,
    country: u.country ?? null,
    verificationStatus: u.verificationStatus,
    photoFileName: u.photoFileName,
    storeDescription: u.storeDescription,
    storeLogoFileName: u.storeLogoFileName,
    hasPhotoFile: !!u.photoBlobKey,
    hasLogoFile: !!u.storeLogoBlobKey,
    mustChangePassword: u.mustChangePassword === 1,
  };
}

// Full seller application as the Admin reviews it (personal + store +
// document details). Document files are recorded by file name in this build.
const sellerApplicationOut = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  country: z.string().nullable(),
  verificationStatus: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pinCode: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  photoFileName: z.string().nullable(),
  storeName: z.string().nullable(),
  storeDescription: z.string().nullable(),
  storeLogoFileName: z.string().nullable(),
  storeAddress: z.string().nullable(),
  businessType: z.string().nullable(),
  gstNumber: z.string().nullable(),
  docType: z.string().nullable(),
  docNumber: z.string().nullable(),
  docFrontFileName: z.string().nullable(),
  docBackFileName: z.string().nullable(),
  createdAt: z.string(),
  hasPhotoFile: z.boolean(),
  photoContentType: z.string().nullable(),
  photoSize: z.number().nullable(),
  hasLogoFile: z.boolean(),
  logoContentType: z.string().nullable(),
  logoSize: z.number().nullable(),
  hasDocFrontFile: z.boolean(),
  docFrontContentType: z.string().nullable(),
  docFrontSize: z.number().nullable(),
  hasDocBackFile: z.boolean(),
  docBackContentType: z.string().nullable(),
  docBackSize: z.number().nullable(),
  walletBalance: z.number(),
  totalBalance: z.number(),
  pendingOrderHolds: z.number(),
  totalDeposited: z.number(),
  totalWithdrawn: z.number(),
  earnings: z.number(),
  productCount: z.number(),
  orderCount: z.number(),
  totalSales: z.number(),
  usedAmount: z.number(),
  pendingWithdrawal: z.number(),
  pendingDeposit: z.number(),
  pendingOrderEarnings: z.number(),
  totalPending: z.number(),
  totalOrderValue: z.number(),
  totalAdminCredit: z.number(),
  serviceRating: z.number().nullable(),
  logisticsRating: z.number().nullable(),
  overallRating: z.number().nullable(),
});

type SellerApplication = z.infer<typeof sellerApplicationOut>;

function toSellerApplication(u: UserRow): SellerApplication {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    country: u.country ?? null,
    verificationStatus: u.verificationStatus,
    address: u.address,
    city: u.city,
    state: u.state,
    pinCode: u.pinCode,
    dateOfBirth: u.dateOfBirth,
    photoFileName: u.photoFileName,
    storeName: u.storeName,
    storeDescription: u.storeDescription,
    storeLogoFileName: u.storeLogoFileName,
    storeAddress: u.storeAddress,
    businessType: u.businessType,
    gstNumber: u.gstNumber,
    docType: u.docType,
    docNumber: u.docNumber,
    docFrontFileName: u.docFrontFileName,
    docBackFileName: u.docBackFileName,
    createdAt: u.createdAt.toISOString(),
    hasPhotoFile: !!u.photoBlobKey,
    photoContentType: u.photoContentType ?? null,
    photoSize: u.photoSize ?? null,
    hasLogoFile: !!u.storeLogoBlobKey,
    logoContentType: u.storeLogoContentType ?? null,
    logoSize: u.storeLogoSize ?? null,
    hasDocFrontFile: !!u.docFrontBlobKey,
    docFrontContentType: u.docFrontContentType ?? null,
    docFrontSize: u.docFrontSize ?? null,
    hasDocBackFile: !!u.docBackBlobKey,
    docBackContentType: u.docBackContentType ?? null,
    docBackSize: u.docBackSize ?? null,
    walletBalance: 0,
    totalBalance: 0,
    pendingOrderHolds: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    earnings: 0,
    productCount: 0,
    orderCount: 0,
    totalSales: 0,
    usedAmount: 0,
    pendingWithdrawal: 0,
    pendingDeposit: 0,
    pendingOrderEarnings: 0,
    totalPending: 0,
    totalOrderValue: 0,
    totalAdminCredit: 0,
    serviceRating: u.serviceRating ?? null,
    logisticsRating: u.logisticsRating ?? null,
    overallRating: u.overallRating ?? null,
  };
}


const ledgerEntryOut = z.object({
  id: z.string(),
  kind: z.string(),
  amount: z.number(),
  direction: z.string(),
  method: z.string(),
  reference: z.string(),
  note: z.string(),
  status: z.string(),
  runningBalance: z.number(),
  createdAt: z.string(),
  // True when this ledger line is a deposit request that carries a
  // payment screenshot (the seller attached one instead of / as well
  // as typing the Transaction Hash / Reference).
  hasScreenshot: z.boolean(),
});
const orderBreakdownOut = z.object({
  orderId: z.number(),
  createdAt: z.string(),
  productNames: z.string(),
  orderAmount: z.number(),
  profit: z.number(),
  clearedAmount: z.number(),
  pendingAmount: z.number(),
  status: z.string(),
  // What the seller must pay from their wallet to complete this order:
  // the base (product) cost of their own items in it. paidFromWallet is
  // true once an "order_payment" wallet entry exists for this order.
  payableCost: z.number(),
  paidFromWallet: z.boolean(),
});
// One withdrawal that has ACTUALLY been paid out of the wallet: a
// customer's withdrawal request the Admin paid (Pay & Withdraw, status
// "paid", or a legacy "completed" approval) or a direct Admin Withdrawal
// (type "admin_withdraw", status "completed"). Pending and rejected
// requests never appear here.
const withdrawalOut = z.object({
  id: z.number(),
  kind: z.string(), // "paid_request" | "admin_withdraw"
  amount: z.number(),
  // Display destination: the method the customer chose plus the UPI ID /
  // bank reference they gave, or "Admin Withdrawal" for a direct debit.
  method: z.string(),
  paymentReference: z.string(),
  note: z.string(),
  status: z.string(), // always "Paid"
  createdAt: z.string(), // payout moment (paid_at when recorded)
});
// One amount that has ACTUALLY been credited as a deposit: an
// Admin-approved deposit request OR a direct Customer Service Credit
// (Admin → Add Amount, type "admin_credit", status "completed").
// Pending and rejected requests never appear here. `kind` keeps the
// source explicit so the list can label Admin credits as such.
const depositCreditOut = z.object({
  id: z.number(),
  kind: z.string(), // "deposit" | "admin_credit"
  amount: z.number(),
  method: z.string(),
  reference: z.string(),
  note: z.string(),
  createdAt: z.string(),
});
const financeOut = z.object({
  sellerId: z.number(),
  availableBalance: z.number(),
  // Total Balance = Available + Pending (order holds). The ONLY thing
  // counted in Pending is order cost held for orders in Shipment.
  totalBalance: z.number(),
  pendingOrderHolds: z.number(),
  usedAmount: z.number(),
  // Sum of deposits ACTUALLY credited: Admin-approved deposit requests
  // PLUS direct Customer Service Credits (Admin → Add Amount). The
  // separate totalAdminCredit figure below is a breakdown of the part
  // of this total that came from Admin credits — it is NOT an extra
  // amount on top of totalDeposited.
  totalDeposited: z.number(),
  // Sum of withdrawals ACTUALLY paid out (paid/completed withdrawal
  // requests + completed Admin Withdrawals). Order payments are NOT
  // withdrawals and are never counted here (they live in usedAmount /
  // totalOrderPayments).
  totalWithdrawn: z.number(),
  withdrawals: z.array(withdrawalOut),
  deposits: z.array(depositCreditOut),
  totalAdminCredit: z.number(),
  earningsCleared: z.number(),
  totalCreditsCompleted: z.number(),
  pendingWithdrawal: z.number(),
  pendingDeposit: z.number(),
  pendingOrderEarnings: z.number(),
  totalPending: z.number(),
  totalOrderValue: z.number(),
  totalOrderPayments: z.number(),
  orderCount: z.number(),
  productCount: z.number(),
  orders: z.array(orderBreakdownOut),
  ledger: z.array(ledgerEntryOut),
});
type Finance = z.infer<typeof financeOut>;

// Order-time seller attribution. An order belongs to the sellers who
// carried its products WHEN THE ORDER WAS PLACED — never to a seller who
// added the same product later (that leaked one seller's past earnings
// into another seller's wallet, dashboard and Admin shop grouping).
// Resolution per order:
//   1. order_seller_items snapshot rows written at placement time
//      (exact per-product attribution).
//   2. The seller_notifications rows created at placement time (they
//      name exactly the sellers the order was attributed to then); a
//      seller not among them gets nothing from that order, a seller who
//      is among them keeps the established current-picks item split.
//   3. Notification rows, BUT only when the seller's account already
//      existed when the order was placed. A row created later for a
//      seller who did not exist at order time can only be backfill
//      (the old backfill manufactured rows from current store picks,
//      and it stamped them with the ORDER's date, so the row itself
//      cannot tell genuine from backfilled) — it is not proof.
//   4. Nothing recorded: NOBODY. Never guess from current store picks:
//      a seller who adds a product today must not inherit old orders
//      for it (the ghost-order bug: new seller Ali added the BagNest
//      backpack and instantly "received" old Order #5, Completed, with
//      its profit in his wallet, though he never sold it).
type OrderAttribution = {
  snapByOrder: Map<number, Map<number, Set<number>>>;
  notifByOrder: Map<number, Set<number>>;
  sellerCreatedAt: Map<number, Date>;
  orderCreatedAt: Map<number, Date>;
};

// A seller can only genuinely own an order placed after their account
// was created. Missing dates fail OPEN (preserve old behaviour) —
// real rows always carry both dates.
function sellerExistedAtOrder(attr: OrderAttribution, sellerId: number, orderId: number): boolean {
  const sc = attr.sellerCreatedAt.get(sellerId);
  const oc = attr.orderCreatedAt.get(orderId);
  if (!sc || !oc) return true;
  return sc.getTime() <= oc.getTime();
}

async function loadOrderAttribution(db: Db): Promise<OrderAttribution> {
  const snapByOrder = new Map<number, Map<number, Set<number>>>();
  try {
    const rows = await db.select().from(schema.orderSellerItems);
    for (const r of rows) {
      let bySeller = snapByOrder.get(r.orderId);
      if (!bySeller) { bySeller = new Map(); snapByOrder.set(r.orderId, bySeller); }
      let set = bySeller.get(r.sellerId);
      if (!set) { set = new Set(); bySeller.set(r.sellerId, set); }
      set.add(r.productId);
    }
  } catch { /* table missing on an un-migrated database — fall through */ }
  const notifByOrder = new Map<number, Set<number>>();
  const notifs = await db
    .select({ orderId: schema.sellerNotifications.orderId, sellerId: schema.sellerNotifications.sellerId })
    .from(schema.sellerNotifications);
  for (const n of notifs) {
    let set = notifByOrder.get(n.orderId);
    if (!set) { set = new Set(); notifByOrder.set(n.orderId, set); }
    set.add(n.sellerId);
  }
  const sellerCreatedAt = new Map<number, Date>();
  const userRows = await db.select({ id: schema.users.id, createdAt: schema.users.createdAt }).from(schema.users);
  for (const u of userRows) sellerCreatedAt.set(u.id, u.createdAt);
  const orderCreatedAt = new Map<number, Date>();
  const orderRows = await db.select({ id: schema.orders.id, createdAt: schema.orders.createdAt }).from(schema.orders);
  for (const o of orderRows) orderCreatedAt.set(o.id, o.createdAt);
  return { snapByOrder, notifByOrder, sellerCreatedAt, orderCreatedAt };
}

// The product ids of `orderId` that belong to `sellerId` under the
// order-time attribution rules above. `orderSellerId` is the order row's
// own seller_id: when it is set, the order was placed FOR one named
// seller (the Admin's Quick Send to one shop) and belongs to that seller
// ALONE — never to every seller who happens to carry the same product.
// (Quick Send used to leave seller_id null and fan the order out to all
// carriers, so an order sent to a NEW seller account also showed under
// the OLD account in the Admin Panel, the old seller's Orders and their
// wallet figures.)
function attributedProductIds(
  attr: OrderAttribution,
  orderId: number,
  sellerId: number,
  currentIds: Set<number>,
  orderSellerId?: number | null,
): Set<number> {
  if (orderSellerId != null && sellerId !== orderSellerId) return new Set<number>();
  const snap = attr.snapByOrder.get(orderId);
  if (snap) return snap.get(sellerId) ?? new Set<number>();
  const notif = attr.notifByOrder.get(orderId);
  if (notif) {
    if (!notif.has(sellerId)) return new Set<number>();
    if (!sellerExistedAtOrder(attr, sellerId, orderId)) return new Set<number>();
    return currentIds;
  }
  // Explicit order for this seller (orders.seller_id set at placement,
  // e.g. Admin Quick Send) with no other proof: it IS their order —
  // this is not guessing from current picks. (Without this, the delete
  // flow could not snapshot such an order for the Admin history.)
  if (orderSellerId === sellerId) return currentIds;
  // No order-time proof at all: nobody owns it. (Previously this fell
  // back to current store picks — the ghost-order bug.)
  return new Set<number>();
}

// The sellers `orderId` is attributed to under the same rules, given the
// sellers who carry its products today.
function attributedSellerIds(
  attr: OrderAttribution,
  orderId: number,
  currentSellerIds: number[],
  orderSellerId?: number | null,
): number[] {
  if (orderSellerId != null) return [orderSellerId];
  const snap = attr.snapByOrder.get(orderId);
  if (snap) return [...snap.keys()];
  const notif = attr.notifByOrder.get(orderId);
  if (notif) return currentSellerIds.filter((id) => notif.has(id) && sellerExistedAtOrder(attr, id, orderId));
  // No order-time proof at all: nobody owns it — never guess from
  // current store picks (the ghost-order bug).
  return [];
}

// THE wallet model (one shared computation for every screen):
//  • Ship (Deliver): the order COST moves Available → Pending (held). It
//    is not lost: Total (Available + Pending) does not change.
//  • Admin Approve → Completed: the FULL order value (cost + profit) is
//    credited to Available and the hold clears. Net effect of a completed
//    order on Total is exactly +profit — a completed order never lowers
//    the seller's balance.
//  • Return to Pending / Cancelled: the hold is released back to
//    Available; re-shipping holds the same payment again (no new charge).
//  • Pending = ONLY order cost held for orders in Shipment. Deposit and
//    withdrawal requests awaiting approval are tracked separately
//    (pendingDeposit / pendingWithdrawal) and never enter Pending.
async function computeSellerFinance(db: Db, sellerId: number): Promise<Finance> {
  const picks = await db.select().from(schema.sellerProducts).where(eq(schema.sellerProducts.sellerId, sellerId));
  const myIds = new Set(picks.map((x) => x.productId));
  const attr = await loadOrderAttribution(db);
  // Wallet order payments already made by this seller (reference carries
  // the order number: "Order #<id>"). The payment row is the HOLD: it
  // exists once per order, however many times the order is re-shipped.
  type PayRow = typeof schema.walletTransactions.$inferSelect;
  const payByOrder = new Map<number, PayRow>();
  const allPayRows: PayRow[] = [];
  {
    const payRows = await db.select().from(schema.walletTransactions).where(eq(schema.walletTransactions.sellerId, sellerId));
    for (const r of payRows) {
      if (r.type !== "order_payment" || r.status !== "completed") continue;
      allPayRows.push(r);
      const m = r.reference.match(/Order #(\d+)/);
      if (m && !payByOrder.has(parseInt(m[1]!, 10))) payByOrder.set(parseInt(m[1]!, 10), r);
    }
  }
  const consumedPayIds = new Set<number>();
  type Raw = { id: string; kind: string; amount: number; direction: string; method: string; reference: string; note: string; status: string; createdAt: string; sortAt: number; effect: number; hasScreenshot?: boolean };
  const raw: Raw[] = [];
  const ordersBd: z.infer<typeof orderBreakdownOut>[] = [];
  let earningsCleared = 0;
  let completionCredits = 0;
  let pendingOrderHolds = 0;
  let totalOrderValue = 0;
  let orderCount = 0;
  let usedAmount = 0;
  let totalOrderPayments = 0;
  // Cost restored by the correction for orders completed under the old
  // profit-only credit (see the balance_correction ledger line below).
  let correctionTotal = 0;
  let correctionAt = 0;
  {
    const allOrders = await db.select().from(schema.orders).orderBy(asc(schema.orders.id));
    for (const o of allOrders) {
      // Payment gate: a prepaid order whose payment is still under
      // verification (or was rejected) is NOT a seller order — it adds
      // no figures, holds, counts or ledger lines to any wallet.
      if (o.paymentStatus === "pending" || o.paymentStatus === "rejected") continue;
      // Order-time attribution: only the products this seller carried
      // when the order was placed count — never products added later.
      const attrIds = attributedProductIds(attr, o.id, sellerId, myIds, o.sellerId);
      if (attrIds.size === 0) continue;
      const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, o.id));
      const mine = items.filter((it) => attrIds.has(it.productId));
      if (mine.length === 0) continue;
      const orderAmount = mine.reduce((s, it) => s + it.buyerPrice * it.qty, 0);
      const profit = mine.reduce((s, it) => s + it.profitAmount * it.qty, 0);
      const payableCost = mine.reduce((s, it) => s + it.basePrice * it.qty, 0);
      const names: string[] = [];
      for (const it of mine) {
        const pr = await db.select({ name: schema.products.name }).from(schema.products).where(eq(schema.products.id, it.productId)).limit(1);
        names.push(`${pr[0]?.name ?? "Product"} × ${it.qty}`);
      }
      const pay = payByOrder.get(o.id);
      if (pay) consumedPayIds.add(pay.id);
      const paid = !!pay;
      if (o.status === "Cancelled") {
        // A cancelled order releases any held cost back to Available:
        // the hold line is shown as released with no effect.
        if (paid) {
          raw.push({ id: `release-${o.id}`, kind: "order_payment_released", amount: payableCost, direction: "debit", method: "Order Payment Held", reference: `Order #${o.id}`, note: "Order cancelled — the held amount was released back to Available. Nothing was charged for this order.", status: "released", createdAt: pay.createdAt.toISOString(), sortAt: pay.createdAt.getTime(), effect: 0 });
        }
        continue;
      }
      totalOrderValue += orderAmount;
      orderCount += 1;
      let clearedAmount = 0;
      let pendingAmount = 0;
      if (o.status === "Delivered") {
        // Completion credit: the FULL order value when the seller paid
        // the cost from the wallet (the held cost comes back inside this
        // credit, plus the profit). Orders completed without a wallet
        // payment credit their profit only — no cost was ever held.
        const credit = paid ? orderAmount : profit;
        completionCredits += credit;
        earningsCleared += profit;
        clearedAmount = credit;
        if (paid) {
          raw.push({ id: `hold-${o.id}`, kind: "order_payment_held", amount: payableCost, direction: "debit", method: "Order Payment Held", reference: `Order #${o.id}`, note: "Order cost held while this order was in Shipment.", status: "completed", createdAt: pay.createdAt.toISOString(), sortAt: pay.createdAt.getTime(), effect: -payableCost });
          correctionTotal += payableCost;
          const cAt = pay.createdAt.getTime() + 1000;
          if (cAt > correctionAt) correctionAt = cAt;
          raw.push({ id: `completed-${o.id}`, kind: "order_completed", amount: credit, direction: "credit", method: "Order Completed", reference: `Order #${o.id}`, note: `Full order value credited (+₹${credit.toLocaleString("en-IN")}) — includes ₹${profit.toLocaleString("en-IN")} profit. The held cost is back in your Available Balance.`, status: "completed", createdAt: new Date(cAt).toISOString(), sortAt: cAt, effect: credit });
          usedAmount += payableCost;
          totalOrderPayments += payableCost;
        } else {
          raw.push({ id: `completed-${o.id}`, kind: "order_completed", amount: credit, direction: "credit", method: "Order Completed", reference: `Order #${o.id}`, note: "Order profit credited to your Available Balance.", status: "completed", createdAt: o.createdAt.toISOString(), sortAt: o.createdAt.getTime(), effect: credit });
        }
      } else if (o.status === "Shipped") {
        if (paid) {
          pendingOrderHolds += payableCost;
          pendingAmount = payableCost;
          raw.push({ id: `hold-${o.id}`, kind: "order_payment_held", amount: payableCost, direction: "debit", method: "Order Payment Held", reference: `Order #${o.id}`, note: "Order cost held in Pending until delivery is approved by Customer Service.", status: "pending", createdAt: pay.createdAt.toISOString(), sortAt: pay.createdAt.getTime(), effect: -payableCost });
          usedAmount += payableCost;
          totalOrderPayments += payableCost;
        }
      } else if (paid) {
        // Pending / Confirmed with a payment on record = returned by the
        // Admin after a first ship: the hold is released back to
        // Available, and re-shipping holds the same payment again.
        raw.push({ id: `release-${o.id}`, kind: "order_payment_released", amount: payableCost, direction: "debit", method: "Order Payment Held", reference: `Order #${o.id}`, note: "This order is back in Pending — the held amount was returned to your Available Balance. Shipping it again holds the same amount again, with no extra charge.", status: "released", createdAt: pay.createdAt.toISOString(), sortAt: pay.createdAt.getTime(), effect: 0 });
      }
      ordersBd.push({ orderId: o.id, createdAt: o.createdAt.toISOString(), productNames: names.join(", "), orderAmount, profit, clearedAmount, pendingAmount, status: o.status, payableCost, paidFromWallet: paid });
    }
  }
  // Orphan order payments (their order no longer exists): keep the
  // deduction visible so the ledger always reconciles to Available.
  for (const r of allPayRows) {
    if (consumedPayIds.has(r.id)) continue;
    usedAmount += r.amount;
    totalOrderPayments += r.amount;
    raw.push({ id: `tx-${r.id}`, kind: "order_payment_held", amount: r.amount, direction: "debit", method: r.method || "Wallet", reference: r.reference, note: r.note, status: r.status, createdAt: r.createdAt.toISOString(), sortAt: r.createdAt.getTime(), effect: -r.amount });
  }
  // Balance Correction — completed orders: orders completed under the
  // old model were credited profit only, so their held cost never came
  // back. Under the corrected model the Order Completed credit above is
  // the full order value; this ONE line records the total cost restored
  // by that correction. It is a record of the correction (the money is
  // already inside the Order Completed credits), so its effect is 0 and
  // nothing is credited twice.
  if (correctionTotal > 0) {
    raw.push({ id: "balance-correction", kind: "balance_correction", amount: correctionTotal, direction: "credit", method: "Balance Correction — completed orders", reference: "", note: "Completed orders were previously credited profit only. They now credit the full order value (cost + profit), so this held cost is restored inside the Order Completed credits above — this line records the correction and is not an extra credit.", status: "completed", createdAt: new Date(correctionAt + 1000).toISOString(), sortAt: correctionAt + 1000, effect: 0 });
  }
  const rows = await db.select().from(schema.walletTransactions).where(eq(schema.walletTransactions.sellerId, sellerId)).orderBy(asc(schema.walletTransactions.id));
  let totalDeposited = 0;
  let totalAdminCredit = 0;
  let pendingWithdrawal = 0;
  let pendingDeposit = 0;
  // Withdrawals ACTUALLY paid out + deposits ACTUALLY credited, for the
  // wallet's Total Withdrawn / Total Deposited section. Built in the
  // same single pass as the ledger so the section can never disagree
  // with it. Pending / rejected requests are never added here. Direct
  // Admin Panel movements count too, each exactly once: a completed
  // Customer Service Credit is a deposit (below), and a completed
  // direct Admin Withdrawal is a withdrawal (below).
  let totalWithdrawn = 0;
  const withdrawalsList: z.infer<typeof withdrawalOut>[] = [];
  const depositsList: z.infer<typeof depositCreditOut>[] = [];
  for (const r of rows) {
    if (r.type === "deposit" && r.status === "approved") { totalDeposited += r.amount; depositsList.push({ id: r.id, kind: "deposit", amount: r.amount, method: r.method, reference: r.reference, note: r.note, createdAt: r.createdAt.toISOString() }); raw.push({ id: `tx-${r.id}`, kind: "deposit", amount: r.amount, direction: "credit", method: r.method, reference: r.reference, note: r.note, status: r.status, createdAt: r.createdAt.toISOString(), sortAt: r.createdAt.getTime(), effect: r.amount, hasScreenshot: !!r.screenshotBlobKey }); }
    else if (r.type === "deposit" && r.status === "pending") { pendingDeposit += r.amount; raw.push({ id: `tx-${r.id}`, kind: "deposit", amount: r.amount, direction: "credit", method: r.method, reference: r.reference, note: r.note, status: r.status, createdAt: r.createdAt.toISOString(), sortAt: r.createdAt.getTime(), effect: 0, hasScreenshot: !!r.screenshotBlobKey }); }
    else if (r.type === "deposit") { raw.push({ id: `tx-${r.id}`, kind: "deposit", amount: r.amount, direction: "credit", method: r.method, reference: r.reference, note: r.note, status: r.status, createdAt: r.createdAt.toISOString(), sortAt: r.createdAt.getTime(), effect: 0, hasScreenshot: !!r.screenshotBlobKey }); }
    else if (r.type === "admin_credit") { if (r.status === "completed") { totalAdminCredit += r.amount; totalDeposited += r.amount; depositsList.push({ id: r.id, kind: "admin_credit", amount: r.amount, method: "Customer Service Credit", reference: "Added by Customer Service", note: r.note, createdAt: r.createdAt.toISOString() }); } raw.push({ id: `tx-${r.id}`, kind: "admin_credit", amount: r.amount, direction: "credit", method: "Customer Service Credit", reference: "Added by Customer Service", note: r.note, status: r.status, createdAt: r.createdAt.toISOString(), sortAt: r.createdAt.getTime(), effect: r.status === "completed" ? r.amount : 0 }); }
    else if (r.type === "withdraw" && r.status === "completed") { usedAmount += r.amount; totalWithdrawn += r.amount; withdrawalsList.push({ id: r.id, kind: "paid_request", amount: r.amount, method: [r.method, r.reference].filter((x) => x && x.trim()).join(" · "), paymentReference: r.paymentReference ?? "", note: r.note, status: "Paid", createdAt: (r.paidAt ?? r.createdAt).toISOString() }); raw.push({ id: `tx-${r.id}`, kind: "withdraw", amount: r.amount, direction: "debit", method: r.method, reference: r.reference, note: r.note, status: r.status, createdAt: r.createdAt.toISOString(), sortAt: r.createdAt.getTime(), effect: -r.amount }); }
    else if (r.type === "withdraw" && r.status === "paid") {
      // Paid out by the Admin from the Admin Panel (Pay & Withdraw). This
      // is the SAME row that held the amount while pending, so the effect
      // stays exactly one −amount: the hold becomes the deduction, never a
      // second one. The ledger line is the payout line for this request.
      usedAmount += r.amount;
      totalWithdrawn += r.amount;
      const paidWhen = r.paidAt ?? r.createdAt;
      withdrawalsList.push({ id: r.id, kind: "paid_request", amount: r.amount, method: [r.method, r.reference].filter((x) => x && x.trim()).join(" · "), paymentReference: r.paymentReference ?? "", note: r.note, status: "Paid", createdAt: paidWhen.toISOString() });
      const noteParts = [r.details, r.reference ? `Payout: ${r.method} · ${r.reference}` : "", r.paymentReference ? `Payment Ref: ${r.paymentReference}` : "", r.note].filter((x) => x && x.trim());
      raw.push({ id: `tx-${r.id}`, kind: "withdraw_paid", amount: r.amount, direction: "debit", method: r.method, reference: `Request #${r.id}`, note: noteParts.join(" · "), status: "paid", createdAt: paidWhen.toISOString(), sortAt: paidWhen.getTime(), effect: -r.amount });
    }
    else if (r.type === "withdraw" && r.status === "pending") { pendingWithdrawal += r.amount; raw.push({ id: `tx-${r.id}`, kind: "withdraw", amount: r.amount, direction: "debit", method: r.method, reference: r.reference, note: r.note, status: r.status, createdAt: r.createdAt.toISOString(), sortAt: r.createdAt.getTime(), effect: -r.amount }); }
    else if (r.type === "withdraw") { raw.push({ id: `tx-${r.id}`, kind: "withdraw", amount: r.amount, direction: "debit", method: r.method, reference: r.reference, note: r.note, status: r.status, createdAt: r.createdAt.toISOString(), sortAt: r.createdAt.getTime(), effect: 0 }); }
    else if (r.type === "admin_withdraw") { if (r.status === "completed") { usedAmount += r.amount; totalWithdrawn += r.amount; withdrawalsList.push({ id: r.id, kind: "admin_withdraw", amount: r.amount, method: "Customer Service Withdrawal", paymentReference: "", note: r.note, status: "Paid", createdAt: r.createdAt.toISOString() }); } raw.push({ id: `tx-${r.id}`, kind: "admin_withdraw", amount: r.amount, direction: "debit", method: "Customer Service Withdrawal", reference: "", note: r.note, status: r.status, createdAt: r.createdAt.toISOString(), sortAt: r.createdAt.getTime(), effect: r.status === "completed" ? -r.amount : 0 }); }
    // order_payment rows are handled in the order loop above (the hold
    // and its release/completion depend on the order's status) — never
    // counted a second time here.
  }
  raw.sort((a, b) => a.sortAt - b.sortAt || a.id.localeCompare(b.id));
  let running = 0;
  const ledgerAsc = raw.map((e) => { running += e.effect; return { id: e.id, kind: e.kind, amount: e.amount, direction: e.direction, method: e.method, reference: e.reference, note: e.note, status: e.status, runningBalance: running, createdAt: e.createdAt, hasScreenshot: e.hasScreenshot ?? false }; });
  const availableBalance = running;
  // totalDeposited already includes completed Admin credits (they are
  // deposits now), so totalAdminCredit must NOT be added again here —
  // each credit is counted exactly once.
  const totalCreditsCompleted = totalDeposited + completionCredits;
  // Pending is ONLY order cost held for orders in Shipment. Pending
  // deposit / withdrawal requests stay separate figures and are never
  // added into Pending (pendingOrderEarnings is retired: order profit
  // is not pending money — it arrives inside the completion credit).
  const pendingOrderEarnings = 0;
  const totalPending = pendingOrderHolds;
  const totalBalance = availableBalance + pendingOrderHolds;
  ordersBd.sort((a, b) => b.orderId - a.orderId);
  withdrawalsList.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  depositsList.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  return { sellerId, availableBalance, totalBalance, pendingOrderHolds, usedAmount, totalDeposited, totalWithdrawn, withdrawals: withdrawalsList, deposits: depositsList, totalAdminCredit, earningsCleared, totalCreditsCompleted, pendingWithdrawal, pendingDeposit, pendingOrderEarnings, totalPending, totalOrderValue, totalOrderPayments, orderCount, productCount: picks.length, orders: ordersBd, ledger: ledgerAsc.slice().reverse() };
}

async function toSellerApplicationFull(db: Db, u: UserRow): Promise<SellerApplication> {
  const base = toSellerApplication(u);
  const f = await computeSellerFinance(db, u.id);
  return { ...base, walletBalance: f.availableBalance, totalBalance: f.totalBalance, pendingOrderHolds: f.pendingOrderHolds, totalDeposited: f.totalDeposited, totalWithdrawn: f.totalWithdrawn, earnings: f.earningsCleared, productCount: f.productCount, orderCount: f.orderCount, totalSales: f.totalOrderValue, usedAmount: f.usedAmount, pendingWithdrawal: f.pendingWithdrawal, pendingDeposit: f.pendingDeposit, pendingOrderEarnings: f.pendingOrderEarnings, totalPending: f.totalPending, totalOrderValue: f.totalOrderValue, totalAdminCredit: f.totalAdminCredit };
}

const orderOut = z.object({
  id: z.number(),
  buyerId: z.number(),
  sellerId: z.number().nullable(),
  customerName: z.string(),
  phone: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  pinCode: z.string(),
  paymentMethod: z.string(),
  // Prepaid proof: the typed transaction reference ("" for COD) and
  // whether a payment screenshot is attached (Admin views it via
  // getOrderPaymentProofUrl).
  paymentReference: z.string(),
  hasPaymentProof: z.boolean(),
  // Prepaid payment verification gate (buyer Pay First orders only):
  // "none" | "pending" (under verification) | "verified" | "rejected",
  // plus the Admin's written rejection reason ("" unless rejected).
  paymentStatus: z.string(),
  paymentRejectReason: z.string(),
  placedBy: z.string(),
  total: z.number(),
  status: z.string(),
  codConfirmed: z.number(),
  codConfirmedAt: z.string().nullable(),
  createdAt: z.string(),
  items: z.array(
    z.object({
      productId: z.number(),
      productName: z.string(),
      qty: z.number(),
      basePrice: z.number(),
      profitPercent: z.number(),
      profitAmount: z.number(),
      buyerPrice: z.number(),
    }),
  ),
});

type OrderRow = typeof schema.orders.$inferSelect;

async function toOrderOut(db: Db, o: OrderRow) {
  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, o.id));
  const withNames = await Promise.all(
    items.map(async (it) => {
      const p = await db
        .select({ name: schema.products.name })
        .from(schema.products)
        .where(eq(schema.products.id, it.productId))
        .limit(1);
      return {
        productId: it.productId,
        productName: p[0]?.name ?? "Product",
        qty: it.qty,
        basePrice: it.basePrice,
        profitPercent: it.profitPercent,
        profitAmount: it.profitAmount,
        buyerPrice: it.buyerPrice,
      };
    }),
  );
  return {
    id: o.id,
    buyerId: o.buyerId,
    sellerId: o.sellerId,
    // Admin-sent orders always DISPLAY as a customer order — the source
    // label reads "Order by Customer" on every surface. The internal
    // placedBy marker stays in the data only.
    customerName: o.placedBy === "admin" ? "Order by Customer" : o.customerName,
    phone: o.phone,
    address: o.address,
    city: o.city,
    state: o.state,
    pinCode: o.pinCode,
    paymentMethod: o.paymentMethod,
    paymentReference: o.paymentReference ?? "",
    hasPaymentProof: !!o.paymentProofBlobKey,
    paymentStatus: o.paymentStatus ?? "none",
    paymentRejectReason: o.paymentRejectReason ?? "",
    placedBy: o.placedBy ?? "customer",
    total: o.total,
    status: o.status,
    codConfirmed: o.codConfirmed ?? 0,
    codConfirmedAt: o.codConfirmedAt ? o.codConfirmedAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
    items: withNames,
  };
}

const ticketOut = z.object({
  id: z.number(),
  userId: z.number().nullable(),
  name: z.string(),
  email: z.string(),
  subject: z.string(),
  message: z.string(),
  status: z.string(),
  reply: z.string().nullable(),
  createdAt: z.string(),
});

type TicketRow = typeof schema.tickets.$inferSelect;

function toTicketOut(t: TicketRow) {
  return {
    id: t.id,
    userId: t.userId,
    name: t.name,
    email: t.email,
    subject: t.subject,
    message: t.message,
    status: t.status,
    reply: t.reply,
    createdAt: t.createdAt.toISOString(),
  };
}

const chatMessageOut = z.object({
  id: z.number(),
  userId: z.number(),
  sender: z.enum(["customer", "admin"]),
  message: z.string(),
  hasAttachment: z.boolean(),
  attachmentFileName: z.string().nullable(),
  attachmentContentType: z.string().nullable(),
  attachmentSize: z.number().nullable(),
  createdAt: z.string(),
});

type ChatRow = typeof schema.chatMessages.$inferSelect;

function toChatOut(m: ChatRow) {
  return {
    id: m.id,
    userId: m.userId,
    sender: m.sender,
    message: m.message,
    hasAttachment: !!m.attachmentBlobKey,
    attachmentFileName: m.attachmentFileName ?? null,
    attachmentContentType: m.attachmentContentType ?? null,
    attachmentSize: m.attachmentSize ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

// Chat attachments (payment proof etc.): images (JPG/PNG) and PDF only,
// max 3 MB — the same validation style as the seller document uploads.
// Returns either the stored blob metadata or a written error.
const CHAT_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "application/pdf"];
// Magic-bytes check: the declared content-type must match the file's
// actual bytes, so a mislabeled upload cannot be served under a type
// it is not (defense in depth alongside the blob nosniff header).
function sniffFileType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return "application/pdf";
  return null;
}

async function storeChatAttachment(
  ctx: Ctx,
  att: { fileName: string; contentType: string; dataBase64: string },
): Promise<
  | { ok: true; blobKey: string; fileName: string; contentType: string; size: number }
  | { ok: false; error: string }
> {
  if (!CHAT_ATTACHMENT_TYPES.includes(att.contentType)) {
    return { ok: false, error: "Only JPG, PNG or PDF files can be attached in chat. Please choose an image or a PDF document." };
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(att.dataBase64, "base64"));
  } catch {
    return { ok: false, error: "The file could not be read. Please try again." };
  }
  if (bytes.length === 0) return { ok: false, error: "The selected file is empty." };
  if (sniffFileType(bytes) !== att.contentType) {
    return { ok: false, error: "The file's contents do not match its type — please choose a genuine JPG, PNG or PDF file." };
  }
  if (bytes.length > 3 * 1024 * 1024) {
    return { ok: false, error: "File is too large — maximum 3 MB. Please choose a smaller photo or document." };
  }
  const safe = att.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "attachment";
  const key = `chat-attachments/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safe}`;
  await ctx.blobs.put(key, bytes, { contentType: att.contentType });
  return { ok: true, blobKey: key, fileName: att.fileName, contentType: att.contentType, size: bytes.length };
}

const chatAttachmentArg = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  dataBase64: z.string().min(1).max(6000000),
});

// Deposit payment screenshots: JPG/PNG images ONLY, max 3 MB (the same
// size limit as the other uploads). A seller attaches one to a deposit
// request instead of — or as well as — typing the Transaction Hash /
// Reference; for USDT deposits one of the two is required. Stored as a
// blob on the wallet_transactions row; the Admin views it from the
// wallet request before approving (getDepositScreenshotUrl).
const DEPOSIT_SCREENSHOT_TYPES = ["image/jpeg", "image/png"];
const DEPOSIT_SCREENSHOT_MAX = 3 * 1024 * 1024;
async function storeDepositScreenshot(
  ctx: Ctx,
  att: { fileName: string; contentType: string; dataBase64: string },
): Promise<
  | { ok: true; blobKey: string; fileName: string; contentType: string; size: number }
  | { ok: false; error: string }
> {
  if (!DEPOSIT_SCREENSHOT_TYPES.includes(att.contentType)) {
    return { ok: false, error: "Only JPG or PNG images can be attached as a payment screenshot. Please choose an image file (JPG or PNG)." };
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(att.dataBase64, "base64"));
  } catch {
    return { ok: false, error: "The screenshot could not be read. Please try again." };
  }
  if (bytes.length === 0) return { ok: false, error: "The selected screenshot file is empty." };
  if (sniffFileType(bytes) !== att.contentType) {
    return { ok: false, error: "The screenshot's contents do not match its type — please attach a genuine JPG or PNG image." };
  }
  if (bytes.length > DEPOSIT_SCREENSHOT_MAX) {
    return { ok: false, error: "Screenshot is too large — maximum 3 MB. Please choose a smaller image." };
  }
  const safe = att.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "screenshot";
  const key = `deposit-screenshots/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safe}`;
  await ctx.blobs.put(key, bytes, { contentType: att.contentType });
  return { ok: true, blobKey: key, fileName: att.fileName, contentType: att.contentType, size: bytes.length };
}

// Catalog for the main store (Indian platform). Prices are integer INR at
// realistic current Indian market levels (Amazon India / Flipkart / Meesho
// ranges). Seeded once by seedCatalog when the products table is empty, and
// synced by name by ensureIndiaCatalog, which re-prices the original twelve
// products to INR and inserts any missing ones; after that sync every row
// stays editable/deletable in the Admin panel. Image files live in
// client/src/assets (image_asset holds the file name); image_source_url is
// the photo's source page, kept for provenance (null when the search result
// carried no source page).
const STARTER_PRODUCTS: Array<{
  name: string;
  category: string;
  description: string;
  basePrice: number;
  oldPrice: number | null;
  profitPercent: number;
  stock: number;
  imageAsset: string | null;
  imageSourceUrl: string | null;
}> = [
  {
    name: "Wireless Bluetooth Earbuds with Charging Case",
    category: "Electronics",
    description:
      "True wireless earbuds with Bluetooth 5.3, clear call quality, touch controls and up to 24 hours of total playtime with the charging case.",
    basePrice: 1499,
    oldPrice: 2999,
    profitPercent: 20,
    stock: 120,
    imageAsset: "earbuds.jpg",
    imageSourceUrl: "https://casablanca-shop1.youcan.store/products/airpods",
  },
  {
    name: "Portable Bluetooth Speaker — Deep Bass",
    category: "Electronics",
    description:
      "Compact portable speaker with deep bass, 10-hour battery, splash-proof body and hands-free calling. Perfect for home and travel.",
    basePrice: 1999,
    oldPrice: 3999,
    profitPercent: 20,
    stock: 80,
    imageAsset: "speaker.png",
    imageSourceUrl: "https://library.shoplentor.com/home-page-six/",
  },
  {
    name: "Smartwatch with Bluetooth Calling & Fitness Tracking",
    category: "Electronics",
    description:
      "Smartwatch with Bluetooth calling, heart-rate and step tracking, multiple sports modes and a bright round display. Android and iOS compatible.",
    basePrice: 1999,
    oldPrice: 3999,
    profitPercent: 25,
    stock: 90,
    imageAsset: "smartwatch.webp",
    imageSourceUrl:
      "https://www.flipkart.com/wearable-smart-devices/pr?sid=ajy&p%5B%5D=facets.discount_range_v1%255B%255D%3D40%2525+or+more&otracker=categorytree&sort=price_asc&p%5B%5D=facets.fulfilled_by%255B%255D%3DPlus+%2528FAssured%2529&p%5B%5D=facets.brand%255B%255D%3DboAt&p%5B%5D=facets.availability%255D%3DExclude+Out+of+Stock&affid=adminnxtify&affExtParam1=EPTG1650151&affExtParam2=TzuGkC_p__p_&pwsvid=PW1687533345996STzuGkCRtmwQ8pPr",
  },
  {
    name: "Wireless Neckband Earphones with Mic",
    category: "Electronics",
    description:
      "Lightweight neckband earphones with deep bass, built-in mic for calls and up to 20 hours of playback on a single charge.",
    basePrice: 799,
    oldPrice: 1599,
    profitPercent: 25,
    stock: 150,
    imageAsset: "neckband.jpg",
    imageSourceUrl: "https://evmzone.com/evm-products/bluetooth-neckband.html",
  },
  {
    name: "20000mAh Fast-Charging Power Bank",
    category: "Electronics",
    description:
      "20000mAh power bank with 22.5W fast charging, dual USB output plus Type-C port and LED battery indicator. Charges most phones 4–5 times.",
    basePrice: 1299,
    oldPrice: 2499,
    profitPercent: 20,
    stock: 110,
    imageAsset: "powerbank.webp",
    imageSourceUrl: "https://www.souq.com.bd/",
  },
  {
    name: "Over-Ear Bluetooth Headphones with Mic",
    category: "Electronics",
    description:
      "Comfortable over-ear wireless headphones with soft cushioned ear cups, 40 hours of playback, built-in mic and foldable design.",
    basePrice: 1799,
    oldPrice: 3499,
    profitPercent: 20,
    stock: 70,
    imageAsset: "headphones.jpg",
    imageSourceUrl:
      "https://joincheckmate.com/products/01g4s4frn4vbdpd0ntckz32dtx/0db2e86fc9dbc28d723e1d44902e3a11",
  },
  {
    name: "Men's Printed Cotton Kurta — Blue",
    category: "Fashion",
    description:
      "Breathable pure-cotton kurta with a subtle all-over print, band collar and comfortable regular fit. Sizes M, L, XL available.",
    basePrice: 899,
    oldPrice: 1799,
    profitPercent: 25,
    stock: 60,
    imageAsset: "kurta.jpg",
    imageSourceUrl:
      "https://www.houseofindya.com/blue-printed-pure-cotton-kurta-for-men-648632/iprdt?curr=inr",
  },
  {
    name: "Women's Designer Lawn Kurti — Magenta",
    category: "Fashion",
    description:
      "Bright magenta kurti with designer print, soft summer fabric and stitched finishing. Sizes S, M, L available.",
    basePrice: 1099,
    oldPrice: 2199,
    profitPercent: 25,
    stock: 55,
    imageAsset: "kurti.jpg",
    imageSourceUrl:
      "https://www.styleus.co.uk/product/magenta-sapphire-designer-lawn-kurti/",
  },
  {
    name: "Women's Banarasi Silk Saree with Blouse Piece",
    category: "Fashion",
    description:
      "Banarasi-style silk saree with rich woven zari work and an unstitched blouse piece. A festive and wedding-season favourite.",
    basePrice: 1299,
    oldPrice: 2599,
    profitPercent: 25,
    stock: 45,
    imageAsset: "saree.jpg",
    imageSourceUrl:
      "https://gadgetchampions.in/siril-womens-banarasi-silk-saree-kanjivaram-jacquard-sari-with-unstitched-blouse-piece/",
  },
  {
    name: "Men's Cotton Round-Neck T-Shirt",
    category: "Fashion",
    description:
      "Everyday round-neck t-shirt in soft combed cotton with a regular fit. Sizes M, L, XL, XXL available.",
    basePrice: 499,
    oldPrice: 999,
    profitPercent: 25,
    stock: 200,
    imageAsset: "tshirt.jpg",
    imageSourceUrl: "https://www.ayzeze.cz:443/lv/products/69f3fa1b3dc45901c71f5fa4",
  },
  {
    name: "Women's Embroidered Salwar Suit Set",
    category: "Fashion",
    description:
      "Three-piece salwar suit set with delicate thread embroidery: kurta, bottom and dupatta in breathable summer fabric.",
    basePrice: 1499,
    oldPrice: 2999,
    profitPercent: 25,
    stock: 40,
    imageAsset: "salwar.jpg",
    imageSourceUrl: null,
  },
  {
    name: "Men's Slim-Fit Stretch Jeans",
    category: "Fashion",
    description:
      "Slim-fit jeans in stretchable denim with a clean faded finish. Waist sizes 28–36 available.",
    basePrice: 999,
    oldPrice: 1999,
    profitPercent: 25,
    stock: 85,
    imageAsset: "jeans.jpg",
    imageSourceUrl: "https://www.desertcart.tn/products/131550438",
  },
  {
    name: "Men's Running Sports Shoes — Lightweight Mesh",
    category: "Shoes",
    description:
      "Lightweight breathable mesh running shoes with cushioned sole for daily jogging, gym and casual wear. UK sizes 6–11.",
    basePrice: 1499,
    oldPrice: 2999,
    profitPercent: 20,
    stock: 75,
    imageAsset: "shoes.jpg",
    imageSourceUrl: "https://www.poizon.am/product/30541096?variant=57809568",
  },
  {
    name: "Women's Flat Sandals — Pink",
    category: "Shoes",
    description:
      "Comfortable flat sandals with cushioned sole and elegant gold-tone strap detail — easy slip-on wear for all day.",
    basePrice: 699,
    oldPrice: 1399,
    profitPercent: 25,
    stock: 90,
    imageAsset: "sandals.jpg",
    imageSourceUrl:
      "https://www.desertcart.ph/products/557254496-khadimswomen-pink-flat-sandals-casual-slip-on-flats-for-ladies",
  },
  {
    name: "Men's Formal Leather Oxford Shoes",
    category: "Shoes",
    description:
      "Classic lace-up Oxford formal shoes with cushioned insole — the right finish for office and occasions. UK sizes 6–11.",
    basePrice: 1799,
    oldPrice: 3599,
    profitPercent: 20,
    stock: 50,
    imageAsset: "formal-shoes.webp",
    imageSourceUrl:
      "https://www.gentleman-shoe.com/products/men's-genuine-leather-formal-oxford-shoes",
  },
  {
    name: "Kids' Lightweight Sports Shoes",
    category: "Shoes",
    description:
      "Light, flexible sports shoes for kids with a non-slip sole and easy velcro-plus-lace fit. For school, play and sports.",
    basePrice: 699,
    oldPrice: 1399,
    profitPercent: 20,
    stock: 95,
    imageAsset: "kids-shoes.jpg",
    imageSourceUrl: "https://umayshop.kz/product/1982971862074273793",
  },
  {
    name: "Men's Chronograph Watch — Silver Steel",
    category: "Watches",
    description:
      "Silver-toned chronograph-look wrist watch with stainless steel strap, butterfly clasp and water resistance for daily wear.",
    basePrice: 2999,
    oldPrice: 5999,
    profitPercent: 30,
    stock: 40,
    imageAsset: "mens-watch.jpg",
    imageSourceUrl: "https://www.ajio.com/s/watches-232072?page=498",
  },
  {
    name: "Women's Rose Gold Analog Watch",
    category: "Watches",
    description:
      "Elegant rose gold analog watch for women with a slim dial and comfortable strap — a perfect gift piece.",
    basePrice: 1499,
    oldPrice: 2999,
    profitPercent: 30,
    stock: 45,
    imageAsset: "ladies-watch.jpg",
    imageSourceUrl:
      "https://www.flipkart.com/iloz-analog-watch-girls/p/itm24b979440a6a6",
  },
  {
    name: "Men's Minimalist Leather Strap Watch",
    category: "Watches",
    description:
      "Clean minimalist dial on a genuine leather strap — a versatile analog watch for office and casual wear.",
    basePrice: 1999,
    oldPrice: 3999,
    profitPercent: 30,
    stock: 55,
    imageAsset: "leather-watch.jpg",
    imageSourceUrl:
      "https://fado.vn/de/amazon/mens-watches-minimalist-leather-strap-analogue-waterproof-watch-B0CYT3531H.html",
  },
  {
    name: "Men's Digital Sports Watch — Waterproof",
    category: "Watches",
    description:
      "Rugged digital sports watch with stopwatch, alarm, LED backlight and water resistance — built for training and outdoors.",
    basePrice: 899,
    oldPrice: 1799,
    profitPercent: 30,
    stock: 130,
    imageAsset: "digital-watch.png",
    imageSourceUrl:
      "https://www.kilimall.co.ke/listing/1000222845-new-sports-digital-watch-for-men-waterproof-electronic-countdown-mens-wristwatches-military-clock--sports-watcheswatch-gift-box?skuId=10000614547&source=store-allProduct-",
  },
  {
    name: "Non-Stick Cookware Set — 8 Pieces",
    category: "Home & Kitchen",
    description:
      "8-piece non-stick cookware set with glass lids: pots in three sizes plus a frying pan. Even heating, easy to clean, gas-stove friendly.",
    basePrice: 2999,
    oldPrice: 5499,
    profitPercent: 20,
    stock: 30,
    imageAsset: "cookware.jpg",
    imageSourceUrl: "https://zoeproducts.co/product-category/home-and-kitchen/",
  },
  {
    name: "Stainless Steel Electric Kettle — 1.8L",
    category: "Home & Kitchen",
    description:
      "1.8 litre cordless electric kettle in stainless steel with fast boiling, auto shut-off and heat-protection handle.",
    basePrice: 1099,
    oldPrice: 1999,
    profitPercent: 20,
    stock: 65,
    imageAsset: "kettle.jpg",
    imageSourceUrl:
      "https://af.zssydq.com/blog/can-i-use-an-electric-kettle-to-make-oolong-tea-1637364.html",
  },
  {
    name: "750W Mixer Grinder with 3 Jars",
    category: "Home & Kitchen",
    description:
      "750 watt mixer grinder with three stainless steel jars for chutneys, spices and smoothies, overload protection and sturdy ABS body.",
    basePrice: 2799,
    oldPrice: 5499,
    profitPercent: 20,
    stock: 35,
    imageAsset: "mixer.jpg",
    imageSourceUrl: "https://picmasa.com/explore/amazonfresh-india",
  },
  {
    name: "Aluminium Pressure Cooker — 5 Litre",
    category: "Home & Kitchen",
    description:
      "5 litre aluminium pressure cooker with precision weight valve and comfortable heat-resistant handles. Gas and induction friendly base.",
    basePrice: 1499,
    oldPrice: 2999,
    profitPercent: 20,
    stock: 60,
    imageAsset: "cooker.webp",
    imageSourceUrl:
      "https://www.indiamart.com/proddetail/5l-stainless-steel-pressure-cooker-2851300201212.html",
  },
  {
    name: "Ceramic Dinner Set — 18 Pieces",
    category: "Home & Kitchen",
    description:
      "18-piece ceramic dinner set for six: dinner plates, side plates and bowls with a glazed finish. Microwave and dishwasher safe.",
    basePrice: 1999,
    oldPrice: 3999,
    profitPercent: 20,
    stock: 25,
    imageAsset: "dinner-set.webp",
    imageSourceUrl:
      "https://www.alibaba.es/product-detail/king-the-latest-design-round-shape_10000002795146.html",
  },
  {
    name: "Cotton Double Bedsheet with 2 Pillow Covers",
    category: "Home & Kitchen",
    description:
      "Traditional printed cotton double bedsheet with two matching pillow covers. Soft, breathable and colour-fast.",
    basePrice: 799,
    oldPrice: 1599,
    profitPercent: 20,
    stock: 70,
    imageAsset: "bedsheet.webp",
    imageSourceUrl:
      "https://gursimcrafts.com/product/rajasthani-traditionally-printed-cotton-doublebed-bedsheet-with-pack-of-2-pillow-covers/",
  },
  {
    name: "Vitamin C Face Serum — 30ml",
    category: "Beauty",
    description:
      "Vitamin C face serum with hyaluronic acid for brighter, hydrated skin. 30ml dropper bottle, suitable for all skin types.",
    basePrice: 499,
    oldPrice: 999,
    profitPercent: 35,
    stock: 150,
    imageAsset: "serum.jpg",
    imageSourceUrl:
      "https://m.hindi.oemodmcosmetics.com/hindi/sale-46784233-vitamin-c-liquid-face-serum-skin-lightening-serum-face-care-hyaluronic-acid-serum.html",
  },
  {
    name: "Sunscreen Lotion SPF 50 — 200ml",
    category: "Beauty",
    description:
      "Broad-spectrum SPF 50 sunscreen lotion with UVA/UVB protection. Non-greasy, water-resistant formula for daily use.",
    basePrice: 349,
    oldPrice: 699,
    profitPercent: 30,
    stock: 140,
    imageAsset: "sunscreen.jpg",
    imageSourceUrl:
      "https://awaywedding.com/product_details/12016969/bondi-sands-sunscreen-spf50+-lotion-200ml",
  },
  {
    name: "Gentle Foaming Face Wash — 150ml",
    category: "Beauty",
    description:
      "Gentle foaming face wash for combination and oily skin. Cleans deeply without drying, for a fresh morning and night routine.",
    basePrice: 249,
    oldPrice: 499,
    profitPercent: 30,
    stock: 180,
    imageAsset: "facewash.webp",
    imageSourceUrl: "https://melionsbrothers.com/collections/derma-care",
  },
  {
    name: "Moisturising Body Lotion — 400ml",
    category: "Beauty",
    description:
      "Intensive moisturising body lotion for dry skin — fast-absorbing, non-sticky and lightly scented. 400ml family pack.",
    basePrice: 399,
    oldPrice: 799,
    profitPercent: 30,
    stock: 120,
    imageAsset: "lotion.jpg",
    imageSourceUrl: "https://incibeauty.com/produit/8717163673065",
  },
  {
    name: "Matte Lipstick Set — 6 Shades",
    category: "Cosmetics",
    description:
      "Set of 6 mousse matte lipsticks in everyday-to-party shades. Long-lasting, waterproof colour that stays comfortable on the lips.",
    basePrice: 399,
    oldPrice: 799,
    profitPercent: 35,
    stock: 160,
    imageAsset: "lipstick.jpg",
    imageSourceUrl:
      "https://www.desertcart.fi/products/494347536-6pcs-matte-lipstick-makeup-set-classic-colors-lipstick-waterproof-long",
  },
  {
    name: "Liquid Foundation — Natural Matte Finish",
    category: "Cosmetics",
    description:
      "Liquid foundation with a natural matte finish and buildable medium coverage. Pump bottle for clean, easy application.",
    basePrice: 349,
    oldPrice: 699,
    profitPercent: 35,
    stock: 130,
    imageAsset: "foundation.jpg",
    imageSourceUrl:
      "https://ar.gzdsbottle.com/auraglass-premium-liquid-foundation-pump-bottle-series",
  },
  {
    name: "Intense Black Kajal Pencil",
    category: "Cosmetics",
    description:
      "Intense black kajal pencil with a smooth, smudge-resistant finish — one stroke is enough for a bold everyday look.",
    basePrice: 149,
    oldPrice: 299,
    profitPercent: 35,
    stock: 300,
    imageAsset: "kajal.webp",
    imageSourceUrl: "https://www.nykaa.com/shopaarel-eye-kajal-pencil/p/18185645",
  },
  {
    name: "All-in-One Makeup Kit Combo",
    category: "Cosmetics",
    description:
      "Complete makeup kit in a carry case: eyeshadow palettes, lipsticks, blush, foundation cakes, brushes, mascara and eyeliner — everything in one box.",
    basePrice: 899,
    oldPrice: 1799,
    profitPercent: 30,
    stock: 60,
    imageAsset: "makeup-kit.jpg",
    imageSourceUrl:
      "https://www.shopabunda.com/products/professional-makeup-kit-for-women-full-kit-with-mirror-58-colors-all-in-one-make-up-gift-set-combination-with-eyeshadow-compact-powder-blush-lipstick-lip-liner-eyebrow-pencil-glitter-powder-eyeliner-mascara-cosmetic-case-for-girls-100-n",
  },
  {
    name: "Nail Polish Set — 6 Glossy Shades",
    category: "Cosmetics",
    description:
      "Set of 6 glossy nail polishes in popular shades with a quick-dry, chip-resistant formula.",
    basePrice: 299,
    oldPrice: 599,
    profitPercent: 35,
    stock: 170,
    imageAsset: "nail-polish.jpg",
    imageSourceUrl: null,
  },
  {
    name: "Waterproof Liquid Eyeliner",
    category: "Cosmetics",
    description:
      "Waterproof liquid eyeliner with a fine felt tip for sharp lines that stay put all day without smudging.",
    basePrice: 199,
    oldPrice: 399,
    profitPercent: 35,
    stock: 220,
    imageAsset: "eyeliner.jpg",
    imageSourceUrl: "https://sastokhoj.com/product/pudaier-waterproof-kajal-1-5gm/",
  },
  {
    name: "Oil-Control Compact Powder",
    category: "Cosmetics",
    description:
      "2-in-1 oil-control compact powder for a fresh matte look that lasts for hours. Includes mirror and puff.",
    basePrice: 249,
    oldPrice: 499,
    profitPercent: 35,
    stock: 150,
    imageAsset: "compact.webp",
    imageSourceUrl: "https://www.shryoan.com/products/2-in-1-oil-control-compact-powder-4",
  },
  {
    name: "Women's Leather Handbag — Tan",
    category: "Bags",
    description:
      "Spacious tan handbag in premium PU leather with top handle, shoulder strap and inner zip pockets for daily essentials.",
    basePrice: 1599,
    oldPrice: 3199,
    profitPercent: 25,
    stock: 50,
    imageAsset: "handbag.jpg",
    imageSourceUrl: "https://www.semashow.com/how-to-sell-my-purse-online/",
  },
  {
    name: "Anti-Theft Laptop Backpack with USB Port",
    category: "Bags",
    description:
      "Water-repellent laptop backpack for up to 15.6 inch laptops with anti-theft pocket, USB charging port and padded straps.",
    basePrice: 1199,
    oldPrice: 2399,
    profitPercent: 25,
    stock: 65,
    imageAsset: "backpack.jpg",
    imageSourceUrl:
      "https://shopabunda.com/products/tzowla-business-laptop-backpack-anti-theft-college-backpack-with-usb-charging-port-and-lock-15-6-inch-computer-backpacks-for-women-men-casual-hiking-travel-daypack-blue?s_id=12331962",
  },
  {
    name: "Men's Genuine Leather Wallet",
    category: "Bags",
    description:
      "Genuine leather bifold wallet for men with multiple card slots, coin pocket and RFID-safe lining.",
    basePrice: 499,
    oldPrice: 999,
    profitPercent: 25,
    stock: 140,
    imageAsset: "wallet.webp",
    imageSourceUrl:
      "https://teatee.de/products/genuine-leather-wallet-for-men-top-layer-cowhide-multi-card-slot-large-capacity-coin-purse-short-rfid-anti-theft-zero-wallet",
  },
  {
    name: "English Willow Cricket Bat — Classic",
    category: "Sports",
    description:
      "Classic English willow cricket bat with cane handle and rubber grip, knocked-in ready for hard-ball cricket.",
    basePrice: 4999,
    oldPrice: 8999,
    profitPercent: 15,
    stock: 20,
    imageAsset: "cricket-bat.jpg",
    imageSourceUrl: "https://otcricket.theshop.jp/items/87023208",
  },
  {
    name: "Anti-Skid Yoga Mat — 6mm",
    category: "Sports",
    description:
      "Extra-thick 6mm yoga and exercise mat with anti-skid surface and carry strap — gentle on knees and joints.",
    basePrice: 599,
    oldPrice: 1199,
    profitPercent: 25,
    stock: 100,
    imageAsset: "yoga-mat.jpg",
    imageSourceUrl: "https://wein-shop.at/?e=281879722",
  },
  {
    name: "Adjustable Dumbbell Pair — 2.5kg × 2",
    category: "Sports",
    description:
      "Pair of 2.5kg dumbbells with a comfortable grip coating — a home-workout staple for arms, shoulders and light training.",
    basePrice: 1299,
    oldPrice: 2599,
    profitPercent: 20,
    stock: 55,
    imageAsset: "dumbbells.webp",
    imageSourceUrl: "https://shopping.mywebhero.co.uk?page=891",
  },
  // ---- Expanded catalog (daily-updated store): several more products in
  // every category at realistic Indian market prices, healthy stock. New
  // rows ship with the clean initial-letter tile until photos are added.
  { name: "USB-C Fast Charging Cable — 1.5m Braided", category: "Electronics", description: "Braided nylon USB-C to USB-C cable with 60W fast-charge support for phones, tablets and laptops. 1.5 metre length.", basePrice: 299, oldPrice: 599, profitPercent: 25, stock: 400, imageAsset: "usb-c-fast-charging-cable-1-5m-braided.jpg", imageSourceUrl: null },
  { name: "65W GaN Fast Charger with Dual Ports", category: "Electronics", description: "Compact GaN charger with USB-C and USB-A ports — charges a laptop and a phone together at full speed.", basePrice: 1499, oldPrice: 2999, profitPercent: 20, stock: 180, imageAsset: "65w-gan-fast-charger-with-dual-ports.jpg", imageSourceUrl: null },
  { name: "LED Desk Lamp with Touch Dimmer", category: "Electronics", description: "Foldable LED study lamp with 3 colour modes, touch dimmer and USB charging — gentle on the eyes for long study hours.", basePrice: 899, oldPrice: 1799, profitPercent: 20, stock: 160, imageAsset: "led-desk-lamp-with-touch-dimmer.jpg", imageSourceUrl: null },
  { name: "Wireless Mouse — Silent Click, 2.4GHz", category: "Electronics", description: "Ergonomic wireless mouse with silent clicks, adjustable DPI and up to 12 months of battery life.", basePrice: 599, oldPrice: 1199, profitPercent: 25, stock: 220, imageAsset: "wireless-mouse-silent-click-2-4ghz.jpg", imageSourceUrl: null },
  { name: "Mobile Phone Stand — Adjustable Aluminium", category: "Electronics", description: "Sturdy aluminium phone stand with adjustable angle for video calls, classes and watching videos hands-free.", basePrice: 399, oldPrice: 799, profitPercent: 25, stock: 260, imageAsset: "mobile-phone-stand-adjustable-aluminium.jpg", imageSourceUrl: null },
  { name: "Men's Checked Casual Shirt — Cotton", category: "Fashion", description: "Everyday checked casual shirt in breathable cotton with a regular fit. Sizes M, L, XL, XXL available.", basePrice: 799, oldPrice: 1599, profitPercent: 25, stock: 190, imageAsset: "men-s-checked-casual-shirt-cotton.jpg", imageSourceUrl: null },
  { name: "Women's Floral A-Line Dress", category: "Fashion", description: "Flowy floral A-line dress in soft rayon — comfortable for college, office and outings. Sizes S, M, L, XL.", basePrice: 999, oldPrice: 1999, profitPercent: 25, stock: 140, imageAsset: "women-s-floral-a-line-dress.jpg", imageSourceUrl: null },
  { name: "Unisex Cotton Hoodie — Winter Fleece Lined", category: "Fashion", description: "Warm fleece-lined hoodie with kangaroo pocket and drawstring hood. Unisex regular fit.", basePrice: 1199, oldPrice: 2399, profitPercent: 25, stock: 150, imageAsset: "unisex-cotton-hoodie-winter-fleece-lined.jpg", imageSourceUrl: null },
  { name: "Women's Cotton Leggings — Pack of 2", category: "Fashion", description: "Stretchable cotton leggings in a value pack of 2 everyday colours. Free size fits most.", basePrice: 499, oldPrice: 999, profitPercent: 25, stock: 300, imageAsset: "women-s-cotton-leggings-pack-of-2.jpg", imageSourceUrl: null },
  { name: "Men's Cotton Track Pants", category: "Fashion", description: "Comfortable cotton track pants with elastic waist, drawstring and two side pockets — for walks, gym and home.", basePrice: 699, oldPrice: 1399, profitPercent: 25, stock: 210, imageAsset: "men-s-cotton-track-pants.jpg", imageSourceUrl: null },
  { name: "Kids' Cotton T-Shirt — Pack of 3", category: "Fashion", description: "Soft cotton t-shirts for kids in a pack of 3 bright colours. Ages 4–12 years.", basePrice: 599, oldPrice: 1199, profitPercent: 25, stock: 240, imageAsset: "kids-cotton-t-shirt-pack-of-3.jpg", imageSourceUrl: null },
  { name: "Women's Kolhapuri-Style Chappal", category: "Shoes", description: "Traditional Kolhapuri-style flat chappal with cushioned sole — pairs beautifully with kurtis and sarees.", basePrice: 599, oldPrice: 1199, profitPercent: 25, stock: 170, imageAsset: "women-s-kolhapuri-style-chappal.jpg", imageSourceUrl: null },
  { name: "Men's Casual Canvas Sneakers", category: "Shoes", description: "Lightweight canvas sneakers with lace-up fit and anti-slip sole for daily casual wear. UK sizes 6–11.", basePrice: 999, oldPrice: 1999, profitPercent: 20, stock: 160, imageAsset: "men-s-casual-canvas-sneakers.jpg", imageSourceUrl: null },
  { name: "Women's Block Heel Sandals", category: "Shoes", description: "Comfortable block-heel sandals with ankle strap — stable height for parties and office wear.", basePrice: 899, oldPrice: 1799, profitPercent: 25, stock: 130, imageAsset: "women-s-block-heel-sandals.jpg", imageSourceUrl: null },
  { name: "Men's Slip-On Loafers", category: "Shoes", description: "Easy slip-on loafers with cushioned insole — smart-casual finish for office and evenings out.", basePrice: 1299, oldPrice: 2599, profitPercent: 20, stock: 120, imageAsset: "men-s-slip-on-loafers.jpg", imageSourceUrl: null },
  { name: "Women's Analog Watch — Bracelet Strap", category: "Watches", description: "Elegant women's analog watch with a linked bracelet strap and stone-studded bezel — a lovely gift piece.", basePrice: 1299, oldPrice: 2599, profitPercent: 30, stock: 110, imageAsset: "women-s-analog-watch-bracelet-strap.jpg", imageSourceUrl: null },
  { name: "Men's Automatic-Style Watch — Brown Leather", category: "Watches", description: "Classic round-dial watch on a brown leather strap with date window — office and festive wear.", basePrice: 2499, oldPrice: 4999, profitPercent: 30, stock: 90, imageAsset: "men-s-automatic-style-watch-brown-leather.jpg", imageSourceUrl: null },
  { name: "Kids' Digital Watch — Colourful Strap", category: "Watches", description: "Fun digital watch for kids with alarm, stopwatch and a colourful soft strap. Splash resistant.", basePrice: 499, oldPrice: 999, profitPercent: 30, stock: 200, imageAsset: "kids-digital-watch-colourful-strap.jpg", imageSourceUrl: null },
  { name: "Stainless Steel Water Bottle — 1 Litre", category: "Home & Kitchen", description: "Single-wall stainless steel bottle, 1 litre, leak-proof cap — for school, office, gym and travel.", basePrice: 499, oldPrice: 999, profitPercent: 20, stock: 320, imageAsset: "stainless-steel-water-bottle-1-litre.jpg", imageSourceUrl: null },
  { name: "Electric Rice Cooker — 1.8 Litre", category: "Home & Kitchen", description: "1.8 litre electric rice cooker with keep-warm mode, steamer basket and non-stick inner pot. Serves 4–6.", basePrice: 1999, oldPrice: 3999, profitPercent: 20, stock: 90, imageAsset: "electric-rice-cooker-1-8-litre.jpg", imageSourceUrl: null },
  { name: "Vegetable Chopper — 5-in-1 Manual", category: "Home & Kitchen", description: "Manual 5-in-1 vegetable chopper and slicer with container — cuts prep time for daily cooking.", basePrice: 399, oldPrice: 799, profitPercent: 20, stock: 280, imageAsset: "vegetable-chopper-5-in-1-manual.jpg", imageSourceUrl: null },
  { name: "Microfibre Double Bed Blanket", category: "Home & Kitchen", description: "Soft, warm microfibre double blanket in a solid colour — light in weight, heavy on comfort.", basePrice: 999, oldPrice: 1999, profitPercent: 20, stock: 140, imageAsset: "microfibre-double-bed-blanket.jpg", imageSourceUrl: null },
  { name: "Plastic Storage Container Set — 12 Pieces", category: "Home & Kitchen", description: "Airtight BPA-free storage containers in assorted sizes for flour, rice, pulses and snacks. Set of 12.", basePrice: 699, oldPrice: 1399, profitPercent: 20, stock: 200, imageAsset: "plastic-storage-container-set-12-pieces.jpg", imageSourceUrl: null },
  { name: "Aloe Vera Soothing Gel — 200ml", category: "Beauty", description: "Pure aloe vera gel for skin and hair — soothes sunburn, hydrates and cools. 200ml tub.", basePrice: 199, oldPrice: 399, profitPercent: 30, stock: 350, imageAsset: "aloe-vera-soothing-gel-200ml.jpg", imageSourceUrl: null },
  { name: "Charcoal Peel-Off Face Mask — 100g", category: "Beauty", description: "Activated charcoal peel-off mask that lifts blackheads and excess oil for clearer-looking skin.", basePrice: 249, oldPrice: 499, profitPercent: 30, stock: 260, imageAsset: "charcoal-peel-off-face-mask-100g.jpg", imageSourceUrl: null },
  { name: "Argan Oil Hair Serum — 100ml", category: "Beauty", description: "Non-sticky argan hair serum that tames frizz and adds shine without weighing hair down.", basePrice: 349, oldPrice: 699, profitPercent: 30, stock: 240, imageAsset: "argan-oil-hair-serum-100ml.jpg", imageSourceUrl: null },
  { name: "Herbal Henna Powder — Natural Colour, 200g", category: "Beauty", description: "Natural henna (mehndi) powder for hair colour and conditioning — triple-sifted, chemical-free.", basePrice: 149, oldPrice: 299, profitPercent: 30, stock: 300, imageAsset: "herbal-henna-powder-natural-colour-200g.jpg", imageSourceUrl: null },
  { name: "Volumising Mascara — Smudge Proof", category: "Cosmetics", description: "Volumising mascara with a curved brush for lifted, fuller-looking lashes that stay smudge-proof all day.", basePrice: 299, oldPrice: 599, profitPercent: 35, stock: 280, imageAsset: "volumising-mascara-smudge-proof.jpg", imageSourceUrl: null },
  { name: "HD Blush & Highlighter Palette", category: "Cosmetics", description: "Blush and highlighter palette with buildable pigments for a fresh, glowing finish.", basePrice: 449, oldPrice: 899, profitPercent: 35, stock: 190, imageAsset: "hd-blush-highlighter-palette.jpg", imageSourceUrl: null },
  { name: "36-Shade Eyeshadow Palette", category: "Cosmetics", description: "36 matte and shimmer eyeshadow shades in one palette — everyday nudes to party glam.", basePrice: 599, oldPrice: 1199, profitPercent: 35, stock: 170, imageAsset: "36-shade-eyeshadow-palette.jpg", imageSourceUrl: null },
  { name: "Makeup Brush Set — 12 Pieces with Pouch", category: "Cosmetics", description: "12 soft synthetic makeup brushes for face and eyes with a carry pouch — no shedding, easy to wash.", basePrice: 399, oldPrice: 799, profitPercent: 35, stock: 210, imageAsset: "makeup-brush-set-12-pieces-with-pouch.jpg", imageSourceUrl: null },
  { name: "Lip Balm — Pack of 4 Fruity Flavours", category: "Cosmetics", description: "Moisturising lip balms in 4 fruity flavours with shea butter — pocket-friendly pack of 4.", basePrice: 199, oldPrice: 399, profitPercent: 35, stock: 380, imageAsset: "lip-balm-pack-of-4-fruity-flavours.jpg", imageSourceUrl: null },
  { name: "BB Cream — All-in-One, SPF 15", category: "Cosmetics", description: "All-in-one BB cream that moisturises, evens tone and adds light coverage with SPF 15.", basePrice: 299, oldPrice: 599, profitPercent: 35, stock: 230, imageAsset: "bb-cream-all-in-one-spf-15.jpg", imageSourceUrl: null },
  { name: "Women's Sling Bag — Quilted", category: "Bags", description: "Quilted sling bag with chain strap and roomy main pocket — day-to-evening carry for phone, wallet and makeup.", basePrice: 899, oldPrice: 1799, profitPercent: 25, stock: 150, imageAsset: "women-s-sling-bag-quilted.jpg", imageSourceUrl: null },
  { name: "Travel Duffel Bag — 40 Litre", category: "Bags", description: "Spacious 40 litre travel duffel with shoe pocket and strong zips — cabin-friendly weekend size.", basePrice: 1099, oldPrice: 2199, profitPercent: 25, stock: 130, imageAsset: "travel-duffel-bag-40-litre.jpg", imageSourceUrl: null },
  { name: "Kids' School Backpack — Cartoon Print", category: "Bags", description: "Lightweight school backpack with cartoon print, 2 compartments and padded straps for ages 5–10.", basePrice: 799, oldPrice: 1599, profitPercent: 25, stock: 180, imageAsset: "kids-school-backpack-cartoon-print.jpg", imageSourceUrl: null },
  { name: "Leather Cricket Ball — Pack of 2", category: "Sports", description: "Season leather cricket balls with stitched seam for practice and matches. Pack of 2.", basePrice: 799, oldPrice: 1599, profitPercent: 20, stock: 160, imageAsset: "leather-cricket-ball-pack-of-2.jpg", imageSourceUrl: null },
  { name: "Badminton Racket Pair with Shuttle Pack", category: "Sports", description: "Two steel-frame badminton rackets with a pack of 6 nylon shuttlecocks and a carry cover.", basePrice: 999, oldPrice: 1999, profitPercent: 20, stock: 150, imageAsset: "badminton-racket-pair-with-shuttle-pack.jpg", imageSourceUrl: null },
  { name: "Resistance Bands Set — 5 Levels", category: "Sports", description: "Set of 5 loop resistance bands from light to extra-heavy for home workouts and physiotherapy.", basePrice: 499, oldPrice: 999, profitPercent: 25, stock: 260, imageAsset: "resistance-bands-set-5-levels.jpg", imageSourceUrl: null },
  { name: "Skipping Rope — Adjustable, Ball Bearing", category: "Sports", description: "Adjustable skipping rope with smooth ball-bearing handles and foam grips — cardio anywhere.", basePrice: 299, oldPrice: 599, profitPercent: 25, stock: 300, imageAsset: "skipping-rope-adjustable-ball-bearing.jpg", imageSourceUrl: null },
  // ---- Premium expansion to 200 products: every category now mixes
  // everyday prices with believable Indian premium / high-price items,
  // plus a brand-new Mobiles category from budget to flagship.
  // Electronics — premium mix
  { name: "Premium Noise-Cancelling Headphones — ANC Pro", category: "Electronics", description: "Flagship over-ear headphones with adaptive noise cancellation, 60-hour battery and studio-grade sound.", basePrice: 10833, oldPrice: 24999, profitPercent: 20, stock: 45, imageAsset: "premium-noise-cancelling-headphones-anc-pr.jpg", imageSourceUrl: null },
  { name: "5.1 Channel Soundbar Home Theatre System", category: "Electronics", description: "Dolby soundbar with wireless subwoofer and rear speakers — cinema sound for your living room.", basePrice: 14999, oldPrice: 29999, profitPercent: 20, stock: 30, imageAsset: "5-1-channel-soundbar-home-theatre-system.jpg", imageSourceUrl: null },
  { name: "55-inch 4K UHD Smart TV — Dolby Vision", category: "Electronics", description: "55-inch 4K panel with Dolby Vision, voice remote and all popular streaming apps built in.", basePrice: 35416, oldPrice: 64999, profitPercent: 20, stock: 15, imageAsset: "55-inch-4k-uhd-smart-tv-dolby-vision.jpg", imageSourceUrl: null },
  { name: "Gaming Laptop — 16GB RAM, RTX Graphics, 512GB SSD", category: "Electronics", description: "High-refresh gaming laptop with dedicated RTX graphics, 16GB RAM and fast SSD storage.", basePrice: 62500, oldPrice: 99999, profitPercent: 15, stock: 12, imageAsset: "gaming-laptop-16gb-ram-rtx-graphics-512gb.jpg", imageSourceUrl: null },
  { name: "Ultra-Thin Laptop 14-inch — 16GB RAM, 512GB SSD", category: "Electronics", description: "Premium aluminium ultrabook for work and study — backlit keyboard, fingerprint login, all-day battery.", basePrice: 78260, oldPrice: 109999, profitPercent: 15, stock: 10, imageAsset: "ultra-thin-laptop-14-inch-16gb-ram-512gb-s.jpg", imageSourceUrl: null },
  { name: "Mirrorless Camera 24MP with 15-45mm Kit Lens", category: "Electronics", description: "24 megapixel mirrorless camera with 4K video, Wi-Fi sharing and kit lens — for creators and travel.", basePrice: 54166, oldPrice: 84999, profitPercent: 20, stock: 8, imageAsset: "mirrorless-camera-24mp-with-15-45mm-kit-le.jpg", imageSourceUrl: null },
  { name: "Tablet 11-inch — WiFi, 256GB, Stylus Support", category: "Electronics", description: "11-inch high-resolution tablet for classes, notes, OTT and light gaming. 256GB storage.", basePrice: 29166, oldPrice: 44999, profitPercent: 20, stock: 25, imageAsset: "tablet-11-inch-wifi-256gb-stylus-support.jpg", imageSourceUrl: null },
  { name: "Premium Smartwatch — AMOLED, GPS, Titanium Case", category: "Electronics", description: "Flagship smartwatch with AMOLED display, built-in GPS, ECG-style health tracking and titanium finish.", basePrice: 24999, oldPrice: 39999, profitPercent: 20, stock: 35, imageAsset: "premium-smartwatch-amoled-gps-titanium-cas.jpg", imageSourceUrl: null },
  { name: "Mechanical Gaming Keyboard — RGB, Hot-Swap", category: "Electronics", description: "Hot-swappable mechanical keyboard with RGB backlight and aluminium frame for gaming and typing.", basePrice: 3999, oldPrice: 7999, profitPercent: 25, stock: 80, imageAsset: "mechanical-gaming-keyboard-rgb-hot-swap.jpg", imageSourceUrl: null },
  { name: "Foldable Drone with 4K Camera & GPS", category: "Electronics", description: "Foldable camera drone with 4K video, GPS return-to-home and 30 minutes of flight time.", basePrice: 20833, oldPrice: 34999, profitPercent: 20, stock: 18, imageAsset: "foldable-drone-with-4k-camera-gps.jpg", imageSourceUrl: null },
  { name: "HEPA Air Purifier for Home — Covers 400 sq ft", category: "Electronics", description: "True-HEPA air purifier that removes dust, pollen and PM2.5 — quiet night mode included.", basePrice: 8333, oldPrice: 15999, profitPercent: 20, stock: 40, imageAsset: "hepa-air-purifier-for-home-covers-400-sq-f.jpg", imageSourceUrl: null },
  { name: "Robot Vacuum Cleaner with Smart Mapping", category: "Electronics", description: "Self-navigating robot vacuum with room mapping, app control and auto-recharge.", basePrice: 19999, oldPrice: 35999, profitPercent: 20, stock: 22, imageAsset: "robot-vacuum-cleaner-with-smart-mapping.jpg", imageSourceUrl: null },
  { name: "Premium True Wireless Earbuds — Hybrid ANC", category: "Electronics", description: "Premium earbuds with hybrid active noise cancellation, wireless charging and crystal-clear calls.", basePrice: 6666, oldPrice: 12999, profitPercent: 25, stock: 60, imageAsset: "premium-true-wireless-earbuds-hybrid-anc.jpg", imageSourceUrl: null },
  // Mobiles — budget to flagship (new category)
  { name: "Redmi 13 5G (8GB RAM, 128GB)", category: "Mobiles", description: "Budget 5G phone with 120Hz display, 108MP main camera and 5030mAh battery. Popular value pick.", basePrice: 12173, oldPrice: 17999, profitPercent: 15, stock: 60, imageAsset: "redmi-13-5g-8gb-ram-128gb.jpg", imageSourceUrl: "https://h-id.vyaparify.com/shree-radhe-mobile-1/product/redmi-138128gb" },
  { name: "Poco M6 Pro 5G (8GB RAM, 256GB)", category: "Mobiles", description: "Performance-focused 5G phone with large 6.79-inch display and 67W turbo charging.", basePrice: 13043, oldPrice: 18999, profitPercent: 15, stock: 55, imageAsset: "poco-m6-pro-5g-8gb-ram-256gb.jpg", imageSourceUrl: "https://morenamart.com/product/poco-m6-pro-5g-forest-green-8gb-ram-256gb-storage/" },
  { name: "Realme Narzo 70 5G (8GB RAM, 128GB)", category: "Mobiles", description: "Slim 5G phone with AMOLED display and fast charging — a strong budget all-rounder.", basePrice: 11303, oldPrice: 16999, profitPercent: 15, stock: 65, imageAsset: "realme-narzo-70-5g-8gb-ram-128gb.jpg", imageSourceUrl: "https://www.desertcart.com.om/brand/realemu" },
  { name: "Vivo T3x 5G (6GB RAM, 128GB)", category: "Mobiles", description: "Big-battery 5G phone (6000mAh) with stereo speakers for long days away from the charger.", basePrice: 11738, oldPrice: 17499, profitPercent: 15, stock: 50, imageAsset: "vivo-t3x-5g-6gb-ram-128gb.jpg", imageSourceUrl: "https://www.croma.com/vivo-t3x-5g-6gb-ram-128gb-celestial-green-/p/306356?utm_source=cuelinks&utm_medium=affiliate&utm_campaign=summersale&utm_term=network&utm_content=20260525clgvmd7nbazf" },
  { name: "Samsung Galaxy M35 5G (8GB RAM, 128GB)", category: "Mobiles", description: "Galaxy M-series 5G phone with Super AMOLED 120Hz display and 6000mAh battery.", basePrice: 15416, oldPrice: 24499, profitPercent: 20, stock: 45, imageAsset: "samsung-galaxy-m35-5g-8gb-ram-128gb.jpg", imageSourceUrl: "https://www.tradeling.com/ae-en/product-details/samsung-galaxy-m35-5g-uae-version-8gb-ram-128gb-light-blue-66c888dee29903afb6856e23-6329c4504efabf903adf35b1" },
  { name: "Nothing Phone (2a) 5G (8GB RAM, 256GB)", category: "Mobiles", description: "Distinctive transparent-design phone with Glyph lights, clean software and AMOLED display.", basePrice: 23213, oldPrice: 29999, profitPercent: 12, stock: 35, imageAsset: "nothing-phone-2a-5g-8gb-ram-256gb.jpg", imageSourceUrl: "https://gqmobiles.lk/nothing/nothing-phone-2a" },
  { name: "OnePlus Nord 4 5G (8GB RAM, 256GB)", category: "Mobiles", description: "Metal unibody Nord with flagship-grade chipset, 100W charging and smooth 120Hz AMOLED.", basePrice: 26785, oldPrice: 34999, profitPercent: 12, stock: 30, imageAsset: "oneplus-nord-4-5g-8gb-ram-256gb.jpg", imageSourceUrl: "https://vasanthandco.in/Category/38?OrderBy=price-high-low&MinPrice=2649&MaxPrice=1108000&pageId=37" },
  { name: "Redmi Note 13 Pro 5G (8GB RAM, 256GB)", category: "Mobiles", description: "200MP camera phone with 1.5K AMOLED display and 67W fast charging.", basePrice: 21428, oldPrice: 28999, profitPercent: 12, stock: 40, imageAsset: "redmi-note-13-pro-5g-8gb-ram-256gb.jpg", imageSourceUrl: "https://e-point.hr/product/xiaomi-redmi-note-13-pro-5g-8256-gb-black/" },
  { name: "iQOO Neo 9 Pro 5G (8GB RAM, 256GB)", category: "Mobiles", description: "Gaming-focused flagship killer with a top-tier processor and 120W flash charging.", basePrice: 32142, oldPrice: 41999, profitPercent: 12, stock: 25, imageAsset: "iqoo-neo-9-pro-5g-8gb-ram-256gb.jpg", imageSourceUrl: "https://www.justdial.com/jdmart/Ernakulam/iPhone-14-Plus-256GB-Midnight/pid-272259053/0484PX484-X484-210416171515-N7A8?idx=0&jdmid=jdm-1699242-ent-5-28205734&flow=result&searchfrom=b2b_prsltpg" },
  { name: "Vivo V40 5G (8GB RAM, 256GB)", category: "Mobiles", description: "Camera-first phone with ZEISS-tuned portrait lens and slim curved AMOLED display.", basePrice: 31249, oldPrice: 39999, profitPercent: 12, stock: 25, imageAsset: "vivo-v40-5g-8gb-ram-256gb.jpg", imageSourceUrl: "https://www.vasanthandco.in/Category/38?pageId=23" },
  { name: "Oppo Reno 12 5G (8GB RAM, 256GB)", category: "Mobiles", description: "Stylish Reno-series phone with AI camera features and a bright curved display.", basePrice: 29463, oldPrice: 37999, profitPercent: 12, stock: 25, imageAsset: "oppo-reno-12-5g-8gb-ram-256gb.jpg", imageSourceUrl: "https://bhatiamobile.com/product/oppo-reno12-5g-8-gb-ram-256-gb-storage/?attribute_pa_color=matte-brown" },
  { name: "Realme GT 6 5G (12GB RAM, 256GB)", category: "Mobiles", description: "Flagship-level performance with a 6000-nit bright display and advanced cooling for gaming.", basePrice: 36606, oldPrice: 46999, profitPercent: 12, stock: 20, imageAsset: "realme-gt-6-5g-12gb-ram-256gb.jpg", imageSourceUrl: "https://mail.corah.org.au/?shop/items/C4025012706/" },
  { name: "Samsung Galaxy A55 5G (8GB RAM, 256GB)", category: "Mobiles", description: "Premium mid-range Galaxy with metal frame, IP67 rating and long software support.", basePrice: 35713, oldPrice: 45999, profitPercent: 12, stock: 28, imageAsset: "samsung-galaxy-a55-5g-8gb-ram-256gb.jpg", imageSourceUrl: "https://www.kilimall.co.ke/listing/1000375899" },
  { name: "Samsung Galaxy S24 5G (8GB RAM, 256GB)", category: "Mobiles", description: "Flagship Galaxy S-series phone with Galaxy AI, pro cameras and a bright 120Hz display.", basePrice: 68181, oldPrice: 89999, profitPercent: 10, stock: 15, imageAsset: "samsung-galaxy-s24-5g-8gb-ram-256gb.jpg", imageSourceUrl: "https://dev.boolchand.com/electronics/products/P310?country=SXM&country_sub=AIA" },
  { name: "Apple iPhone 16 (128GB)", category: "Mobiles", description: "Latest-generation iPhone with A18 chip, Camera Control and the Dynamic Island display.", basePrice: 72636, oldPrice: 89900, profitPercent: 10, stock: 12, imageAsset: "apple-iphone-16-128gb.jpg", imageSourceUrl: "https://butovomall.istudio-shop.ru/catalog/iphone-16-128gb" },
  { name: "Google Pixel 9 (12GB RAM, 256GB)", category: "Mobiles", description: "Pixel flagship with Google AI camera features and clean Android experience.", basePrice: 72726, oldPrice: 89999, profitPercent: 10, stock: 10, imageAsset: "google-pixel-9-12gb-ram-256gb.jpg", imageSourceUrl: "https://wetech.co.il/item/76693249697" },
  { name: "Samsung Galaxy Z Flip 6 (12GB RAM, 256GB)", category: "Mobiles", description: "Foldable flip flagship with FlexCam, cover screen widgets and pocketable design.", basePrice: 99999, oldPrice: 124999, profitPercent: 10, stock: 6, imageAsset: "samsung-galaxy-z-flip-6-12gb-ram-256gb.jpg", imageSourceUrl: "https://VasanthAndCo.in/product/110190102859/samsung-galaxy-z-flip6-5g-12-gb-ram-256-gb-silver-shadow-mobile-phone" },
  { name: "Apple iPhone 16 Pro (128GB)", category: "Mobiles", description: "Pro iPhone with titanium body, A18 Pro chip and advanced triple-camera system.", basePrice: 109000, oldPrice: 129900, profitPercent: 10, stock: 8, imageAsset: "apple-iphone-16-pro-128gb.jpg", imageSourceUrl: "https://www.convergetp.co.uk/apple-iphone-16-pro-desert-titanium-5g-smartphone-128-gb-gsm-1tphomob-009251/" },
  // Fashion — premium mix
  { name: "Men's Premium Leather Jacket — Biker Style", category: "Fashion", description: "Premium faux-leather biker jacket with quilted shoulders and soft inner lining.", basePrice: 7999, oldPrice: 15999, profitPercent: 25, stock: 25, imageAsset: "men-s-premium-leather-jacket-biker-style.jpg", imageSourceUrl: "https://eshmanco.com/collections/men-biker-jackets" },
  { name: "Women's Designer Party Gown — Floor Length", category: "Fashion", description: "Elegant floor-length party gown with sequin bodice — for receptions and celebrations.", basePrice: 5999, oldPrice: 11999, profitPercent: 25, stock: 20, imageAsset: "women-s-designer-party-gown-floor-length.jpg", imageSourceUrl: "https://lifeisaparty.com.au/collections/evening-floor" },
  { name: "Men's Slim-Fit Formal Blazer", category: "Fashion", description: "Tailored slim-fit blazer for office, interviews and functions. Sizes 38–44.", basePrice: 3999, oldPrice: 7999, profitPercent: 25, stock: 40, imageAsset: "men-s-slim-fit-formal-blazer.jpg", imageSourceUrl: "https://www.cheapestinindia.com/price-history/arvind-ad-grid-tattersall-check-twill-blazer--6813e3a3a4f97f9b2058a966" },
  { name: "Women's Kanjivaram Pure Silk Saree", category: "Fashion", description: "Rich Kanjivaram-style pure silk saree with traditional temple border and zari work.", basePrice: 9999, oldPrice: 19999, profitPercent: 20, stock: 15, imageAsset: "women-s-kanjivaram-pure-silk-saree.jpg", imageSourceUrl: "https://pricehistoryapp.com/product/sgf11-women-s-kanjivaram-pure-soft-silk-saree-with-unstitched-blouse-piece" },
  { name: "Premium Pashmina Wool Shawl", category: "Fashion", description: "Soft pashmina-feel wool shawl with woven border — winter luxury for men and women.", basePrice: 3499, oldPrice: 6999, profitPercent: 25, stock: 30, imageAsset: "premium-pashmina-wool-shawl.jpg", imageSourceUrl: null },
  { name: "Men's Designer Sherwani Set — Wedding", category: "Fashion", description: "Regal sherwani set with embroidered collar, churidar and dupatta — groom and wedding wear.", basePrice: 11999, oldPrice: 24999, profitPercent: 25, stock: 12, imageAsset: "men-s-designer-sherwani-set-wedding.jpg", imageSourceUrl: "https://www.indianweddingsaree.com/product/jacquard-wedding-sherwani-in-white-and-off-white-with-stone-work-1970806" },
  { name: "Women's Premium Anarkali Kurta Set", category: "Fashion", description: "Flared Anarkali kurta set with dupatta in premium georgette — festive ready.", basePrice: 4499, oldPrice: 8999, profitPercent: 25, stock: 22, imageAsset: "women-s-premium-anarkali-kurta-set.jpg", imageSourceUrl: "https://bino.bot/p/B6SRHTZ0" },
  { name: "Unisex Aviator Sunglasses — UV400 Polarised", category: "Fashion", description: "Classic aviator frame with polarised UV400 lenses and hard carry case.", basePrice: 1499, oldPrice: 2999, profitPercent: 30, stock: 90, imageAsset: "unisex-aviator-sunglasses-uv400-polarised.jpg", imageSourceUrl: null },
  { name: "Men's Premium Cotton Chinos", category: "Fashion", description: "Stretch cotton chinos with a clean tapered fit — office to evening versatility.", basePrice: 1599, oldPrice: 3199, profitPercent: 25, stock: 85, imageAsset: "men-s-premium-cotton-chinos.jpg", imageSourceUrl: null },
  { name: "Women's Handloom Cotton Saree", category: "Fashion", description: "Handloom-woven cotton saree with a traditional border — breathable all-day drape.", basePrice: 1799, oldPrice: 3599, profitPercent: 25, stock: 45, imageAsset: "women-s-handloom-cotton-saree.jpg", imageSourceUrl: null },
  { name: "Kids' Party Frock — Net & Sequins", category: "Fashion", description: "Twirl-ready party frock for girls with net flare and sequin yoke. Ages 3–10.", basePrice: 999, oldPrice: 1999, profitPercent: 25, stock: 70, imageAsset: "kids-party-frock-net-sequins.jpg", imageSourceUrl: "https://imall.com/product/ACR1252U-%D1%83%D1%81%D1%82%D1%80%D0%BE%D0%B9%D1%81%D1%82%D0%B2%D0%BE-%D1%81%D1%87%D0%B8%D1%82%D1%8B%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F-%D0%BF%D0%B0%D1%80%D0%B0%D0%BC%D0%B5%D1%82%D1%80%D0%BE%D0%B2-USB-%D0%B8%D0%BD%D1%82%D0%B5%D1%80%D1%84%D0%B5%D0%B9%D1%81-%D0%BF%D1%80%D0%BE%D0%B4%D0%B0%D0%B6%D0%B0-%D1%82%D0%BE%D0%BB%D1%8C%D0%BA%D0%BE-%D0%BC%D0%BE%D0%B4%D1%83%D0%BB%D1%8F/Tools-Measurement-Analysis-Instruments/aliexpress.ru/1005001362054574/1381-1661530/en" },
  { name: "Men's Nehru Jacket — Festive Brocade", category: "Fashion", description: "Brocade Nehru (Modi) jacket that lifts any kurta outfit for festivals and functions.", basePrice: 2499, oldPrice: 4999, profitPercent: 25, stock: 35, imageAsset: "men-s-nehru-jacket-festive-brocade.jpg", imageSourceUrl: "https://www.etsy.com/uk/listing/1529719171/brocade-nehru-jacket-in-navy-blue" },
  { name: "Women's Sequin Party Dress — Knee Length", category: "Fashion", description: "Sparkle-ready sequin dress with a flattering fit — parties and evenings out.", basePrice: 4999, oldPrice: 9999, profitPercent: 25, stock: 18, imageAsset: "women-s-sequin-party-dress-knee-length.jpg", imageSourceUrl: null },
  // Shoes — premium mix
  { name: "Premium Running Shoes — Carbon Plate", category: "Shoes", description: "Race-day running shoes with carbon plate and responsive foam for serious runners.", basePrice: 9999, oldPrice: 16999, profitPercent: 20, stock: 30, imageAsset: "premium-running-shoes-carbon-plate.jpg", imageSourceUrl: "https://www.voghion.com/professional-carbon-plate-running-shoes/dp/31864014" },
  { name: "Men's Italian-Style Leather Derby Shoes", category: "Shoes", description: "Premium leather derby shoes with hand-stitched finish — boardroom ready.", basePrice: 6666, oldPrice: 12999, profitPercent: 20, stock: 25, imageAsset: "men-s-italian-style-leather-derby-shoes.jpg", imageSourceUrl: "https://italianshoescompany.com/collections/derby-shoes?page=2" },
  { name: "Women's Branded Street-Style Sneakers", category: "Shoes", description: "Chunky street-style sneakers with cushioned sole — the everyday fashion staple.", basePrice: 4166, oldPrice: 7999, profitPercent: 20, stock: 55, imageAsset: "women-s-branded-street-style-sneakers.jpg", imageSourceUrl: null },
  { name: "Men's Waterproof Hiking Boots", category: "Shoes", description: "High-ankle waterproof hiking boots with deep-grip sole for treks and travel.", basePrice: 3749, oldPrice: 7499, profitPercent: 25, stock: 40, imageAsset: "men-s-waterproof-hiking-boots.jpg", imageSourceUrl: "https://pickofprime.com/product/mens-waterproof-hiking-boots-lightweight-comfortable-leather-mid-ankle-outdoor-trekking-boot-8/" },
  { name: "Women's Premium Heeled Ankle Boots", category: "Shoes", description: "Suede-finish heeled ankle boots with side zip — winter statement pair.", basePrice: 4999, oldPrice: 9999, profitPercent: 25, stock: 28, imageAsset: "women-s-premium-heeled-ankle-boots.jpg", imageSourceUrl: "https://shoptheworld.in/p/b09kbk1f9q-vintage-foundry-co-est-2014-torgeis-women-s-bella-fashion-supple-faux-leather-zipper-ankle-boots-stacked-heel-pointed-toe-rubber-outsole-size-8" },
  { name: "Cricket Shoes with Spikes — Pro", category: "Shoes", description: "Lightweight cricket shoes with metal spikes and reinforced toe for match play.", basePrice: 2999, oldPrice: 5999, profitPercent: 20, stock: 45, imageAsset: "cricket-shoes-with-spikes-pro.jpg", imageSourceUrl: "https://wildwickets.co.uk/gray-nicolls-velocity-3-5-cricket-spike-senior-updating/" },
  { name: "Men's Premium Suede Loafers", category: "Shoes", description: "Soft suede loafers with cushioned insole — premium smart-casual comfort.", basePrice: 5833, oldPrice: 10999, profitPercent: 20, stock: 22, imageAsset: "men-s-premium-suede-loafers.jpg", imageSourceUrl: "https://imall.com/product/GROSIR%21%21-Padimas-Roti-Panggang-1-DUS-isi-60-PCS-grosir-kekinian-viral-termurah/Bakery/padi-mas/shopee.co.id/22819845311/995-3992582/en" },
  { name: "Women's Embroidered Punjabi Juttis — Premium", category: "Shoes", description: "Hand-embroidered Punjabi juttis with padded sole — pairs with suits and lehengas.", basePrice: 1299, oldPrice: 2599, profitPercent: 25, stock: 75, imageAsset: "women-s-embroidered-punjabi-juttis-premium.jpg", imageSourceUrl: "https://www.fusionwalks.com/products/floral-heavy-work-jutti" },
  { name: "Kids' LED Light-Up Shoes", category: "Shoes", description: "Rechargeable LED shoes for kids with 7 colour modes — fun and visible at play.", basePrice: 899, oldPrice: 1799, profitPercent: 25, stock: 95, imageAsset: "kids-led-light-up-shoes.jpg", imageSourceUrl: "https://inpink.ru/product/33044167510" },
  { name: "Men's Pro Training Gym Shoes", category: "Shoes", description: "Stable flat-sole training shoes built for lifting, CrossFit and gym sessions.", basePrice: 2499, oldPrice: 4999, profitPercent: 20, stock: 65, imageAsset: "men-s-pro-training-gym-shoes.jpg", imageSourceUrl: "https://www.cheapestinindia.com/price-history/adidas-men-shoes-or-torsizzle-or--695f1fe87fc699515b072d46" },
  // Watches — premium mix
  { name: "Men's Luxury Automatic Watch — Sapphire Glass", category: "Watches", description: "Self-winding automatic movement, sapphire-coated glass and exhibition back — a collector's piece.", basePrice: 41666, oldPrice: 79999, profitPercent: 20, stock: 10, imageAsset: "men-s-luxury-automatic-watch-sapphire-glas.jpg", imageSourceUrl: "https://www.daraz.lk/products/2026new-mens-watch-automatic-watch-nh35-mens-mechanical-watch-ar-sapphire-stainless-steel-10bar-luminous-mens-watch-rollstimi-i755630949.html" },
  { name: "Women's Diamond-Accent Luxury Watch", category: "Watches", description: "Luxury women's watch with crystal-set bezel and mother-of-pearl dial.", basePrice: 24999, oldPrice: 44999, profitPercent: 20, stock: 12, imageAsset: "women-s-diamond-accent-luxury-watch.jpg", imageSourceUrl: "https://www.vogarts.com/womens-quartz-watch-rose-gold-diamond-luxury-niche-style/dp/23657181" },
  { name: "Men's Premium Chronograph — Swiss Style", category: "Watches", description: "Bold chronograph dials, solid steel case and premium bracelet — Swiss-inspired design.", basePrice: 16666, oldPrice: 29999, profitPercent: 20, stock: 15, imageAsset: "men-s-premium-chronograph-swiss-style.jpg", imageSourceUrl: "https://chrono.uz/product/swiss-military-sm34052-13-swiss-made-classic-chrono-men/" },
  { name: "Men's Skeleton Automatic Watch", category: "Watches", description: "Open-heart skeleton dial showing the automatic movement inside. Leather strap.", basePrice: 12499, oldPrice: 24999, profitPercent: 20, stock: 14, imageAsset: "men-s-skeleton-automatic-watch.jpg", imageSourceUrl: "https://www.desertcart.in/products/527497682-ik-colouring-mens-watch-mechanical-stainless-steel-skeleton-steampunk-design-automatic-self-winding-roman-numeral-wrist-watch" },
  { name: "Women's Crystal Bracelet Watch — Rose Gold", category: "Watches", description: "Jewellery-style bracelet watch in rose gold with crystal detailing.", basePrice: 7499, oldPrice: 14999, profitPercent: 20, stock: 20, imageAsset: "women-s-crystal-bracelet-watch-rose-gold.jpg", imageSourceUrl: "https://cdejewelry-egypt.com" },
  { name: "Men's GMT Dual-Time Watch", category: "Watches", description: "Dual-time GMT hand for travellers, with rotating bezel and luminous markers.", basePrice: 9999, oldPrice: 18999, profitPercent: 20, stock: 16, imageAsset: "men-s-gmt-dual-time-watch.jpg", imageSourceUrl: "https://www.zegarek.net/zegarki-davosa/zegarek-163.480.45" },
  { name: "Premium Diver's Watch — 200m Water Resistant", category: "Watches", description: "Professional dive watch rated to 200m with unidirectional bezel and steel bracelet.", basePrice: 14999, oldPrice: 27999, profitPercent: 20, stock: 13, imageAsset: "premium-diver-s-watch-200m-water-resistant.jpg", imageSourceUrl: "https://imall.com/product/%D0%9C%D1%83%D0%B6%D1%81%D0%BA%D0%B8%D0%B5-%D0%BC%D0%B5%D1%85%D0%B0%D0%BD%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%B5-%D1%87%D0%B0%D1%81%D1%8B-%D0%B4%D0%BB%D1%8F-%D0%B4%D0%B0%D0%B9%D0%B2%D0%B8%D0%BD%D0%B3%D0%B0-200-%D0%BC%D0%B5%D1%82%D1%80%D0%BE%D0%B2-%D0%B2%D1%8B%D1%81%D0%BE%D0%BA%D0%BE%D0%BA%D0%B0%D1%87%D0%B5%D1%81%D1%82%D0%B2%D0%B5%D0%BD%D0%BD%D1%8B%D0%B5-%D0%BA%D0%BB%D0%B0%D1%81%D1%81%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%B5-%D1%81-%D0%B2%D0%BE%D0%B4%D0%BD%D1%8B%D0%BC-%D0%BF%D1%80%D0%B8%D0%B7%D1%80%D0%B0%D0%BA%D0%BE%D0%BC-%D0%B0%D0%B1%D0%B0%D0%BB%D0%BE%D0%BD%D0%BE%D0%BC-%D1%81%D0%B2%D0%B5%D1%82%D1%8F%D1%89%D0%B8%D0%B5%D1%81%D1%8F-%D0%BD%D0%BE%D1%87%D1%8C%D1%8E-Ruishi/aliexpress.ru/1005006105179010/1381-184337582/ru" },
  { name: "Women's Minimalist Mesh-Strap Watch", category: "Watches", description: "Ultra-slim minimalist dial on a fine mesh strap — understated elegance.", basePrice: 2999, oldPrice: 5999, profitPercent: 25, stock: 40, imageAsset: "women-s-minimalist-mesh-strap-watch.jpg", imageSourceUrl: "https://www.zegarek.net/zegarki-jowissa/zegarek-j5610m" },
  { name: "Men's Chronograph Watch — Tan Leather Strap", category: "Watches", description: "Vintage-look chronograph on a tan leather strap with contrast stitching.", basePrice: 5499, oldPrice: 10999, profitPercent: 20, stock: 24, imageAsset: "men-s-chronograph-watch-tan-leather-strap.jpg", imageSourceUrl: "https://library.pencidesign.net/watch-store_home/" },
  { name: "Kids' GPS Smartwatch with Calling", category: "Watches", description: "Kids' smartwatch with GPS tracking, two-way calling and safe contact list for parents' peace of mind.", basePrice: 3499, oldPrice: 6999, profitPercent: 20, stock: 50, imageAsset: "kids-gps-smartwatch-with-calling.jpg", imageSourceUrl: "https://mltechworld.com/next-gen-store/wearfit-next-gen-champ-4g-kids-kids-smart-watch-with-gps-tracking-2-way-video-voice-calling-safe-zone-alert-7-games-sos-does-not-support-jio-sim-pink/" },
  // Home & Kitchen — premium mix
  { name: "Double-Door Refrigerator 260L — Frost Free", category: "Home & Kitchen", description: "260 litre frost-free double-door fridge with inverter compressor and convertible freezer.", basePrice: 24999, oldPrice: 38999, profitPercent: 15, stock: 12, imageAsset: "double-door-refrigerator-260l-frost-free.jpg", imageSourceUrl: "https://www.bajajfinserv.in/bmall/lg-260-l-2-star-frost-free-double-door-refrigerator-dazzel-steel-gl-n292kdsr/p/29185" },
  { name: "Front-Load Washing Machine 7kg — Inverter", category: "Home & Kitchen", description: "7kg front-load washer with inverter motor, steam wash and 5-star energy rating.", basePrice: 28999, oldPrice: 44999, profitPercent: 15, stock: 10, imageAsset: "front-load-washing-machine-7kg-inverter.jpg", imageSourceUrl: "https://hkele.com.hk/en/WW70AG5S21CXSH" },
  { name: "Split Air Conditioner 1.5 Ton — 5 Star Inverter", category: "Home & Kitchen", description: "1.5 ton 5-star inverter split AC with copper condenser and fast-cool mode.", basePrice: 37999, oldPrice: 59999, profitPercent: 15, stock: 8, imageAsset: "split-air-conditioner-1-5-ton-5-star-inver.jpg", imageSourceUrl: "https://store.digitalteamindia.com/product/blue-star-15-ton-5-star-convertible-5-in-1-cooling-inverter-split-ac-copper-4-way-swing-stabalizer-free-operation-dust-filter-smart-ready-blue-fins-se" },
  { name: "Convection Microwave Oven 28L", category: "Home & Kitchen", description: "28 litre convection microwave for baking, grilling and reheating — with auto-cook menus.", basePrice: 11499, oldPrice: 19999, profitPercent: 20, stock: 20, imageAsset: "convection-microwave-oven-28l.jpg", imageSourceUrl: "https://www.bajajfinserv.in/bmall/lg-28-l-convection-microwave-oven-black-mc2886bht/p/29185" },
  { name: "Premium Espresso Coffee Maker — 15 Bar", category: "Home & Kitchen", description: "15-bar espresso machine with milk frother for café-style coffee at home.", basePrice: 16666, oldPrice: 29999, profitPercent: 20, stock: 15, imageAsset: "premium-espresso-coffee-maker-15-bar.jpg", imageSourceUrl: "https://www.apexfryer.com/products/china-espresso-coffee-machine-cm3010-pcb-control-15l-water-tank/" },
  { name: "Digital Air Fryer XL — 5 Litre", category: "Home & Kitchen", description: "5 litre digital air fryer with 8 presets — crispy food with up to 85% less oil.", basePrice: 6999, oldPrice: 12999, profitPercent: 20, stock: 45, imageAsset: "digital-air-fryer-xl-5-litre.jpg", imageSourceUrl: "https://www.bobshop.co.za/refurbished-silver-crest-xl-digital-air-fryer/p/644369950" },
  { name: "RO + UV Water Purifier — 7 Stage", category: "Home & Kitchen", description: "7-stage RO+UV purification with TDS controller and 8-litre storage tank.", basePrice: 12999, oldPrice: 21999, profitPercent: 20, stock: 25, imageAsset: "ro-uv-water-purifier-7-stage.jpg", imageSourceUrl: "https://hardwarepasal.com/product/neo-spring-water-purifier" },
  { name: "Premium Copper-Bottom Cookware Set — 10 Pieces", category: "Home & Kitchen", description: "Tri-ply copper-bottom cookware set for fast, even cooking. Induction friendly.", basePrice: 7499, oldPrice: 13999, profitPercent: 20, stock: 18, imageAsset: "premium-copper-bottom-cookware-set-10-piec.jpg", imageSourceUrl: "https://pikeandrose.com/instore/product/lagostina-martellata-hammered-copper-10-piece-set-surlatable-a2a468" },
  { name: "BLDC Smart Ceiling Fan with Remote", category: "Home & Kitchen", description: "Energy-saving BLDC ceiling fan (28W) with remote and timer — silent, powerful airflow.", basePrice: 3499, oldPrice: 6999, profitPercent: 20, stock: 35, imageAsset: "bldc-smart-ceiling-fan-with-remote.jpg", imageSourceUrl: "https://shoptheworld.in/halcyon-breezemaster-smart-energy-saving-5-star-rated-bldc-cei/p/b0cm51hhgb" },
  { name: "Sheesham Wood Coffee Table", category: "Home & Kitchen", description: "Solid sheesham wood coffee table with natural finish — a living-room centrepiece.", basePrice: 8999, oldPrice: 15999, profitPercent: 20, stock: 12, imageAsset: "sheesham-wood-coffee-table.jpg", imageSourceUrl: "https://www.nykaaman.com/ikiriya-kassel-sheesham-wood-coffee-table-in-teak-finish/p/8331200" },
  { name: "Wet & Dry Vacuum Cleaner 1600W", category: "Home & Kitchen", description: "Powerful 1600W vacuum for wet spills and dry dust, with blower function and large tank.", basePrice: 7999, oldPrice: 13999, profitPercent: 20, stock: 22, imageAsset: "wet-dry-vacuum-cleaner-1600w.jpg", imageSourceUrl: "https://www.ebay.co.uk/itm/173869720755?itmmeta=01HX4CXJAP93NPFEJQPJFK9CEH&hash=item287b7164b3:g:WFUAAOSwpG5ddx~b" },
  { name: "Touch-Panel Induction Cooktop 2000W", category: "Home & Kitchen", description: "2000W induction cooktop with touch controls, preset menus and auto shut-off.", basePrice: 2799, oldPrice: 4999, profitPercent: 20, stock: 55, imageAsset: "touch-panel-induction-cooktop-2000w.jpg", imageSourceUrl: "https://www.ndtvshopping.com/appliances/best-induction-stoves-with-wide-utensil-compatibility-for-modern-kitchens-11419515" },
  { name: "Luxury Satin Bedsheet Set — King Size", category: "Home & Kitchen", description: "Silky satin-finish king-size bedsheet set with 2 pillow covers — hotel feel at home.", basePrice: 2499, oldPrice: 4999, profitPercent: 20, stock: 40, imageAsset: "luxury-satin-bedsheet-set-king-size.jpg", imageSourceUrl: "https://www.nykaa.com/arrabi-premium-vanilla-pink-solid-satin-king-size-fitted-bedsheet-with-2-pillow-covers/p/29007478?productId=29007478&pps=3" },
  // Beauty — premium mix
  { name: "Premium Korean Skincare Set — 5 Steps", category: "Beauty", description: "Complete 5-step Korean routine: cleanser, toner, essence, serum and cream.", basePrice: 2499, oldPrice: 4999, profitPercent: 30, stock: 60, imageAsset: "premium-korean-skincare-set-5-steps.jpg", imageSourceUrl: "https://www.sayweee.com/ko/product/5-Step-Balanced-Skincare-Routine-for-Combination-Skin-Advanced-/2201581" },
  { name: "Luxury Vitamin C + Retinol Night Combo", category: "Beauty", description: "Day vitamin C serum plus night retinol cream — a premium anti-ageing duo.", basePrice: 1499, oldPrice: 2999, profitPercent: 30, stock: 70, imageAsset: "luxury-vitamin-c-retinol-night-combo.jpg", imageSourceUrl: null },
  { name: "Professional Ceramic Hair Straightener", category: "Beauty", description: "Salon-grade straightener with ceramic plates, fast heat-up and temperature control.", basePrice: 2999, oldPrice: 5999, profitPercent: 25, stock: 45, imageAsset: "professional-ceramic-hair-straightener.jpg", imageSourceUrl: null },
  { name: "Professional Hair Dryer 2000W — Cool Shot", category: "Beauty", description: "2000W salon dryer with cool-shot button and concentrator nozzle for smooth blowouts.", basePrice: 2499, oldPrice: 4999, profitPercent: 25, stock: 50, imageAsset: "professional-hair-dryer-2000w-cool-shot.jpg", imageSourceUrl: "https://makeup.ch/brand/1338769/" },
  { name: "Premium Beard Grooming Kit for Men", category: "Beauty", description: "Beard oil, balm, wash, wooden comb and scissors in a gift-ready grooming kit.", basePrice: 999, oldPrice: 1999, profitPercent: 30, stock: 85, imageAsset: "premium-beard-grooming-kit-for-men.jpg", imageSourceUrl: "https://www.sourceready.com/supplier/list/best-beard-oil-manufacturers" },
  { name: "Electric Facial Cleansing Brush — Sonic", category: "Beauty", description: "Sonic cleansing brush with 3 speed modes and 2 brush heads for deep, gentle cleaning.", basePrice: 1299, oldPrice: 2599, profitPercent: 30, stock: 65, imageAsset: "electric-facial-cleansing-brush-sonic.jpg", imageSourceUrl: "https://baduglobal.com/mini-electric-facial-cleansing-brush-silicone-sonic-face-cleaner-deep-pore-cleaning-skin-massager-face-cleansing-brush-device-p-659400.html" },
  { name: "Luxury Body Care Gift Hamper", category: "Beauty", description: "Body wash, lotion, scrub and bath salts in a premium gift hamper box.", basePrice: 1799, oldPrice: 3499, profitPercent: 30, stock: 40, imageAsset: "luxury-body-care-gift-hamper.jpg", imageSourceUrl: "https://amsons.co.uk" },
  { name: "Premium Onion Hair Oil — 250ml", category: "Beauty", description: "Onion-seed hair oil with 14 natural oils for stronger, shinier hair. 250ml.", basePrice: 449, oldPrice: 899, profitPercent: 30, stock: 140, imageAsset: "premium-onion-hair-oil-250ml.jpg", imageSourceUrl: "https://www.sanketcollection.in/product/29991748/Onion-Hair-Oil-for-Hair-Regrowth-and-Hair-Fall-Control--250ml-" },
  { name: "24K Gold Face Mask — Luxury Glow", category: "Beauty", description: "Gold-infused peel-off mask for an instant festive glow before functions.", basePrice: 899, oldPrice: 1799, profitPercent: 30, stock: 75, imageAsset: "24k-gold-face-mask-luxury-glow.jpg", imageSourceUrl: "https://vitaminskart.com/glo24k-unleash-the-power-of-gold/" },
  { name: "Professional Hair Spa Kit — Salon at Home", category: "Beauty", description: "Complete hair spa kit with mask, serum and scalp scrub for salon-like care at home.", basePrice: 1199, oldPrice: 2399, profitPercent: 30, stock: 55, imageAsset: "professional-hair-spa-kit-salon-at-home.jpg", imageSourceUrl: "https://homeneedspro.com/package-details/keratin-hair-spa" },
  // Cosmetics — premium mix
  { name: "Luxury Makeup Vanity Box — Complete Pro Kit", category: "Cosmetics", description: "Professional vanity case with full face, eye and lip ranges — a makeup artist's kit.", basePrice: 3999, oldPrice: 7999, profitPercent: 30, stock: 25, imageAsset: "luxury-makeup-vanity-box-complete-pro-kit.jpg", imageSourceUrl: null },
  { name: "Premium HD Foundation + Primer Set", category: "Cosmetics", description: "HD foundation with pore-blurring primer for a flawless, photo-ready base.", basePrice: 1299, oldPrice: 2599, profitPercent: 30, stock: 60, imageAsset: "premium-hd-foundation-primer-set.jpg", imageSourceUrl: "https://www.hypd.store/bhavya/product/65f2395d6dab2a1fe33a52b7?title=PRO+HD+Foundation+-+Ceder+30+Ml" },
  { name: "Designer Lipstick Collection — 12 Shades", category: "Cosmetics", description: "Curated 12-shade lipstick vault from nudes to bold reds in luxe packaging.", basePrice: 1499, oldPrice: 2999, profitPercent: 35, stock: 55, imageAsset: "designer-lipstick-collection-12-shades.jpg", imageSourceUrl: "https://motherbabykids.com/vetted/best-designer-lipstick-collections/" },
  { name: "Premium Eau de Parfum — 50ml, Long Lasting", category: "Cosmetics", description: "Long-lasting eau de parfum with notes of oud, musk and citrus. 50ml bottle.", basePrice: 1999, oldPrice: 3999, profitPercent: 30, stock: 45, imageAsset: "premium-eau-de-parfum-50ml-long-lasting.jpg", imageSourceUrl: "https://almashalux.com/collections/recomanded" },
  { name: "Pro Contour & Highlight Palette", category: "Cosmetics", description: "Cream and powder contour-highlighter palette for sculpted, pro-level looks.", basePrice: 999, oldPrice: 1999, profitPercent: 35, stock: 70, imageAsset: "pro-contour-highlight-palette.jpg", imageSourceUrl: "https://www.notino.de/revolution-pro/sculpt-and-glow-konturier-palette-fuer-die-wangen/" },
  { name: "Luxury Kajal & Eyeliner Duo", category: "Cosmetics", description: "Smudge-proof kajal plus precision liner in one premium duo pack.", basePrice: 549, oldPrice: 1099, profitPercent: 35, stock: 120, imageAsset: "luxury-kajal-eyeliner-duo.jpg", imageSourceUrl: "https://www.spacenk.com/uk/makeup/eyes/eyeliner/intense-black-24h-kajal-eyeliner-duo-MUK200059050.html" },
  { name: "Premium Nail Art Studio Kit", category: "Cosmetics", description: "Nail art kit with 24 colours, stickers, rhinestones and tools for salon nails at home.", basePrice: 1499, oldPrice: 2999, profitPercent: 30, stock: 40, imageAsset: "premium-nail-art-studio-kit.jpg", imageSourceUrl: "https://nailprime.com/best-nail-kit-for-beginners/" },
  { name: "HD Makeup Setting Spray — Pro Fixer", category: "Cosmetics", description: "Long-wear setting spray that locks makeup for up to 16 hours without cracking.", basePrice: 699, oldPrice: 1399, profitPercent: 35, stock: 90, imageAsset: "hd-makeup-setting-spray-pro-fixer.jpg", imageSourceUrl: "https://shoptheworld.in/c2p-pro-ultra-hd-makeup-setting-mist-fix-makeup-fixer-spray/p/b09kvc9y7b" },
  { name: "Luxury Blush & Bronzer Duo", category: "Cosmetics", description: "Silky blush and bronzer duo with a natural sun-kissed finish.", basePrice: 899, oldPrice: 1799, profitPercent: 35, stock: 65, imageAsset: "luxury-blush-bronzer-duo.jpg", imageSourceUrl: "https://sephora.in/product/stila-putty-blush-slash-bronzer-duo-v-bronzed-gerbera" },
  { name: "Premium Cleansing Balm — Makeup Remover", category: "Cosmetics", description: "Melting cleansing balm that removes waterproof makeup while nourishing skin.", basePrice: 649, oldPrice: 1299, profitPercent: 35, stock: 80, imageAsset: "premium-cleansing-balm-makeup-remover.jpg", imageSourceUrl: "https://www.podrygka.ru/catalog/ukhod/litso/umyvanie/258591-gidrofilnyy-balzam-dlya-umyvaniya-nsc-ochishchayushchiy-dlya-snyatiya-makiyazha-100-ml/?advcake_method=2&m=2" },
  { name: "Bridal Makeup Trousseau Set — Deluxe", category: "Cosmetics", description: "Deluxe bridal trousseau with premium lipsticks, palettes, brushes and base essentials.", basePrice: 4999, oldPrice: 9999, profitPercent: 30, stock: 15, imageAsset: "bridal-makeup-trousseau-set-deluxe.jpg", imageSourceUrl: "https://www.adora-sa.com/" },
  // Bags — premium mix
  { name: "Designer Leather Tote Bag — Premium", category: "Bags", description: "Structured premium tote in genuine-feel leather with laptop sleeve and zip closure.", basePrice: 7999, oldPrice: 15999, profitPercent: 25, stock: 20, imageAsset: "designer-leather-tote-bag-premium.jpg", imageSourceUrl: "https://www.everfulwholesale.com/el/products/women-tote-bag-large-capacity-pu-leather-litchi-grain-minimalist-shoulder-handbag-for-work-daily-commute-fashion-765612" },
  { name: "Women's Premium Chain Shoulder Bag", category: "Bags", description: "Quilted shoulder bag with gold-tone chain strap — day-to-party carry.", basePrice: 3999, oldPrice: 7999, profitPercent: 25, stock: 30, imageAsset: "women-s-premium-chain-shoulder-bag.jpg", imageSourceUrl: null },
  { name: "Premium Hard-Shell Trolley Suitcase — 28 inch", category: "Bags", description: "Lightweight hard-shell suitcase with spinner wheels, TSA lock and expandable storage.", basePrice: 5999, oldPrice: 11999, profitPercent: 25, stock: 22, imageAsset: "premium-hard-shell-trolley-suitcase-28-inc.jpg", imageSourceUrl: "https://oneclearwinner.co.uk/product/28-inch-suitcase-hard-shell/" },
  { name: "Men's Premium Leather Briefcase", category: "Bags", description: "Executive leather briefcase with padded laptop compartment and combination lock.", basePrice: 6999, oldPrice: 13999, profitPercent: 25, stock: 15, imageAsset: "men-s-premium-leather-briefcase.jpg", imageSourceUrl: "https://stridewise.com/best-leather-briefcase-men/" },
  { name: "Premium Sports Gym Bag with Shoe Compartment", category: "Bags", description: "Water-resistant gym bag with separate shoe tunnel and wet pocket.", basePrice: 1999, oldPrice: 3999, profitPercent: 25, stock: 50, imageAsset: "premium-sports-gym-bag-with-shoe-compartme.jpg", imageSourceUrl: "https://szoneier.com/custom-basketball-bags-manufacturer/" },
  { name: "Women's Embroidered Potli Bag — Set of 2", category: "Bags", description: "Traditional embroidered potli bags for weddings and festive outfits. Set of 2.", basePrice: 799, oldPrice: 1599, profitPercent: 25, stock: 85, imageAsset: "women-s-embroidered-potli-bag-set-of-2.jpg", imageSourceUrl: "https://www.etsy.com/listing/4518787779/floral-embroidered-silk-potli-bags-set?utm_source=OpenGraph&utm_medium=PageTools&utm_campaign=Share" },
  { name: "Premium Camera Backpack — Padded, Waterproof", category: "Bags", description: "Padded camera backpack with custom dividers, tripod holder and rain cover.", basePrice: 3499, oldPrice: 6999, profitPercent: 25, stock: 28, imageAsset: "premium-camera-backpack-padded-waterproof.jpg", imageSourceUrl: "https://byalexnicole.com/must-see/travel-backpack-with-camera-compartment" },
  { name: "Luxury Metallic Evening Clutch", category: "Bags", description: "Metallic-finish evening clutch with detachable chain — for parties and weddings.", basePrice: 2499, oldPrice: 4999, profitPercent: 25, stock: 35, imageAsset: "luxury-metallic-evening-clutch.jpg", imageSourceUrl: null },
  { name: "Kids' Premium School Bag Set — 3 in 1", category: "Bags", description: "Backpack, lunch bag and pencil pouch set with ergonomic padded straps.", basePrice: 1499, oldPrice: 2999, profitPercent: 25, stock: 60, imageAsset: "kids-premium-school-bag-set-3-in-1.jpg", imageSourceUrl: "https://www.mygreen-life.com/products/kids-cartoon-backpack-set-3-in-1-lightweight-waterproof-school-bag-with-lunch-box-pencil-pouch-reflective-strips-chest-strap-for-boys-girls-kindergarten-preschool?variant=de16ea9b-7391-4553-884f-bc8c56d6bc90" },
  // Sports — premium mix
  { name: "Grade-1 English Willow Cricket Bat — Pro", category: "Sports", description: "Top-grade English willow bat, hand-pressed and knocked-in, for serious leather-ball cricket.", basePrice: 12499, oldPrice: 21999, profitPercent: 15, stock: 10, imageAsset: "grade-1-english-willow-cricket-bat-pro.jpg", imageSourceUrl: "https://www.indiamart.com/proddetail/grade-1-english-willow-cricket-bat-23863899712.html" },
  { name: "Premium Carbon-Fibre Badminton Racket", category: "Sports", description: "Full carbon-fibre frame racket — light, stiff and built for power smashes.", basePrice: 3999, oldPrice: 7999, profitPercent: 20, stock: 30, imageAsset: "premium-carbon-fibre-badminton-racket.jpg", imageSourceUrl: "https://federperiti.eu/badminton/12840-buy-badminton-racket-online.html" },
  { name: "Home Gym Set — 20kg Adjustable Plates & Rods", category: "Sports", description: "Complete 20kg home gym: plates, curl rod, dumbbell rods and accessories.", basePrice: 4999, oldPrice: 8999, profitPercent: 20, stock: 25, imageAsset: "home-gym-set-20kg-adjustable-plates-rods.jpg", imageSourceUrl: "https://jalosports.fi/tuotemerkki/hms/page/9/" },
  { name: "Foldable Electric Treadmill — Home Running", category: "Sports", description: "Motorised treadmill with 12 programs, LED display and space-saving foldable frame.", basePrice: 29999, oldPrice: 49999, profitPercent: 15, stock: 6, imageAsset: "foldable-electric-treadmill-home-running.jpg", imageSourceUrl: "https://shopvante.com/product/zateety-foldable-treadmill-2-5hp-electric-folding-treadmill-running-walking-machine-for-men-home-gym-max-265-lbs-weight-capacityblack/" },
  { name: "Mountain Bicycle 27.5-inch — 21 Gear", category: "Sports", description: "Alloy-frame MTB with 21-speed gears, dual disc brakes and front suspension.", basePrice: 13999, oldPrice: 22999, profitPercent: 15, stock: 12, imageAsset: "mountain-bicycle-27-5-inch-21-gear.jpg", imageSourceUrl: "https://cunado.ch/eu-cu12-5682446.html" },
  { name: "Premium Yoga & Pilates Studio Set", category: "Sports", description: "Studio set: premium mat, blocks, strap, resistance ring and carry bag.", basePrice: 2499, oldPrice: 4999, profitPercent: 25, stock: 45, imageAsset: "premium-yoga-pilates-studio-set.jpg", imageSourceUrl: "https://frau-pilates.com/" },
  { name: "Professional Football — Size 5, Machine Stitched", category: "Sports", description: "Match-quality size-5 football with durable machine-stitched panels.", basePrice: 1499, oldPrice: 2999, profitPercent: 20, stock: 70, imageAsset: "professional-football-size-5-machine-stitc.jpg", imageSourceUrl: "http://pizzavmaestro.ru/football-down-indicator-elastic-band-adjustable-wrist-strap-professional-football-referees-wristband-football-match-accessories/page/2" },
  { name: "Complete Cricket Kit Bag Set — Senior", category: "Sports", description: "Full senior cricket kit: pads, gloves, helmet, guards and wheeled kit bag.", basePrice: 8999, oldPrice: 15999, profitPercent: 20, stock: 14, imageAsset: "complete-cricket-kit-bag-set-senior.jpg", imageSourceUrl: "https://www.sportsgear24x7.com/s/cricket/cricket-kit" },
  { name: "Premium Foldable Table Tennis Table", category: "Sports", description: "Competition-size TT table with playback mode, wheels and quick-fold design.", basePrice: 16999, oldPrice: 27999, profitPercent: 15, stock: 8, imageAsset: "premium-foldable-table-tennis-table.jpg", imageSourceUrl: "https://wauwau.at/Kids-2-0-quot-Screen-With-32GB-Card-STEM-Educational-Toy-m-215554" },
  { name: "Premium GPS Fitness Tracker Band", category: "Sports", description: "AMOLED fitness band with built-in GPS, SpO2 and 14-day battery for runners and athletes.", basePrice: 4499, oldPrice: 8999, profitPercent: 20, stock: 40, imageAsset: "premium-gps-fitness-tracker-band.jpg", imageSourceUrl: "https://me-page.org/Peiq3Zk" },
];

// Create one seller notification per seller whose store contains at least
// one ordered product (same rule as a normal checkout order). Best-effort:
// a notification failure never fails the order itself. When `onlySellerId`
// is given (the Admin's Quick Send to ONE shop), the order is attributed
// and notified to that seller alone — other sellers carrying the same
// product get no snapshot row, no notification and no share of the order.
async function notifySellersOfOrder(
  db: Db,
  orderId: number,
  lines: Array<{ productId: number; buyerPrice: number; qty: number }>,
  onlySellerId?: number,
): Promise<void> {
  try {
    const bySeller = new Map<number, { productName: string; amount: number }>();
    const snapProducts = new Map<number, Set<number>>();
    for (const line of lines) {
      const sellers = await db
        .select()
        .from(schema.sellerProducts)
        .where(eq(schema.sellerProducts.productId, line.productId));
      if (sellers.length === 0) continue;
      const prod = await db
        .select({ name: schema.products.name })
        .from(schema.products)
        .where(eq(schema.products.id, line.productId))
        .limit(1);
      const pname = prod[0]?.name ?? "Product";
      for (const s of sellers) {
        if (onlySellerId != null && s.sellerId !== onlySellerId) continue;
        const cur = bySeller.get(s.sellerId) ?? { productName: pname, amount: 0 };
        cur.amount += line.buyerPrice * line.qty;
        bySeller.set(s.sellerId, cur);
        let set = snapProducts.get(s.sellerId);
        if (!set) { set = new Set(); snapProducts.set(s.sellerId, set); }
        set.add(line.productId);
      }
    }
    // Record the order-time attribution snapshot: from now on this
    // order's earnings, holds and Admin shop grouping are read from
    // these rows, so later store changes cannot move the order to a
    // different seller.
    for (const [sellerId, productIds] of snapProducts) {
      for (const productId of productIds) {
        try {
          await db.insert(schema.orderSellerItems).values({ orderId, sellerId, productId });
        } catch { /* snapshot is best-effort; reads fall back gracefully */ }
      }
    }
    for (const [sellerId, info] of bySeller) {
      try {
        await db.insert(schema.sellerNotifications).values({
          sellerId,
          orderId,
          productName: info.productName,
          amount: info.amount,
          isRead: 0,
        });
      } catch (e) {
        if (!String(e).includes("UNIQUE")) throw e;
      }
    }
  } catch {
    // Notifications are best-effort; the order itself already succeeded.
  }
}

// Tell every seller whose products are in this order that the order is
// COMPLETED (Admin approved the shipment). A general seller notice
// (orderId null so it stays visible until dismissed — an order-linked
// notice would auto-clear the moment the order reads Delivered).
// Best-effort, like notifySellersOfOrder.
async function notifySellersOrderCompleted(db: Db, orderId: number): Promise<void> {
  try {
    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    const currentIds = new Set<number>();
    for (const it of items) {
      const sellers = await db.select().from(schema.sellerProducts).where(eq(schema.sellerProducts.productId, it.productId));
      for (const s of sellers) currentIds.add(s.sellerId);
    }
    // Only the sellers the order was attributed to at placement time
    // are told it completed — not sellers who added the product later.
    // An order placed for one named seller (seller_id set) completes
    // for that seller alone.
    const ord = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
    const attr = await loadOrderAttribution(db);
    const sellerIds = new Set(attributedSellerIds(attr, orderId, [...currentIds], ord[0]?.sellerId ?? null));
    for (const sellerId of sellerIds) {
      await db.insert(schema.sellerNotices).values({
        sellerId,
        orderId: null,
        message: `Your order #${orderId} is completed ✓ — the shipment was approved and the order is now in your Completed section. Its profit has been added to your wallet earnings.`,
        isRead: 0,
      });
    }
  } catch {
    // Best-effort; the status change itself already succeeded.
  }
}

// Wallet-credit events (the Wallet tab dot): inserted at the exact
// moment money ARRIVES in a seller's Available balance — never for
// debits, holds, or rejections, and never into the bell, the notices
// banner, or dashboard tiles, so a credit has exactly one signal.
async function insertWalletEvent(db: Db, e: { sellerId: number; kind: "deposit_approved" | "admin_credit" | "order_completed"; amount: number; reference: string; orderId?: number | null; txId?: number | null }): Promise<void> {
  if (!e.amount || e.amount <= 0) return;
  await db.insert(schema.sellerWalletEvents).values({ sellerId: e.sellerId, kind: e.kind, amount: e.amount, reference: e.reference, orderId: e.orderId ?? null, txId: e.txId ?? null, isRead: 0 });
}

// Order completion's wallet share, mirroring computeSellerFinance:
// sellers who paid the order cost from the wallet get the full order
// value back; otherwise the profit only. Skips prepaid orders under
// verification / rejected (they never credit) and sellers with no
// attributed items, so no dot ever appears for money that never came.
async function notifySellersWalletCredit(db: Db, orderId: number): Promise<void> {
  try {
    const ord = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
    if (!ord[0]) return;
    if (ord[0].paymentStatus === "pending" || ord[0].paymentStatus === "rejected") return;
    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    const currentSellerIds = new Set<number>();
    for (const it of items) {
      const sellers = await db.select().from(schema.sellerProducts).where(eq(schema.sellerProducts.productId, it.productId));
      for (const s of sellers) currentSellerIds.add(s.sellerId);
    }
    const attr = await loadOrderAttribution(db);
    const sellerIds = attributedSellerIds(attr, orderId, [...currentSellerIds], ord[0].sellerId ?? null);
    for (const sellerId of sellerIds) {
      // attributedProductIds takes the seller's CURRENT PRODUCT ids
      // (not seller ids) as its 4th argument — same as
      // computeSellerFinance's myIds. Passing seller ids here silently
      // emptied every order's item list, so no event was ever made.
      const picks = await db.select().from(schema.sellerProducts).where(eq(schema.sellerProducts.sellerId, sellerId));
      const sellerProductIds = new Set(picks.map((x) => x.productId));
      const myIds = attributedProductIds(attr, orderId, sellerId, sellerProductIds, ord[0].sellerId ?? null);
      const mine = items.filter((it) => myIds.has(it.productId));
      if (mine.length === 0) continue;
      const payRows = await db.select().from(schema.walletTransactions).where(eq(schema.walletTransactions.sellerId, sellerId));
      const paid = payRows.some((r) => r.type === "order_payment" && r.status === "completed" && r.reference.match(/Order #(\d+)/)?.[1] === String(orderId));
      const credit = paid
        ? mine.reduce((s, it) => s + it.buyerPrice * it.qty, 0)
        : mine.reduce((s, it) => s + it.profitAmount * it.qty, 0);
      // Idempotency: one order_completed event per (seller, order), ever.
      // Without this, Delivered -> Pending -> Delivered credited twice.
      const already = await db
        .select({ id: schema.sellerWalletEvents.id })
        .from(schema.sellerWalletEvents)
        .where(and(eq(schema.sellerWalletEvents.sellerId, sellerId), eq(schema.sellerWalletEvents.kind, "order_completed"), eq(schema.sellerWalletEvents.orderId, orderId)))
        .limit(1);
      if (already.length > 0) continue;
      await insertWalletEvent(db, { sellerId, kind: "order_completed", amount: credit, reference: `Order #${orderId}`, orderId });
    }
  } catch (e) {
    // Best-effort, like notifySellersOrderCompleted: the status change
    // itself already succeeded. Log so a missing dot is traceable in
    // the server logs instead of failing silently.
    console.error("notifySellersWalletCredit failed for order", orderId, e);
  }
}

// --- Shop from Other Platforms (external products) ---------------------
// Real products sold on OTHER merchants' websites, fetched from a
// product catalog on 24 Oct 2026. Prices are as listed on that date; the
// final price is on the merchant's own site. URLs are the clean product
// pages (tracking parameters stripped). There is NO live Amazon API
// connected — Amazon links enter through Admin → External Products,
// where the Admin can paste any real product URL.
const SEED_EXTERNAL_PRODUCTS: Array<{
  name: string;
  brand: string;
  category: string;
  priceInr: number;
  merchant: string;
  productUrl: string;
}> = [
  { name: "Apple iPhone 18 Pro Max 512GB Silver", brand: "Apple", category: "Mobiles", priceInr: 204900, merchant: "Apple", productUrl: "https://www.apple.com/in/shop/go/product/MJXU4HN/A" },
  { name: "Samsung Galaxy S25 Ultra 256GB Titanium Black", brand: "Samsung", category: "Mobiles", priceInr: 129999, merchant: "Samsung", productUrl: "https://www.samsung.com/in/smartphones/galaxy-s25-ultra/buy/" },
  { name: "Samsung Galaxy M17 5G (4GB/128GB, Sapphire Black)", brand: "Samsung", category: "Mobiles", priceInr: 15579, merchant: "Blinkit", productUrl: "https://blinkit.com/prn/samsung-galaxy-m-17-5g-smartphone-4-gb-128-gb-sapphire-black-6-7-1-unit/prid/727828" },
  { name: "Samsung M36 5G 128GB Light Green", brand: "Samsung", category: "Mobiles", priceInr: 23999, merchant: "Reliance Digital", productUrl: "https://www.reliancedigital.in/product/samsung-m36-5g-128-gb-8-gb-ram-light-green-mobile-phone-mpqw4w-10129084" },
  { name: "JBL Tune 770NC Wireless Over-Ear ANC Headphones Blue", brand: "JBL", category: "Audio", priceInr: 4999, merchant: "Blinkit", productUrl: "https://blinkit.com/prn/jbl-tune-770nc-wireless-over-ear-anc-bluetooth-headphones-blue-1-unit/prid/614433" },
  { name: "Noise Buds VS102 Truly Wireless Earbuds", brand: "Noise", category: "Audio", priceInr: 1299, merchant: "Noise", productUrl: "https://www.gonoise.com/products/noise-buds-vs102-truly-wireless-earbuds-ondc-partner-exclusive" },
  { name: "Noise Buds VS102 Pro", brand: "Noise", category: "Audio", priceInr: 1234, merchant: "Noise", productUrl: "https://www.gonoise.com/products/noise-buds-vs102-pro-truly-wireless-earbuds" },
  { name: "Sony WH-CH720N Wireless Noise Cancelling Headphones Blue", brand: "Sony", category: "Audio", priceInr: 6990, merchant: "Instamart", productUrl: "https://instamart.in/p/sony-wh-ch720n-wireless-headphones-noise-cancellation-50h-battery-bluetooth-blue-HIOZFM7BF4" },
  // Amazon's own listing, verified on amazon.in on 24 Oct 2026 (ASIN
  // B09B917Z8D; price ₹4,499 cross-checked the same day on Gadgets360
  // and Smartprix, both reporting the Amazon price on 24 Oct 2026).
  { name: "Amazon Echo Dot (5th Gen) — Smart Speaker with Alexa, Black", brand: "Amazon", category: "Audio", priceInr: 4499, merchant: "Amazon", productUrl: "https://www.amazon.in/dp/B09B917Z8D" },
  { name: "WROGN White Checks Casual Shirt (M)", brand: "WROGN", category: "Fashion", priceInr: 1300, merchant: "Nykaa Man", productUrl: "https://www.nykaaman.com/wrogn-white-checks-collar-neck-casual-shirt/p/25892450" },
  { name: "The Rue Collection Men Casual Shirt", brand: "The Rue Collection", category: "Fashion", priceInr: 537, merchant: "Myntra", productUrl: "https://www.myntra.com/Shirts/The+Rue+Collection/The-Rue-Collection-Men-Casual-Shirt/42771913/buy" },
  { name: "Rareism Addkin Red Floral A-Line Dress", brand: "Rareism", category: "Fashion", priceInr: 2474, merchant: "Rareism", productUrl: "https://rareism.com/products/addkin-womens-dress-red" },
  { name: "GUESS Women Print Dress", brand: "GUESS", category: "Fashion", priceInr: 10570, merchant: "Guess India", productUrl: "https://guess.in/product/guess-women-print-dress-96407950" },
  { name: "AAYU Women Fit and Flare White Dress", brand: "AAYU", category: "Fashion", priceInr: 685, merchant: "Aayu Wear", productUrl: "https://aayuwear.com/products/aayu-women-fit-and-flare-white-dress" },
  { name: "Cetaphil Healthy Renew Face Serum 15g", brand: "Cetaphil", category: "Beauty", priceInr: 1620, merchant: "Blinkit", productUrl: "https://blinkit.com/prn/cetaphil-healthy-renew-face-serum-15-g/prid/745263" },
  { name: "WOW Skin Science Hyaluronic Acid Face Serum", brand: "WOW Skin Science", category: "Beauty", priceInr: 649, merchant: "WOW Skin Science", productUrl: "https://wowskinscience.com/products/advanced-2-hyaluronic-acid-face-serum" },
  { name: "Brillare 10% Vitamin C Face Serum", brand: "Brillare", category: "Beauty", priceInr: 895, merchant: "Brillare", productUrl: "https://www.brillare.co.in/products/vitamin-c-face-serum-for-bright-glowing-skin" },
];

const externalProductOut = z.object({
  id: z.number(),
  name: z.string(),
  brand: z.string(),
  category: z.string(),
  priceInr: z.number(),
  merchant: z.string(),
  productUrl: z.string(),
  createdAt: z.string(),
});

type ExternalProductRow = typeof schema.externalProducts.$inferSelect;

function toExternalProductOut(p: ExternalProductRow) {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand ?? "",
    category: p.category,
    priceInr: p.priceInr,
    merchant: p.merchant,
    productUrl: p.productUrl,
    createdAt: p.createdAt.toISOString(),
  };
}

function validateExternalProduct(a: {
  name: string;
  brand: string;
  category: string;
  priceInr: number;
  merchant: string;
  productUrl: string;
}): string | null {
  const missing: string[] = [];
  if (!a.name.trim()) missing.push("Product Name");
  if (!a.brand.trim()) missing.push("Brand");
  if (!a.category.trim()) missing.push("Category");
  if (!a.merchant.trim()) missing.push("Merchant Name");
  if (!a.productUrl.trim()) missing.push("Product URL");
  if (missing.length > 0) return `Missing: ${missing.join(", ")} — please fill in ${missing.length === 1 ? "this field" : "these fields"} and save again.`;
  if (!(a.priceInr > 0)) return "Price (INR) must be a positive number — please enter the price as listed on the merchant's site (more than ₹0).";
  const url = a.productUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) return "Product URL must start with http:// or https:// — please paste the full product link from the merchant's website.";
  try {
    new URL(url);
  } catch {
    return "Product URL does not look like a valid link — please paste the full product page address from the merchant's website.";
  }
  return null;
}

// Trusted-merchant catalog import (fetched live 2026-10-28 from
// brand stores and large retailers — NOT Amazon.in, which blocks
// automated browsing). Photos were uploaded to the frontend bundle
// (src/assets) in a separate commit; imageAsset holds the bundled
// filename. basePrice is the merchant price; the shop price shown
// to buyers adds the catalog profitPercent (20%), as with every
// other catalog product. oldPrice is the merchant list price
// where it was higher than the sale price, else null.
const TRUSTED_PRODUCTS: Array<{
  name: string; category: string; description: string; basePrice: number;
  oldPrice: number | null; profitPercent: number; stock: number;
  imageAsset: string; imageSourceUrl: string; catalogSource: string;
}> = [
  { name: "Galaxy Cookware 4 Piece Set | Kadhai with Lid, Fry Pan, Dosa Tawa | Induction Friendly | Cool Touch Bakelite Handles", category: "Home & Kitchen", description: "Wonderchef galaxy cookware set in the beautiful colours of red and black will add beauty to your kitchen start cooking healthy meals with minimum oil due to the pfoa free healthy non-stick coating make tasty dishes in th", basePrice: 2399, oldPrice: 4650, profitPercent: 20, stock: 50, imageAsset: "galaxy-cookware-4-piece-set-kadhai-with-lid-fry-pan-dosa-tawa-inductio.jpg", imageSourceUrl: "https://www.wonderchef.com/products/galaxy-cookware-4-piece-set-kadhai-with-lid-fry-pan-dosa-tawa-induction-friendly-cool-touch-bakelite-handles-pure-grade-aluminium-pfoa-free-2-years-warranty-brick-red?fbclid=IwAR6hiiq3SY2D1UytJJmBE7AfqvuIFP6q_ML61ERPWWL_pHc5tCkRt0SQf5Yq8w_maisc_J4MXmgh_QFWEjKu_PCM06g", catalogSource: "trusted" },
  { name: "Blueberry Non-Stick 2 Pc. Cookware Set, Fry Pan 24cm, Dosa Tawa 28cm, Non-toxic, Chemical & PFOA Free, Pure-grade", category: "Home & Kitchen", description: "Healthy Cooking Made Easy: MetaTuff 5-layer non-stick coating ensures minimal oil use, excellent abrasion resistance and is 100% free from PFOA, lead, cadmium, nickel, and arsenic and approved by USFDA and European Food ", basePrice: 1499, oldPrice: 2800, profitPercent: 20, stock: 50, imageAsset: "blueberry-non-stick-2-pc-cookware-set-fry-pan-24cm-dosa-tawa-28cm-non.jpg", imageSourceUrl: "https://www.wonderchef.com/products/blueberry-2pcs-set-fp24-dt28-blue?fbclid=IwAR6IhbQTNlG8GY8E9GxsGp89Knzj4xshc2AygPeujH5D3zrzG5OcJy07g28lVg_maisc_WGEleLvzRlqKwAeC7UuRqg", catalogSource: "trusted" },
  { name: "Meyer Luminescence Non-Stick 8-Piece Cookware Set, Red (Saucepan+Kadai+Frypan+Tawa+Accessories)", category: "Home & Kitchen", description: "Why buy the Meyer Luminescence Non-Stick 8-Piece Cookware Set, Red (Saucepan+Kadai+Frypan+Tawa+Accessories)? This set contains a 14cm saucepan, 26cm kadai with lid, 20cm frypan, 30cm flat tawa, a nylon turner, a nylon sp", basePrice: 6094, oldPrice: 9375, profitPercent: 20, stock: 50, imageAsset: "meyer-luminescence-non-stick-8-piece-cookware-set-red-saucepan-kadai-f.jpg", imageSourceUrl: "https://www.potsandpans.in/products/meyer-luminescence-non-stick-8-piece-cookware-set-red-diamond?utm_content=Facebook_UA&utm_source=facebook&variant=12542244585550&fbclid=IwAR6lDZwc_1lOuWRrTlYFyMH5oaSMJI2JVxVqQk8lcUSxnozW2LozfjXlNjYZWQ_maisc_8xbTeaXiQceTmOS7w5BGAA", catalogSource: "trusted" },
  { name: "Meyer Pre-Seasoned Cast Iron 3 Piece Cookware Set - 28cm Flat Dosa Tawa + 20cm Frypan + 26cm Curved Roti Tawa", category: "Home & Kitchen", description: "Why buy the Meyer Cast Iron Set of 28cm Flat Dosa Tawa + 20cm Frypan + 26cm Curved Roti Tawa? Strength at its best: Heavy gauge cast iron construction that will last for ages Naturally healthy cooking: Absolutely no coat", basePrice: 6731, oldPrice: 8975, profitPercent: 20, stock: 50, imageAsset: "meyer-pre-seasoned-cast-iron-3-piece-cookware-set-28cm-flat-dosa-tawa.jpg", imageSourceUrl: "https://www.potsandpans.in/products/meyer-pre-seasoned-cast-iron-3-piece-cookware-set-28cm-flat-dosa-tawa-20cm-frypan-26cm-curved-roti-tawa?utm_content=Facebook_UA&utm_source=facebook&variant=31614357798990&fbclid=IwAR5eGYo7THpewO1aNiqL3nkjYgo0nPxAASeEJybCSlCVdLWHXADABdNoGwadDA_maisc_HSwYuEFMQd-1NykEUB3jzg", catalogSource: "trusted" },
  { name: "Stainless Steel Water Bottle 1 Litre \u2013 Convex Shaped Steel Bottle", category: "Home & Kitchen", description: "Stainless Steel Water Bottle for Home, Office & Everyday Use Stay hydrated throughout the day with this Stainless Steel Water Bottle 1 Litre, designed in a distinctive convex shape for comfortable handling and everyday w", basePrice: 649, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "stainless-steel-water-bottle-1-litre-convex-shaped-steel-bottle.jpg", imageSourceUrl: "https://ashtok.com/products/stainless-steel-water-bottles-2liter?variant=40712003026997&utm_medium=feed&utm_campaign=meta_catalog&utm_content=product_card&fbclid=IwAR7V7dS1wFlgf84IH8aP9wnBx03ZW-MCQYUQorFQEvxF3TqQhP1MevVW2LpquQ_maisc_0B6r3JafT4GAZ9fKsfYkjA", catalogSource: "trusted" },
  { name: "Soundpeats Air 4 Pro 13mm Titanium Dynamic Driver, Qualcomm's QCC3071 Snapdragon Sound aptX Lossless, Built in 6 Mics", category: "Electronics", description: "One of the largest innovations in wireless audio has been announced: Qualcomm's brand new Snapdragon Sound technology. Soundpeats Air 4 Pro In India \ud83d\udd3bSnapdragon Sound with aptX Lossless\ud83d\udd3b13mm Dynamic Driver for Immersive ", basePrice: 7999, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "soundpeats-air-4-pro-13mm-titanium-dynamic-driver-qualcomm-s-qcc3071-s.jpg", imageSourceUrl: "https://www.soundpeats.in/products/soundpeats-air4-pro-true-wireless-earbuds-india?variant=42311448395842&utm_medium=feed&utm_campaign=meta_catalog&utm_content=product_card&fbclid=IwAR6r4l4rytzczldHz-4RI5wjBXEVGA1WaFjUvmNPWytRZgxq320HMu1lRIUTgQ_maisc_-n0xofRGQUKJLLCfvhas_g", catalogSource: "trusted" },
  { name: "JBL Portable Bluetooth Speaker (Go Essential) - 1 unit", category: "Electronics", description: "The JBL Go Essential is an ultra-compact portable Bluetooth speaker delivering powerful JBL Original Pro Sound. Stream music wirelessly for up to 5 hours on a single charge. With an IPX7 waterproof design and vibrant col", basePrice: 1699, oldPrice: 2999, profitPercent: 20, stock: 50, imageAsset: "jbl-portable-bluetooth-speaker-go-essential-1-unit.jpg", imageSourceUrl: "https://blinkit.com/prn/jbl-portable-bluetooth-speaker-go-essential-1-unit/prid/756989?lat=14.417860&lon=79.960040&utm_source=bl_ads_hylo&fbclid=IwAR7swIyTy5ujrtsWy_uWeNYz8MqENw4mVb4yK_egmwCsyduTlVuXkVD2phUC2A_maisc_z4wHqbpFSZOaBw7XIaCeJw", catalogSource: "trusted" },
  { name: "boAt Portable Bluetooth Speaker (Stone 120) - 1 unit", category: "Electronics", description: "Enjoy powerful 5W boAt Signature Sound with TWS support for 2X audio output. This portable speaker features dynamic RGB LED lighting, up to 12 hours playtime, and Type-C fast charging. With IPX4 splash resistance, built-", basePrice: 849, oldPrice: 2990, profitPercent: 20, stock: 50, imageAsset: "boat-portable-bluetooth-speaker-stone-120-1-unit.jpg", imageSourceUrl: "https://blinkit.com/prn/boat-portable-bluetooth-speaker-stone-120-1-unit/prid/799742?lat=19.224920&lon=73.080570&utm_source=bl_ads_hylo&fbclid=IwAR5t7SVCTpKbPK-weRvfi2EDECNopdKXjlwn-ZLsKRszISowikqQTU1kD0wGfA_maisc_coSrE3MrS8yp-aRQxEC43g", catalogSource: "trusted" },
  { name: "Xiaomi 4i Fast Charge 10000 mAh Power Bank - 1 unit", category: "Electronics", description: "Xiaomi Power Bank 4i features a 10000mAh high-density lithium-ion battery with 22.5W two-way fast charging, Type-C input and output, Power Delivery and Quick Charge 3.0 support. It supports triple-device charging through", basePrice: 1249, oldPrice: 2499, profitPercent: 20, stock: 50, imageAsset: "xiaomi-4i-fast-charge-10000-mah-power-bank-1-unit.jpg", imageSourceUrl: "https://blinkit.com/prn/xiaomi-4i-fast-charge-10000-mah-power-bank-1-unit/prid/563438?region_id=31862&utm_source=bl_ads_hylo&fbclid=IwAR69mGn7tKFDZFs_-Ao9oxbCodM5s1DV2oIsx3aOpomHk9nz2K9an354cK61dA_maisc_9NmPTrAGQwadyexhj8FSgA", catalogSource: "trusted" },
  { name: "boAt Energyshroom PB400 Pro | 20000mAh Fast Charging Power Bank", category: "Electronics", description: "Buy the boAt Energyshroom Pb400 Powerbank With 20000mah Battery online at boAt with travel-friendly design, high capacity and Type-C in & out. Shop the latest boAt range.", basePrice: 1399, oldPrice: 4499, profitPercent: 20, stock: 50, imageAsset: "boat-energyshroom-pb400-pro-20000mah-fast-charging-power-bank.jpg", imageSourceUrl: "https://www.boat-lifestyle.com/products/energyshroom-pb400-powerbank-with-20000mah-battery-capacity-with-smart-ic-protection?variant=40627696500834&fbclid=IwAR4ecoL--nMTFe4SCOwVFbU3rT2t1856E12G62Z1dYTc-Epae4hzYRm9MM9VoQ_maisc_JebCDso2Rhi4-5SkZxtIxg", catalogSource: "trusted" },
  { name: "Samsung Galaxy M 17 5G Smartphone (4 GB, 128 GB, Sapphire Black, 6.7\") - 1 unit", category: "Mobiles", description: "The Samsung smartphone showcases its stunning \u201cMonster Shades\u201d in Sapphire Black. Designed with a sleek, premium finish and a triple-camera setup, it stands out against a moonlit backdrop, highlighting its bold style and", basePrice: 15579, oldPrice: 17999, profitPercent: 20, stock: 50, imageAsset: "samsung-galaxy-m-17-5g-smartphone-4-gb-128-gb-sapphire-black-6-7-1-uni.jpg", imageSourceUrl: "https://blinkit.com/prn/samsung-galaxy-m-17-5g-smartphone-4-gb-128-gb-sapphire-black-6-7-1-unit/prid/727828?lat=12.993110&lon=77.603260&utm_source=bl_ads_hylo&fbclid=IwAR57NvkvXtPBmhn_oQZSuXkbsfdqWgwXeBrV6ORAJz04XzmL5dr50O0_Zn48iA_maisc_8HMMgagsRFyttVCBFIMqnA", catalogSource: "trusted" },
  { name: "REDMI 17C 5G Dark Night 6 GB + 128 GB", category: "Mobiles", description: "REDMI 17C 5G Dark Night 6 GB + 128 GB", basePrice: 22999, oldPrice: 44999, profitPercent: 20, stock: 50, imageAsset: "redmi-17c-5g-dark-night-6-gb-128-gb.jpg", imageSourceUrl: "https://www.mi.com/in/product/redmi-17c-5g/?skupanel=1&gid=4224101222&fbclid=IwAR5TmhzF2-yU7wyKW-58TqDo9F_KBmHyOASGTMOddwL38GiD9pnQiSmCWLeXsQ_maisc_Ynn4shozRuOTt1zyLFdzYQ", catalogSource: "trusted" },
  { name: "Redmi 12 5G", category: "Mobiles", description: "Introducing the Redmi 12 5G, a powerful and feature-packed smartphone that takes your mobile experience to the next level. With its sleek design and impressive performance, this device is perfect for tech enthusiasts and", basePrice: 11999, oldPrice: 19999, profitPercent: 20, stock: 50, imageAsset: "redmi-12-5g.jpg", imageSourceUrl: "https://mydukaan.io/redmi42/products/redmi-12-5g?sku_id=52528624&fbclid=IwAR7J77SeDuhaQisGDQgs6gRiSTQYGyz4p5jqztY9DvKN2Xtu_IGp2ISNgN3H0Q_maisc_RIPgxgANTC2UrBJA_Ix0HA", catalogSource: "trusted" },
  { name: "Redmi 15A 5G Ace Black 4 GB + 128 GB", category: "Mobiles", description: "Redmi 15A 5G Ace Black 4 GB + 128 GB", basePrice: 18499, oldPrice: 28999, profitPercent: 20, stock: 50, imageAsset: "redmi-15a-5g-ace-black-4-gb-128-gb.jpg", imageSourceUrl: "https://www.mi.com/in/product/redmi-15a-5g/?skupanel=1&gid=4224101056&fbclid=IwAR65k3tweFO0VeVnvSDIMAWl_bv9AkjXgcApITdsCp3IrqJ9y1_2N7B29ivg6A_maisc_5lOmhnEHQiayEJ45kFha9g", catalogSource: "trusted" },
  { name: "Galaxy S25 FE 512GB Navy | Samsung A Series Smartphone | 8GB RAM Dual SIM", category: "Mobiles", description: "Slimmer lighter and ready to impress. At just 0.74 cm thin and 190 grams light Galaxy S25 FE is the thinnest and lightest FE phone yet. It also features the slimmest bezels to date paired with a floating camera design fo", basePrice: 77999, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "galaxy-s25-fe-512gb-navy-samsung-a-series-smartphone-8gb-ram-dual-sim.jpg", imageSourceUrl: "https://www.samsung.com/in/smartphones/galaxy-s25/buy/?store_id=in&modelCode=SM-S731BDBHINS&fbclid=IwAR6yUFxKIH6YnQS8vg67Sr_wQin1xU6no1yBXqb2J9G-KaVeZBjv9qTt1d7TXQ_maisc_DIZ5kPaET2qIXYSg_6H6NA", catalogSource: "trusted" },
  { name: "Printed Cotton Half Sleeves Shirt", category: "Fashion", description: "Upgrade your casual wardrobe with this Printed Cotton half-sleeve shirt for Men, designed for effortless style and all-day comfort. Crafted from breathable cotton fabric, this slim-fit casual shirt features a smart, mini", basePrice: 840, oldPrice: 1400, profitPercent: 20, stock: 50, imageAsset: "printed-cotton-half-sleeves-shirt.jpg", imageSourceUrl: "https://successmenswear.com/products/half-sleeves-cotton-summer-shirt-5?utm_content=Facebook_UA&utm_source=facebook&variant=42784999997485&fbclid=IwAR7XyylpVJ0cPdEazpYvzFJYIxaeZP3dQgCIgrytr5JtB_EyTQx0WN-oHzSsBw_maisc_AgAYtvr-ThOUch2PJ1BJ7A", catalogSource: "trusted" },
  { name: "HERE&NOW Men Relaxed Fit Casual Cotton Oxford Shirt", category: "Fashion", description: "Blue Solid Opaque Casual shirts ,has a Spread Collar, Button Placket, Long Regular Sleeves, Curved hem", basePrice: 1999, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "here-now-men-relaxed-fit-casual-cotton-oxford-shirt.jpg", imageSourceUrl: "http://www.myntra.com/Shirts/HERE%26NOW/HERENOW-Men-Relaxed-Fit-Casual-Cotton-Oxford-Shirt/42811131/buy?fbclid=IwAR7vwNoWvKrlj2ljAnOunXisHkh3AhprtWiV8hCI0dPQZxnMM0QO2dPGTRSLpw_maisc_XGqP3bmJQG655PKA7BLI7Q", catalogSource: "trusted" },
  { name: "ASHTONAVA Men Classic Button-Down Collar Vertical solid Cotton Casual Shirt", category: "Fashion", description: "Yellow Textured Opaque Casual shirts ,has a Spread Collar, Button Placket, 1 Patch pocket, Long Roll-Up Sleeves, Curved hem", basePrice: 2299, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "ashtonava-men-classic-button-down-collar-vertical-solid-cotton-casual.jpg", imageSourceUrl: "http://www.myntra.com/Shirts/ASHTONAVA/ASHTONAVA-Men-Classic-Button-Down-Collar-Vertical-solid-Cotton-Casual-Shirt/42585302/buy?fbclid=IwAR5qhxojYwqjckFDxCgVMBFPOD6X2dPmQ4O_OouqhgKHlDGAlohFEnsd-c5qIA_maisc_b4nPbS1EQS6dB1DRLJYNAQ", catalogSource: "trusted" },
  { name: "Printed Cotton Blend Dress Cream / M-97 Cms", category: "Fashion", description: "Material: Cotton BlendPattern: PrintedStyle: FlaredSleeves: 3/4th SleevesNeck: Round NeckTop Type: KurtiKurta Length: MidiOccasion: Everyday WearMaterial Care InstructionMachine Wash", basePrice: 1617, oldPrice: 2695, profitPercent: 20, stock: 50, imageAsset: "printed-cotton-blend-dress-cream-m-97-cms.jpg", imageSourceUrl: "https://mbz.in/products/bs25-d-08-ol-950149-cot-drs?utm_source=bik&utm_medium=whatsapp&utm_campaign=journeys&utm_content=productUrl&fbclid=IwAR4i2gYyUGMaX4-X2-RR0Kyj5a5Peqf-uHPTu773PHlwTZowXrKW7i9OWKwINg_maisc_pYu3iphmRzSelupNYkVz1A", catalogSource: "trusted" },
  { name: "Men's Pure Cotton Plain Regular Fit Full Sleeve Formal Shirt - White", category: "Fashion", description: "Elevate your wardrobe with this Pure Cotton shirt in a refined White shade. Perfect for formal essential, this regular fit shirt is crafted with attention to detail, featuring a semi cut away collar and rounded cuff. The", basePrice: 1396, oldPrice: 2499, profitPercent: 20, stock: 50, imageAsset: "men-s-pure-cotton-plain-regular-fit-full-sleeve-formal-shirt-white.jpg", imageSourceUrl: "https://reidandtaylor.in/products/white-plain-100-cotton-regular-fit-formal-essential-full-sleeve-shirts?utm_content=Facebook_UA&utm_source=facebook&variant=50009459458362&fbclid=IwAR7dkm9cdBk5cvP4N8eaFB0CxrJWI02_phalefZy0BgoNuahVtHFm6Wnq7jZlw_maisc_0fUSYt-FS3KoTr3E-RgQJw", catalogSource: "trusted" },
  { name: "Nike Pegasus 42 Men's Road-Running Shoes (UK 6 (EU 40))", category: "Shoes", description: "Responsive cushioning in the Pegasus 42 provides an energised ride for everyday road runs. Experience power in every stride thanks to the propulsive feel of a curved, full-length Air Zoom unit and a ReactX foam midsole. ", basePrice: 12995, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "nike-pegasus-42-men-s-road-running-shoes-uk-6-eu-40.jpg", imageSourceUrl: "https://www.nike.in/nike-pegasus-42-men-s-road-running-shoes/p/27763452?fbclid=IwAR763CQyin4a7ugmQ1zzIxLEaHTA58q_LseWCK4M0zERCN4gj8rdxiCt_XavRQ_maisc_WkunTY24RL6atlxrbe8VvA", catalogSource: "trusted" },
  { name: "Nike Run Swift 3 Men's Road Running Shoes (9)", category: "Shoes", description: "Whatever the run, the Swift 3 will be there with undying support and devotion. It can help you get out the door for an easy 3 at the end of the day or an intense 2-mile there-and-back with a modified design that's suppor", basePrice: 4722, oldPrice: 6295, profitPercent: 20, stock: 50, imageAsset: "nike-run-swift-3-men-s-road-running-shoes-9.jpg", imageSourceUrl: "https://www.nike.in/nike-run-swift-3-men-s-road-running-shoes/p/27761604?fbclid=IwAR6xJVRdUkKFWm1SvOjbqqWDpUasOOOK4c4b_UzYWHFGem_zJJixXejsBw4QgQ_maisc_rRX_dQLwQzqG0CfHBpWJlg", catalogSource: "trusted" },
  { name: "Adidas ULTRARUN 5 Men Running Shoes Green", category: "Shoes", description: "Elevate running skills with the Ultrarun 5 Running Shoes for men. Crafted for energized runs, these shoes feature a textile upper and rubber outsole for durability and grip. The full-length Cloudfoam+ midsole offers supe", basePrice: 3999, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "adidas-ultrarun-5-men-running-shoes-green.jpg", imageSourceUrl: "https://www.decathlon.in/p/1000005065/adidas-ultrarun-5-men-running-shoes-green?fbclid=IwAR6ImaNhgMm8r9zkkNYL6DQIuItIQtucfmAfX1dm_VFMsOoLkW4tgfV4Wmq40g_maisc_sAiJvxPXRKS6fY9SUvPKPw", catalogSource: "trusted" },
  { name: "Power Grey Running Shoes For Men", category: "Shoes", description: "Whether you\u2019re hitting the track or powering through your daily jog, these Power Running Shoes for Men deliver unmatched comfort and style. Designed for men who demand performance and durability, these shoes combine mode", basePrice: 1499, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "power-grey-running-shoes-for-men.jpg", imageSourceUrl: "https://www.bata.com/in/men/shoes/sports/running/power-grey-running-shoes-for-men-500_2025_8392856_090.html?fbclid=IwAR4GLy5sqAJ01vhLXTNErcMwHclpoL6qsHiv8F_-l-BWF8O5pWMcfn49LYHeSQ_maisc_Kjsit-zQQ3y6d9wggPGw8A", catalogSource: "trusted" },
  { name: "cult Men's MotionGrid Running Shoes - Grey", category: "Shoes", description: "Make every mile feel lighter with these Cult Men's MotionGrid Running Shoes, engineered to keep you moving smoothly and confidently from daily runs to longer training sessions. The lightweight jacquard upper maximises ai", basePrice: 2625, oldPrice: 4599, profitPercent: 20, stock: 50, imageAsset: "cult-men-s-motiongrid-running-shoes-grey.jpg", imageSourceUrl: "https://cultstore.com/products/cult-men-s-motiongrid-running-shoes-grey-706985?utm_content=Facebook_UA&utm_source=facebook&variant=55971487613096&fbclid=IwAR7jWd1zmYYUWkXQHkYj8YzuydOyXVTau0rrL54xelzQwe0iRHVK4RUyfjzMWA_maisc_cq7gyKPVRqmiRWlmZbyb9Q", catalogSource: "trusted" },
  { name: "Sonata Analog Watch for Men - 7007YM02", category: "Watches", description: "Sonata Analog Watch for Men - 7007YM02 Taken from Sonata, this men's analog watch is an exquisite timepiece that merges practicality with contemporary style. It features a golden rectangular dial which is completed by a ", basePrice: 1895, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "sonata-analog-watch-for-men-7007ym02.jpg", imageSourceUrl: "https://www.krishnawatch.com/products/sonata-analog-watch-for-men-ns7007ym02?utm_content=Facebook_UA&utm_source=facebook&variant=44168368947253&fbclid=IwAR543x4ZJB1OAcn6QLZpKWQwhvWDMVwVdM-zR1cFmpXS3XhKgsjH1Z_2i_Ahag_maisc_J66GNjH1TG2CcrG-OXGceA", catalogSource: "trusted" },
  { name: "Casio G-Shock GG-1000-1A3DR Black Analog-Digital dial Resin G662", category: "Watches", description: "Case style: Digital watch with a round case and a stainless steel back Dial style: Black dial, has two digital displays for day and time Features: Shock-resistant, mud-resistant, super illuminator, world time, twin senso", basePrice: 19995, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "casio-g-shock-gg-1000-1a3dr-black-analog-digital-dial-resin-g662.jpg", imageSourceUrl: "http://www.myntra.com/Watches/CASIO/Casio-G-Shock-GG-1000-1A3DR-Black-Analog-Digital-dial-Resin-G662/1351837/buy?fbclid=IwAR7n_nK1IL0M06XtoZjp_oK-AEWUSgGxGVZ1Cd4euQPJ1b8nS73VUptH9xdQWg_maisc_2bv3e5g5S3uLwD4kN_Rdew", catalogSource: "trusted" },
  { name: "FOSSIL Men Solid Analog Watch- ME3219", category: "Watches", description: "Built with a durable strap and a stylish dial, this analog watch is an instant hit for its classy design. It comes with a secured closure, stylish dial and is water-resistant.", basePrice: 20995, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "fossil-men-solid-analog-watch-me3219.jpg", imageSourceUrl: "https://www.lifestylestores.com/in/en/SHOP-Fossil-FOSSIL-Men-Solid-Analog-Watch-ME3219-For-Men/p/1000011333760?fbclid=IwAR5lXLQkQM16nzcAinuysSbYsYELESSm_JB2GNXSXZKU8k8HG2NOenoD8Ih7Xg_maisc_5VJhniWbRAW8YnddLj_1vw", catalogSource: "trusted" },
  { name: "Alba Analog Men's Wristwatch AS9F33X1", category: "Watches", description: "Founded in Japan in 1979, Alba crafts exceptionally designed timepieces assembled with meticulous attention to detail. This men's analog watch benefits from the engineering expertise of the Seiko Watch Corporation. It de", basePrice: 4950, oldPrice: 5500, profitPercent: 20, stock: 50, imageAsset: "alba-analog-men-s-wristwatch-as9f33x1.jpg", imageSourceUrl: "https://watchfactory.in/products/alba-analog-mens-wristwatch-as9f33x1?utm_content=Facebook_UA&utm_source=facebook&variant=52036800184600&fbclid=IwAR5_NmLL-Rk6OVrVZpA-hyRFVoZVEYHvUmBilfkaiu5CZAcRJHkbtcOlWK8Mag_maisc_pecexmEKR7qM8Q5x_T1Ycg", catalogSource: "trusted" },
  { name: "Walrus Men Gold-Toned Dial & Gold-Toned Steel Straps Analogue Watch WWTM-DOUGLAS-060606", category: "Watches", description: "This Walrus analog watch for men brings together a gold-toned round patterned dial (42 mm) and a gold-toned stainless steel bracelet-style strap with a fold-over clasp for a look that works from morning to evening. Easy ", basePrice: 1595, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "walrus-men-gold-toned-dial-gold-toned-steel-straps-analogue-watch-wwtm.jpg", imageSourceUrl: "http://www.myntra.com/Watches/Walrus/Walrus-Men-Gold-Toned-Dial--Gold-Toned-Steel-Straps-Analogue-Watch-WWTM-DOUGLAS-060606/46916963/buy?fbclid=IwAR5egmXYx-tje7OFAHJF-5tm77DajK3EXE7Pqac3wOQA4G28oNEfbOuEtWhy4A_maisc_WeNsXAL_Qf-49aPSxqgxGQ", catalogSource: "trusted" },
  { name: "Skybags Propack Plus Laptop Backpack Blue", category: "Bags", description: "Upgrade your workday with the Skybags Propack Plus Laptop Backpack \u2014 a smart blend of minimal design, comfort, and functionality. Built for professionals, it features 3 spacious compartments, a padded laptop section, a f", basePrice: 1739, oldPrice: 3298, profitPercent: 20, stock: 50, imageAsset: "skybags-propack-plus-laptop-backpack-blue.jpg", imageSourceUrl: "https://skybags.co.in/products/skybags-propack-plus-laptop-backpack-blue?utm_content=Facebook_UA&utm_source=facebook&variant=51147350442265&fbclid=IwAR74QHZTiZDV7lajLCYL8SB6JWmE1a6CcC1lB1s3XAf56eajsC8abeHFSqb7jw_maisc_CiqsZxgWS9-s3lqbLS_xoQ", catalogSource: "trusted" },
  { name: "Skybags Thrive 01 Laptop Backpack Black", category: "Bags", description: "Skybags Thrive, the perfect backpack for young professionals and dreamers stepping into the working world. Sleek and subtle, yet packed with functionality, it features 3 compaertments including 17inch laptop compartment,", basePrice: 1365, oldPrice: 1625, profitPercent: 20, stock: 50, imageAsset: "skybags-thrive-01-laptop-backpack-black.jpg", imageSourceUrl: "https://skybags.co.in/products/skybags-thrive-01-laptop-backpack-black?utm_content=Facebook_UA&utm_source=facebook&variant=52168988328217&fbclid=IwAR7pXXGWpc9BEgFLhQAUb_dxP1QlVHNd-PhgS7YeRtxxAIkQQEVESq_qZ36ZNg_maisc_vx92nCF2TouhWhTbeGSf4Q", catalogSource: "trusted" },
  { name: "Gypsy 30 Litres Laptop Backpack-Red Brown", category: "Bags", description: "Designed for convenience and everyday functionality, the Gypsy 30 Backpack offers a 30-litre capacity with a lightweight 645 g build. It features 3 compartments that provide ample space to organize your daily essentials ", basePrice: 2999, oldPrice: 3749, profitPercent: 20, stock: 50, imageAsset: "gypsy-30-litres-laptop-backpack-red-brown.jpg", imageSourceUrl: "https://wildcraft.com/gypsy-30-litres-laptop-backpack-red-brown-13745?fbclid=IwAR726rLk1-pLgz-K2-g8Ks-OfZQ5YdsJoYqC9qwbRLgpPeZt71VNji2ez9Berg_maisc_jCPR63uzR0y2XXEcO20vnA", catalogSource: "trusted" },
  { name: "KHADIM Leather Handbag for Women", category: "Bags", description: "This smartly designed Leather Handbag from Khadim is the perfect accessory for casual use. An average sized bag, it is spacious on the inside so you can carry essentials like mobile, wallet, coin purse, small cosmetics a", basePrice: 2999, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "khadim-leather-handbag-for-women.jpg", imageSourceUrl: "https://www.khadims.com/products/khadim-leather-handbag-for-women-146011?utm_content=Facebook_UA&utm_source=facebook&variant=45944567267477&fbclid=IwAR6B58nI7L13blN2q5almq7yp3h3vznAhimhuBU5xlWbzI19X1yZtUH3zCptsA_maisc_4frXE0-RSyerZxErxcIMaA", catalogSource: "trusted" },
  { name: "HRX by Hrithik Roshan Unisex Black & Red Colourblocked Lifestyle Backpack", category: "Bags", description: "Black and red textured colourblocked lifestyle backpack One haul loop, has two padded and adjustable shoulder straps One main zip compartment with a slip pocket Two zip pockets on the front, one has an organiser sleeve A", basePrice: 1399, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "hrx-by-hrithik-roshan-unisex-black-red-colourblocked-lifestyle-backpac.jpg", imageSourceUrl: "http://www.myntra.com/Backpacks/HRX+by+Hrithik+Roshan/HRX-by-Hrithik-Roshan-Unisex-Black--Red-Colourblocked-Lifestyle-Backpack/1820129/buy?storeContext=fwd&fbclid=IwAR5ujQ1s4V6KeVALQQem5-oN4adZQiZySfmeTg0MsRfRxzRIaBdfFrpqtKez-Q_maisc_NEpa_CYaR3-lTr4cVZnVfA", catalogSource: "trusted" },
  { name: "Flow Yoga Mat 10MM", category: "Sports", description: "Every pose begins with a foundation \u2014 and comfort is the first step toward control. The NIVIA Flow Yoga Mat (10mm) is crafted for movers who want the perfect balance of stability and soft cushioning. Built from high-dens", basePrice: 1399, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "flow-yoga-mat-10mm.jpg", imageSourceUrl: "https://www.niviasports.com/products/nivia-flow-yoga-mat-10mm-black?utm_content=Facebook_UA&utm_source=facebook&variant=42938943799409&fbclid=IwAR5MqdaDh8nAURBwLAUxKeIjqBLTUqZrNEwezDdOkGa9vXyP76TjhLEpcvvcfQ_maisc_ju1xH0O2Sl2xsYsLgpvfgg", catalogSource: "trusted" },
  { name: "CULT Rectangular 6 MM Yoga Mat", category: "Sports", description: "Set Content: 1 Yoga mat Shape: Rectangular Material: Rubber Pattern: Textured Mat thickness: 6mm Colour: Beige Features: Anti-Slip", basePrice: 3199, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "cult-rectangular-6-mm-yoga-mat.jpg", imageSourceUrl: "http://www.myntra.com/Yoga-Mats/CULT/CULT-Rectangular-6-MM-Yoga-Mat/38316381/buy?fbclid=IwAR7os18UZNmnbEPir0HN_eYLqQPHaUUxKYfugCzy32XExdMfETMUwb6OsYB_OQ_maisc_R9i7BT9aSyKTBxRQ7g_1SQ", catalogSource: "trusted" },
  { name: "Country Color Training Football Size 5", category: "Sports", description: "Show your passion for the game with the NIVIA Country Color football. Made from high-durability molded rubber this ball is built for tough terrains like concrete and asphalt. Its smooth matte surface ensures consistent p", basePrice: 427, oldPrice: 449, profitPercent: 20, stock: 50, imageAsset: "country-color-training-football-size-5.jpg", imageSourceUrl: "https://www.niviasports.com/products/country-color-size-5-1360?utm_content=Facebook_UA&utm_source=facebook&variant=40607317819505&fbclid=IwAR5SHmGkNiWLKrGkfUSHmmMRWbmmbUOtziuaR6eOHxFgcNQ6FDN5evDMnVbRqQ_maisc_eIBGlwxOQDKvlwN0GfSA_w", catalogSource: "trusted" },
  { name: "Intense Xhale English Willow Cricket Bat", category: "Sports", description: "Weight: 1160 -1200 g (Mens) Handle: Short Handle Back Painted, Front cover with Face Grain Tape Made from top-quality Grade 5 Natural English Willow Handcrafted by master craftsmen Thick edges with full Profile Pronounce", basePrice: 10734, oldPrice: 11299, profitPercent: 20, stock: 50, imageAsset: "intense-xhale-english-willow-cricket-bat.jpg", imageSourceUrl: "https://www.dsc-cricket.com/intense-xhale.html?fbclid=IwAR6mFV5pCMzWg7RfV0zBK7jIwajeNeFPTPKQSL8EitXw065THjcP5pk6Oz_vOw_maisc_gCM4CqrHT4isUTdFaVxzTw", catalogSource: "trusted" },
  { name: "Weight Training Gloves 100, Lightweight, Breathable & Durable - Black", category: "Sports", description: "These weight training gloves are the perfect partner to keep your hands clean during your weight training sessions at the gym. These weight training gloves are like a second skin. They feature very light foam and a gripp", basePrice: 499, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "weight-training-gloves-100-lightweight-breathable-durable-black.jpg", imageSourceUrl: "https://www.decathlon.in/p/8595161/weight-training-gloves-100-lightweight-breathable-durable-black?fbclid=IwAR4_Ljch5ycE0vioniC-Xzh_-jqYn4koE7TWxdDgpBLXWW_cymYTf5rU_WVwCg_maisc_84-wiU-jR7KVyAjTLMxuig", catalogSource: "trusted" },
  { name: "Vitamin C 10% Face Serum", category: "Beauty", description: "When to use: AM / PM Frequency: Everyday", basePrice: 269, oldPrice: 299, profitPercent: 20, stock: 50, imageAsset: "vitamin-c-10-face-serum.jpg", imageSourceUrl: "https://beminimalist.co/products/vitamin-c-ethyl-ascorbic-acid-10-acetyl-glucosamine-1?utm_content=Facebook_UA&utm_source=facebook&variant=45154750103713&fbclid=IwAR4Z35K54-0oYF6yLyWPjvoxmj7FIBZm24Qv13v2mOQDYRqbb3vqOVAZGwCi3A_maisc_aUL4YeHVQI6E4OVznzN0Cw", catalogSource: "trusted" },
  { name: "15% Vitamin C & Mandarin Glow Boost Serum", category: "Beauty", description: "A vitamin C face serum is one of the fastest ways to bring life back to dull, tired skin. Plum's 15% Vitamin C & Mandarin Glow Boost Serum combines a stable, beginner-friendly dose of vitamin C with mandarin and Kakadu p", basePrice: 449, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "15-vitamin-c-mandarin-glow-boost-serum.jpg", imageSourceUrl: "https://plumgoodness.com/products/vitamin-c-face-serum?variant=39449880592444&utm_medium=feed&utm_campaign=meta_catalog&utm_content=product_card&fbclid=IwAR4k0uE-LN8fciFwTUKRzOuoUndJO8JQw83-5-FtakTxOeVdeyl767WKnRUHkg_maisc_VX61cV2MTr6xxEgOLOeaFw", catalogSource: "trusted" },
  { name: "Foxtale Golden Hour Glow Sunscreen (SPF 50 PA++++) - 30 ml", category: "Beauty", description: "Shield your skin from harmful UVA and UVB rays with sunscreen SPF 50. This powerful sunscreen provides broad-spectrum protection while keeping your skin glowing all day long.", basePrice: 233, oldPrice: 245, profitPercent: 20, stock: 50, imageAsset: "foxtale-golden-hour-glow-sunscreen-spf-50-pa-30-ml.jpg", imageSourceUrl: "https://blinkit.com/prn/foxtale-golden-hour-glow-sunscreen-spf-50-pa-30-ml/prid/764082?stack=dc%2F%3Fcollection_uuid%3DOTg3NjU0MzIxMjM0NTMzNDI%3D%26l1_uuid%3D12020%26collection_group_id%3D12020%26override_boost_product_ids%3D%5B764082%5D&region_id=34358&utm_source=bl_ads_hylo&fbclid=IwAR7MQyWvh76-tJSy2ldVBsEBo7Vkkr9d6cX4FYHP_oncp3bNR_sV9YUEpzyVvw_maisc_HwYzqZJYSg-iREcp96lanA", catalogSource: "trusted" },
  { name: "Rivona Naturals 99% Pure Aloe Vera Gel - 125 ml", category: "Beauty", description: "Rivona\u2019s 99% aloe Vera gel is a non-greasy multipurpose formulation with multiple beauty benefits for natural self-care. Try it now and experience the magic of aloe Vera gel! Dermatologically tested cruelty free paraben ", basePrice: 189, oldPrice: 299, profitPercent: 20, stock: 50, imageAsset: "rivona-naturals-99-pure-aloe-vera-gel-125-ml.jpg", imageSourceUrl: "https://blinkit.com/prn/rivona-naturals-99-pure-aloe-vera-gel-125-ml/prid/661896?region_id=42308&utm_source=bl_ads_hylo&fbclid=IwAR6YYxiUYGgrYESd43dCKjCTavxRMUoSnB1WH5NuFbmlGZnEz7lomOnLRZ7ZuA_maisc_2N7X6_p7S4mI1Iayze5n8Q", catalogSource: "trusted" },
  { name: "CeraVe Moisturizing Body Lotion (for Normal to Very Dry Skin) - 88 ml", category: "Beauty", description: "CeraVe Moisturizing Lotion \u2013 an effective lotion for dry skin. This CeraVe lotion nourishes and hydrates your skin (can be used for both face and body) & helps restore its protective barrier. Its lightweight, oil-free, a", basePrice: 520, oldPrice: 579, profitPercent: 20, stock: 50, imageAsset: "cerave-moisturizing-body-lotion-for-normal-to-very-dry-skin-88-ml.jpg", imageSourceUrl: "https://blinkit.com/prn/cerave-moisturizing-body-lotion-for-normal-to-very-dry-skin-88-ml/prid/679271?stack=dc%2F%3Fcollection_uuid%3DOTg3NjU0MzIxMjM0NTMzNDI%3D%26l1_uuid%3D204875%26collection_group_id%3D204875%26override_boost_product_ids%3D%5B679271%5D&region_id=33962&utm_source=bl_ads_hylo&fbclid=IwAR59gdsAzvhjPfarPfHFC1sBKvQ3kjEhrrcpkBl_YJx6Lck7Bd4iMbTBk8cCOw_maisc_Kmi-dTkJTwONZVlFdTXbqg", catalogSource: "trusted" },
  { name: "Swiss Beauty Matte Lipstick (213 Bare) - 3.8 g", category: "Cosmetics", description: "Experience the ultimate lip luxury with swiss beauty pure matte lipstick. This lipstick is designed to give you a soft matte finish that feels as incredible as it looks. The water-resistant formula ensures that your lip ", basePrice: 157, oldPrice: 229, profitPercent: 20, stock: 50, imageAsset: "swiss-beauty-matte-lipstick-213-bare-3-8-g.jpg", imageSourceUrl: "https://blinkit.com/prn/swiss-beauty-matte-lipstick-213-bare-38-g/prid/646111?stack=dc%2F%3Fcollection_uuid%3DOTg3NjU0MzIxMjM0NTMzNDE%3D%26l1_uuid%3D11672%26collection_group_id%3D11672%26override_boost_product_ids%3D%5B646111%5D&region_id=36519&utm_source=bl_ads_hylo&fbclid=IwAR6wmf1Cu1X3hGl5WCTgIvVBZW_OeXngjZcQN6JZ1GLSFVom2TK86M4K9WLpYA_maisc_JDeDNe4-SfiaiQQ2u19PEg", catalogSource: "trusted" },
  { name: "Iba Pure Lips Long Stay Matte Lipstick - M07 Red Velvet", category: "Cosmetics", description: "Iba introduces India's first halal-certified and vegan matte lip product. Iba Pure Lips Long Stay Matte Lipstick is formulated to provide a long-lasting, true matte look with a smooth, non-drying finish. All Iba lipstick", basePrice: 274, oldPrice: 365, profitPercent: 20, stock: 50, imageAsset: "iba-pure-lips-long-stay-matte-lipstick-m07-red-velvet.jpg", imageSourceUrl: "https://www.nykaa.com/iba-halal-care-pure-lips-long-stay-matte-lipstick/p/112659?ptype=product&skuId=112666&fbclid=IwAR549jVHz_UFnQJNznBsRett4okE3iLsYMr4npKwEPCSb9uBQdwL8zm7EK3gSA_maisc_1uhV76VoTmS0PAxAvmvnLg", catalogSource: "trusted" },
  { name: "essence Kajal Pencil - 08 Teddy (1 g)", category: "Cosmetics", description: "Buy essence Kajal Pencil - 08 Teddy (1 g) from essence for \u20b9168.00", basePrice: 168, oldPrice: 225, profitPercent: 20, stock: 50, imageAsset: "essence-kajal-pencil-08-teddy-1-g.jpg", imageSourceUrl: "https://www.tirabeauty.com/product/essence-kajal-pencil---08-teddy-1g-9zdhvxsjkazb?fbclid=IwAR4f9OxlCcFy7_wivLq04GeAvsLC4nm7DvBy_upjju9wYs4o82Ih_0x4vIcQxQ_maisc_O-y191JxTAe9SvpOQeHg2Q", catalogSource: "trusted" },
  { name: "RENEE Insta Touch Nail Paints - Set of 4", category: "Cosmetics", description: "Nailed It! Turn every manicure into a masterpiece with RENEE Insta Touch Nail Enamel- Pack of 4. With its highly pigmented formula, these nail paints give a glossy finish that instantly elevates your nails. Their quicky-", basePrice: 335, oldPrice: 399, profitPercent: 20, stock: 50, imageAsset: "renee-insta-touch-nail-paints-set-of-4.jpg", imageSourceUrl: "https://www.reneecosmetics.in/products/renee-insta-touch-nail-paints-set-of-4?utm_content=Facebook_UA&utm_source=facebook&variant=46341442797718&fbclid=IwAR6auKgz2zaaDrnWdQ29EqB1fwp_XOq7c5v562llUFtg_XCT30or3dU9K-fnsA_maisc_rpzXmODwQT2ddSI2abPLQA", catalogSource: "trusted" },
  { name: "Daily Life Forever52 Ultra Definition Liquid Foundation FLF008(30 ml)(Foundation)", category: "Cosmetics", description: "Daily Life Forever52 Ultra Definition Liquid Foundation delivers a 24 hour long results for concentrated coverage and a flawless finish that doesn't fade or shift all day. The saturated color pigments provide an ultra-tr", basePrice: 989, oldPrice: 1099, profitPercent: 20, stock: 50, imageAsset: "daily-life-forever52-ultra-definition-liquid-foundation-flf008-30-ml-f.jpg", imageSourceUrl: "https://www.purplle.com/track?campaign=FBC_2020_01_21_I_love_big_sale_catalog&dpl=1&redirect=https://www.purplle.com/product/daily-life-forever52-ultra-definition-liquid-foundation-flf008-30ml-15-14-73&fbclid=IwAR7gaW9QzdM18cT2DYxl4ztbUEO2wLHsuzwBc1EX8NTh6jbJZ0iYRc-DiaZNZg_maisc_tMNpsl0mRW-T8VunZkepyw", catalogSource: "trusted" },
];

const REAL_PRODUCTS_130: Array<{
  name: string; category: string; description: string; basePrice: number;
  oldPrice: number | null; profitPercent: number; stock: number;
  imageAsset: string; imageSourceUrl: string; catalogSource: string;
}> = [
  { name: "Ladies Premium Leather hand bag 99519", category: "Bags", description: "Model No - 99519 Mrp - 3299/- Product Type - Ladies Premium Leather hand bag Materials Use - GENUINE PREMIUM LEATHER Inner Lining Material : COTTON FABRIC No of main Compartments - 1 No of inner pockets - 6 Handle - 2 Dimensions - Height in cm - 19 c", basePrice: 3299, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "ladies-premium-leather-hand-bag-99519.webp", imageSourceUrl: "https://sreeleathersonline.com/products/ladies-premium-leather-hand-bag-5?utm_content=Facebook_UA&utm_source=facebook&variant=46303949390070&fbclid=IwAR7w0aGdVbjwaGhhzFhZUzh9tn_jKP7IETpCN5BngjmTvr-k9TvErk3IRUa6ig_maisc_L4ixOGFZS9WU9YF00zSqZQ", catalogSource: "trusted" },
  { name: "Ladies Premium Sling Bag | Stylish Compact Premium Crossbody Bag with 96047", category: "Bags", description: "Product Specifications * Model No.: 96047 * Product Type: Ladies Premium Sling Bag * Material: Premium Non-Leather * Inner Lining Material: Cotton Fabric * Colour : Tan * Main Compartments: 3 * Side Compartments: 1 * Dimensions: * Height: 20 cm * Wid", basePrice: 1695, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "ladies-premium-sling-bag-stylish-compact-premium-crossbody-bag-with-96047.webp", imageSourceUrl: "https://sreeleathersonline.com/products/ladies-premium-sling-bag-stylish-compact-crossbody-bag-with-premium-non-leather-finish-96051?utm_content=Facebook_UA&utm_source=facebook&variant=51101889265910&fbclid=IwAR6zW9nST0eB1EXu1OXqLObE9gkfXzncIrj41vEA0MTkNfIQoVff29s5e4_dPQ_maisc_DX_R8rWMS_Cxw0MmRTWZxA", catalogSource: "trusted" },
  { name: "Kids School Bag 54213", category: "Bags", description: "ART - 54213 MRP - 480/- BACKPACK MATERIAL- POLYESTER Height -42 cm Width -14 cm Length -30 cm No of Compartments -2 Spacious compartments Smart Sleeve 1 Front Pocket 2 side water bottle compartments", basePrice: 480, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "kids-school-bag-54213.webp", imageSourceUrl: "https://sreeleathersonline.com/products/kids-school-bag-54213?utm_content=Facebook_UA&utm_source=facebook&variant=46733747355894&fbclid=IwAR5DE9sWnrE-ANlWOHv9bU5cVocAlM_KFr0LOijcr2sHC7-MEUCdwwz9VfKsqw_maisc_E90ZbhK7RJaJ4AG5sNmWaQ", catalogSource: "trusted" },
  { name: "Laptop Backpack – Travel & Everyday Use 35374", category: "Bags", description: "Product Specifications: * Art No.: 35374 * Product Type: Laptop Backpack * Material: Polyester * Dimensions: * Height: 52 cm * Width: 25 cm * Depth: 36 cm * Main Compartments: 4 * Laptop Compartment: Yes * Quick Access Pocket: Yes * Bottle Holder: Ye", basePrice: 850, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "laptop-backpack-travel-everyday-use-35374.webp", imageSourceUrl: "https://sreeleathersonline.com/products/backpack-35374?utm_content=Facebook_UA&utm_source=facebook&variant=45433756352758&fbclid=IwAR42rD73Ki5NB8svSU2cxBLHaqTWqKqFX18xJowvGFEijfexV8JjSXkR4BBPjw_maisc_C3q-eDEnQ9ScU91NSNgqcQ", catalogSource: "trusted" },
  { name: "13 Black Leather Bi-Fold Wallet", category: "Bags", description: "Classic Hidesign's men bi-fold wallet which will never go out of style. Color: Black Leather: Ranch No Of Compartment: 1 Water Resistance: No Pattern: Solid Occasion: Casual Number Of Pockets: 1 Gender: Men Wash Care: Refer product care in PDP Style:", basePrice: 2795, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "13-black-leather-bi-fold-wallet.webp", imageSourceUrl: "https://hidesign.com/products/013-mens-black-bi-fold-wallet?variant=44455030456492&utm_medium=feed&utm_campaign=meta_catalog&utm_content=product_card&fbclid=IwAR58W4YBVLTn8PZ7SsipSA2JcfzMcmwof_wRoFUMKf4vbSGpSJ5dW_FdRW8fVQ_maisc_gArs6VhjQe-wQLm00-weGA", catalogSource: "trusted" },
  { name: "Power Play Women Totes", category: "Bags", description: "This stylish tote bag is perfect for everyday use it is made of durable polyurethane fabric and features a beautiful printed pattern that will turn heads the spacious interior can hold all your essentials and the comfortable handles make it easy to c", basePrice: 14400, oldPrice: 18000, profitPercent: 20, stock: 50, imageAsset: "power-play-women-totes.webp", imageSourceUrl: "https://guess.in/product/brown-logo-monogram-polyurethane-power-play-large-tech-tote-13758235?fbclid=IwAR66s8Q_waKKjo42_X2ZBicachSoOypDzXI460HlLl1VtPyPijGlPEzu1620eA_maisc_ZyJIDGWbRfmCWWG25C-qxA", catalogSource: "trusted" },
  { name: "Silia Women Totes", category: "Bags", description: "Discover elegance with our cream tote bag crafted from 100 pu fabric its textured pattern adds a sophisticated touch perfect for any occasion spacious and stylish this tote is designed for modern women who value both fashion and functionality elevate", basePrice: 11900, oldPrice: 17000, profitPercent: 20, stock: 50, imageAsset: "silia-women-totes.webp", imageSourceUrl: "https://guess.in/product/vanilla-logo-geometric-silia-tote-bag-17072951?fbclid=IwAR7BZlpSwuO-aRFtBhrsshRDeKlnd3JIV0twcjyar5ABM5LM_CZOoA0nhl-Meg_maisc_eIg4UbxFTwSD5kcERnLb6w", catalogSource: "trusted" },
  { name: "TESSA WOMEN'S TOTE BAG - NUDE", category: "Bags", description: "Tessa is a structured vertical tote bag featuring elegant leaf quilting in silky nappa leather. Designed for both work and evening looks, it is versatile, blending fashion with functionality. This tote also comes with a detachable zipper pouch to kee", basePrice: 6020, oldPrice: 8600, profitPercent: 20, stock: 50, imageAsset: "tessa-women-s-tote-bag-nude.webp", imageSourceUrl: "https://tohl.in/products/tessa-womens-vertical-tote-bag-nude?utm_content=Facebook_UA&utm_source=facebook&variant=41615634038839&fbclid=IwAR5N5dWyS5ciusiL0ptBqe99iv-ib5a3ofFwrTOvUFCbyfCzgHAN_v83K7BRdQ_maisc_VB8ZGFSvSjGKXgLw7VQEJA", catalogSource: "trusted" },
  { name: "AIR KIDS - 14L POLYSTER SCHOOL BACKPACK FOR KIDS", category: "Bags", description: "<ul> <li><span>Air Kids by Harissons Bags: Perfect School bag for Boys & Girls, this bag offers essential features to keep them organized.</span></li> <li><span>Bottle Pocket and Front Access Pocket: Conveniently store a water bottle and small valuab", basePrice: 657, oldPrice: 699, profitPercent: 20, stock: 50, imageAsset: "air-kids-14l-polyster-school-backpack-for-kids.webp", imageSourceUrl: "https://harissonsbags.com/products/air-kids-14-litres-polyester-school-backpack-for-kids?variant=40654510293053&fbclid=IwAR5nws4km5IT9FgiJhoD3ChadqMRK6X35_cNoRuzv5l6ZQsXhr9KXeNG72zaBg_maisc_eAYvE0jkRquxmf9DmaXXwQ", catalogSource: "trusted" },
  { name: "259-2020S  Brown Leather Bi-Fold Wallet", category: "Bags", description: "Urban city bifold wallet adds sophistication with a contrast stripe detail. Color: Brown Tabac Leather: Soho No Of Compartment: 1 Water Resistance: No Pattern: Solid Occasion: Casual Number Of Pockets: 1 Gender: Men Wash Care: Refer product care in P", basePrice: 3295, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "259-2020s-brown-leather-bi-fold-wallet.webp", imageSourceUrl: "https://hidesign.com/products/259-2020s-mens-brown-bi-fold-wallet?variant=44442608599212&utm_medium=feed&utm_campaign=meta_catalog&utm_content=product_card&fbclid=IwAR7r1eP9yEe7yxN1FVVMnLqgbTf63lrcvanfF5Bi-NUoQDgDDWv-nXt2IoDLdw_maisc_NSIF3iAFQjCuq0dAPRDVfQ", catalogSource: "trusted" },
  { name: "Caprese Kai Tote", category: "Bags", description: "Elevate your everyday style with the Caprese Kai Large Tote Bag, designed for women who value elegance and functionality. Made from premium faux leather with a sleek solid pattern, this Tote blends durability with sophistication. Its spacious interio", basePrice: 1391, oldPrice: 4799, profitPercent: 20, stock: 50, imageAsset: "caprese-kai-tote.webp", imageSourceUrl: "https://vipbags.com/products/caprese-kai-tote?variant=42981293260871&fbclid=IwAR5B1P7eyJcfOLjL5mbVXZ0fT7FgfvWZBeCkf0r_b-wM5aCYT-ziVP30Ai3Y7g_maisc_vgiYF2LnQXaJKsWG6T-HqQ", catalogSource: "trusted" },
  { name: "Skybags Stash 03 School Backpack, Blue", category: "Bags", description: "The Skybags Stash – a spacious and stylish school bag designed for kids who carry it all. With 3 roomy compartments, a quick-access front pocket, and multipurpose side pockets, it keeps books, bottles, and extras perfectly organized. The padded shoul", basePrice: 999, oldPrice: 2240, profitPercent: 20, stock: 50, imageAsset: "skybags-stash-03-school-backpack-blue.webp", imageSourceUrl: "https://skybags.co.in/products/stash-03-school-backpack-blue?utm_content=Facebook_UA&utm_source=facebook&variant=50983245185305&fbclid=IwAR6lfy9RO8bgZ_6dBWLPX-HZepuZc4ZO8c2s3Bou-DwmjCIPJGzTLEsNLaBr2A_maisc_knakGyYqRqCyW6qjZ4PCTQ", catalogSource: "trusted" },
  { name: "Maestro Plus Laptop Backpack Navy", category: "Bags", description: "Maestro Plus Laptop Backpack Navy", basePrice: 2999, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "maestro-plus-laptop-backpack-navy.webp", imageSourceUrl: "https://wildcraft.com/maestro-plus-laptop-backpack-11809-navy?fbclid=IwAR50JJZt94EYcL1yq1-V2q3YvdrCS-kULG1GlHqi1GDm185gCuorGpCYSSJDgQ_maisc_BtLde3RUTh-W_p1HnnTQGg", catalogSource: "trusted" },
  { name: "Milk Powder Face Wash (Pack of 2)", category: "Beauty", description: "Upgrade your cleansing routine with Vilvah’s Milk Powder Face Wash, a unique powder-to-foam formula powered by Rice Milk Powder, Hyaluronic Acid, and Papain Enzyme. Papain Enzyme helps break down excess oil, sweat, and dead skin buildup, clearing whi", basePrice: 929, oldPrice: 998, profitPercent: 20, stock: 50, imageAsset: "milk-powder-face-wash-pack-of-2.webp", imageSourceUrl: "https://www.vilvahstore.com/products/milk-powder-face-wash-pack-of-2?utm_content=Facebook_UA&utm_source=facebook&variant=43804823322687&fbclid=IwAR47PoOEsWOwMRRYytA7DEaNmqNJbm-LpmQALik8BtjJosasFw1kylviqtOZ_Q_maisc_LtIBkrm3Sdug1DMAsh_HRw", catalogSource: "trusted" },
  { name: "Body Cupid Citrus Body Lotion", category: "Beauty", description: "Body Cupid Citrus Crush Body Lotion is a vibrant fusion of citrus extracts. This luxurious blend wraps your skin in a fresh, zesty fragrance and transports you to a sunny Mediterranean grove surrounded by lemon trees. Experience intense hydration tha", basePrice: 799, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "body-cupid-citrus-body-lotion.webp", imageSourceUrl: "https://www.bodycupid.com/products/citrus-body-lotion?fbclid=IwAR69FuXS7nubTCiQMc3l1VcuwmQEV6Y1rYF46iL3bH6PhZZ1AHi5GJtFPgw9XQ_maisc_0LlFLe-ySoyX8wy3Nb9gNA", catalogSource: "trusted" },
  { name: "Light Moisturising Face cream 30g", category: "Beauty", description: "Peek-a-glow with our light-weight moisturiser specially formulated to hydrate oily skin and smooch normal skin with tons of love and care. It is time to let the rays of radiance shine upon your skin. Net Quantity - 30g", basePrice: 699, oldPrice: 790, profitPercent: 20, stock: 50, imageAsset: "light-moisturising-face-cream-30g.webp", imageSourceUrl: "https://deyga.in/collections/face-cream/products/light-moisturising-face-cream?fbclid=IwAR596_8oCjytjq9bU6RoJ9XZFGeJ2yMuod95M1qPCsbGAvUIeK1H7qWpABRE5g_maisc_jcavpWO1RF--7zm899p6oQ", catalogSource: "trusted" },
  { name: "Shop our Hair Serum with Argan & Arabian oud online", category: "Beauty", description: "Buy our HOB hair serum with argan & almond oil stimulating hair follicles and boosting hair growth. Vitamin E is a natural antioxidant preventing split ends.", basePrice: 749, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "shop-our-hair-serum-with-argan-arabian-oud-online.webp", imageSourceUrl: "https://houseofbeautyindia.com/products/hair-serum?fbclid=IwAR51vZMr87caDO-dxSI_n9AkK0V8WGvhzVbRroh_1kRVspv_MkS1hOY1SR-YpQ_maisc_8UhYeUiSTXSvejviVc2YEQ", catalogSource: "trusted" },
  { name: "Argan Hair Serum - 50ml", category: "Beauty", description: "WHY ARGAN SERUM? * Argan Oil Serum often called Liquid Gold is extremely rich in beneficial nutrients such as fatty acids and Vitamin E. Packed with essential nutrients and antioxidants; it nourishes and moisturizes the hair, while repairing damaged ", basePrice: 399, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "argan-hair-serum-50ml.webp", imageSourceUrl: "https://inatur.in/products/moroccan-argan-oil-hair-serum?utm_content=Facebook_UA&utm_source=facebook&variant=30226652889151&fbclid=IwAR6X1whYEL7DmZ5t4_KQYPKQjJZmrzYC-yTH0U5u7kvnu7hCRLHkas1DYIV72A_maisc_eNEWwg2lRgq6sNdHU_z1MA", catalogSource: "trusted" },
  { name: "Kazima 10% Vitamin C Face Serum - 30 ml", category: "Beauty", description: "The Kazima Vitamin C Face Serum is expertly formulated to revitalize and brighten your skin. Infused with potent Vitamin C, this serum works as a powerful antioxidant to combat dullness and uneven skin tone, making it an essential part of your skinca", basePrice: 199, oldPrice: 560, profitPercent: 20, stock: 50, imageAsset: "kazima-10-vitamin-c-face-serum-30-ml.webp", imageSourceUrl: "https://blinkit.com/prn/kazima-10-vitamin-c-face-serum-30-ml/prid/718697?stack=dc%2F%3Fcollection_uuid%3DOTg3NjU0MzIxMjM0NTMzNDI%3D%26l1_uuid%3D206263%26collection_group_id%3D206263%26override_boost_product_ids%3D%5B718697%5D&region_id=45708&utm_source=bl_ads_hylo&fbclid=IwAR7BmCOKyz0uCbNzKpPF4oAYKbi0be2DY8RABjw2A02zC5LqRavTqpWYq6LpVQ_maisc_8Wf47-gXTjOrMmfRPVTwCA", catalogSource: "trusted" },
  { name: "Vitamin C Serums for Face: Glowing Skin & Anti-Aging Benefits", category: "Beauty", description: "Unlock Radiant Skin with the Best Vitamin C Face Serum Avimee Herbal’s Vitamin C Serum for Face is your go-to solution for brightening and revitalizing your skin. Enriched with powerful antioxidants, this serum targets common skin concerns like dulln", basePrice: 550, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "vitamin-c-serums-for-face-glowing-skin-anti-aging-benefits.webp", imageSourceUrl: "https://avimeeherbal.com/products/vitamin-c-serum-for-face?variant=49336375640280&utm_medium=feed&utm_campaign=meta_catalog&utm_content=product_card&fbclid=IwAR7kJV2DJZmC5fgThTnnHuzt6mgaJc9PoLUcCGBVFr26KC6evMcLd-b9Wett5w_maisc_mHpELjrtROGMpCMEHtfsyg", catalogSource: "trusted" },
  { name: "Vitamin C Serum 10 ml-FREE", category: "Beauty", description: "Clinically proven results cruelty free plant bio-Actives", basePrice: 299, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "vitamin-c-serum-10-ml-free.webp", imageSourceUrl: "https://www.dotandkey.com/products/vitamin-c-serum-10-ml-free?fbclid=IwAR6jDYvQAm5r47zUzou0mbB7Ut8XoupUoqKzL6xOm0KRTgB5nGQs7T3Nmu6DFg_maisc_XLlPcJrDTs2k9n9XSvroWw", catalogSource: "trusted" },
  { name: "Bake 20% Vitamin C Face Serum for Pigmentation & Dark Spots, 30ml", category: "Beauty", description: "Bake 20% Vitamin C Face Serum is scientifically formulated to rejuvenate and brighten your complexion. Infused with Ethyl Ascorbic Acid, the serum delivers powerful antioxidant benefits to promote glowing, radiant skin. With its high concentration of", basePrice: 575, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "bake-20-vitamin-c-face-serum-for-pigmentation-dark-spots-30ml.webp", imageSourceUrl: "https://www.clickoncare.com/products/bake-20-vitamin-c-face-serum-for-pigmentation-dark-spots-30ml?variant=49499023343935&utm_medium=feed&utm_campaign=meta_catalog&utm_content=product_card&fbclid=IwAR7K3qClNQT82gj9KvDd7MBbzonmKdrWryViwOZElnwmcthKIPHUm4cVc_xZHQ_maisc_aH2lM8cEQ4SnpEgR4Xd8Yg", catalogSource: "trusted" },
  { name: "VI-JOHN Prakritik Vitamin C Face Serum", category: "Beauty", description: "Crafted after time-tested patience & research our Vitamin C Serum is a complete game-changer in the skincare industry. Embedded with versatile properties, it can be a part of your both AM & PM routine to help you encounter several skin benefits. A re", basePrice: 599, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "vi-john-prakritik-vitamin-c-face-serum.webp", imageSourceUrl: "https://www.nykaa.com/vi-john-prakritik-vitamin-c-face-serum/p/18057346?ptype=product&skuId=18057346&fbclid=IwAR5TrlJTFYT8axdDhvXrtbJRaEy2Xr3eZdZIhtpT3KTLYDn8RL1ISqLyDZqsIA_maisc_dJ9YT0wMRce661cdPHjjbg", catalogSource: "trusted" },
  { name: "Argan Oil Hair Serum for Smooth & Nourished Hair", category: "Beauty", description: "Give your hair the care it deserves with Olivia Beauty Argan Oil Hair Serum, specially formulated to provide moisture-lock nourishment and improve the appearance of dry, dull and frizzy hair. Enriched with Argan Oil Extract, this lightweight hair ser", basePrice: 130, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "argan-oil-hair-serum-for-smooth-nourished-hair.webp", imageSourceUrl: "https://www.oliviabeauty.in/products/argan-oil-hair-serum?utm_content=Facebook_UA&utm_source=facebook&variant=43626975494389&fbclid=IwAR5SehKj_nSOiiB3wSXHCHL-E23dqnqFPMGrt9gsJLuHmU6xuLfMZeLOzzqIxQ_maisc_1_Ar8BNMT7CHsRc5PnGRuw", catalogSource: "trusted" },
  { name: "R&G Vitamin C Face Serum", category: "Beauty", description: "Skin Brightening Dark Spot Reduction Radiant Glow", basePrice: 644, oldPrice: 699, profitPercent: 20, stock: 50, imageAsset: "r-g-vitamin-c-face-serum.webp", imageSourceUrl: "https://vasustore.com/products/r-g-vitamin-c-face-serum-for-skin-brightening-help-reduce-fine-lines-wrinkles-dark-spots-evens-skin-tone-and-promotes-visibly-radiant-smoother-healthier-looking-skin?variant=43255473766659&fbclid=IwAR7QNCukEODqs0JGXcnVhEglWngAE2CQ0TVxHd-JfR6HJieuJEWNcOYz_74SJg_maisc_x5rZ_0Y7Q-ayzJiuVlWCQw", catalogSource: "trusted" },
  { name: "Dr.Rashel Vitamin C Face Serum - 30 ml", category: "Beauty", description: "Vitamin C Face Serum by Dr. Rashel Gives You Glowing Skin, Reduce Dark Spots ,Reduces Open Pores, Improves Skin Elasticity & Reduces Age Spots Natural Vitamin C Acts as An Antioxidant and Helps Repair Cells, Tissues, and The Functioning of Many Enzym", basePrice: 299, oldPrice: 399, profitPercent: 20, stock: 50, imageAsset: "dr-rashel-vitamin-c-face-serum-30-ml.webp", imageSourceUrl: "https://blinkit.com/prn/drrashel-vitamin-c-face-serum-30-ml/prid/620776?stack=dc%2F%3Fcollection_uuid%3DOTg3NjU0MzIxMjM0NTMzNDI%3D%26l1_uuid%3D206263%26collection_group_id%3D206263%26override_boost_product_ids%3D%5B620776%5D&region_id=33980&utm_source=bl_ads_hylo&fbclid=IwAR7ESWs8SONS4rFYK6yTxS2FSRSevCGZCqRTantwe5vDE3te11SpxH5orgHXNg_maisc_OFyTjiv8S2WGluRD1hhq9g", catalogSource: "trusted" },
  { name: "Bold Eyes Super Lash Mascara Waterproof", category: "Cosmetics", description: "• Water-resistant formula for long-lasting wear and smudge-free results. • Achieve bold, voluminous lashes that stay defined all day. • Wiggle the wand at the base and swipe upward for maximum volume and lift.", basePrice: 299, oldPrice: 499, profitPercent: 20, stock: 50, imageAsset: "bold-eyes-super-lash-mascara-waterproof.webp", imageSourceUrl: "https://swissbeauty.in/products/bold-eyes-super-lash-mascara-waterproof-sb-8095?variant=41887448629443&fbclid=IwAR4rTKnsra7le_LmRwfecfRjhh9OD_ueaM1plNmkj5gOsd7sZfYUD7vjfit0KQ_maisc_R6ASlAjySZepO-DZ6uTmiw", catalogSource: "trusted" },
  { name: "Quintessential Series (15 Brushes)", category: "Cosmetics", description: "Get the best combination of a makeup brush set assembled to give you just what is needed. Whether you are a professional makeup artist or a makeup maven who loves to get makeup done just right there’s a brush for every stroke and swipe. PAC Quintesse", basePrice: 3495, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "quintessential-series-15-brushes.webp", imageSourceUrl: "https://www.paccosmetics.com/products/quintessential-series-15-brushes?utm_content=Facebook_UA&utm_source=facebook&variant=47314483446036&fbclid=IwAR540M6PnJwys9BFnpg4F7YqpVGyKb2_fJvIfwUAutDPzixLfyKw0mJlgfwYVw_maisc_C_RMNoWLQFCjX-IBvMSCJg", catalogSource: "trusted" },
  { name: "Rock & Rose Eyeshadow Palette (50 Colors)", category: "Cosmetics", description: "The perfect blend of bold mattes, irresistible shimmers, and chromatic hues merged into one versatile makeup eyeshadow palette, ideal for beginners and professional artists. The PAC Rock & Rose Eyeshadow Palette features 50 highly pigmented shades in", basePrice: 4995, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "rock-rose-eyeshadow-palette-50-colors.webp", imageSourceUrl: "https://www.paccosmetics.com/products/rock-rose-eyeshadow-palette-50-colors?utm_content=Facebook_UA&utm_source=facebook&variant=49511273890068&fbclid=IwAR5AFhUbOVWcytlmNqmNiMT3kZJR17Rcn-Xj_d54VquoUL1MXx_lpPSo5D2NCA_maisc_KUgg7ElPRFmSY_ttQIp7SQ", catalogSource: "trusted" },
  { name: "CHANEL LES BEIGES SERUM CONCEALER Natural Healthy Glow - B120 - 8.5 g - Makeup Complexion Concealer", category: "Cosmetics", description: "The first serum concealer by CHANEL offers a second-skin finish and works to awaken and illuminate the eye area, as if you had spent the day in the great outdoors. Providing weightless, buildable coverage, it wears flawlessly without creasing, for al", basePrice: 5550, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "chanel-les-beiges-serum-concealer-natural-healthy-glow-b120-8-5-g-makeup-complexion-concealer.webp", imageSourceUrl: "https://www.chanel.com/in/makeup/p/184038/les-beiges-serum-concealer-natural-healthy-glow/?fbclid=IwAR6l_U5V6OoYZt9yTgW8LoXK4SSuYp77jkR4RHnxgDxZFGSHjM86UhHpZ_08rQ_maisc_sFHg9W9JRg6geHtRAwEJmQ", catalogSource: "trusted" },
  { name: "Spotlight Liquid Foundation (30ml) 08 Frosted Cake", category: "Cosmetics", description: "PAC’s Spotlight Liquid Foundation is specially designed to provide a natural-looking, skin-like finish that lets your skin breathe. With its creamy, blendable texture, this foundation balances your complexion and provides a zero-shine effect for a sm", basePrice: 1295, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "spotlight-liquid-foundation-30ml-08-frosted-cake.webp", imageSourceUrl: "https://www.paccosmetics.com/products/spotlight-liquid-foundation?utm_source=bik&utm_medium=whatsapp&utm_campaign=journeys&utm_content=productUrl&fbclid=IwAR63tge3Y5ewqqaQWK4sDHP75JoZnsxNQt1G4mIQI0o2ZduEJMPxzw_SbdOHsg_maisc_3xmWdR6SR6GVKbQVSfgckg", catalogSource: "trusted" },
  { name: "CHANEL LES 4 OMBRES Multi-effect Quadra Eyeshadow - 266 - TISSÉ ESSENTIEL - Nude - 1.2 g - Makeup Eyes Eye Palette", category: "Cosmetics", description: "A palette of four eyeshadows that features the most advanced innovation to enhance creativity. Its optimised formula unites a soft texture and an easy application to achieve maximum colour that is consistent and luminous. The shades come in a variety", basePrice: 6300, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "chanel-les-4-ombres-multi-effect-quadra-eyeshadow-266-tiss-essentiel-nude-1-2-g-makeup-eyes-eye-pale.webp", imageSourceUrl: "https://www.chanel.com/in/makeup/p/164266/les-4-ombres-multi-effect-quadra-eyeshadow/?fbclid=IwAR71e8MR-pZe1kpbfL4rauuFTNLmV37idum3-YB5uEPg6o2hiiUR7tQ-TYkIiw_maisc_sqZk30OVQX6gUZYsJTztew", catalogSource: "trusted" },
  { name: "Olivia Drameyetics Eyeshadow Palette", category: "Cosmetics", description: "Bring your eye makeup looks to life with Olivia Beauty Eyeshadow Palette, featuring 9 richly pigmented shades in a versatile combination of matte, shimmer, satin and metallic finishes. Designed to complement all skin tones, the eyeshadow palette offe", basePrice: 499, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "olivia-drameyetics-eyeshadow-palette.webp", imageSourceUrl: "https://www.oliviabeauty.in/products/eyeshadow-palette?utm_content=Facebook_UA&utm_source=facebook&variant=46951363772661&fbclid=IwAR6KVs_FETFkg8NvtG5QjRoifJltiyJ564DsCoyi5fB5ogx8fVhn-BFvf_v2AA_maisc_In6peYpFRMy83-T4krt5aA", catalogSource: "trusted" },
  { name: "Iba Must Have Waterproof Concealer, 8 ml", category: "Cosmetics", description: "Net Content : 8 ml Suitable for all skin types Iba Must Have Waterproof Concealer has to be the ultimate essential for your makeup kit because this concealer is a multitasking makeup product. This concealer helps in camouflaging dark circles, puffine", basePrice: 492, oldPrice: 615, profitPercent: 20, stock: 50, imageAsset: "iba-must-have-waterproof-concealer-8-ml.webp", imageSourceUrl: "https://ibacosmetics.com/products/iba-must-have-waterproof-concealer?variant=40726378021047&fbclid=IwAR6-tFZ6AWnL_8Rk_0p3h8YzVbY4NjgFqmAhghNKaWJL2sd-_kO1lXW4bspHtw_maisc_OzUJo8omTxmDZGtpPB5PXQ", catalogSource: "trusted" },
  { name: "Signature Kajal | Intense Black", category: "Cosmetics", description: "Suitable For Sensitive Eyes | Suitable For Contact Lens Wearers | Gives Flawless Look", basePrice: 220, oldPrice: 275, profitPercent: 20, stock: 50, imageAsset: "signature-kajal-intense-black.webp", imageSourceUrl: "https://www.jovees.com/collections/beauty/products/signature-kajal?fbclid=IwAR5RuEaRSJoF0a_O0HFA6dyUSoqKz0srVEUm2Tof4C3vM8X9dMvu1X8p66DeHw_maisc_ICOXJTkkQluEvt0F_hcoYA", catalogSource: "trusted" },
  { name: "PAC Blush Brush - 302", category: "Cosmetics", description: "Large powder brush specialised 'tips' to pick up and distribute setting powder perfectly (with minimal absorption).Features:High-performance makeup brushes with super fine densely packed bristles for instant high coverageThese professional quality ma", basePrice: 491, oldPrice: 545, profitPercent: 20, stock: 50, imageAsset: "pac-blush-brush-302.webp", imageSourceUrl: "https://www.nykaa.com/pac-powder-brush-302/p/82239?ptype=product&skuId=82239&fbclid=IwAR4_h4ZuefIW1117bG__u-OKxgox3_vx1yPUgxPIvU0YFYs7K134aNcFjeDNvg_maisc_51OLmCssRQOWHjuG-OD0kw", catalogSource: "trusted" },
  { name: "shape tape™ concealer", category: "Cosmetics", description: "what it is The iconic full coverage matte concealer for instantly covering dark circles, blemishes + redness with 16-hour wear. why we love it Full coverage without the full feel from the #1 concealer brand*. shape tape™ original concealer delivers i", basePrice: 4260, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "shape-tape-concealer.webp", imageSourceUrl: "https://tartecosmetics.com/en-in/products/shape-tape-concealer?variant=52789612937238&fbclid=IwAR6NhM0lVLkccG_1j7oYQTQkp5lCm5mjmINXJ4meM3GsDQcPjCoxv3uM-CVBQg_maisc_Er7Khv6FRYGFjyG8wyeK7g", catalogSource: "trusted" },
  { name: "M.A.C In Extreme Dimension Waterproof Mascara Lash - Dimensional Black", category: "Cosmetics", description: "Country of Origin: Belgium / Canada / Czech Republic / Dominican Republic / France / Germany / Italy / Japan / South Korea / Mexico / North Macedonia / Poland / SwitzerlandGeneric Name: MakeupName of Mfg / Brand: Estee Lauder CompaniesAddress of Mfg ", basePrice: 2950, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "m-a-c-in-extreme-dimension-waterproof-mascara-lash-dimensional-black.webp", imageSourceUrl: "https://www.nykaa.com/m-a-c-in-extreme-dimension-waterproof-mascara-dimensional-black/p/91214?ptype=product&skuId=91214&fbclid=IwAR72CdHYDSMp0zzyxibiR3tEjqCmen2Rv7NPBp5zZINtbvvv9Fn_i7AUMtkGRg_maisc_B8AZsTbZQzakFAPzLIrqhg", catalogSource: "trusted" },
  { name: "Melt Cosmetics Gemini Eyeshadow Palette", category: "Cosmetics", description: "A ten-shade eyeshadow palette.Perfect for any vibe or occasion, the Melt Cosmetics Gemini Eyeshadow Palette belongs in your makeup collection. With ten bold, super-pigmented shades to choose from, in both matte and metallic textures, this soft, warm ", basePrice: 5513, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "melt-cosmetics-gemini-eyeshadow-palette.webp", imageSourceUrl: "https://www.beautybay.com/p/melt-cosmetics/gemini-eyeshadow-palette/?fbclid=IwAR5fLFJxAOm_F7-MyU4yivUcoKvwr4XJoSHPyd2ZqNfJgrvpQUGtUv_E3fb82Q_maisc_hP2nSK3pS6G3Q2n_GSZEGg", catalogSource: "trusted" },
  { name: "boAt Airdopes Plus 318 | Bluetooth Earbuds with 100H Playback", category: "Electronics", description: "Discover seamless sound with the boAt Airdopes Plus 318 Earbuds, featuring 100 hours of playback, 4 mics powered by ENx™ Technology, BEAST™ Mode for enhanced performance, and ASAP™ Charge capability. Shop Now!", basePrice: 1499, oldPrice: 4990, profitPercent: 20, stock: 50, imageAsset: "boat-airdopes-plus-318-bluetooth-earbuds-with-100h-playback.webp", imageSourceUrl: "https://www.boat-lifestyle.com/products/airdopes-plus-318-bluetooth-wireless-earbuds?variant=41937386733666&fbclid=IwAR7HkmcKttYkgLkb2ZBGssAOcBaXgQLt9YtgCcI6Cx7FRi4FJDlaf1UgNfrBNQ_maisc_nqcEFjlATt2bfMLnDarOaA", catalogSource: "trusted" },
  { name: "Monitor III A.N.C. - Active noise cancelling headphones with wireless playtime.", category: "Electronics", description: "Focus on your music with over-ear headphones complete with active noise cancellation. Fully adjustable, with hours of wireless playtime.", basePrice: 22999, oldPrice: 29999, profitPercent: 20, stock: 50, imageAsset: "monitor-iii-a-n-c-active-noise-cancelling-headphones-with-wireless-playtime.webp", imageSourceUrl: "https://www.marshall.com/in/en/product/monitor-iii-anc?pid=1009077&fbclid=IwAR4O2CnNqrDftl6c-gkXtSBquReDdZRwyKPvbKnEzEa07Zr8T6HPWbiyTggdOQ_maisc_qSBFLsHcTI2BHhjUhi2TBA", catalogSource: "trusted" },
  { name: "ERD PB-130 Fast Charging 10000 mAh Power Bank (Black) - 1 unit", category: "Electronics", description: "10000 mAh BIS-approved power bank with Li-Polymer cells and slim polycarbonate body. Charges in ~5 hours via USB-A or USB-C. Supports fast charging up to 25W (USB-A & USB-C outputs). LED indicators and button to check battery level. Safe, reliable pe", basePrice: 876, oldPrice: 1609, profitPercent: 20, stock: 50, imageAsset: "erd-pb-130-fast-charging-10000-mah-power-bank-black-1-unit.webp", imageSourceUrl: "https://blinkit.com/prn/erd-pb130-fast-charging-10000-mah-power-bank-black/prid/741814?region_id=43993&utm_source=bl_ads_hylo&fbclid=IwAR7DNN6CJovwhrTenzdkhG3jAhvtYLvnouaxFWe_e7YWkC4iZJBP9T4yKgHAZw_maisc_o-u54hBHQGCBKwkgDe57Bw", catalogSource: "trusted" },
  { name: "Buy Ki-Pad 5 Wired Gaming Keyboard Mouse Combo", category: "Electronics", description: "Buy Portronics Ki Pad 5 wired gaming keyboard & mouse combo with adjustable DPI up to 3600, 19-key anti-ghosting, RGB lighting & ergonomic design for gamers.", basePrice: 1199, oldPrice: 2999, profitPercent: 20, stock: 50, imageAsset: "buy-ki-pad-5-wired-gaming-keyboard-mouse-combo.webp", imageSourceUrl: "https://www.portronics.com/products/ki-pad-5?variant=50904326111456&fbclid=IwAR7uRThllJk16BuIxl3wrbcipvtsSHWjQf6EZEZOZaAD6SeYQmCsR1fNtO8n_Q_maisc_7_qiLMXNQlKAYIwk_HPM-g", catalogSource: "trusted" },
  { name: "Portronics Fynix Portable Bluetooth Speaker (POR-2982) - 1 unit", category: "Electronics", description: "Powerful audio on the go with this 30W portable Bluetooth speaker, perfect for outdoor parties, travel, or home use. Featuring Bluetooth 5.3 for faster pairing and stable connections, it offers TWS pairing, up to 6 hours playtime, Type-C fast chargin", basePrice: 2632, oldPrice: 3999, profitPercent: 20, stock: 50, imageAsset: "portronics-fynix-portable-bluetooth-speaker-por-2982-1-unit.webp", imageSourceUrl: "https://blinkit.com/prn/portronics-fynix-portable-bluetooth-speaker-por-2982-1-unit/prid/699057?region_id=40520&utm_source=bl_ads_hylo&fbclid=IwAR4kt49i_AFOFVq-JgqRRRoeZRwqsczohJHi9OrJ7JyFm4_Nj8UFuVSQwpNjzg_maisc_Cozw-XUvTSeaSWNiVACb5Q", catalogSource: "trusted" },
  { name: "Unix Blake Boom RA 20W Portable Wireless Bluetooth Speaker", category: "Electronics", description: "with Dazzling RGB Color Light Show, TWS Function, 2400mAh Battery, Up to 9 Hours Playtime, USB & TF Card Support, Fast Type-C Charging (Black)", basePrice: 1299, oldPrice: 2199, profitPercent: 20, stock: 50, imageAsset: "unix-blake-boom-ra-20w-portable-wireless-bluetooth-speaker.webp", imageSourceUrl: "https://unixindia.in/product/unix-blake-boom-ra-20w-portable-wireless-bluetooth-speaker/?fbclid=IwAR5eBy7sHU1x_u1ijr8uSLuR-FihDCmng5zfXnHRw2MmkPKJIQObP_vgVDeSnw_maisc_ERCnCLngQPiqIuDYyJXN_Q", catalogSource: "trusted" },
  { name: "DailyObjects POP 45W Twin Port GaN5 Adapter - White | Slim Profile, Fast Charging", category: "Electronics", description: "Hitting 100% charge no longer feels like a chore when you power play everyday with the surprisingly slim and vibrant POP 45W TWIN PORT GaN5 ADAPTER. Designed to delight, POP not only holds the power to fast charge two devices at once, the striking co", basePrice: 2499, oldPrice: 2999, profitPercent: 20, stock: 50, imageAsset: "dailyobjects-pop-45w-twin-port-gan5-adapter-white-slim-profile-fast-charging.webp", imageSourceUrl: "https://www.dailyobjects.com/pop-45w-twin-port-gan5-adapter-white/dp?f=pid~POP-45W-TWN-PRT-GN-WAL-ADPTR-WHT&fbclid=IwAR4Ne6lQI2otkBMC6hC8jGqavbnvxq6jKDn7EY_lGsQDtV1c9Oal4G5HK77P9A_maisc_jP5WQpK6Tk6cDEdEm4CzKw", catalogSource: "trusted" },
  { name: "Clat Flash Charging Adapter with Cable (120 W) - 1 unit", category: "Electronics", description: "The Clat 120W Flash Charger delivers ultra-fast charging for compatible devices with support for VOOC and SuperVOOC protocols. It includes a premium LED nylon braided USB Type-C cable for durability and features Smart IC technology with advanced prot", basePrice: 998, oldPrice: 1999, profitPercent: 20, stock: 50, imageAsset: "clat-flash-charging-adapter-with-cable-120-w-1-unit.webp", imageSourceUrl: "https://blinkit.com/prn/clat-flash-charging-adapter-with-cable-120-w/prid/829755?region_id=44381&utm_source=bl_ads_hylo&fbclid=IwAR7J1m3yYUxrP_-OXWmFSKU0HZA4yxgevIKvxadC4YE9_wmP1mZHvqXLw3Z7Ew_maisc_pFwaioonRdCgnkyE1rxQ0A", catalogSource: "trusted" },
  { name: "BT03 Portable Bluetooth Speaker (BK)", category: "Electronics", description: "Blaupunkt BT03, 52 mm speaker produces an audio output of 5 watts in crystal-clear detail, covering the high, mid, and low frequencies. Its 1200 mAh battery offers up to 6 hours of playback time. Make conference calls in your car, office, bathroom, o", basePrice: 839, oldPrice: 1999, profitPercent: 20, stock: 50, imageAsset: "bt03-portable-bluetooth-speaker-bk.webp", imageSourceUrl: "https://www.blaupunktaudio.in/products/bt03-best-bluetooth-speaker?utm_content=Facebook_UA&utm_source=facebook&variant=40898341601434&fbclid=IwAR6B_K21B4XY1wfhL6aCMG0Qpby8KWojfe7EZ_PMrusD_vXiuCNnPuhSOCAYvw_maisc_o8KYtUcRRLG7cPfAaBDxyQ", catalogSource: "trusted" },
  { name: "BT03 LIVE Portable Bluetooth speaker", category: "Electronics", description: "The Blaupunkt BT03 LIVE Bluetooth Speaker is a small and strong portable speaker made for great sound quality wherever you are. It offers up to 12W output, Bluetooth 5.0 connectivity, and various playback options like USB, AUX, TF card, and FM radio.", basePrice: 944, oldPrice: 2999, profitPercent: 20, stock: 50, imageAsset: "bt03-live-portable-bluetooth-speaker.webp", imageSourceUrl: "https://www.blaupunktaudio.in/products/bt03-live-bluetooth-speaker?utm_content=Facebook_UA&utm_source=facebook&variant=47653823807741&fbclid=IwAR5HxC6dF4tSvvToT_vlRlTLYu3XIXiVkWTK1aX2zyxVO0L5TxjmOcR7SCxdCg_maisc_3OVKvFxbTKCedMkTitRMiw", catalogSource: "trusted" },
  { name: "Aibimy MY392BT Compact Portable Bluetooth Speaker - Avyukta Mobile", category: "Electronics", description: "Big sound, micro size. The Aibimy MY392BT Compact Bluetooth Speaker is designed for Canadians on the move. Perfectly sized to slip into your backpack, bike cage, or carry-on luggage, this lightweight mini-speaker delivers surprisingly rich audio and ", basePrice: 8499, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "aibimy-my392bt-compact-portable-bluetooth-speaker-avyukta-mobile.webp", imageSourceUrl: "https://www.avyuktamobile.com/products/aibimy-my392bt-compact-portable-bluetooth-speaker?fbclid=IwAR7i5A5HK3tpZRtHMXPb1xYMj3yDxpvKrd_0hKXJ-9uUyyDmFWDx7Hwn9HlQQQ_maisc_UWGnaXhXS6ilWeIQzzpJww", catalogSource: "trusted" },
  { name: "JBL Clip 5 Wireless Bluetooth Speaker - Black", category: "Electronics", description: "The JBL Clip 5 is an ultra-portable Bluetooth speaker that delivers big sound with punchy bass. Its redesigned carabiner has a wider opening, making it easy to attach to your backpack, belt loop, or other items. You can enjoy up to 12 hours of playti", basePrice: 4499, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "jbl-clip-5-wireless-bluetooth-speaker-black.webp", imageSourceUrl: "https://suhavimart.com/product/jbl-clip-5-wireless-ultra-portable-bluetooth-speaker-black/?fbclid=IwAR7Aq3KkTydsLmL7X3lkkYrAeBBtCBcx6ZyzfbqZe4XOp0eSsFIfsZhbv1bD-Q_maisc_g7VEJVt5TKuqn6z55RGXow", catalogSource: "trusted" },
  { name: "Zebronicsx Santanu Rocket 500 Bluetooth 5.0 Portable Speaker 20W Rms; Tws; 10 Hour Backup; Rgb Lights; Detachable Handle", category: "Electronics", description: "<p>The Zebronicsx Santanu Rocket 500 Bluetooth Portable Speaker - the ultimate sound companion for music lovers on the go. With powerful 20W RMS output and Bluetooth 5.0 technology; this speaker delivers crisp; clear sound wirelessly. Enjoy up to 10 ", basePrice: 704, oldPrice: 7999, profitPercent: 20, stock: 50, imageAsset: "zebronicsx-santanu-rocket-500-bluetooth-5-0-portable-speaker-20w-rms-tws-10-hour-backup-rgb-lights-d.webp", imageSourceUrl: "https://instamart.in/p/zebronicsx-santanu-rocket-500-bluetooth-5-0-portable-speaker-20w-rms-tws-10-hour-backup-rgb-lights-detachable-handle-P7QPYIKT6C?locId=32382e35373732353437312c37372e303530323334353530&fbclid=IwAR518NBd7fVjK_astEehl3x1cdY6wrz_egVjWpcqX1W2PrIMDWAWb0HdOFVBwA_maisc_okPOsgpBQrqN1M1Ub_ghsg", catalogSource: "trusted" },
  { name: "Casual Slim Fit Denim Jeans for Men", category: "Fashion", description: "These dark blue slim fit denim jeans combine classic style with everyday comfort. Crafted from a high-quality cotton blend fabric, they provide durability with a modern silhouette. Perfect for office casuals, weekend wear, or travel, these denim jean", basePrice: 2150, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "casual-slim-fit-denim-jeans-for-men.webp", imageSourceUrl: "https://successmenswear.com/products/casual-jeans-with-5-pocket-1?utm_content=Facebook_UA&utm_source=facebook&variant=44399219802157&fbclid=IwAR5vgr98-aokpelrh40iZyjcE7PhEbXIkeAY6d3cQCq1yqb7y3KxakZvYF0HCA_maisc_kZ7ixUMxSlWo9xa6Yaps7Q", catalogSource: "trusted" },
  { name: "MENS LEATHER HOODED JACKET 410145(2 TONE)", category: "Fashion", description: "Product details Product Code: 410145(2 TONE) Product Name: MEN'S LEATHER HOODED JACKET Price: 6500/- Sizes Available: S,M, L, XL,XXL, XXXL Color: 2 TONE Material: GENUINE LEATHER Lining Fabric: TAFFETA CLOTH No. of Pockets: 4 Outer pockets and 1 Inne", basePrice: 6500, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "mens-leather-hooded-jacket-410145-2-tone.webp", imageSourceUrl: "https://sreeleathersonline.com/products/mens-leather-hooded-jacket-4101452-tone?utm_content=Facebook_UA&utm_source=facebook&variant=47464430108918&fbclid=IwAR5oVJoagkkZTJgqRcIBv_LKVzfJxdP2zrMFtx4SkxZegajqS0uEHiMVhBCavg_maisc_7QMi2eTbTwm0nkbuFnTXkw", catalogSource: "trusted" },
  { name: "Printed Casual Shirt", category: "Fashion", description: "Add a burst of charm to your wardrobe with this floral printed casual shirt for men. Tailored in a slim fit, this cotton shirt offers a comfortable yet sharp look, perfect for weekend getaways, brunches, or casual meetups. The all-over floral print i", basePrice: 951, oldPrice: 1585, profitPercent: 20, stock: 50, imageAsset: "printed-casual-shirt.webp", imageSourceUrl: "https://successmenswear.com/products/printed-casual-shirt-5?utm_content=Facebook_UA&utm_source=facebook&variant=41564617375789&fbclid=IwAR6wnIvsV6VOhHirrzS-LgsR23X7M2FPKWkx0Ox8pOPkh9XOfRB0ZHsgVRPiRw_maisc_WDgPpBEdQPK9Lu9KahUNxg", catalogSource: "trusted" },
  { name: "White Printed Pure Silk Saree Without Blouse Piece", category: "Fashion", description: "Elegance is when the inside is as beautiful as the outside Presenting, this white color printed silk saree, made with pure silk fabric which will give you a comfortable yet attractive look. The best part of this saree is its white. Pair it with a blo", basePrice: 8399, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "white-printed-pure-silk-saree-without-blouse-piece.webp", imageSourceUrl: "https://www.indiansilkhouseagencies.com/products/white-printed-pure-silk-saree-without-blouse-piece-8500000715253ctc?utm_content=Facebook_UA&utm_source=facebook&variant=53124297392442&fbclid=IwAR7pT1lkOzWx9XCQjr83GmXE8yd-mLkumsnjbXNQgek9HmJNLqdEfSkCzFtKVA_maisc_WKgffD54Qz2rX3scHOypXQ", catalogSource: "trusted" },
  { name: "Carlos 02 Men's Black Zip Up Style Leather Jacket", category: "Fashion", description: "Rev up your style quotient with Carlos-02 by Hidesign, a passport to unparalleled fashion handcrafted from genuine vegetable-tanned leather. As you embark on your style journey, let this jacket be your travel companion. Pair it with classic denim and", basePrice: 52595, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "carlos-02-men-s-black-zip-up-style-leather-jacket.webp", imageSourceUrl: "https://hidesign.com/products/carlos-02-men-black-zip-up?variant=44273379180716&utm_medium=feed&utm_campaign=meta_catalog&utm_content=product_card&fbclid=IwAR7D2GsfoWkc6Pav3SWjGcBqo62WpCfaLFNXK3M8ychxngELygpZHDOZjA5Mjg_maisc_nleujKYFSrqQkj0-0_ooQQ", catalogSource: "trusted" },
  { name: "Printed Casual Cotton Shirt For Men", category: "Fashion", description: "Refresh your everyday style with this blue printed casual cotton shirt for men from Success Menswear. Crafted from breathable cotton fabric, it offers all-day comfort and a soft, lightweight feel. Ideal for casual outings, weekend wear, or relaxed so", basePrice: 2150, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "printed-casual-cotton-shirt-for-men.webp", imageSourceUrl: "https://successmenswear.com/products/premium-solid-blue-shirt?utm_content=Facebook_UA&utm_source=facebook&variant=44397555712045&fbclid=IwAR4PE0qdU-2KdNNm-y5Q1Xe6ig9UyvXabRgm7m97K8VE1zASsIxkFLtKaLCGJQ_maisc_rQS2cbDaSiKrW7L5Y-gXww", catalogSource: "trusted" },
  { name: "Men's anders slim fit jeans", category: "Fashion", description: "An offering from our environmentally conscious range, called etx, this jeans is crafted from premium soft, stretch denim fabric. it makes for a perfect addition to your every day wardrobe. the slim fit and mid rise waist is the original denim fit, a ", basePrice: 3999, oldPrice: 9999, profitPercent: 20, stock: 50, imageAsset: "men-s-anders-slim-fit-jeans.webp", imageSourceUrl: "https://www.gasjeans.in/7687176?fbclid=IwAR5wKWFYpi3ks1ob36SFhTzl5nwjVPZx4W2Kqy7RoPf9CA9x59ttVWTZxfoX8w_maisc_sxCh7_57S--fELd1eTVRvA", catalogSource: "trusted" },
  { name: "Contrast Jacquard-Denim Jacket", category: "Fashion", description: "Crafted for the modern man, this casual jacket combines style and functionality seamlessly. Made from premium breathable cotton fabric, it ensures all-day comfort while maintaining a relaxed fit for effortless wear. The textured denim-jacquard patter", basePrice: 1999, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "contrast-jacquard-denim-jacket.webp", imageSourceUrl: "https://cahoot.in/products/mens-navy-blue-abstract-jacquard-denim-jacket_csmawjk3297?utm_content=Facebook_UA&utm_source=facebook&variant=47121257824514&fbclid=IwAR5yGSuZUQctq4UV0-h3naZcqN1K7XTUGWmT_hHA957DxtlaMSF6DQcgp5_jsA_maisc_GgqK6jaASlu_3i-ObiRUCw", catalogSource: "trusted" },
  { name: "Roadster Men Blue Slim Fit Mid-Rise Clean Look Stretchable Jeans", category: "Fashion", description: "Blue medium wash 5-pocket mid-rise jeans, clean look with no fade, has a button and zip closure, waistband with belt loops", basePrice: 599, oldPrice: 1199, profitPercent: 20, stock: 50, imageAsset: "roadster-men-blue-slim-fit-mid-rise-clean-look-stretchable-jeans.webp", imageSourceUrl: "http://www.myntra.com/Jeans/Roadster/Roadster-Men-Blue-Slim-Fit-Mid-Rise-Clean-Look-Stretchable-Jeans/4653763/buy?fbclid=IwAR7_-ZSy1T6S0sbc3Oa-WnKfgxCoZP_IDvvt22bGL0xWOqEHUERg0rcYwB46wA_maisc_SJ3viRzjTL-cMSddcrUxBg", catalogSource: "trusted" },
  { name: "The Rue Collection Men Casual Shirt", category: "Fashion", description: "Brown Solid Opaque Casual shirts ,has a Band Collar, Button Placket, 1 Patch pocket, Long Regular Sleeves, Curved hem", basePrice: 537, oldPrice: 1299, profitPercent: 20, stock: 50, imageAsset: "the-rue-collection-men-casual-shirt.webp", imageSourceUrl: "http://www.myntra.com/Shirts/The+Rue+Collection/The-Rue-Collection-Men-Casual-Shirt/42771913/buy?fbclid=IwAR7TqKsPLTw9UoWGChcrzWHc0xcr6nozcY1JmiXbfilfL-lT6c4OgVArPW6r6g_maisc_hSY4rLioSACZn4TDkXYurA", catalogSource: "trusted" },
  { name: "Estilocus Men Standard Striped Casual Shirt", category: "Fashion", description: "Turquoise Blue Vertical Stripes Striped Opaque Casual shirts ,has a Spread Collar, Zip, Long Roll-Up Sleeves, Curved hem", basePrice: 1499, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "estilocus-men-standard-striped-casual-shirt.webp", imageSourceUrl: "http://www.myntra.com/Shirts/Estilocus/Estilocus-Men-Standard-Striped-Casual-Shirt/39492417/buy?fbclid=IwAR6mbiqzUI2m6mdzXlux3o3sT5IB5neUrpBQJr6JVHKqlYRbPIlljLIGaundHQ_maisc_Qm6uz5snRP6fthHDoOuZnQ", catalogSource: "trusted" },
  { name: "Printed Cotton Blend Dress Blue / L-1.02 Mtr", category: "Fashion", description: "Material: Cotton BlendPattern: PrintedStyle: FlaredSleeves: 3/4th SleevesNeck: Round NeckTop Type: KurtiKurta Length: Knee LengthOccasion: Everyday WearMaterial Care InstructionMachine Wash", basePrice: 1797, oldPrice: 2995, profitPercent: 20, stock: 50, imageAsset: "printed-cotton-blend-dress-blue-l-1-02-mtr.webp", imageSourceUrl: "https://mbz.in/products/bs25-d-08-ol-950334-cot-drs?utm_source=bik&utm_medium=whatsapp&utm_campaign=journeys&utm_content=productUrl&fbclid=IwAR5aMv-aHDcK0Sjt9XW6KXWld7NI_qDxw8lpSKuCmN5wmHC_1EXkNIPg9fADcg_maisc_IQ96JE8ORwGYimNJhSZizg", catalogSource: "trusted" },
  { name: "Cantabil Casual Shirt for Men l Breathable & Soft with Color Fastness Regular Fit Fit 100% Cotton Fabric Self Design Pattern", category: "Fashion", description: "Men&#39;s Spread Collar 100% Cotton Shirt – Breathable, Stylish &amp; Comfortable. Upgrade your wardrobe with this trendy and stylish men&#39;s Spread Collar shirt, designed for all-day comfort and effortless fashion. Crafted from a premium 100% Cott", basePrice: 1399, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "cantabil-casual-shirt-for-men-l-breathable-soft-with-color-fastness-regular-fit-fit-100-cotton-fabri.webp", imageSourceUrl: "https://cantabilshop.com/products/mens-blue-regular-fit-self-design-full-sleeve-formal-shirt-1?fbclid=IwAR6ycfe2gkdLbD1tbK9hQi4JRkkfbZ4P-6Z1p728hNQDoXzupLCvcXxvOtN5Mg_maisc_NgfSxW4RSV6uG06vowj0ng", catalogSource: "trusted" },
  { name: "Professional 1200W Mixer Grinder with 4 Jars, Special Blade for Silbatta Khada Masala Grinding, Mincing & Whisking, Ideal for Grinding, Blending Chutn", category: "Home & Kitchen", description: "Professional mixer grinder is designed to handle all your grinding and blending needs from the smoothest chutneys to coarse spice blends with a powerful 1200w copper motor durable stainless-steel blades and multiple jars this appliance makes cooking ", basePrice: 7999, oldPrice: 15000, profitPercent: 20, stock: 50, imageAsset: "professional-1200w-mixer-grinder-with-4-jars-special-blade-for-silbatta-khada-masala-grinding-mincin.webp", imageSourceUrl: "https://www.wonderchef.com/products/wonderchef-professional-1200w-mg-4-jar-black?fbclid=IwAR6dO56RbakENAN--UjlVN3-poJwunWxRmnZhKqfsyLwwz-OkkSNM11bMQpAJA_maisc_fsA3lrI_QUO7s9WkB_XQsQ", catalogSource: "trusted" },
  { name: "BOSS Comfort 500W Mixer Grinder with Powerful Motor, 2 SS Jars, 2 years warranty*", category: "Home & Kitchen", description: "Want to Grind and Blend to perfection? Use the BOSS 500-Watt Comfort Mixer Grinder. It will help you churn out dishes just as good as the ones at your favourite restaurant. This utilitarian Mixer Grinder comes with two Jars that have different capaci", basePrice: 2600, oldPrice: 3250, profitPercent: 20, stock: 50, imageAsset: "boss-comfort-500w-mixer-grinder-with-powerful-motor-2-ss-jars-2-years-warranty.webp", imageSourceUrl: "https://bossindia.com/product/boss-comfort-mixer-grinder/?attribute_pa_color=beige&fbclid=IwAR4yMVkmypiBVWqwFdbcYDZ_TLGQN93ghW8sR832FdnVmttFZ1uNdg943WSRNA_maisc_SP-EsZWcRPaqaQk0Z8q0xA", catalogSource: "trusted" },
  { name: "Stainless Steel Water Bottle 1 Litre | Steel Bottle 1000 ml", category: "Home & Kitchen", description: "Stainless Steel Water Bottle 1 Litre for Everyday Hydration Stay hydrated throughout the day with the ASHTOK Stainless Steel Water Bottle 1 Litre, a reusable 1000 ml bottle designed for everyday use at home, office, college, travel and outdoor activi", basePrice: 649, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "stainless-steel-water-bottle-1-litre-steel-bottle-1000-ml.webp", imageSourceUrl: "https://ashtok.com/products/trendy-water-bottles?variant=41987751215157&utm_medium=feed&utm_campaign=meta_catalog&utm_content=product_card&fbclid=IwAR4OBjYk_eOjdC79AyNChjiKwVjhSF_pL0h-msZhTXgG7F3G0kDcFyKoAevOAg_maisc_nNNaJoEJQAK1NKDDqRJKgw", catalogSource: "trusted" },
  { name: "Crescent Electric Kettle | 1.8L Capacity | 1350W | Stainless Steel Body | Safety Locking Lid | 2 Year Warranty", category: "Home & Kitchen", description: "Wonderchef Crescent Electric Kettle -1.8 Litres for quick & easy boiling of milk, water or to prepare instant tea /coffee.Boil water to the ideal temperature for preparing your favourite cup, from delicate green teas to instant coffee and more. The 1", basePrice: 699, oldPrice: 2150, profitPercent: 20, stock: 50, imageAsset: "crescent-electric-kettle-1-8l-capacity-1350w-stainless-steel-body-safety-locking-lid-2-year-warranty.webp", imageSourceUrl: "https://www.wonderchef.com/products/crescent-electric-kettle-stainless-steel-interior-safety-locking-lid?country=IN&fbclid=IwAR7Y0o8fZJYPkjEW0lG2ocXTXpN1WHCxlSt_bS9MLnQCpXweJ15B7b5GbjHFmQ_maisc_6OcNGgp_StuS8N_4_48Ogw", catalogSource: "trusted" },
  { name: "Electric Kettle 1.8 Litre Stainless Steel with 360° Rotational Base, 1350 W - Silver (9002)", category: "Home & Kitchen", description: "1.8 Litre Capacity: A full 1.8 litres covers chai for six, a jug of hot water for the flask, or enough boiling water to start a batch of noodles. A 1.8-litre electric kettle of this size handles a family morning without needing a second round. Capaci", basePrice: 809, oldPrice: 1395, profitPercent: 20, stock: 50, imageAsset: "electric-kettle-1-8-litre-stainless-steel-with-360-rotational-base-1350-w-silver-9002.webp", imageSourceUrl: "https://glenindia.com/products/glen-9002-electric-kettle-1-8-ltr-1350w?fbclid=IwAR6TNQlCoPcZS2M4otgJ20M-hb9-FywAKCRWTx2eQ8MoVJqcTfuOgqIof0gZ9w_maisc_7QYJ9IzeTcWCVngcmw5uZQ", catalogSource: "trusted" },
  { name: "Lifelong Vaccum Insulated Steel Wall Bottle - 1 pc", category: "Home & Kitchen", description: "This steel water bottle features an ergonomic design for comfortable handling and everyday hydration use. Made from stainless steel, it is suitable for storing water and beverages at home, office, gym, school, or travel.", basePrice: 967, oldPrice: 1899, profitPercent: 20, stock: 50, imageAsset: "lifelong-vaccum-insulated-steel-wall-bottle-1-pc.webp", imageSourceUrl: "https://blinkit.com/prn/lifelong-vaccum-insulated-steel-wall-bottle/prid/587084?region_id=33990&utm_source=bl_ads_hylo&fbclid=IwAR6h9WSc9d_OEVDdToqmj2SwICkPs2zWnRhYXs5gM2z8dOM6yskY2tcf9lIWgQ_maisc_MtrslnzxQI2SuQOOKeEe-Q", catalogSource: "trusted" },
  { name: "Nelcon Ooze Steel Wall Bottle (Silver) - 1000 ml", category: "Home & Kitchen", description: "Stay hydrated anytime with this stylish single wall 1000 ml stainless steel water bottle. Made from durable, rust-resistant steel, it is lightweight, easy to carry and perfect for gym, office, school, travel and daily use. The leak-resistant design e", basePrice: 299, oldPrice: 549, profitPercent: 20, stock: 50, imageAsset: "nelcon-ooze-steel-wall-bottle-silver-1000-ml.webp", imageSourceUrl: "https://blinkit.com/prn/nelcon-ooze-steel-wall-bottle-silver/prid/1380277?region_id=46427&utm_source=bl_ads_hylo&fbclid=IwAR4Uy-VUtFN5yw8bKqx0J-XH2nZKAdk7Lh8uX-iBwjAomvnyGrkwwi7l-2MbSg_maisc_-nYynkpWQ7SkuRGGFzGR7g", catalogSource: "trusted" },
  { name: "King Size Premium Cotton Bed Sheet & 2 Pillow Cover Set - BDS01", category: "Home & Kitchen", description: "Product Specification Material : Premium Cotton Colour : Off-white with Brown Pattern : Printed Style : Club Floral Fusion Bed Sheet : 274 cm X 274 cm Pillow case : 46 cm X 71 cm Features Soft & Comfort Breathable Durable Anti-Pill Cotton Touch Wash ", basePrice: 2195, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "king-size-premium-cotton-bed-sheet-2-pillow-cover-set-bds01.webp", imageSourceUrl: "https://ramrajcotton.in/products/king-size-premium-cotton-bed-sheet-2-pillow-cover-set-bds01?variant=48202374709474&fbclid=IwAR4cdovqrWk1gtugnUjHX9Gtf7mpSHftmSwnB26GTmUbKhEiGcGaqIOyWZc6Pg_maisc_Un6ERAouRJmBjI8eG-ixgQ", catalogSource: "trusted" },
  { name: "The Better Home Steel Wall Bottle (Silver) - 5 pcs", category: "Home & Kitchen", description: "Premium pack of 5 stainless steel water bottles with 1L capacity each. Made from food-grade 304 stainless steel, these BPA-free bottles feature a leak-proof cap, rust-proof body, wide mouth, and lightweight design. Suitable for home, office, school, ", basePrice: 1299, oldPrice: 3259, profitPercent: 20, stock: 50, imageAsset: "the-better-home-steel-wall-bottle-silver-5-pcs.webp", imageSourceUrl: "https://blinkit.com/prn/the-better-home-steel-wall-bottle-silver/prid/1383902?region_id=45883&utm_source=bl_ads_hylo&fbclid=IwAR5jlqgXhKZpeCg45LeMs49Yx-KWvTft0P9Ya9BPk4dUJmfHx3ETUMI4tnHH2w_maisc_oSZa6nW9T3m_jATSZSx4wA", catalogSource: "trusted" },
  { name: "Set of 3 - Capri Series", category: "Home & Kitchen", description: "A 3-piece set that features our Fry Pan, Kadai and Tawa. All your kitchen staples in one place.", basePrice: 8999, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "set-of-3-capri-series.webp", imageSourceUrl: "https://embercookware.com/products/set-of-3-ss-bundled?variant=49477154046254&fbclid=IwAR6xbqtPbZ2MTKzfT8zv7SZ9zJSDa4n-5UwbtprGXDDpoDKPuOYyVXzlVGxHgg_maisc_IB-Bpz9sRW2KqB7OiAQ-KQ", catalogSource: "trusted" },
  { name: "Cutting Edge Plastic Kitchen Storage Container Set - 8 pcs", category: "Home & Kitchen", description: "Stackable containers save space and keep your kitchen organized. Made with a shatterproof, impact-resistant body, they are extremely durable and designed to last for years. BPA-free material ensures food stays fresh longer by preventing bacteria buil", basePrice: 325, oldPrice: 660, profitPercent: 20, stock: 50, imageAsset: "cutting-edge-plastic-kitchen-storage-container-set-8-pcs.webp", imageSourceUrl: "https://blinkit.com/prn/cutting-edge-plastic-kitchen-storage-container-set/prid/607848?region_id=34544&utm_source=bl_ads_hylo&fbclid=IwAR4DlBQ_mbPjL-anjlX3xoVfQsQ7nC0Q9PBfrS5I8O4UHSncuz16eUCbKQ3eTw_maisc_6DYI1IA-TGys1Hhc5WjskA", catalogSource: "trusted" },
  { name: "ISOMARS LED Desk Lamp with Adjustable Angle & Clamp | 12 Inch Overhead USB Study Table Light for Desktop, Laptop, Office & Reading | 3 Color Modes, 10 Brightness Levels, Eye Care LED Lamp11", category: "Home & Kitchen", description: "Smart Focused Lighting for Better Work, Study & Reading. The ISOMARS LED Desk Lamp with Adjustable Angle & Clamp is a modern overhead workspace lighting solution designed to give you bright, glare-controlled and customizable illumination exactly wher", basePrice: 1149, oldPrice: 2799, profitPercent: 20, stock: 50, imageAsset: "isomars-led-desk-lamp-with-adjustable-angle-clamp-12-inch-overhead-usb-study-table-light-for-desktop.webp", imageSourceUrl: "https://isomarsshop.in/products/isomars-led-desk-lamp-12-inch-adjustable-angle-clamp?utm_content=Facebook_UA&utm_source=facebook&variant=46365187604630&fbclid=IwAR5JTS1vtavYragy3t85gXc0D4j_QIZwx9O--VF8Eu6nXVAmH-t3Xq5qXp46bA_maisc_TjPKQyViS7qCQq2TKqKAsA", catalogSource: "trusted" },
  { name: "Nestasia Groovo Storage Container (Set of 4; 520ml + 750ml)", category: "Home & Kitchen", description: "Keep your kitchen organized and your food fresh with this set of four Nestasia Groovo storage containers; featuring two versatile sizes. The sleek; stackable design helps maximize cabinet space while providing a leak-proof solution for everyday meal ", basePrice: 1349, oldPrice: 1995, profitPercent: 20, stock: 50, imageAsset: "nestasia-groovo-storage-container-set-of-4-520ml-750ml.webp", imageSourceUrl: "https://instamart.in/p/nestasia-groovo-storage-container-set-of-4-520ml-750ml-NUA6MKYEAA?locId=32382e36383238343535332c37372e333436323332313730&fbclid=IwAR6xesXrGLXvY56RmRc34BuSRImYr8kqGQx6qdJwv0SJo3h4J6f6IQ9IddO9yg_maisc_SoHNYA-6QJeG-BWDLej3bw", catalogSource: "trusted" },
  { name: "Apple iPhone 16 128GB White", category: "Mobiles", description: "Apple iPhone 16. Featuring Camera Control, giving you an easier way to quickly access camera tools and an all-A18 chip that empowers Apple Intelligence, plus big boost in battery life - up to 22 hours video playback on iPhone 16. The two-in-one 48Mp ", basePrice: 89900, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "apple-iphone-16-128gb-white.webp", imageSourceUrl: "https://www.apple.com/in/shop/go/product/MYE93HN/A?cid=04788495_rmc_in_soc_retail_dwli_socl_rbwfm_cusf_shpinfd_cpc_and_mob_aandt_ggt_t1cty_pmlp_mfnnl_inen_ofr_static_11ar_ban_hxvi_na_lau_bnow_na_na_iphone16128gbwhite", catalogSource: "trusted" },
  { name: "Buy Nothing Phone (4b) 128 GB, 8 GB RAM, Black, Mobile Phone at Reliance Digital", category: "Mobiles", description: "Storage: 8 GB RAM, 128 GB Internal Memory,Display: 17.19 cm (6.77 inch), AMOLED LTPS, 120 Hz, 1224 x 2720 px Resolution,Rear Camera: 50 MP Wide Angle, JNS, Water Resistant: IP64,Accelerometer, Ambient Light Sensor, Proximity Sensor, Flicker Sensor & ", basePrice: 37999, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "buy-nothing-phone-4b-128-gb-8-gb-ram-black-mobile-phone-at-reliance-digital.webp", imageSourceUrl: "https://www.reliancedigital.in/product/nothing-phone-4b-128-gb-8-gb-ram-black-mobile-phone-mrj5mp-10305138?fbclid=IwAR4KURrSfr312JvnmdmDT5Ujch7q_oUsF4gJDI8oIos0aek7DmLtx_YclYPggQ_maisc_M9Dj53wnQzqpVJ_3eO_o3A", catalogSource: "trusted" },
  { name: "Apple iPhone 16 128GB Black", category: "Mobiles", description: "Apple iPhone 16. Featuring Camera Control, giving you an easier way to quickly access camera tools and an all-A18 chip that empowers Apple Intelligence, plus big boost in battery life - up to 22 hours video playback on iPhone 16. The two-in-one 48Mp ", basePrice: 89900, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "apple-iphone-16-128gb-black.webp", imageSourceUrl: "https://www.apple.com/in/shop/go/product/MYE73HN/A?cid=04788494_rmc_in_soc_retail_dwli_socl_rbwfm_cusf_shpinfd_cpc_and_mob_aandt_ggt_t1cty_pmlp_mfnnl_inen_ofr_static_11ar_ban_hxvi_na_lau_bnow_na_na_iphone16128gbblack", catalogSource: "trusted" },
  { name: "Nothing Phone (4a) 5G 256 GB, 8 GB RAM, Black, Mobile Phone", category: "Mobiles", description: "Storage: 8 GB RAM, 256 GB Internal Memory,In-display Fingerprint Sensor,Water Resistant: IP64,SIM Type: Nano,Glass Type: Gorilla Glass 7I, and more in the Nothing Phone (4a) 5G 256 GB, 8 GB RAM, Black, Mobile Phone", basePrice: 47499, oldPrice: 49999, profitPercent: 20, stock: 50, imageAsset: "nothing-phone-4a-5g-256-gb-8-gb-ram-black-mobile-phone.webp", imageSourceUrl: "https://www.reliancedigital.in/product/nothing-phone-4a-5g-256-gb-8-gb-ram-black-mobile-phone-mmerv1-9974700?fbclid=IwAR67briLixYkk4Vf2qMqTz1wWxv9NwJelffQQrnlmw-9Gh913K8PNhNy6SgCFw_maisc_kht54A_ZRe6b4RVt1mfQ6Q", catalogSource: "trusted" },
  { name: "Nothing Phone (4b) (White, 128 GB) (8 GB RAM)", category: "Mobiles", description: "The Nothing Phone (4b) is a budget-focused smartphone with several notable features:Display: 6.77-inch FHD+ Super AMOLED, 120Hz adaptive refresh rate, HDR10+, up to 2,000 nits peak brightness", basePrice: 39999, oldPrice: 54999, profitPercent: 20, stock: 50, imageAsset: "nothing-phone-4b-white-128-gb-8-gb-ram.webp", imageSourceUrl: "https://snapmint.com/p/nothing-phone-4b-white-128-gb-8-gb-ram-smart-phones-on-emi?snapmint_checkout_sale_aug26&fbclid=IwAR6Bd72ImsVpzwVMPiHxlPNIbTIhr1fgEuAdE1amqkhiZDhr5wZIS1rfKu4hBA_maisc_GGELmU1GQEmzEZzI535Xvw", catalogSource: "trusted" },
  { name: "Nothing Phone (4b) (8GB RAM, 256GB Storage) Qualcomm Snapdragon 6 Gen 4 | 6000mAh Battery | IP64 Rating | Black", category: "Mobiles", description: "Display: 6.77 inch Full HD+ AMOLED Display, 1224 x 2720 Resolution, Storage: 8GB RAM / 256GB Internal Memory, Processor: Qualcomm Snapdragon 6 Gen 4 Octa-Core Processor, Adreno GPU, Operating System: Android 16 with Nothing OS, Camera: 50MP + 8MP Rea", basePrice: 39499, oldPrice: 59999, profitPercent: 20, stock: 50, imageAsset: "nothing-phone-4b-8gb-ram-256gb-storage-qualcomm-snapdragon-6-gen-4-6000mah-battery-ip64-rating-black.webp", imageSourceUrl: "https://www.vijaysales.com/p/P259203/259209/nothing-phone-4b-8gb-ram-256gb-storage-qualcomm-snapdragon-6-gen-4-6000-mah-battery-ip64-rating-black?fbclid=IwAR6kj8v4WNBGSEmVVxFEV6iKcZVX2K5BFLMQA2RXAwCb4_sXedJKUqoOoBOLIg_maisc_kKArBDn8SBq5uxnCMhh1UA", catalogSource: "trusted" },
  { name: "Nothing Phone (4b) | 8GB | 128GB", category: "Mobiles", description: "The Nothing Phone (4b) is a dual-SIM smartphone featuring a 6.77-inch Super AMOLED display with a 120 Hz adaptive refresh rate and a Full HD+ resolution. It is powered by an octa-core Snapdragon processor and runs Nothing OS based on Android 16, prov", basePrice: 39999, oldPrice: 54999, profitPercent: 20, stock: 50, imageAsset: "nothing-phone-4b-8gb-128gb.webp", imageSourceUrl: "https://logtech.in/product/nothing-phone-4b-8gb-128gb?fbclid=IwAR54nzOoVV_mZrj16G_J00GR5XYZfHWrEuK-AZmL97FyyA8yO6MeowgqbveHng_maisc_8-t--R8yQkSesmb2-aWDKw", catalogSource: "trusted" },
  { name: "Nothing Phone (4a)  12 GB RAM & 256 GB Storage  5400 mAh Battery  50 MP + 50 MP Rear Camera  6.78” Display  Black", category: "Mobiles", description: "<p>The Nothing Phone (4a) is designed to deliver a premium smartphone experience with a sleek and modern design. It features a large 6.78 inch Flexible AMOLED display that offers vibrant colours; deep contrast; and an immersive viewing experience for", basePrice: 38999, oldPrice: 40999, profitPercent: 20, stock: 50, imageAsset: "nothing-phone-4a-12-gb-ram-256-gb-storage-5400-mah-battery-50-mp-50-mp-rear-camera-6-78-display-blac.webp", imageSourceUrl: "https://instamart.in/p/nothing-phone-4a-12-gb-ram-256-gb-storage-5400-mah-battery-50-mp-50-mp-rear-camera-6-78-display-black-LSV6PH5FLK?locId=32382e37333932353931382c37372e313937373333363530&fbclid=IwAR6_Y1BRtFTDSh921ZFTfWNnl7gJ9BdeizdjaQiTmgtCWsv9-AQRopKVV5O81w_maisc_Yjd8S4s9Q-KucLHZT5q0wA", catalogSource: "trusted" },
  { name: "Nothing Phone (4b)  8 GB RAM & 256 GB Storage  6000 mAh Battery  50 MP + 8 MP Rear Camera  6.77 Display  Black", category: "Mobiles", description: "<p>The Nothing Phone (4b) is engineered to deliver a smooth and immersive smartphone experience with its large 6.77 Inch Super AMOLED Display that offers vibrant colors; sharp details; and fluid visuals. Powered by the Snapdragon 6 Gen 4 Processor; t", basePrice: 36899, oldPrice: 59999, profitPercent: 20, stock: 50, imageAsset: "nothing-phone-4b-8-gb-ram-256-gb-storage-6000-mah-battery-50-mp-8-mp-rear-camera-6-77-display-black.webp", imageSourceUrl: "https://instamart.in/p/nothing-phone-4b-8-gb-ram-256-gb-storage-6000-mah-battery-50-mp-8-mp-rear-camera-6-77-display-black-WM81QINS0I?locId=31322e39373438363334362c38302e323538343933313230&fbclid=IwAR6vkBnoNNyWD9frHsWnFTdfDj0Kb-UGle7O7DVoH_lKqV7zgE_N-MXMmuOxtA_maisc_hFenoiaNQAioeT5Dyyz5Jw", catalogSource: "trusted" },
  { name: "Nothing Phone (4b)  8 GB RAM & 256 GB Storage  6000 mAh Battery  50 MP + 8 MP Rear Camera  6.77 Display  Blue", category: "Mobiles", description: "<p>The Nothing Phone (4b) is engineered to deliver a smooth and immersive smartphone experience with its large 6.77 Inch Super AMOLED Display that offers vibrant colors; sharp details; and fluid visuals. Powered by the Snapdragon 6 Gen 4 Processor; t", basePrice: 37599, oldPrice: 59999, profitPercent: 20, stock: 50, imageAsset: "nothing-phone-4b-8-gb-ram-256-gb-storage-6000-mah-battery-50-mp-8-mp-rear-camera-6-77-display-blue.webp", imageSourceUrl: "https://instamart.in/p/nothing-phone-4b-8-gb-ram-256-gb-storage-6000-mah-battery-50-mp-8-mp-rear-camera-6-77-display-blue-DFO393VH8X?locId=33302e38363039383939382c37352e383638383338333030&fbclid=IwAR6bHnD4hNZkXjafoCOAvpTnotV2zMpV14p6KyHWbl_hDH7nihvQN8H3-Kuchg_maisc_3dUEpT8rRNCxbDCQbhKa9g", catalogSource: "trusted" },
  { name: "Nothing Phone (4a) Pro  12 GB RAM & 256 GB Storage  5400 mAh Battery  50 MP + 50 MP Rear Camera  6.83” Display  Black", category: "Mobiles", description: "<p>The Nothing Phone (4a) Pro is designed to deliver an enhanced smartphone experience with premium performance and a refined design. It features a large 6.83 Inch Flexible AMOLED Display that offers vibrant colours; deep contrast; and an immersive v", basePrice: 53999, oldPrice: 55999, profitPercent: 20, stock: 50, imageAsset: "nothing-phone-4a-pro-12-gb-ram-256-gb-storage-5400-mah-battery-50-mp-50-mp-rear-camera-6-83-display.webp", imageSourceUrl: "https://instamart.in/p/nothing-phone-4a-pro-12-gb-ram-256-gb-storage-5400-mah-battery-50-mp-50-mp-rear-camera-6-83-display-black-ZGR8PQR3EW?locId=31392e32303834323638392c37322e383235303336393930&fbclid=IwAR78c9t9t6isWBwRLZXs18Rvqq5linAcs2X0Brs5I-I4dSkdOHr1dIB6FvddXg_maisc_v0NAyJmxQfW0QVQRvIdm0A", catalogSource: "trusted" },
  { name: "Apple iPhone 17 512GB White", category: "Mobiles", description: "iPhone 17. Center Stage front camera. Latest-generation Ceramic Shield. 6.3-inch ProMotion display. A19 chip. Five gorgeous colors. - MG6Q4HN/A", basePrice: 124900, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "apple-iphone-17-512gb-white.webp", imageSourceUrl: "https://www.apple.com/in/shop/go/product/MG6Q4HN/A", catalogSource: "trusted" },
  { name: "Nothing phone (4A) pro 8Gb 128GB silver", category: "Mobiles", description: "The Nothing Phone (4a) Pro is a premium mid-range smartphone launched in March 2026 by Nothing, the technology company founded by Carl Pei. It is an upgraded version of the Phone (4a), offering improved performance, a brighter display, and enhanced c", basePrice: 7500, oldPrice: 69999, profitPercent: 20, stock: 50, imageAsset: "nothing-phone-4a-pro-8gb-128gb-silver.webp", imageSourceUrl: "https://snapmint.com/p/nothing-phone-4a-pro-8gb-128gb-silver-smart-phones-on-emi?hsa_acc=10150653181710006&hsa_ad=6254806812658&hsa_cam=6254806812258&hsa_grp=6254806812458&hsa_net=facebook&hsa_src=fb&hsa_ver=3&fbclid=IwAR71oGuFs6g34RbxyfGc3uP5RX0KiID6qDqm1pJCcVkCqxxdmbbN5t1q4NsQ_w_maisc_08s4OZd3R0akAEcO-wRwig", catalogSource: "trusted" },
  { name: "KIDS SPORTS SHOES 36413 (10 to 13 years)", category: "Shoes", description: "Model no - 36413 Mrp - 580/- Size - 2-5 Age Group -10 to 13 years KIDS SPORTS SHOES Upper material - Synthetic upper Sole - Airmax In sole - Comfort footbed", basePrice: 580, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "kids-sports-shoes-36413-10-to-13-years.webp", imageSourceUrl: "https://sreeleathersonline.com/products/mens-sports-shoe-36413?utm_content=Facebook_UA&utm_source=facebook&variant=46316949209334&fbclid=IwAR4_6B_rOo2xnchccd7l_L1SoXi3ivwsqcjXeZnKuL1p05mmhYnUStnUBWoAkA_maisc_lPewVGYjT7aPvJDRITSwfQ", catalogSource: "trusted" },
  { name: "Men's Formal Leather Shoe – Premium Professional Style - 915244", category: "Shoes", description: "Product Specifications * Model No.: 915244 * Product Type: Men's Formal Leather Shoe * Upper Material: Genuine Leather * Sole Material: PU (Polyurethane) * Available Sizes: 6 – 10 * Quantity: 1 Pair MRP: ₹1,695/- Key Features * ✔ Genuine Leather Uppe", basePrice: 1695, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "men-s-formal-leather-shoe-premium-professional-style-915244.webp", imageSourceUrl: "https://sreeleathersonline.com/products/mens-formal-leather-shoe-915244?utm_content=Facebook_UA&utm_source=facebook&variant=49237795209462&fbclid=IwAR4K-YgLmh29ekHngv85d5dUwrJht73jU79wHaX7fOI108F1vT3PROYAOYUG8A_maisc_Mpr51ZTPQj-FV_Lm4fznzg", catalogSource: "trusted" },
  { name: "Nike Promina Women's Walking Shoes", category: "Shoes", description: "The Nike Promina makes every walk a soft ride. Its tall foam stack is combined with a grooved rocker on the outsole, providing high cushioning for all-day comfort.", basePrice: 4122, oldPrice: 5495, profitPercent: 20, stock: 50, imageAsset: "nike-promina-women-s-walking-shoes.webp", imageSourceUrl: "https://www.nike.in/nike-w-promina-print/p/27764091?fbclid=IwAR5tCm-0u5udoh_UfjUqMf_I5PJ91BC5J6SSqCoSZmeDk2GUrUl3GAk7xca0vQ_maisc_YLHrLtTtSgOip7QL2dXRVA", catalogSource: "trusted" },
  { name: "Women’s White Platform Sneakers – Stylish Synthetic Lace-Up Shoes", category: "Shoes", description: "Description The Women's White Platform Sneakers by Alberto Torresi combine contemporary streetwear fashion with effortless everyday sophistication. Crafted with a vegan upper in a stylish off-white shade, they feature a striking color-blocked design ", basePrice: 2304, oldPrice: 5999, profitPercent: 20, stock: 50, imageAsset: "women-s-white-platform-sneakers-stylish-synthetic-lace-up-shoes.webp", imageSourceUrl: "https://www.albertotorresi.com/products/women-white-platform-sneakers-stylish-synthetic-lace-up-shoes-1105-white?utm_content=Facebook_UA&utm_source=facebook&variant=51131264041248&fbclid=IwAR5nFan_arj8KOXqsxguePRvJLMICXHWdG0EzvZKau7iSf818Cs_SayXfQZzew_maisc_wBMGApuvSOSXeaeZ7f37Dg", catalogSource: "trusted" },
  { name: "Nike Team Hustle D 12 Older Kids' Basketball Shoes (UK 4.5)", category: "Shoes", description: "The Nike Team Hustle D is made for kids who love to hoop. Its strap closure system makes it easy to secure your fit fast. Underfoot, plush foam and a durable rubber outsole give you the cushioning and grip you need to confidently play on outdoor cour", basePrice: 3822, oldPrice: 5095, profitPercent: 20, stock: 50, imageAsset: "nike-team-hustle-d-12-older-kids-basketball-shoes-uk-4-5.webp", imageSourceUrl: "https://www.nike.in/nike-team-hustle-d-12-older-kids-basketball-shoes/p/27765283?fbclid=IwAR57V865p-NnE4yI-QkQNiFh7fr1o8NvB7mnVH1i7zn8ss01vCC3XymQxHXSug_maisc_WFW1LXcOT2uUMMwXee0sSw", catalogSource: "trusted" },
  { name: "Duke Women Lightweight Walking Shoes (XFOL1556)", category: "Shoes", description: "Experience ultimate comfort and lightweight performance with our Duke Women Lightweight Walking Shoes. The knitted EVA fabric offers a perfect combination of breathability and durability, making these shoes the ideal choice for your daily walks. Stay", basePrice: 1278, oldPrice: 3195, profitPercent: 20, stock: 50, imageAsset: "duke-women-lightweight-walking-shoes-xfol1556.webp", imageSourceUrl: "https://www.dukeindia.com/products/duke-women-lightweight-walking-shoes-xfol1556?utm_content=Facebook_UA&utm_source=facebook&variant=42880354058423&fbclid=IwAR5HZqEGNvt0IumRAZMGspY83C0B_Z62bjHLouakEIygyuuD4jW3HxKtlfUYSg_maisc_OJtU_xVFTliJJLZbfDod_Q", catalogSource: "trusted" },
  { name: "Nike Motiva 2 Women's Walking Shoes (UK 7)", category: "Shoes", description: "Made for your daily walks, the Motiva returns in a lighter, sleeker design. Cloud-like foam in the midsole gives you the same underfoot feel as the original and layered mesh up top keeps every step breathable.", basePrice: 9695, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "nike-motiva-2-women-s-walking-shoes-uk-7.webp", imageSourceUrl: "https://www.nike.in/nike-motiva-2-women-s-walking-shoes/p/27763562?fbclid=IwAR7u1OMcvfS7UALni8Wor0_w87waHsJoq9xMndKiUFfmW_esKJuCDKh5wPnIAg_maisc_oNjocmALR1i4VwEDNtifVg", catalogSource: "trusted" },
  { name: "Power Blue Walking Shoes For Women", category: "Shoes", description: "Whether you’re stepping out for a brisk morning walk or powering through your daily routine, these Power Walking Shoes for Women deliver unmatched comfort and style. Designed specifically for women who value both performance and aesthetics, these sho", basePrice: 1359, oldPrice: 1699, profitPercent: 20, stock: 50, imageAsset: "power-blue-walking-shoes-for-women.webp", imageSourceUrl: "https://www.bata.com/in/power-blue-walking-shoes-for-women-500_2025_5599277_040.html?fbclid=IwAR4C2UihCjRq6KPvUTAwtEQkljBZdlzV4kLzbrtKFnhlEZbhzZ4wq-WorsGVIg_maisc_siv80E_jQRC_tNPYYZDyJw", catalogSource: "trusted" },
  { name: "Nike Run Defy Men's Road-Running Shoes", category: "Shoes", description: "Run by your own rules in the Nike Run Defy. A foam midsole, breathable upper and reliable traction combine to make a shoe that's ready for runs of all lengths and paces.", basePrice: 2397, oldPrice: 3995, profitPercent: 20, stock: 50, imageAsset: "nike-run-defy-men-s-road-running-shoes.webp", imageSourceUrl: "https://www.nike.in/nike-run-defy-men-s-road-running-shoes/p/24942534?fbclid=IwAR6Q9B5b83-3JYI3Gi2sA7MyyeDef390bIUAFG06s8lWBI3GKE3V1DEg-wLucA_maisc_WYZAJKycQuyXetauWccrzw", catalogSource: "trusted" },
  { name: "Men’s Formal Leather Shoe | Genuine Leather Elegance for Professional Wear 996375", category: "Shoes", description: "Product Specifications * Model No.: 996375 * Product Type: Men’s Formal Leather Shoe * Upper Material: Genuine Leather * Sole Material: TPR * Size Range: 6 – 10 * Quantity: 1 Pair * MRP: ₹950/- Key Features & Benefits * Genuine Leather Upper: Premium", basePrice: 950, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "men-s-formal-leather-shoe-genuine-leather-elegance-for-professional-wear-996375.webp", imageSourceUrl: "https://sreeleathersonline.com/products/mens-formal-leather-shoe-996375?utm_content=Facebook_UA&utm_source=facebook&variant=50896175530230&fbclid=IwAR7ZBoHL7eW1naGOiNlgL8hWBB-m2afstOQZMZyc9Mk2UOqjs1zKzYXZ17R_aw_maisc_7Dda6QYDQfmuzVETxuMEfw", catalogSource: "trusted" },
  { name: "MENS FORMAL LEATHER SHOE 575222", category: "Shoes", description: "Model no - 575222 Mrp - 1400/- Size - 6 - 10 Mens formal Leather shoe Upper material - Genuine leather Sole - TPR Quantity - 1 pair Expertly crafted from high-quality leather, our Men's Formal Leather Shoe (Style #575222) is the perfect addition to a", basePrice: 1400, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "mens-formal-leather-shoe-575222.webp", imageSourceUrl: "https://sreeleathersonline.com/products/mens-formal-leather-shoe-575222?utm_content=Facebook_UA&utm_source=facebook&variant=49829833179382&fbclid=IwAR4tQN53aTbiRxQ3opyimmwoFGXey37tyumty3EZoFJUg0oDqASG18YGewN47w_maisc_NkvEUls3Ts-KXUMVevEEjg", catalogSource: "trusted" },
  { name: "Rapawalk Brown & Black Handcrafted Standard Width Leather Derbys", category: "Shoes", description: "Premium leather shoes expertfully handcrafted in Italian leather using artisanal techniques. Leather: Highest grade Full-grain Italian soft leather,that is dense, lightweight, ultra-durable, and abrasion resistant. Sole:Argentine leather soles in dar", basePrice: 8850, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "rapawalk-brown-black-handcrafted-standard-width-leather-derbys.webp", imageSourceUrl: "http://www.myntra.com/Formal-Shoes/RAPAWALK/Rapawalk-Brown--Black-Handcrafted-Standard-Width-Leather-Derbys/7282736/buy?fbclid=IwAR54lQDs8QTc_x9B6Hu8FW82WW4FWyXoPzEASTjIqIQo62-1idX_LMHiMiKK9g_maisc_4VlF8KxJQX-nDnZ9El5SXQ", catalogSource: "trusted" },
  { name: "cult Women's CloudFlex Walking Shoes - Lt.Mauve", category: "Shoes", description: "From busy mornings to long evening walks, the Cult Women’s CloudFlex Walking Shoes are built to keep every step light, smooth, and effortless. The high stretch breathable knitted upper adapts naturally to your foot, delivering flexible comfort and a ", basePrice: 2159, oldPrice: 3999, profitPercent: 20, stock: 50, imageAsset: "cult-women-s-cloudflex-walking-shoes-lt-mauve.webp", imageSourceUrl: "https://cultstore.com/products/cult-women-s-cloudflex-walking-shoes-lt-mauve?utm_content=Facebook_UA&utm_source=facebook&variant=55542040035496&fbclid=IwAR5Kp8ecJ0EG4uWFnkWiU30zgX-Vb_LJmxK4uI5ClyfJTgaXZNB7t7iy_G0c2w_maisc_4KYnOhokQg2XBnvji7U6xA", catalogSource: "trusted" },
  { name: "Elastic Training Mini Resistance Bands, Set of 3-5,6 and 7kg - Blue/Purple/Black", category: "Sports", description: "3 fitness resistance bands (5/6/7 kg) to boost your workout. Thighs, buttocks, arms, abs, whether you're standing or lying down, they won't let any muscle rest. Lightweight, compact and ready to travel anywhere, our 3 resistance bands offer different", basePrice: 399, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "elastic-training-mini-resistance-bands-set-of-3-5-6-and-7kg-blue-purple-black.webp", imageSourceUrl: "https://www.decathlon.in/p/8528803/elastic-training-mini-resistance-bands-set-of-3-5-6-and-7kg-blue-purple-black?fbclid=IwAR6sOPeZwGKcjLIVQq1fSQne_v86EO8fNPu_g80EHZdqWUoVkRQm3IYPdkYwjw_maisc_j7w9AQPpQMidI0BMsgWsyg", catalogSource: "trusted" },
  { name: "Badminton Racket for Adult - Pink - Br Sensation 190", category: "Sports", description: "Badminton Racket for Adult - Pink - Br Sensation 190 - This racket is tailored for beginner badminton players seeking a tolerant and powerful racket. It features a uniquely designed string bed that enlarges the sweet spot, tolerating more off -center", basePrice: 999, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "badminton-racket-for-adult-pink-br-sensation-190.webp", imageSourceUrl: "https://www.decathlon.in/p/8862685/adult-badminton-racket-br-sensation-190-pink?fbclid=IwAR4ths55Iis9PVtpF9RCVzHSpqki4LxYYqU3EpdbdHjNtviXQCO7VPQrsFr5xA_maisc_9EiOocZ5TSKJvY6x0Lga3w", catalogSource: "trusted" },
  { name: "3kg PVC Hex Dumbbell Set", category: "Sports", description: "Train smarter at home with the Lifelong PVC Hex Dumbbells Pack of 2. Each dumbbell weighs 3kg, making the total weight 6kg, ideal for beginners, fitness enthusiasts, and home gym workouts.", basePrice: 399, oldPrice: 600, profitPercent: 20, stock: 50, imageAsset: "3kg-pvc-hex-dumbbell-set.webp", imageSourceUrl: "https://www.lifelongindiaonline.com/products/3kg-hex-dumbbells?utm_content=Facebook_UA&utm_source=facebook&variant=41863463305278&fbclid=IwAR4zaSvQ4TzM4tj007U05KEVZ5hLWV4tRE94uUPcfzMrHQLJ6-hK8j4zJI5MSQ_maisc_-O6eKM7LQgC6c1-Nuaf8yA", catalogSource: "trusted" },
  { name: "Gym Bag 15L Grey", category: "Sports", description: "Our team of fitness enthusiasts designed this sports bag for carrying your essential belongings. Practical and ingenious, you can take it everywhere. This little training backpack is super trendy. Its drawstring handles make it ultra comfortable, and", basePrice: 799, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "gym-bag-15l-grey.webp", imageSourceUrl: "https://www.decathlon.in/p/8668362/gym-bag-15l-grey?fbclid=IwAR6XAh_MKDyX-q5jIRhOE4c4u5lrYeo4r9xweKqFZaqPuhvZGK5nQ_c-i6M55A_maisc_lweevh_-ToG-rpNjOgOOgw", catalogSource: "trusted" },
  { name: "ZAP Gun Carbine 10000 English Willow Cricket Bat (Grade 2)", category: "Sports", description: "CONQUER WITH CHARACTER What makes a cricket bat that you'd like to take out and smack bowlers left, right and centre? Crafted from handpicked exceptional Grade 2 Willow, the bat has a superwide central sweetspot that constitutes 50-60% of the bat's m", basePrice: 22812, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "zap-gun-carbine-10000-english-willow-cricket-bat-grade-2.webp", imageSourceUrl: "https://www.zapcricket.com/products/zap-gun-carbine-10000-english-willow-cricket-bat?variant=54698189848649&utm_medium=feed&utm_campaign=meta_catalog&utm_content=product_card&fbclid=IwAR49gjMbpiwca6sGg482X2gBx5k1zwoZEMJc_FJf6gQbjXXm8h07pCb6TLtdMA_maisc_um8-6TZRR92VhGz5efzy6w", catalogSource: "trusted" },
  { name: "Buy Regular Skipping Rope - Red Online | Decathlon", category: "Sports", description: "Buy Regular Skipping Rope - Red, red skipping rope, skipping rope exercise which is adjustable, & has a ergonomic grip for high intensity workout.", basePrice: 359, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "buy-regular-skipping-rope-red-online-decathlon.webp", imageSourceUrl: "https://www.decathlon.in/p/8556907/skipping-rope-regular-red?fbclid=IwAR6B_Czr_2a4zl_CEtFpwPFKHm1g9AdawoQNZHLMqy7uaTLSceEH1KSIiyW6aw_maisc_HKXNAw3fR8Sw8b8ivkx3GA", catalogSource: "trusted" },
  { name: "Slovic 6 mm Anti Slip Yoga Mat with Non-woven Cover Bag (Green) - 1 unit", category: "Sports", description: "Enhance your workouts with the Slovic 6 mm Yoga Mat, made from eco-friendly TPE material for safe, durable use. It offers excellent cushioning and joint support, while the anti-slip double-sided texture ensures a firm grip during exercises. Lightweig", basePrice: 849, oldPrice: 1399, profitPercent: 20, stock: 50, imageAsset: "slovic-6-mm-anti-slip-yoga-mat-with-non-woven-cover-bag-green-1-unit.webp", imageSourceUrl: "https://blinkit.com/prn/slovic-6-mm-anti-slip-yoga-mat-with-nonwoven-cover-bag-green/prid/770659?region_id=45923&utm_source=bl_ads_hylo&fbclid=IwAR4NDhifrVqhqSh-emVFTePGWh_NcuecWaELIMn9fResJRAvr4nL2U_lre4_rA_maisc_-J9b0sFpTWS5ylpVVBOQKg", catalogSource: "trusted" },
  { name: "BLU 111 English Willow Bat", category: "Sports", description: "Weight: 1160 -1200 g (Mens) Handle: Short Handle Made from top quality grade 3 natural English willow Handcrafted by master craftsman Treble spring handle for maximum shock absorption and strength Traditionally shaped and massive edges at drive zone ", basePrice: 17004, oldPrice: 17899, profitPercent: 20, stock: 50, imageAsset: "blu-111-english-willow-bat.webp", imageSourceUrl: "https://www.dsc-cricket.com/blu-111-english-willow-cricket-bat.html?fbclid=IwAR5ogHmocnuifW8HhFDoe1sHHvSgxGjpMBdzV1u0B8ijlGrZKHl7CBb2jOd19A_maisc_iu7KY24tRPOIoHup9julAw", catalogSource: "trusted" },
  { name: "Intense Passion English Willow Bat", category: "Sports", description: "Weight: 1160 -1200 g (Mens) Handle: Short Handle Made from top quality grade 2+ natural English willow Handcrafted by master craftsman Treble spring handle for maximum shock absorption and strength Traditionally shaped and massive edges at drive zone", basePrice: 37524, oldPrice: 39499, profitPercent: 20, stock: 50, imageAsset: "intense-passion-english-willow-bat.webp", imageSourceUrl: "https://www.dsc-cricket.com/intense-passion.html?fbclid=IwAR7w6RnPjBnLi6E9NwiKELeWh0il3WfZt9ycPSX1r2kvuMDH1jn_9LAOa9shfA_maisc_UnXNYFxOQDe4NhHHbs9Ejg", catalogSource: "trusted" },
  { name: "Intense Attitude English Willow Bat", category: "Sports", description: "Weight: 1160 -1200 g (Mens) Handle: Short Handle Made from top quality grade 4 natural English wIllow Handcrafted by master craftsman Treble spring handle for maximum shock absorption and strength Traditionally shaped and massive edges at drive zone ", basePrice: 19949, oldPrice: 20999, profitPercent: 20, stock: 50, imageAsset: "intense-attitude-english-willow-bat.webp", imageSourceUrl: "https://www.dsc-cricket.com/intense-attitude.html?fbclid=IwAR6IknFbGd9Xr2-3nOHBUOd49ci2slFYbyTyuMw5dSt2Amh8jU6PvOCdu4p0AQ_maisc_yacg9HAVQSGnVvMNO3z_Ow", catalogSource: "trusted" },
  { name: "Li-Ning Tectonic 1 Badminton Racket", category: "Sports", description: "Li-Ning Tectonic 1 Badminton Racket - Strung Crafting the ultimate ground-breaking performance booster, Li-Ning's Tectonic 1 is devised for strength and stability making it the perfect combination for bold attacks and relentless defenses. With its 7m", basePrice: 3990, oldPrice: 6690, profitPercent: 20, stock: 50, imageAsset: "li-ning-tectonic-1-badminton-racket.webp", imageSourceUrl: "https://prokicksports.com/products/li-ning-tectonic-1-badminton-racket?utm_content=Facebook_UA&utm_source=facebook&variant=44392112619814&fbclid=IwAR6MFTAEPUa9dau-RaS29iTQ_s4TXgAl7pg7lNax33H8UrWkA_KPie1URGmXSw_maisc_N4lLpRBrTwmu8h9yY5oJuw", catalogSource: "trusted" },
  { name: "BLAK 550 English Willow Bat", category: "Sports", description: "Weight: 1160 -1200 g (Mens) Handle: Short Handle Made from top quality grade 1+ natural English willow Exquisitely handcrafted by our master craftsman Curved Blade for powerful performance Traditionally shaped and massive edges at drive zone Mid to L", basePrice: 55384, oldPrice: 58299, profitPercent: 20, stock: 50, imageAsset: "blak-550-english-willow-bat.webp", imageSourceUrl: "https://www.dsc-cricket.com/blak-550-english-willow-bat.html?fbclid=IwAR4iSTiyx8lGYm4H6nUxrsSKTj42fAkTQ4qEGkOWdSrvaPGtbRhCnQxVNPIgqg_maisc_oMQ3-p0-T5KXbjg8EgiExA", catalogSource: "trusted" },
  { name: "Hundred Energy Burst 18 Strung Badminton Racket", category: "Sports", description: "- Colour: Black and Blue - Crafted with Japanese-made graphite, ensuring a lightweight and exceptionally durable frame, it is ideal for prolonged play. - Leveraging Curve technology enlarges the sweet spot, providing an edge in shot accuracy for play", basePrice: 1349, oldPrice: 2499, profitPercent: 20, stock: 50, imageAsset: "hundred-energy-burst-18-strung-badminton-racket.webp", imageSourceUrl: "http://www.myntra.com/Badminton-Racquets/Hundred/Hundred-Energy-Burst-18-Strung-Badminton-Racket-/41400374/buy?fbclid=IwAR49NKFzZcxrhn85MT_U9EOw4vEZYCJHbCZo5BPnr3pvgaNIXNVLxYx5bzh6Jg_maisc_6cJOWEU0QQu5Xn-OsJ06sA", catalogSource: "trusted" },
  { name: "Fastrack Kronos Guys Chronograph Watch With Date Black Dial & Black Leather Strap", category: "Watches", description: "Case dimension: 44.00 x 51.30 x 10.85 mm. Water resistance: 5 ATM / 50 m | Leather Strap | Stainless steel back cover | 2 years warranty period", basePrice: 5995, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "fastrack-kronos-guys-chronograph-watch-with-date-black-dial-black-leather-strap.webp", imageSourceUrl: "https://www.fastrack.in/product/fastrack-kronos-quartz-chronograph-with-date-black-dial-black-leather-strap-watch-for-guys-3335nl02.html?lang=en_IN&fbclid=IwAR5KXaPNpaLObQm38pCi2PPmSEFTca3ZxA4StD5D4fjJWQIKIfHdi-1mobzReg_maisc_MCkZ-zIrR5akNS2QTNPEtg", catalogSource: "trusted" },
  { name: "Fastrack Bare Basics Quartz Analog Brown Dial Leather Strap Watch for Guys", category: "Watches", description: "Display Brand Fastrack Name Fastrack Bare Basics Quartz Analog Brown Dial Leather Strap Watch for Guys Gender Guys Glass Material Mineral Glass Warranty Period 24 Months Warranty Detail This watch offers 24 months warranty on the Movement and 12 mont", basePrice: 1915, oldPrice: 2395, profitPercent: 20, stock: 50, imageAsset: "fastrack-bare-basics-quartz-analog-brown-dial-leather-strap-watch-for-guys.webp", imageSourceUrl: "https://www.fastrack.in/product/fastrack-bare-basics-quartz-analog-watch-for-guys-with-brown-dial-leather-strap-3247sl01.html?lang=en_IN&nsbp=true&fbclid=IwAR47hmVgAT5gFiW4I5uSAwPvbCjVG9vIqkrT90Rkh8NtJ_zIEjLB4rUIDblKRg_maisc_zcC-_Y41SPyfHJLJEb6V9A", catalogSource: "trusted" },
  { name: "Anne Klein Analog Watch For Women Nbak3001Blrt", category: "Watches", description: "Lending a contemporary twist to an elegant design, this women's analog watch from Anne Klein is a must-have wrist essential. Its stainless steel strap comes in a shade of navy that elevates the look of the watch. The grey round dial is housed in a 34", basePrice: 9499, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "anne-klein-analog-watch-for-women-nbak3001blrt.webp", imageSourceUrl: "https://www.kamalwatch.com/products/anne-klein-analog-watch-for-women-nbak3001blrt?utm_content=Facebook_UA&utm_source=facebook&variant=47661768966361&fbclid=IwAR5LXjKGBddydp2sDLX9Efljntfl5SRr6FjGIDq2JRqrNRPisd59e42gckFcDw_maisc_o1i8m0bpQyCR6o6LRq_amQ", catalogSource: "trusted" },
  { name: "Beetle Black Large Dial Grey PU Strap Men's Watch", category: "Watches", description: "This watch features a clean black dial with a sleek non-functional Chrono design and a cool brown faux leather strap, its design is equally elegant and sophisticated. This watch has a very timeless and stylish design and makes it a great addition to ", basePrice: 1999, oldPrice: 4699, profitPercent: 20, stock: 50, imageAsset: "beetle-black-large-dial-grey-pu-strap-men-s-watch.webp", imageSourceUrl: "https://jokerandwitch.com/products/beetle-black-dial-light-grey-pu-strap-watch?fbclid=IwAR78wJxmG525L776YBC1b81tHl3dK3DQlMsrJ-EoGC3yyk5QOODUm0ZZTZhuHA_maisc_czPQzPV1SOaqYPlVt-U8xg", catalogSource: "trusted" },
  { name: "Fastrack Overdrive Quartz Chronograph Tachymeter Black Dial Black Stainless Steel Strap Watch For Guys", category: "Watches", description: "Fuelled by the adrenaline of Formula 1, the Overdrive Chronograph Tachymeter is built for those who live life in the fast lane. Featuring a dynamic 3D dial inspired by a racetrack from above - complete with the silhouette of an iconic F1 car - this t", basePrice: 7495, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "fastrack-overdrive-quartz-chronograph-tachymeter-black-dial-black-stainless-steel-strap-watch-for-gu.webp", imageSourceUrl: "https://www.fastrack.in/product/fastrack-overdrive-quartz-chronograph-tachymeter-black-dial-black-stainless-steel-strap-watch-for-guys-3332km01.html?lang=en_IN&nsbp=true&fbclid=IwAR6Cld00TuMA6JLDlNmFcpVAcDpGUmkzSLo3ALyBlc8xQM1epWgUoFWAsnbHXw_maisc_2hg8LnpLTBKmeI5YFdo3gA", catalogSource: "trusted" },
  { name: "FOSSIL Men Analog Watch with Leather Strap - FS5380", category: "Watches", description: "Engineered with a leather strap and bold Roman markers, this analog watch from the FOSSIL is an instant winner for its refined construction. It comes with an adjustable tang buckle closure and is water-resistant up to 100 m. A perfect upgrade for any", basePrice: 12995, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "fossil-men-analog-watch-with-leather-strap-fs5380.webp", imageSourceUrl: "https://www.lifestylestores.com/in/en/SHOP-Fossil-FOSSIL-Men-Analog-Watch-with-Leather-Strap--FS5380-For-Men/p/1000006269734?fbclid=IwAR5aO5GAshmiw_pzLR0hZrNka_5_ncv792jJ-ohRnWjHhS5xr7Cn_nWh8rM3qw_maisc_HPTyusSnT8OIkpVEVng5LQ", catalogSource: "trusted" },
  { name: "Machine Men Quartz Black Dial Chronograph Silicone Watch FS6099", category: "Watches", description: "Inspired by classic American machinery, the Machine Chronograph commands attention with its bold knurled topring. Unmistakably masculine with a bold 44mm case housing a brushed black dial with textured details, all protected by a mineral crystal face", basePrice: 13495, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "machine-men-quartz-black-dial-chronograph-silicone-watch-fs6099.webp", imageSourceUrl: "https://justintime.in/products/fossil-machine-men-quartz-black-dial-chronograph-silicone-watch-fs6099?utm_content=Facebook_UA&utm_source=facebook&variant=51553922679059&fbclid=IwAR7lyjraCSMJvK4glfoshcPVq1SdDbeNhF4_NRed-uuwYVVE193X2Td--mfH4w_maisc_oJ2Fr_i7RBesfiCAxMWJmw", catalogSource: "trusted" },
  { name: "CASIO Men Analog Watch with Leather Strap - A1362", category: "Watches", description: "Engineered with a leather strap and bold Roman markers, this analog watch from the TITAN is an instant winner for its refined construction. It comes with an adjustable tang buckle closure, chronographic dials and is water-resistant up to 50m. A perfe", basePrice: 2995, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "casio-men-analog-watch-with-leather-strap-a1362.webp", imageSourceUrl: "https://www.lifestylestores.com/in/en/SHOP-Casio-CASIO-Men-Analog-Watch-with-Leather-Strap--A1362-For-Men/p/1000007062630?fbclid=IwAR72d8Onv09nRfwhEUfOO8kIscZyNpYz1hsvs-Xxj_Okrj5Y4dbnuW7OWsZUiA_maisc_XOj56AP3RKuopCD3J3q6xw", catalogSource: "trusted" },
  { name: "Carlington Diva Series Watch - 1 unit", category: "Watches", description: "The Carlington Diva Series Analog Women’s Watch is designed to complement the elegance and confidence of today’s woman. With its graceful dial and premium stainless steel chain strap, this watch blends timeless style with everyday practicality. Built", basePrice: 1899, oldPrice: 4999, profitPercent: 20, stock: 50, imageAsset: "carlington-diva-series-watch-1-unit.webp", imageSourceUrl: "https://blinkit.com/prn/carlington-diva-series-watch-1-unit/prid/773490?lat=28.620120&lon=77.162800&utm_source=bl_ads_hylo&fbclid=IwAR4qxSd5PIsainTouGPTknMlqEsYCXjQNhU4DnlwTTB2jFjXL6F0tWKpIdwQeQ_maisc_r6lGJpxyS6SMxaCJ3rs7DA", catalogSource: "trusted" },
  { name: "Tissot T1256173305100 Supersport Chrono Chronograph Watch for Men", category: "Watches", description: "This men's analog watch from Tissot is an exquisite timepiece that has a classic style with a contemporary touch. Functional on a quartz chronograph movement, the round dial is protected by a sapphire glass. The strap is crafted with care using stain", basePrice: 61000, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "tissot-t1256173305100-supersport-chrono-chronograph-watch-for-men.webp", imageSourceUrl: "https://watchfactory.in/products/tissot-t1256173305100-supersport-chrono-chronograph-watch-for-men?utm_content=Facebook_UA&utm_source=facebook&variant=44955368522008&fbclid=IwAR453LtRjeu4fh5jAsDNJpIvm9L0b-zTVcWoOkMBUO52YgX3kIlJMyzAdD6psw_maisc_eyUNcqBGQruVvqK748Wjlw", catalogSource: "trusted" },
  { name: "EMPORIO ARMANI Men Analog Watch with Leather Strap - AR2502", category: "Watches", description: "Engineered with a leather strap and bold markers, this analog watch from the ARMANI household is an instant winner for its refined construction. It comes with an adjustable tang buckle closure and is water-resistant up to 50m. A perfect upgrade for a", basePrice: 14495, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "emporio-armani-men-analog-watch-with-leather-strap-ar2502.webp", imageSourceUrl: "https://www.lifestylestores.com/in/en/SHOP-Armani-EMPORIO-ARMANI-Men-Analog-Watch-with-Leather-Strap--AR2502-For-Men/p/1000005246363?fbclid=IwAR6D_lC7m-vqgx8zjIEc1ku0EZdXwX1kg8J9Is7RZJCCRTUEQ9_LHhKnNVZJWA_maisc_RB4q49aoQK2fAnJ_uOD-tA", catalogSource: "trusted" },
  { name: "Guess Round 38mm White Dial Analog Women Watch - GW1034L4", category: "Watches", description: "Experience timeless craftsmanship with the GUESS Watch for Women Analog, a true classic among water resistant watches for Woman Analog. Designed with a bold 38mm White dial and a stylish BLUE Silicone Strap.\" this Women's watches model combines moder", basePrice: 14396, oldPrice: 17995, profitPercent: 20, stock: 50, imageAsset: "guess-round-38mm-white-dial-analog-women-watch-gw1034l4.webp", imageSourceUrl: "https://www.justwatches.com/products/guess-round-38mm-white-dial-analog-women-watch-gw1034l4?utm_content=Facebook_UA&utm_source=facebook&variant=48231728709880&fbclid=IwAR6u5N0hcWd2BrpduifdQmmQ7EOMaacxy3Q9BB_5jdbJVWaz-xK3JViOWgLvEQ_maisc_r0x00MSnTGakdEgcrGsKgg", catalogSource: "trusted" },
  { name: "DIESEL Men Mega Chief Analog Watch with Leather Strap - DZ1206", category: "Watches", description: "Engineered with a leather strap and bold numeric markers, this analog watch from the DIESEL is an instant winner. It comes with an adjustable tang buckle closure and is water-resistant up to 100m. A perfect upgrade for any occasion, this one exudes a", basePrice: 13995, oldPrice: null, profitPercent: 20, stock: 50, imageAsset: "diesel-men-mega-chief-analog-watch-with-leather-strap-dz1206.webp", imageSourceUrl: "https://www.lifestylestores.com/in/en/SHOP-Diesel-DIESEL-Men-Mega-Chief-Analog-Watch-with-Leather-Strap--DZ1206-For-Men/p/1000003150852?fbclid=IwAR7bHxAK5nELQoeZX1nm7ku8xAfI-faG3tzV0kOuJzNbmHZcEXI4VqBDrQe3hQ_maisc_L0_S6xIJTju96ZceugpvDA", catalogSource: "trusted" },
];

// Kitchen photo fixes: product id -> correct bundled photo filename.
// These 7 Home & Kitchen products showed a wrong/shared photo.
const KITCHEN_PHOTO_FIXES: Record<number, string> = {
  254: "kitchen-254-cookware.jpg",
  264: "kitchen-264-grinder.jpg",
  274: "kitchen-274-dinnerset.jpg",
  284: "kitchen-284-bedsheet.jpg",
  294: "kitchen-294-kettle.png",
  304: "kitchen-304-containers.jpg",
  314: "kitchen-314-dinnerset.jpg",
};
// Age signal for a blob key. Every blob key this backend generates embeds
// Date.now() as the first dash-segment of its last path segment
// (seller-docs/<kind>/<ms>-..., chat-attachments/<ms>-...,
// deposit-screenshots/<ms>-..., header-logo/<ms>-...). The blobs table
// has NO created_at column, so this is the only age signal available;
// keys that do not match (seeded/legacy keys) return null and are NEVER
// deleted by cleanup.
function blobKeyTimestamp(key: string): number | null {
  const last = key.split("/").pop() ?? "";
  const ms = Number(last.split("-")[0]);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

// Lazy orphan-blob cleanup. uploadSellerDocument must stay PUBLIC: the
// guest seller-signup form uploads documents BEFORE the account exists
// (frontend FileNameField -> registerSeller with the returned keys), so
// a token gate would break every guest signup at the document step.
// Instead, each upload deletes at most 100 blob rows that are BOTH older
// than 24h AND referenced by no owning row, so abandoned guest uploads
// cannot accumulate forever while in-flight signups (minutes old) and
// every attached file are always safe. Best-effort: any failure here is
// swallowed so cleanup can never break an upload.
async function cleanupOrphanBlobs(ctx: Ctx): Promise<void> {
  try {
    const db = ctx.db<typeof schema>();
    const referenced = new Set<string>();
    const collect = (rows: Array<Record<string, unknown>>, field: string) => {
      for (const r of rows) {
        const v = r[field];
        if (typeof v === "string" && v) referenced.add(v);
      }
    };
    const [u, o, c, w, s] = await Promise.all([
      db.select({ photoBlobKey: schema.users.photoBlobKey, storeLogoBlobKey: schema.users.storeLogoBlobKey, docFrontBlobKey: schema.users.docFrontBlobKey, docBackBlobKey: schema.users.docBackBlobKey }).from(schema.users),
      db.select({ paymentProofBlobKey: schema.orders.paymentProofBlobKey }).from(schema.orders),
      db.select({ attachmentBlobKey: schema.chatMessages.attachmentBlobKey }).from(schema.chatMessages),
      db.select({ screenshotBlobKey: schema.walletTransactions.screenshotBlobKey }).from(schema.walletTransactions),
      db.select({ headerLogoBlobKey: schema.settings.headerLogoBlobKey, headerLogoUrl: schema.settings.headerLogoUrl }).from(schema.settings),
    ]);
    for (const r of u) {
      collect([r], "photoBlobKey");
      collect([r], "storeLogoBlobKey");
      collect([r], "docFrontBlobKey");
      collect([r], "docBackBlobKey");
    }
    collect(o, "paymentProofBlobKey");
    collect(c, "attachmentBlobKey");
    collect(w, "screenshotBlobKey");
    for (const r of s) {
      if (typeof r.headerLogoBlobKey === "string" && r.headerLogoBlobKey) referenced.add(r.headerLogoBlobKey);
      // A pasted header-logo URL may itself point at a blob; keep that
      // blob alive too (single settings row, cheap to parse).
      if (typeof r.headerLogoUrl === "string") {
        const m = r.headerLogoUrl.match(/\/blobs\/([^?#]+)/);
        if (m) {
          try { referenced.add(decodeURIComponent(m[1])); } catch { /* malformed URL, ignore */ }
        }
      }
    }
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const all = await db.select({ key: schema.blobs.key }).from(schema.blobs);
    let deleted = 0;
    for (const row of all) {
      if (deleted >= 100) break;
      if (referenced.has(row.key)) continue;
      const ts = blobKeyTimestamp(row.key);
      if (ts === null || ts > cutoff) continue;
      await ctx.blobs.delete(row.key);
      deleted++;
    }
  } catch {
    // Orphan cleanup must never fail an upload.
  }
}

export const Actions = {
  seedCatalog: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({ seeded: z.boolean(), count: z.number() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      await getSettingsRow(db);
      const existing = await db
        .select({ id: schema.products.id })
        .from(schema.products)
        .limit(1);
      if (existing.length > 0) {
        const all = await db.select({ id: schema.products.id }).from(schema.products);
        return { seeded: false, count: all.length };
      }
      try {
        await db.insert(schema.products).values(STARTER_PRODUCTS);
      } catch (e) {
        // Concurrent first load already seeded (unique product names).
        if (!String(e).includes("UNIQUE")) throw e;
        const all = await db.select({ id: schema.products.id }).from(schema.products);
        return { seeded: false, count: all.length };
      }
      ctx.invalidateQueries();
      return { seeded: true, count: STARTER_PRODUCTS.length };
    },
  }),

  // One-time India catalog sync (the owner asked for INR pricing at Indian
  // market levels and a much bigger catalog with a Cosmetics section).
  // INSERT-ONLY since the 2026-10-29 security fix: it must NEVER overwrite
  // an existing product's price, description, category or image — admin
  // edits to starter products used to be reverted by this action (and by
  // the frontend's auto-call on every first load). Missing starter
  // products are inserted; everything already present is left untouched.
  // Admin-only: the old public tag let anyone trigger the sync.
  ensureIndiaCatalog: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({
      ok: z.literal(true),
      updated: z.number(),
      inserted: z.number(),
      total: z.number(),
    }),
    async handler(
      ctx,
    ): Promise<{ ok: true; updated: number; inserted: number; total: number }> {
      const db = ctx.db<typeof schema>();
      await getSettingsRow(db);
      const existing = await db.select().from(schema.products);
      const byName = new Map(existing.map((p) => [p.name, p]));
      // "updated" stays 0 by design: existing products are never touched.
      const updated = 0;
      let inserted = 0;
      for (const entry of STARTER_PRODUCTS) {
        if (byName.has(entry.name)) continue;
        try {
          await db.insert(schema.products).values(entry);
          inserted += 1;
        } catch (e) {
          // A concurrent first load (or the post-submit sync) inserted
          // this product first; the unique name index turns the duplicate
          // into a no-op instead of a second row.
          if (!String(e).includes("UNIQUE")) throw e;
        }
      }
      if (inserted > 0) ctx.invalidateQueries();
      const all = await db
        .select({ id: schema.products.id })
        .from(schema.products);
      return { ok: true as const, updated, inserted, total: all.length };
    },
  }),

  getSettings: defineAction({
    auth: "public",
    request: z.object({}),
    response: z.object({
      storeName: z.string(),
      supportWhatsapp: z.string(),
      supportEmail: z.string(),
      supportTelegram: z.string(),
      defaultProfitPercent: z.number(),
      colorScheme: z.string(),
      layoutDesign: z.string(),
      usdtDepositAddress: z.string(),
      depositNetwork: z.string(),
      depositsEnabled: z.boolean(),
      localDepositNote: z.string(),
      langHindiEnabled: z.boolean(),
      langArabicEnabled: z.boolean(),
      currencyInrEnabled: z.boolean(),
      currencyUsdEnabled: z.boolean(),
      currencyUsdtEnabled: z.boolean(),
      externalProductsEnabled: z.boolean(),
      paymentUpiEnabled: z.boolean(),
      paymentBankEnabled: z.boolean(),
      paymentUsdtEnabled: z.boolean(),
      lastPriceSyncAt: z.string().nullable(),
      lastPriceSyncNote: z.string(),
      googleSignInEnabled: z.boolean(),
      headerLogoUrl: z.string(),
      headerBrandMode: z.string(),
      storefrontTheme: z.string(),
      reviewsSectionEnabled: z.boolean(),
      sessionsEnabled: z.boolean(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const s = await getSettingsRow(db);
      return {
        storeName: s.storeName,
        supportWhatsapp: s.supportWhatsapp,
        supportEmail: s.supportEmail,
        supportTelegram: s.supportTelegram ?? "",
        defaultProfitPercent: s.defaultProfitPercent,
        colorScheme: s.colorScheme ?? "navy",
        layoutDesign: s.layoutDesign ?? "classic",
        usdtDepositAddress: s.usdtDepositAddress ?? "",
        depositNetwork: s.depositNetwork ?? "BEP20 (BNB Smart Chain)",
        depositsEnabled: (s.depositsEnabled ?? 1) === 1,
        localDepositNote: s.localDepositNote ?? "",
        langHindiEnabled: (s.langHindiEnabled ?? 1) === 1,
        langArabicEnabled: (s.langArabicEnabled ?? 1) === 1,
        currencyInrEnabled: (s.currencyInrEnabled ?? 1) === 1,
        currencyUsdEnabled: (s.currencyUsdEnabled ?? 1) === 1,
        currencyUsdtEnabled: (s.currencyUsdtEnabled ?? 1) === 1,
        externalProductsEnabled: (s.externalProductsEnabled ?? 1) === 1,
        paymentUpiEnabled: (s.paymentUpiEnabled ?? 1) === 1,
        paymentBankEnabled: (s.paymentBankEnabled ?? 1) === 1,
        paymentUsdtEnabled: (s.paymentUsdtEnabled ?? 1) === 1,
        lastPriceSyncAt: s.lastPriceSyncAt ? s.lastPriceSyncAt.toISOString() : null,
        lastPriceSyncNote: s.lastPriceSyncNote ?? "",
        googleSignInEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        headerLogoUrl: s.headerLogoBlobKey ? await ctx.blobs.getUrl(s.headerLogoBlobKey) : (s.headerLogoUrl ?? ""),
        headerBrandMode: (s as { headerBrandMode?: string }).headerBrandMode ?? "both",
        storefrontTheme: (s as { storefrontTheme?: string }).storefrontTheme ?? "premium",
        reviewsSectionEnabled: ((s as { reviewsSectionEnabled?: number }).reviewsSectionEnabled ?? 1) === 1,
        sessionsEnabled: true,
      };
    },
  }),

  // Admin → Theme & Design → Header Logo: upload an image (stored as
  // a blob, same 3 MB / image-type rules as seller document uploads)
  // or paste an image URL; remove restores the text brand. Only the
  // admin may change it; the resolved URL is public via getSettings.
  adminSetHeaderLogo: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      mode: z.enum(["upload", "url", "remove"]),
      dataBase64: z.string().max(6000000).optional(),
      fileName: z.string().max(200).optional(),
      contentType: z.string().max(100).optional(),
      imageUrl: z.string().max(1000).optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), headerLogoUrl: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can change the header logo.", headerLogoUrl: "" };
      const s = await getSettingsRow(db);
      const patch: Record<string, unknown> = {};
      if (args.mode === "remove") {
        patch.headerLogoBlobKey = null; patch.headerLogoContentType = null; patch.headerLogoSize = null; patch.headerLogoUrl = "";
      } else if (args.mode === "url") {
        const url = (args.imageUrl ?? "").trim();
        if (!url) return { ok: false, error: "Paste an image URL first.", headerLogoUrl: "" };
        if (!/^https?:\/\//i.test(url)) return { ok: false, error: "The image URL must start with http:// or https://.", headerLogoUrl: "" };
        patch.headerLogoBlobKey = null; patch.headerLogoContentType = null; patch.headerLogoSize = null; patch.headerLogoUrl = url;
      } else {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowed.includes(args.contentType ?? "")) return { ok: false, error: "Only JPG, PNG, WEBP or GIF images are allowed.", headerLogoUrl: "" };
        let bytes: Uint8Array;
        try { bytes = new Uint8Array(Buffer.from(args.dataBase64 ?? "", "base64")); } catch { return { ok: false, error: "The file could not be read. Please try again.", headerLogoUrl: "" }; }
        if (bytes.length === 0) return { ok: false, error: "The selected file is empty.", headerLogoUrl: "" };
        if (sniffFileType(bytes) !== args.contentType) return { ok: false, error: "The file's contents do not match its type — please upload a genuine JPG, PNG, WEBP or GIF image.", headerLogoUrl: "" };
        if (bytes.length > 3 * 1024 * 1024) return { ok: false, error: "File is too large — maximum 3 MB.", headerLogoUrl: "" };
        const safe = (args.fileName ?? "logo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
        const key = `header-logo/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safe}`;
        await ctx.blobs.put(key, bytes, { contentType: args.contentType! });
        patch.headerLogoBlobKey = key; patch.headerLogoContentType = args.contentType; patch.headerLogoSize = bytes.length; patch.headerLogoUrl = "";
      }
      await db.update(schema.settings).set(patch as never).where(eq(schema.settings.id, s.id));
      ctx.invalidateQueries();
      const after = await getSettingsRow(db);
      const headerLogoUrl = after.headerLogoBlobKey ? await ctx.blobs.getUrl(after.headerLogoBlobKey) : (after.headerLogoUrl ?? "");
      return { ok: true, error: null, headerLogoUrl };
    },
  }),

  // Admin → Settings → Deposit Settings: the USDT deposit destination
  // sellers see on the Wallet → Deposit page (address + network). The QR
  // on that page is generated from exactly this saved address. The
  // address must be non-empty and look like a wallet address; a format
  // mismatch for the chosen network is a written WARNING (the save still
  // succeeds) because the network field governs what "correct" means.
  updateDepositSettings: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      usdtDepositAddress: z.string().max(200),
      depositNetwork: z.string().min(1).max(80),
      // Admin-editable local-deposit line for the seller deposit page.
      // Saved trimmed; an empty value restores the built-in default line.
      localDepositNote: z.string().max(1000).optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), warning: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can change deposit settings.", warning: null };
      const address = args.usdtDepositAddress.trim();
      const network = args.depositNetwork.trim();
      if (!address) return { ok: false, error: "USDT Deposit Address is missing — please paste the wallet address sellers should send USDT to.", warning: null };
      if (!network) return { ok: false, error: "Network is missing — please enter the network name (for example BEP20 (BNB Smart Chain)).", warning: null };
      // Plausible wallet address: alphanumeric only (0x… hex for EVM
      // chains, base58 for TRON etc.), 26–64 characters, no spaces.
      if (!/^[A-Za-z0-9]{26,64}$/.test(address)) {
        return { ok: false, error: "This does not look like a wallet address — it should be 26–64 letters/numbers with no spaces (a BEP20 address starts with 0x and is 42 characters). Please check and paste it again.", warning: null };
      }
      let warning: string | null = null;
      const net = network.toUpperCase();
      if ((net.includes("BEP20") || net.includes("BSC") || net.includes("BNB")) && !/^0x[0-9a-fA-F]{40}$/.test(address)) {
        warning = "Warning: for BEP20 the address should start with 0x and be 42 characters. It was saved as entered — please double-check it is the right address for the selected network.";
      } else if (net.includes("TRC20") && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
        warning = "Warning: a TRC20 address usually starts with T and is 34 characters. It was saved as entered — please double-check it is the right address for the selected network.";
      }
      await getSettingsRow(db);
      await db.update(schema.settings).set({ usdtDepositAddress: address, depositNetwork: network, localDepositNote: (args.localDepositNote ?? "").trim() }).where(eq(schema.settings.id, 1));
      ctx.invalidateQueries();
      return { ok: true, error: null, warning };
    },
  }),

  // Admin → Settings → Deposit Settings: the Deposit Account ON/OFF
  // switch. OFF hides the address/QR on the seller deposit page and
  // blocks new deposit requests (requestDeposit checks the same flag);
  // balances, past deposits and withdrawals are untouched.
  setDepositsEnabled: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), enabled: z.boolean() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), depositsEnabled: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can switch deposits on or off.", depositsEnabled: false };
      await getSettingsRow(db);
      await db.update(schema.settings).set({ depositsEnabled: args.enabled ? 1 : 0 }).where(eq(schema.settings.id, 1));
      ctx.invalidateQueries();
      return { ok: true, error: null, depositsEnabled: args.enabled };
    },
  }),

  // Admin → Settings → Payment Methods: per-method ON/OFF switches for
  // UPI, Bank Account and USDT. An OFF method is hidden from the seller
  // deposit/withdraw pickers and refused by requestDeposit /
  // requestWithdraw; USDT OFF also hides the Deposit Address card/QR.
  // All three may be OFF (the forms then show a written "currently
  // unavailable" note). Existing requests, balances and history are
  // never touched. Admin-only, like every other settings save.
  updatePaymentMethods: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      upiEnabled: z.boolean(),
      bankEnabled: z.boolean(),
      usdtEnabled: z.boolean(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can change payment method settings." };
      await getSettingsRow(db);
      await db.update(schema.settings).set({
        paymentUpiEnabled: args.upiEnabled ? 1 : 0,
        paymentBankEnabled: args.bankEnabled ? 1 : 0,
        paymentUsdtEnabled: args.usdtEnabled ? 1 : 0,
      }).where(eq(schema.settings.id, 1));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Admin → Settings → Language & Prices: per-language and per-currency
  // ON/OFF switches. English is always ON (fallback) so it is not part
  // of this action. At least one price currency must stay ON — otherwise
  // prices could not be shown at all — so an all-OFF currency set is
  // refused with a written error and nothing is saved.
  updateLanguagePriceSettings: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      langHindiEnabled: z.boolean(),
      langArabicEnabled: z.boolean(),
      currencyInrEnabled: z.boolean(),
      currencyUsdEnabled: z.boolean(),
      currencyUsdtEnabled: z.boolean(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can change language and price settings." };
      if (!args.currencyInrEnabled && !args.currencyUsdEnabled && !args.currencyUsdtEnabled) {
        return { ok: false, error: "At least one price currency (INR, USD or USDT) must stay ON — prices cannot be shown if all three are OFF. Please keep one currency ON and save again." };
      }
      await getSettingsRow(db);
      await db.update(schema.settings).set({
        langHindiEnabled: args.langHindiEnabled ? 1 : 0,
        langArabicEnabled: args.langArabicEnabled ? 1 : 0,
        currencyInrEnabled: args.currencyInrEnabled ? 1 : 0,
        currencyUsdEnabled: args.currencyUsdEnabled ? 1 : 0,
        currencyUsdtEnabled: args.currencyUsdtEnabled ? 1 : 0,
      }).where(eq(schema.settings.id, 1));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Admin → Theme & Design: pick the store-wide colour scheme and layout
  // design. Stored in settings, so the whole store (shop, seller, admin)
  // changes for every visitor at once. The light/dark toggle stays a
  // per-visitor choice on top of this.
  updateStoreDesign: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      colorScheme: z.enum(["navy", "emerald", "royal", "charcoal", "teal", "crimson", "sunset", "rose"]),
      layoutDesign: z.enum(["classic", "menu", "topsearch", "minimal", "wide"]),
      headerBrandMode: z.enum(["both", "logo", "text"]),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this." };
      await getSettingsRow(db);
      await db.update(schema.settings).set({ colorScheme: args.colorScheme, layoutDesign: args.layoutDesign, headerBrandMode: args.headerBrandMode }).where(eq(schema.settings.id, 1));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Admin → Theme & Design: one-click storefront theme activation
  // ("premium" = the existing theme, "fresh" = Fresh Market). Only the
  // theme column changes — colour scheme, layout, logo and every
  // business table are untouched, so switching back restores Premium
  // exactly. Deliberately separate from updateStoreDesign so the
  // scheme/layout save can never clobber the theme (and vice versa).
  adminSetStorefrontTheme: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      theme: z.enum(["premium", "fresh"]),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this." };
      await getSettingsRow(db);
      await db.update(schema.settings).set({ storefrontTheme: args.theme }).where(eq(schema.settings.id, 1));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Admin → Products: ONE-CLICK price refresh. Re-syncs every product's
  // price (base price + old/MRP price) to the store's latest maintained
  // price list — the canonical catalog price data this app seeds and
  // syncs from (STARTER_PRODUCTS, matched by product name). There is no
  // external supplier/market feed connected, so this honestly refreshes
  // from that price list; it never invents market prices. Products the
  // Admin added or renamed are not in the price list and keep their
  // price. Records when the refresh ran in settings.
  refreshCatalogPrices: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      changed: z.number(),
      checked: z.number(),
      skipped: z.number(),
      examples: z.array(z.object({ name: z.string(), oldBasePrice: z.number(), newBasePrice: z.number(), oldBuyerPrice: z.number(), newBuyerPrice: z.number() })),
      syncedAt: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const fail = (error: string) => ({ ok: false, error, changed: 0, checked: 0, skipped: 0, examples: [], syncedAt: null });
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return fail("You do not have permission to do this.");
      const rows = await db.select().from(schema.products);
      const byName = new Map(STARTER_PRODUCTS.map((p) => [p.name, p]));
      let changed = 0;
      let skipped = 0;
      const examples: Array<{ name: string; oldBasePrice: number; newBasePrice: number; oldBuyerPrice: number; newBuyerPrice: number }> = [];
      for (const row of rows) {
        const entry = byName.get(row.name);
        if (!entry) { skipped += 1; continue; }
        if (row.basePrice !== entry.basePrice || row.oldPrice !== entry.oldPrice) {
          const oldBuyer = row.basePrice + profitOf(row.basePrice, row.profitPercent);
          const newBuyer = entry.basePrice + profitOf(entry.basePrice, row.profitPercent);
          await db.update(schema.products).set({ basePrice: entry.basePrice, oldPrice: entry.oldPrice }).where(eq(schema.products.id, row.id));
          changed += 1;
          if (examples.length < 5) examples.push({ name: row.name, oldBasePrice: row.basePrice, newBasePrice: entry.basePrice, oldBuyerPrice: oldBuyer, newBuyerPrice: newBuyer });
        }
      }
      const now = new Date();
      const note = changed > 0
        ? `${changed} price(s) updated from the latest price list (${rows.length} products checked${skipped > 0 ? `, ${skipped} not in the price list kept their price` : ""}).`
        : `All prices already match the latest price list (${rows.length} products checked).`;
      await getSettingsRow(db);
      await db.update(schema.settings).set({ lastPriceSyncAt: now, lastPriceSyncNote: note }).where(eq(schema.settings.id, 1));
      ctx.invalidateQueries();
      return { ok: true, error: null, changed, checked: rows.length, skipped, examples, syncedAt: now.toISOString() };
    },
  }),

  updateSettings: defineAction({
    auth: { arg: "userId", role: "admin" },
    request: z.object({
      userId: z.number(),
      storeName: z.string().min(1).max(80),
      supportWhatsapp: z.string().max(30),
      supportEmail: z.string().max(120),
      supportTelegram: z.string().max(120).optional(),
      defaultProfitPercent: z.number().int().min(0).max(200),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const me = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.userId))
        .limit(1);
      if (!me[0] || me[0].role !== "admin") {
        throw new Error("Only the admin can change store settings.");
      }
      await getSettingsRow(db);
      await db
        .update(schema.settings)
        .set({
          storeName: args.storeName,
          supportWhatsapp: args.supportWhatsapp,
          supportEmail: args.supportEmail,
          ...(args.supportTelegram !== undefined ? { supportTelegram: args.supportTelegram } : {}),
          defaultProfitPercent: args.defaultProfitPercent,
        })
        .where(eq(schema.settings.id, 1));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // Bulk auto-add: generate N brand-new products spread across all
  // categories (Admin → Products). Names are composed per category from
  // brand/type/style/colour parts and checked against every existing
  // product name, so nothing duplicates; prices sit inside each
  // category's existing price range with the same budget/premium mix;
  // each generated product reuses a real photo from its own category
  // (the same owned-photo mechanism as the curated catalog), and is
  // marked catalog_source = "bulk" internally. Existing products are
  // never touched. There is NO per-run cap: the Admin can add as many
  // as they type in one run; generation and inserts run in internal
  // batches so a very large run still completes reliably.
  adminBulkGenerateProducts: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      mode: z.enum(["add", "target"]),
      value: z.number().int().min(1),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      added: z.number(),
      totalNow: z.number(),
      perCategory: z.array(z.object({ category: z.string(), added: z.number() })),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const fail = (error: string, totalNow: number) => ({ ok: false, error, added: 0, totalNow, perCategory: [] as Array<{ category: string; added: number }> });
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      const existing = await db.select().from(schema.products);
      if (!me[0] || me[0].role !== "admin") return fail("Only the Admin can add products in bulk.", existing.length);
      const want = args.mode === "target" ? args.value - existing.length : args.value;
      if (want <= 0) return fail(args.mode === "target" ? "The catalog already has that many products — enter a bigger target total." : "Enter how many new products to add.", existing.length);
      // No maximum: any positive count is accepted. Only zero /
      // negative / already-reached targets are refused (above).

      // Photo fix: bulk products used to be inserted with imageAsset null,
      // so they showed letter tiles. Reuse a real photo from the same
      // category (an existing product's imageAsset), round-robin.
      const donors = new Map<string, string[]>();
      for (const p of existing) {
        if (p.imageAsset) {
          const list = donors.get(p.category) ?? [];
          list.push(p.imageAsset);
          donors.set(p.category, list);
        }
      }
      const donorIdx = new Map<string, number>();
      const donorFor = (category: string): string | null => {
        const list = donors.get(category);
        if (!list || list.length === 0) return null;
        const idx = donorIdx.get(category) ?? 0;
        donorIdx.set(category, idx + 1);
        return list[idx % list.length]!;
      };
      const PARTS: Record<string, { brands: string[]; types: string[]; styles: string[]; specs: string[] }> = {
        "Electronics": { brands: ["SoundWave", "VoltEdge", "TechNest", "Aurora", "NexLine", "PowerHub", "EchoBeat", "Zentro"], types: ["Wireless Bluetooth Speaker", "True Wireless Earbuds", "Fast Charger", "Power Bank 20000mAh", "LED Desk Lamp", "USB-C Charging Cable", "Bluetooth Neckband", "Smart LED Strip Light", "Mini Table Fan", "Wireless Mouse"], styles: ["Pro", "Plus", "Max", "Lite", "Ultra", "Classic", "Sport", "Studio"], specs: ["with Mic", "Type-C", "with Carry Case", "2026 Edition", "with Fast Pairing", "with LED Display"] },
        "Mobiles": { brands: ["Galaxy", "Redmi", "Realme", "Vivo", "Oppo", "Poco", "Infinix", "Moto"], types: ["5G Smartphone", "5G Smartphone", "5G Smartphone", "4G Smartphone"], styles: ["", "", "Plus", "Pro"], specs: ["6GB RAM, 128GB", "8GB RAM, 128GB", "8GB RAM, 256GB", "12GB RAM, 256GB"] },
        "Fashion": { brands: ["UrbanThread", "StyleKart", "Vastra", "Trendio", "FabLane", "Meena", "Kurtiva", "DenimCo"], types: ["Men's Casual T-Shirt", "Women's Printed Kurti", "Men's Slim-Fit Jeans", "Women's Ethnic Dress", "Men's Cotton Shirt", "Women's Palazzo Set", "Unisex Hoodie", "Men's Track Pants", "Women's Straight Kurta", "Kids Cotton Frock"], styles: ["Classic", "Festive", "Everyday", "Premium", "Summer", "Comfort Fit"], specs: ["Pack of 1", "Pack of 2", "Sizes S-XXL", "Sizes M-XL"] },
        "Home & Kitchen": { brands: ["HomeEssenz", "KitchenKraft", "NestLiving", "CookPro", "UrbanNest", "DailyUse", "SteelCraft", "HomeJoy"], types: ["Non-Stick Cookware Set", "Steel Dinner Set", "Electric Kettle 1.8L", "Cotton Bedsheet Set", "Storage Container Set", "Pressure Cooker", "Mixer Grinder", "Dinner Serving Bowl Set", "Cotton Curtain Pair", "Water Bottle Set of 6"], styles: ["Classic", "Premium", "Everyday", "Family Pack", "Deluxe", "Essential"], specs: ["Set of 4", "Set of 6", "Set of 12", "King Size", "Queen Size"] },
        "Cosmetics": { brands: ["GlowKart", "Lakmé Style", "HerbalGlow", "PureSkin", "VelvetTouch", "Naturals", "ShineLab", "AromaSkin"], types: ["Matte Lipstick", "Liquid Foundation", "Kajal Pencil", "Face Wash Gel", "Hair Serum", "Compact Powder", "Nail Polish Set", "Face Cream", "Body Lotion", "Eyeliner Pen"], styles: ["Matte", "Glossy", "Herbal", "Long-Lasting", "Daily Care", "Premium"], specs: ["Pack of 1", "Pack of 2", "100ml", "200ml", "50g"] },
        "Beauty": { brands: ["GlowKart", "PureSkin", "HerbalGlow", "VelvetTouch", "Naturals", "AromaSkin", "ShineLab", "SkinFirst"], types: ["Vitamin C Serum", "Sunscreen SPF 50", "Aloe Vera Gel", "Charcoal Face Mask", "Rose Water Toner", "Hair Oil", "Sheet Mask Pack", "Body Scrub", "Lip Balm Set", "Face Moisturiser"], styles: ["Herbal", "Premium", "Daily Care", "Hydrating", "Brightening", "Natural"], specs: ["100ml", "200ml", "Pack of 3", "Pack of 5", "50ml"] },
        "Shoes": { brands: ["StrideX", "RunFlex", "UrbanWalk", "SportZone", "ComfortStep", "TrailPro", "FlexFit", "WalkEasy"], types: ["Men's Running Shoes", "Women's Walking Shoes", "Kids Sports Shoes", "Men's Casual Sneakers", "Women's Sandals", "Men's Formal Shoes", "Women's Heels", "Unisex Canvas Shoes"], styles: ["Sport", "Classic", "Comfort", "Premium", "Everyday", "Lightweight"], specs: ["UK 6-10", "UK 5-9", "UK 3-8"] },
        "Watches": { brands: ["TimeKart", "Chronox", "EliteTime", "WatchHub", "Tempo", "UrbanTime", "Classiq", "NovaTime"], types: ["Men's Analog Watch", "Women's Analog Watch", "Smart Watch", "Men's Chronograph Watch", "Women's Bracelet Watch", "Digital Sports Watch", "Fitness Smart Band Watch"], styles: ["Classic", "Premium", "Sport", "Minimal", "Luxury Look", "Everyday"], specs: ["Leather Strap", "Steel Strap", "Silicone Strap"] },
        "Sports": { brands: ["SportZone", "ProPlay", "FitGear", "ChampionX", "ActiveLab", "TrailPro", "FlexFit", "PowerPlay"], types: ["Cricket Bat", "Badminton Racket Pair", "Yoga Mat 6mm", "Dumbbell Set", "Football Size 5", "Skipping Rope", "Resistance Band Set", "Cricket Ball Pack", "Table Tennis Set", "Gym Gloves Pair"], styles: ["Pro", "Classic", "Training", "Premium", "Club", "Everyday"], specs: ["Pack of 1", "Pack of 2", "Set of 3"] },
        "Bags": { brands: ["TravelKart", "UrbanPack", "StyleTote", "BagNest", "Voyago", "CarryAll", "TrendBag", "PackPro"], types: ["Travel Backpack", "Women's Handbag", "Laptop Bag 15.6 inch", "School Bag", "Duffel Travel Bag", "Sling Crossbody Bag", "Wallet & Card Holder", "Trolley Travel Bag"], styles: ["Classic", "Premium", "Everyday", "Anti-Theft", "Water-Resistant", "Lightweight"], specs: ["20L", "30L", "35L", "With Shoe Pocket"] },
      };
      const COLOURS = ["Black", "Blue", "Red", "Green", "Maroon", "Grey", "White", "Pink", "Brown", "Navy", "Beige", "Purple"];
      const byCat = new Map<string, typeof existing>();
      for (const p of existing) {
        const arr = byCat.get(p.category) ?? [];
        arr.push(p);
        byCat.set(p.category, arr);
      }
      const categories = Object.keys(PARTS).filter((c) => (byCat.get(c) ?? []).length > 0);
      if (categories.length === 0) return fail("The catalog is empty — add the starter catalog first.", existing.length);
      const usedNames = new Set(existing.map((p) => p.name.toLowerCase()));
      const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
      const rows: Array<typeof schema.products.$inferInsert> = [];
      const perCatCount = new Map<string, number>();
      let guard = 0;
      while (rows.length < want && guard < want * 60) {
        guard++;
        const category = categories[rows.length % categories.length]!;
        const catRows = byCat.get(category)!;
        const parts = PARTS[category]!;
        const brand = pick(parts.brands);
        const type = pick(parts.types);
        const style = pick(parts.styles);
        const spec = pick(parts.specs);
        const colour = pick(COLOURS);
        const pattern = Math.floor(Math.random() * 4);
        const name =
          category === "Mobiles"
            ? `${brand} ${style ? style + " " : ""}${Math.floor(Math.random() * 40) + 10} 5G (${spec})`
            : pattern === 0
              ? `${brand} ${type} — ${style} (${spec})`
              : pattern === 1
                ? `${brand} ${colour} ${type} ${style}`
                : pattern === 2
                  ? `${type} — ${brand} ${style} Edition (${spec})`
                  : `${brand} ${type} ${spec} — ${colour}`;
        if (usedNames.has(name.toLowerCase())) continue;
        usedNames.add(name.toLowerCase());
        const prices = catRows.map((p) => p.basePrice);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const r = Math.random();
        const t = r < 0.2 ? Math.pow(Math.random(), 0.5) : Math.pow(Math.random(), 1.5);
        const rawPrice = min + (max - min) * t;
        const basePrice = Math.max(49, Math.round(rawPrice / 10) * 10 - 1);
        const oldPrice = Math.round((basePrice * (1.3 + Math.random() * 0.7)) / 10) * 10 - 1;
        const profitPercent = pick([10, 12, 15, 15, 18, 20, 20, 22, 25, 28, 30]);
        // Bulk-generated products have no photo of their own. They
        // used to borrow a random photo from another product in the
        // category, so the picture often showed a different product
        // than the name — never do that: no photo (the client renders
        // an honest initial-letter tile) beats a wrong photo.
        rows.push({
          name,
          category,
          description: style
            ? `${type} by ${brand} in a ${style.toLowerCase()} finish. A popular pick in ${category} — quality checked and dispatched quickly with Cash on Delivery available.`
            : `${type} by ${brand}. A popular pick in ${category} — quality checked and dispatched quickly with Cash on Delivery available.`,
          basePrice,
          oldPrice: oldPrice > basePrice ? oldPrice : null,
          profitPercent,
          stock: 10 + Math.floor(Math.random() * 290),
          imageAsset: donorFor(category),
          imageSourceUrl: null,
          catalogSource: "bulk",
        });
        perCatCount.set(category, (perCatCount.get(category) ?? 0) + 1);
      }
      if (rows.length === 0) return fail("Could not generate unique new products — please try a smaller number.", existing.length);
      for (let i = 0; i < rows.length; i += 100) {
        await db.insert(schema.products).values(rows.slice(i, i + 100));
      }
      const totalNow = existing.length + rows.length;
      ctx.invalidateQueries();
      return {
        ok: true,
        error: null,
        added: rows.length,
        totalNow,
        perCategory: categories.map((c) => ({ category: c, added: perCatCount.get(c) ?? 0 })).filter((x) => x.added > 0),
      };
    },
  }),

  // One-time repair: give every photo-less base product a real photo
  // from its own category (same donor rule as bulk-generate). Admin-only.
  adminBackfillProductImages: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), fixed: z.number(), remaining: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the Admin can repair product photos.", fixed: 0, remaining: 0 };
      const all = await db.select().from(schema.products);
      const donors = new Map<string, string[]>();
      for (const p of all) {
        if (p.imageAsset) {
          const list = donors.get(p.category) ?? [];
          list.push(p.imageAsset);
          donors.set(p.category, list);
        }
      }
      let fixed = 0;
      let remaining = 0;
      for (const p of all) {
        if (p.imageAsset) continue;
        const list = donors.get(p.category);
        if (!list || list.length === 0) { remaining++; continue; }
        await db.update(schema.products).set({ imageAsset: list[p.id % list.length]! }).where(eq(schema.products.id, p.id));
        fixed++;
      }
      ctx.invalidateQueries();
      return { ok: true, error: null, fixed, remaining };
    },
  }),

  // One-click import of the 50 trusted-merchant products above.
  // Idempotent: names already in the catalog are skipped (the name
  // column is UNIQUE), so running it twice cannot duplicate products.
  adminImportTrustedProducts: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), inserted: z.number(), skipped: z.number(), totalNow: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      const all = await db.select().from(schema.products);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the Admin can import products.", inserted: 0, skipped: 0, totalNow: all.length };
      const existing = new Set(all.map((p) => p.name.toLowerCase()));
      let inserted = 0;
      let skipped = 0;
      for (const item of TRUSTED_PRODUCTS) {
        if (existing.has(item.name.toLowerCase())) { skipped++; continue; }
        await db.insert(schema.products).values(item);
        existing.add(item.name.toLowerCase());
        inserted++;
      }
      ctx.invalidateQueries();
      return { ok: true, error: null, inserted, skipped, totalNow: all.length + inserted };
    },
  }),

  adminImportReal180: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), inserted: z.number(), skipped: z.number(), totalNow: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      const all = await db.select().from(schema.products);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the Admin can import products.", inserted: 0, skipped: 0, totalNow: all.length };
      const existing = new Set(all.map((p) => p.name.toLowerCase()));
      let inserted = 0;
      let skipped = 0;
      for (const item of [...TRUSTED_PRODUCTS, ...REAL_PRODUCTS_130]) {
        if (existing.has(item.name.toLowerCase())) { skipped++; continue; }
        await db.insert(schema.products).values(item);
        existing.add(item.name.toLowerCase());
        inserted++;
      }
      ctx.invalidateQueries();
      return { ok: true, error: null, inserted, skipped, totalNow: all.length + inserted };
    },
  }),

  // Repairs the 7 kitchen photos: sets each listed product's imageAsset
  // to its correct bundled photo. Idempotent (same values on re-run).
  // Missing ids (product deleted since) are reported, not fatal.
  adminFixKitchenPhotos: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), updated: z.number(), missing: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the Admin can repair product photos.", updated: 0, missing: 0 };
      let updated = 0;
      let missing = 0;
      for (const [id, imageAsset] of Object.entries(KITCHEN_PHOTO_FIXES)) {
        const rows = await db.update(schema.products).set({ imageAsset }).where(eq(schema.products.id, Number(id))).returning({ id: schema.products.id });
        if (rows.length > 0) updated++;
        else missing++;
      }
      ctx.invalidateQueries();
      return { ok: true, error: null, updated, missing };
    },
  }),

  listProducts: defineAction({
    auth: "public",
    request: z.object({
      category: z.string().optional(),
      search: z.string().optional(),
    }),
    response: z.object({ products: z.array(productOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      let rows = await db
        .select()
        .from(schema.products)
        .orderBy(asc(schema.products.category), asc(schema.products.name));
      if (args.category && args.category !== "All") {
        rows = rows.filter((p) => p.category === args.category);
      }
      if (args.search && args.search.trim()) {
        const q = args.search.trim().toLowerCase();
        rows = rows.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q),
        );
      }
      return { products: rows.map(toProductOut) };
    },
  }),

  // Buyer registration with Gmail OR mobile number: whichever method is
  // chosen, the other field is optional. At least one identifier (a valid
  // Gmail/email or a 10-digit Indian mobile number) is required.
  register: defineAction({
    auth: "public",
    request: z.object({
      name: z.string().min(2).max(80),
      email: z.string().max(120).optional(),
      password: z.string().min(8).max(100),
      role: z.enum(["buyer", "seller"]),
      storeName: z.string().max(80).optional(),
      phone: z.string().max(30).optional(),
      country: z.string().max(60).optional(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      user: userOut.nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (args.role === "seller") {
        return {
          ok: false,
          error:
            "Seller accounts are created through the Seller Application form, not instant registration.",
          user: null,
        };
      }
      const country = (args.country ?? "").trim();
      if (!country) {
        return {
          ok: false,
          error: "Country is missing — please select your country.",
          user: null,
        };
      }
      const emailRaw = (args.email ?? "").trim().toLowerCase();
      // The phone follows the SELECTED country's format (Pakistan:
      // 03XX XXXXXXX / +92 …, India: 98XXX XXXXX / +91 …) and is stored
      // canonically with its country code.
      const phoneCanon = canonicalPhone(args.phone, country);
      if (!emailRaw && !phoneCanon) {
        return {
          ok: false,
          error:
            "Please give your Gmail/email or your mobile number — one of them is needed to create your account.",
          user: null,
        };
      }
      if (emailRaw && !isValidEmail(emailRaw)) {
        return {
          ok: false,
          error: "Email looks wrong — please enter a valid Gmail/email address.",
          user: null,
        };
      }
      if (args.phone && args.phone.trim() && !phoneCanon) {
        const spec = phoneSpecFor(country);
        return {
          ok: false,
          error: spec
            ? `Mobile number looks wrong for ${country} — please enter it like ${spec.example}, or with the country code +${spec.dial}.`
            : "Mobile number looks wrong — please check and enter it again.",
          user: null,
        };
      }
      if (emailRaw) {
        const existing = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, emailRaw))
          .limit(1);
        if (existing[0]) {
          return {
            ok: false,
            error: "This email is already registered. Please sign in instead.",
            user: null,
          };
        }
      }
      if (phoneCanon) {
        const byPhone = await findUserByPhone(db, phoneCandidates(args.phone));
        if (byPhone) {
          return {
            ok: false,
            error:
              "This mobile number is already registered. Please sign in with it instead.",
            user: null,
          };
        }
      }
      const inserted = await db
        .insert(schema.users)
        .values({
          name: args.name.trim(),
          email: emailRaw || null,
          password: await hashPassword(args.password),
          role: args.role,
          storeName: null,
          phone: phoneCanon || null,
          country,
        })
        .returning();
      ctx.invalidateQueries();
      return { ok: true, error: null, user: toUserOut(inserted[0]!) };
    },
  }),

  // Multi-step seller application (Indian platform): personal details,
  // store details and an Indian ID document (Aadhaar / Ration Card / PAN /
  // Voter ID, recorded by type, number and uploaded file names). Gmail is
  // optional when the seller registers with a mobile number (and the
  // mobile number is the sign-in identifier then). NEW applications are
  // created with verificationStatus "pending": the seller can sign in
  // and see their application, but cannot add products or sell until the
  // Admin verifies the account from Admin → Seller Accounts (reviewSeller).
  // Sellers approved earlier keep their "approved" status untouched.
  registerSeller: defineAction({
    auth: "public",
    request: z.object({
      // Step 1 — personal details
      name: z.string().min(2).max(80),
      country: z.string().max(60).optional(),
      email: z.string().max(120).optional(),
      password: z.string().min(8).max(100),
      phone: z.string().min(7).max(25),
      address: z.string().min(5).max(300),
      city: z.string().min(2).max(60),
      state: z.string().min(2).max(60),
      pinCode: z.string().min(0).max(10),
      dateOfBirth: z.string().min(4).max(20),
      photoFileName: z.string().max(200).optional(),
      // Step 2 — store details
      storeName: z.string().min(2).max(80),
      storeDescription: z.string().min(10).max(500),
      storeLogoFileName: z.string().max(200).optional(),
      storeAddress: z.string().min(5).max(300),
      businessType: z.string().min(2).max(60),
      gstNumber: z.string().max(20).optional(),
      // Step 3 — document verification
      docType: z.enum(["Aadhaar Card", "Ration Card", "PAN Card", "Voter ID", "Passport", "National ID Card"]),
      docNumber: z.string().min(4).max(30),
      docFrontFileName: z.string().min(1).max(200),
      docBackFileName: z.string().max(200).optional(),
      photoBlobKey: z.string().max(500).optional(),
      photoContentType: z.string().max(100).optional(),
      photoSize: z.number().int().min(0).max(10000000).optional(),
      storeLogoBlobKey: z.string().max(500).optional(),
      storeLogoContentType: z.string().max(100).optional(),
      storeLogoSize: z.number().int().min(0).max(10000000).optional(),
      docFrontBlobKey: z.string().max(500).optional(),
      docFrontContentType: z.string().max(100).optional(),
      docFrontSize: z.number().int().min(0).max(10000000).optional(),
      docBackBlobKey: z.string().max(500).optional(),
      docBackContentType: z.string().max(100).optional(),
      docBackSize: z.number().int().min(0).max(10000000).optional(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      user: userOut.nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const country = (args.country ?? "").trim();
      if (!country) {
        return {
          ok: false,
          error: "Step 1 – Personal Details: Country is missing — please select your country.",
          user: null,
        };
      }
      const emailRaw = (args.email ?? "").trim().toLowerCase();
      if (emailRaw && !isValidEmail(emailRaw)) {
        return {
          ok: false,
          error:
            "Step 1 – Personal Details: Email looks wrong — please enter a valid Gmail/email address, or leave it empty and register with your mobile number.",
          user: null,
        };
      }
      const phoneCanon = canonicalPhone(args.phone, country);
      if (!phoneCanon) {
        const spec = phoneSpecFor(country);
        return {
          ok: false,
          error: spec
            ? `Step 1 – Personal Details: Mobile number looks wrong for ${country} — please enter it like ${spec.example}, or with the country code +${spec.dial}.`
            : "Step 1 – Personal Details: Mobile number looks wrong — please check and enter it again.",
          user: null,
        };
      }
      if (!postalValid(country, args.pinCode)) {
        const len = COUNTRY_POSTAL_LENGTH[country];
        return {
          ok: false,
          error: len
            ? `Step 1 – Personal Details: Postal code for ${country} is ${len} digits — please check and enter it again.`
            : "Step 1 – Personal Details: Postal code looks wrong — please check and enter it again.",
          user: null,
        };
      }
      if (emailRaw) {
        const existing = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, emailRaw))
          .limit(1);
        if (existing[0]) {
          return {
            ok: false,
            error: "This email is already registered. Please sign in instead.",
            user: null,
          };
        }
      }
      const byPhone = await findUserByPhone(db, phoneCandidates(args.phone));
      if (byPhone) {
        return {
          ok: false,
          error:
            "This mobile number is already registered. Please sign in with it instead.",
          user: null,
        };
      }
      const inserted = await db
        .insert(schema.users)
        .values({
          name: args.name.trim(),
          email: emailRaw || null,
          password: await hashPassword(args.password),
          role: "seller",
          storeName: args.storeName.trim(),
          phone: phoneCanon,
          country,
          verificationStatus: "pending",
          address: args.address.trim(),
          city: args.city.trim(),
          state: args.state.trim(),
          pinCode: args.pinCode.trim(),
          dateOfBirth: args.dateOfBirth.trim(),
          photoFileName: args.photoFileName?.trim() || null,
          storeDescription: args.storeDescription.trim(),
          storeLogoFileName: args.storeLogoFileName?.trim() || null,
          storeAddress: args.storeAddress.trim(),
          businessType: args.businessType.trim(),
          gstNumber: args.gstNumber?.trim() || null,
          docType: args.docType,
          docNumber: args.docNumber.trim(),
          docFrontFileName: args.docFrontFileName.trim(),
          docBackFileName: args.docBackFileName?.trim() || null,
          photoBlobKey: args.photoBlobKey || null,
          photoContentType: args.photoContentType || null,
          photoSize: args.photoSize ?? null,
          storeLogoBlobKey: args.storeLogoBlobKey || null,
          storeLogoContentType: args.storeLogoContentType || null,
          storeLogoSize: args.storeLogoSize ?? null,
          docFrontBlobKey: args.docFrontBlobKey || null,
          docFrontContentType: args.docFrontContentType || null,
          docFrontSize: args.docFrontSize ?? null,
          docBackBlobKey: args.docBackBlobKey || null,
          docBackContentType: args.docBackContentType || null,
          docBackSize: args.docBackSize ?? null,
        })
        .returning();
      ctx.invalidateQueries();
      return { ok: true, error: null, user: toUserOut(inserted[0]!) };
    },
  }),

  // Buyer → seller shift (user request 2026-10-28): a signed-in buyer
  // converts their OWN account into a seller account with the same
  // email/phone and password — no second account, no duplicate
  // identifier (registerSeller refuses duplicate email/phone, so a
  // buyer could never register as a seller with the same details).
  // The frontend collects only the REMAINING info (address, store,
  // documents); name/email/phone/country come from the account
  // (country is asked only when the account has none). The converted
  // account starts verificationStatus "pending": it can sign in and
  // see the seller dashboard, but cannot add products or sell until
  // the Admin verifies it from Admin → Seller Accounts — exactly
  // like a new seller application. The shift is one-way (there is no
  // seller → buyer conversion); the buyer's old orders and cart rows
  // stay in the database but the seller views do not show buyer
  // history. Sessions keep working: the dispatcher loads the role
  // fresh from the users table on every request, so the same token
  // carries the new role immediately, no re-login needed.
  convertBuyerToSeller: defineAction({
    auth: { arg: "userId" },
    request: z.object({
      userId: z.number(),
      country: z.string().max(60).optional(),
      address: z.string().min(5).max(300),
      city: z.string().min(2).max(60),
      state: z.string().min(2).max(60),
      pinCode: z.string().min(0).max(10),
      dateOfBirth: z.string().min(4).max(20),
      photoFileName: z.string().max(200).optional(),
      storeName: z.string().min(2).max(80),
      storeDescription: z.string().min(10).max(500),
      storeLogoFileName: z.string().max(200).optional(),
      storeAddress: z.string().min(5).max(300),
      businessType: z.string().min(2).max(60),
      gstNumber: z.string().max(20).optional(),
      docType: z.enum(["Aadhaar Card", "Ration Card", "PAN Card", "Voter ID", "Passport", "National ID Card"]),
      docNumber: z.string().min(4).max(30),
      docFrontFileName: z.string().min(1).max(200),
      docBackFileName: z.string().max(200).optional(),
      photoBlobKey: z.string().max(500).optional(),
      photoContentType: z.string().max(100).optional(),
      photoSize: z.number().int().min(0).max(10000000).optional(),
      storeLogoBlobKey: z.string().max(500).optional(),
      storeLogoContentType: z.string().max(100).optional(),
      storeLogoSize: z.number().int().min(0).max(10000000).optional(),
      docFrontBlobKey: z.string().max(500).optional(),
      docFrontContentType: z.string().max(100).optional(),
      docFrontSize: z.number().int().min(0).max(10000000).optional(),
      docBackBlobKey: z.string().max(500).optional(),
      docBackContentType: z.string().max(100).optional(),
      docBackSize: z.number().int().min(0).max(10000000).optional(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      user: userOut.nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.userId))
        .limit(1);
      const u = rows[0];
      if (!u) {
        return { ok: false, error: "Account not found.", user: null };
      }
      if (u.role !== "buyer") {
        return {
          ok: false,
          error: "Only a buyer account can be shifted to a seller account.",
          user: null,
        };
      }
      const accountCountry = (u.country ?? "").trim();
      const country = accountCountry || (args.country ?? "").trim();
      if (!country) {
        return {
          ok: false,
          error: "Country is missing — please select your country.",
          user: null,
        };
      }
      if (!postalValid(country, args.pinCode)) {
        const len = COUNTRY_POSTAL_LENGTH[country];
        return {
          ok: false,
          error: len
            ? `Postal code for ${country} is ${len} digits — please check and enter it again.`
            : "Postal code looks wrong — please check and enter it again.",
          user: null,
        };
      }
      const updated = await db
        .update(schema.users)
        .set({
          role: "seller",
          verificationStatus: "pending",
          country,
          address: args.address.trim(),
          city: args.city.trim(),
          state: args.state.trim(),
          pinCode: args.pinCode.trim(),
          dateOfBirth: args.dateOfBirth.trim(),
          photoFileName: args.photoFileName?.trim() || u.photoFileName,
          storeName: args.storeName.trim(),
          storeDescription: args.storeDescription.trim(),
          storeLogoFileName: args.storeLogoFileName?.trim() || u.storeLogoFileName,
          storeAddress: args.storeAddress.trim(),
          businessType: args.businessType.trim(),
          gstNumber: args.gstNumber?.trim() || null,
          docType: args.docType,
          docNumber: args.docNumber.trim(),
          docFrontFileName: args.docFrontFileName.trim(),
          docBackFileName: args.docBackFileName?.trim() || null,
          photoBlobKey: args.photoBlobKey || u.photoBlobKey,
          photoContentType: args.photoContentType || u.photoContentType,
          photoSize: args.photoSize ?? u.photoSize,
          storeLogoBlobKey: args.storeLogoBlobKey || u.storeLogoBlobKey,
          storeLogoContentType: args.storeLogoContentType || u.storeLogoContentType,
          storeLogoSize: args.storeLogoSize ?? u.storeLogoSize,
          docFrontBlobKey: args.docFrontBlobKey || u.docFrontBlobKey,
          docFrontContentType: args.docFrontContentType || u.docFrontContentType,
          docFrontSize: args.docFrontSize ?? u.docFrontSize,
          docBackBlobKey: args.docBackBlobKey || u.docBackBlobKey,
          docBackContentType: args.docBackContentType || u.docBackContentType,
          docBackSize: args.docBackSize ?? u.docBackSize,
        })
        .where(eq(schema.users.id, args.userId))
        .returning();
      ctx.invalidateQueries();
      return { ok: true, error: null, user: toUserOut(updated[0]!) };
    },
  }),

  // Sign in with Gmail/email OR mobile number — whichever identifier the
  // account was registered with. `identifier` carries either one; the
  // legacy `email` field is still accepted.
  login: defineAction({
    auth: "public",
    request: z.object({
      identifier: z.string().max(120).optional(),
      email: z.string().max(120).optional(),
      password: z.string().min(1).max(100),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      user: userOut.nullable(),
      token: z.string().nullable().optional(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const identifier = (args.identifier ?? args.email ?? "").trim();
      if (!identifier) {
        return {
          ok: false,
          error: "Please enter your Gmail/email or your mobile number.",
          user: null,
        };
      }
      // Brute-force guard: 5 failures on one identifier locks it for 15
      // minutes. The lockout message is the only place the response
      // differs — every other failure below returns the same generic
      // error, so the response never reveals whether the account exists.
      const lockKey = loginLockoutKey(identifier);
      if (isLoginLocked(lockKey)) {
        return {
          ok: false,
          error: "Too many failed sign-in attempts — please try again in 15 minutes.",
          user: null,
        };
      }
      let u: UserRow | undefined;
      if (identifier.includes("@")) {
        const rows = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, identifier.toLowerCase()))
          .limit(1);
        u = rows[0];
        if (!u) {
          recordLoginFailure(lockKey);
          return {
            ok: false,
            error: "Invalid login ID or password.",
            user: null,
          };
        }
      } else {
        const candidates = phoneCandidates(identifier);
        if (candidates.length === 0) {
          return {
            ok: false,
            error: "Mobile number looks wrong — please enter the number you registered with, with your country code if you used one.",
            user: null,
          };
        }
        u = await findUserByPhone(db, candidates);
        if (!u) {
          recordLoginFailure(lockKey);
          return {
            ok: false,
            error: "Invalid login ID or password.",
            user: null,
          };
        }
      }
      if (!(await verifyPassword(args.password, u.password))) {
        recordLoginFailure(lockKey);
        return { ok: false, error: "Invalid login ID or password.", user: null };
      }
      clearLoginFailures(lockKey);
      if (!isHashedPassword(u.password)) {
        const hashed = await hashPassword(args.password);
        await db.update(schema.users).set({ password: hashed }).where(eq(schema.users.id, u.id));
        u = { ...u, password: hashed };
      }
      // Seller verification is decided by the Admin only (reviewSeller):
      // signing in never changes a pending/rejected status.
      const token = await issueSessionToken(db, u.id);
      return { ok: true, error: null, user: toUserOut(u), token };
    },
  }),

  // Google sign-in return: the frontend exchanges the one-time code the
  // backend callback issued (after Google verified the email) for the
  // user session. The code is single-use and expires after 10 minutes.
  // Existing accounts match by email (any role); new Google users were
  // already created as buyers by the callback.
  completeGoogleLogin: defineAction({
    auth: "public",
    request: z.object({ code: z.string().min(10).max(128) }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      user: userOut.nullable(),
      token: z.string().nullable().optional(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const codes = await db.select().from(schema.googleLoginCodes).where(eq(schema.googleLoginCodes.code, args.code)).limit(1);
      const row = codes[0];
      if (!row) return { ok: false, error: "Google sign-in session expired. Please try again.", user: null };
      await db.delete(schema.googleLoginCodes).where(eq(schema.googleLoginCodes.code, args.code));
      const ageMs = Date.now() - new Date(row.createdAt as any).getTime();
      if (ageMs > 10 * 60 * 1000) return { ok: false, error: "Google sign-in session expired. Please try again.", user: null };
      const users = await db.select().from(schema.users).where(eq(schema.users.id, row.userId)).limit(1);
      if (!users[0]) return { ok: false, error: "Account not found. Please register first.", user: null };
      const token = await issueSessionToken(db, users[0].id);
      return { ok: true, error: null, user: toUserOut(users[0]), token };
    },
  }),

  // The very first admin account is created explicitly by the store owner
  // from the sign-in screen; after one admin exists this action refuses.
  hasAdmin: defineAction({
    auth: "public",
    request: z.object({}),
    response: z.object({ hasAdmin: z.boolean() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const admins = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.role, "admin"))
        .limit(1);
      return { hasAdmin: admins.length > 0 };
    },
  }),

  addToMyStore: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number(), productId: z.number() }),
    response: z.object({ ok: z.literal(true), alreadyAdded: z.boolean() }),
    async handler(ctx, args): Promise<{ ok: true; alreadyAdded: boolean }> {
      const db = ctx.db<typeof schema>();
      const seller = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.sellerId))
        .limit(1);
      if (!seller[0] || seller[0].role !== "seller") {
        throw new Error("Only seller accounts can add products to a store.");
      }
      if (seller[0].verificationStatus === "pending") {
        throw new Error(
          "Your account is pending verification by Customer Service. You can add products and start selling as soon as Customer Service verifies your account.",
        );
      }
      if (seller[0].verificationStatus === "rejected") {
        throw new Error(
          "Your seller application was not approved. Please contact support for details.",
        );
      }
      const existing = await db
        .select()
        .from(schema.sellerProducts)
        .where(
          and(
            eq(schema.sellerProducts.sellerId, args.sellerId),
            eq(schema.sellerProducts.productId, args.productId),
          ),
        )
        .limit(1);
      if (existing[0]) return { ok: true as const, alreadyAdded: true };
      await db.insert(schema.sellerProducts).values({
        sellerId: args.sellerId,
        productId: args.productId,
      });
      ctx.invalidateQueries();
      return { ok: true as const, alreadyAdded: false };
    },
  }),

  removeFromMyStore: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number(), productId: z.number() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.sellerProducts)
        .where(
          and(
            eq(schema.sellerProducts.sellerId, args.sellerId),
            eq(schema.sellerProducts.productId, args.productId),
          ),
        );
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  listSellerProducts: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number() }),
    response: z.object({ products: z.array(productOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!me[0] || me[0].role !== "seller") throw new Error("Only seller accounts can list their store products.");
      const picks = await db
        .select()
        .from(schema.sellerProducts)
        .where(eq(schema.sellerProducts.sellerId, args.sellerId))
        .orderBy(desc(schema.sellerProducts.id));
      const out = [];
      for (const pick of picks) {
        const p = await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, pick.productId))
          .limit(1);
        if (p[0]) out.push(toProductOut(p[0]));
      }
      return { products: out };
    },
  }),

  getCart: defineAction({
    auth: { arg: "buyerId" },
    request: z.object({ buyerId: z.number() }),
    response: z.object({
      items: z.array(
        z.object({
          product: productOut,
          qty: z.number(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cartItems)
        .where(eq(schema.cartItems.buyerId, args.buyerId))
        .orderBy(asc(schema.cartItems.id));
      const items = [];
      for (const row of rows) {
        const p = await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, row.productId))
          .limit(1);
        if (p[0]) items.push({ product: toProductOut(p[0]), qty: row.qty });
      }
      return { items };
    },
  }),

  addToCart: defineAction({
    auth: { arg: "buyerId" },
    request: z.object({ buyerId: z.number(), productId: z.number() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const buyer = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.buyerId))
        .limit(1);
      if (!buyer[0] || buyer[0].role !== "buyer") {
        throw new Error("Sign in with a buyer account to use the cart.");
      }
      const existing = await db
        .select()
        .from(schema.cartItems)
        .where(
          and(
            eq(schema.cartItems.buyerId, args.buyerId),
            eq(schema.cartItems.productId, args.productId),
          ),
        )
        .limit(1);
      if (existing[0]) {
        await db
          .update(schema.cartItems)
          .set({ qty: existing[0].qty + 1 })
          .where(eq(schema.cartItems.id, existing[0].id));
      } else {
        await db.insert(schema.cartItems).values({
          buyerId: args.buyerId,
          productId: args.productId,
          qty: 1,
        });
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  setCartQty: defineAction({
    auth: { arg: "buyerId" },
    request: z.object({
      buyerId: z.number(),
      productId: z.number(),
      qty: z.number().int().min(0).max(99),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      if (args.qty === 0) {
        await db
          .delete(schema.cartItems)
          .where(
            and(
              eq(schema.cartItems.buyerId, args.buyerId),
              eq(schema.cartItems.productId, args.productId),
            ),
          );
      } else {
        await db
          .update(schema.cartItems)
          .set({ qty: args.qty })
          .where(
            and(
              eq(schema.cartItems.buyerId, args.buyerId),
              eq(schema.cartItems.productId, args.productId),
            ),
          );
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  placeOrder: defineAction({
    auth: { arg: "buyerId" },
    request: z.object({
      buyerId: z.number(),
      customerName: z.string().min(2).max(80),
      phone: z.string().min(7).max(30),
      address: z.string().min(5).max(300),
      city: z.string().min(2).max(60),
      state: z.string().min(2).max(60),
      // Postal / ZIP code follows the BUYER's country (Pakistan 5
      // digits, India 6, some countries none) — validated in the
      // handler against the account's country, not a fixed 6 here.
      pinCode: z.string().min(0).max(10),
      paymentMethod: z.string().min(1).max(60),
      // Prepaid ("Pay First") proof: a typed transaction reference
      // and/or a payment screenshot — one of the two is required for
      // prepaid orders, neither for Cash on Delivery.
      paymentReference: z.string().max(120).optional(),
      paymentScreenshot: chatAttachmentArg.optional(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      orderId: z.number().nullable(),
      total: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const buyer = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.buyerId))
        .limit(1);
      if (!buyer[0] || buyer[0].role !== "buyer") {
        return {
          ok: false,
          error: "Sign in with a buyer account to place an order.",
          orderId: null,
          total: 0,
        };
      }
      // Delivery details follow the buyer's OWN country: the phone must
      // be a valid number for that country (Pakistan 03XX…/+92…, India
      // 98XXX…/+91…) and the postal code that country's length — an
      // India-only 10-digit / 6-digit rule blocked foreign buyers from
      // ever checking out.
      const buyerCountry = buyer[0].country ?? null;
      const phoneCanon = canonicalPhone(args.phone, buyerCountry);
      if (!phoneCanon) {
        const spec = phoneSpecFor(buyerCountry);
        return {
          ok: false,
          error: spec
            ? `Mobile number looks wrong for ${buyerCountry} — please enter it like ${spec.example}, or with the country code +${spec.dial}.`
            : "Mobile number looks wrong — please check and enter it again.",
          orderId: null,
          total: 0,
        };
      }
      if (!postalValid(buyerCountry, args.pinCode)) {
        const len = buyerCountry ? COUNTRY_POSTAL_LENGTH[buyerCountry] : undefined;
        return {
          ok: false,
          error: len
            ? `Postal code for ${buyerCountry} is ${len} digits — please check and enter it again.`
            : "Postal code looks wrong — please check and enter it again.",
          orderId: null,
          total: 0,
        };
      }
      // Payment step: "Cash on Delivery" (pay when the order arrives)
      // or a prepaid method ("Pay First" — pay now, then delivery).
      // A prepaid method must be switched ON in Admin → Settings →
      // Payment Methods, and the buyer must give ONE proof: the
      // transaction reference ID or a payment screenshot.
      const pm = args.paymentMethod.trim();
      let paymentReference = "";
      let proof: { blobKey: string; fileName: string; contentType: string; size: number } | null = null;
      if (pm === "Cash on Delivery") {
        // No proof — payment happens at the door.
      } else if (pm.startsWith("Prepaid — ")) {
        const method = pm.slice("Prepaid — ".length);
        const s = await getSettingsRow(db);
        const enabled =
          method === "UPI"
            ? (s.paymentUpiEnabled ?? 1) === 1
            : method === "Bank Account"
              ? (s.paymentBankEnabled ?? 1) === 1
              : method === "USDT (Crypto)"
                ? (s.paymentUsdtEnabled ?? 1) === 1
                : false;
        if (!enabled) {
          return {
            ok: false,
            error: "That payment method is currently unavailable — please choose another payment option or contact Customer Service.",
            orderId: null,
            total: 0,
          };
        }
        if (method === "USDT (Crypto)" && !(s.usdtDepositAddress ?? "").trim()) {
          return {
            ok: false,
            error: "USDT payment is being set up — please choose another payment option or contact Customer Service.",
            orderId: null,
            total: 0,
          };
        }
        paymentReference = (args.paymentReference ?? "").trim();
        if (!paymentReference && !args.paymentScreenshot) {
          return {
            ok: false,
            error: "Please type your payment Transaction / UTR reference ID or attach a screenshot of your payment — one of the two is needed so Customer Service can verify your payment.",
            orderId: null,
            total: 0,
          };
        }
        if (args.paymentScreenshot) {
          const stored = await storeDepositScreenshot(ctx, args.paymentScreenshot);
          if (!stored.ok) return { ok: false, error: stored.error, orderId: null, total: 0 };
          proof = stored;
        }
      } else {
        return {
          ok: false,
          error: "Please choose a payment option — Pay on Delivery or Pay First.",
          orderId: null,
          total: 0,
        };
      }
      const cart = await db
        .select()
        .from(schema.cartItems)
        .where(eq(schema.cartItems.buyerId, args.buyerId));
      if (cart.length === 0) {
        return {
          ok: false,
          error: "Your cart is empty.",
          orderId: null,
          total: 0,
        };
      }
      type Line = {
        productId: number;
        qty: number;
        basePrice: number;
        profitPercent: number;
        profitAmount: number;
        buyerPrice: number;
      };
      const lines: Line[] = [];
      let total = 0;
      for (const row of cart) {
        const p = await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, row.productId))
          .limit(1);
        if (!p[0]) continue;
        // Stock gate: an order can never take more than the stock on
        // hand. Before this check the quantity was never compared to
        // stock, so a buyer could order 99 of a product with 15 in
        // stock and the stock was silently clamped to zero.
        if (row.qty > p[0].stock) {
          return {
            ok: false,
            error:
              p[0].stock > 0
                ? `Only ${p[0].stock} left in stock for "${p[0].name}" — please reduce its quantity in your cart and try again.`
                : `"${p[0].name}" is out of stock — please remove it from your cart and try again.`,
            orderId: null,
            total: 0,
          };
        }
        const profitAmount = profitOf(p[0].basePrice, p[0].profitPercent);
        const buyerPrice = p[0].basePrice + profitAmount;
        lines.push({
          productId: p[0].id,
          qty: row.qty,
          basePrice: p[0].basePrice,
          profitPercent: p[0].profitPercent,
          profitAmount,
          buyerPrice,
        });
        total += buyerPrice * row.qty;
      }
      if (lines.length === 0) {
        return {
          ok: false,
          error: "Your cart is empty.",
          orderId: null,
          total: 0,
        };
      }
      // Seller attribution is resolved in sellerDashboard: any order whose
      // items include a product from a seller's store credits that item's
      // profit to the seller. Orders placed directly here keep sellerId
      // null (main-store sale).
      let orderId = 0;
      try {
        await db.transaction(async (tx) => {
          const inserted = await tx
            .insert(schema.orders)
        .values({
          buyerId: args.buyerId,
          sellerId: null,
          customerName: args.customerName.trim(),
          phone: phoneCanon,
          address: args.address.trim(),
          city: args.city.trim(),
          state: args.state.trim(),
          pinCode: args.pinCode.trim(),
          paymentMethod: pm,
          paymentReference,
          paymentProofBlobKey: proof?.blobKey ?? null,
          paymentProofFileName: proof?.fileName ?? null,
          paymentProofContentType: proof?.contentType ?? null,
          paymentProofSize: proof?.size ?? null,
          // Pay First orders start behind the payment verification
          // gate: visible to the buyer and the Admin, but NOT released
          // to sellers until the Admin verifies the payment.
          paymentStatus: pm.startsWith("Prepaid — ") ? "pending" : "none",
          total,
          status: "Pending",
        })
        .returning({ id: schema.orders.id });
          orderId = inserted[0]!.id;
          for (const line of lines) {
            await tx.insert(schema.orderItems).values({ orderId, ...line });
            // Atomic guard against the oversell race: the decrement only
            // applies when stock still covers the quantity AT THIS
            // MOMENT. Zero affected rows means another checkout took the
            // last units in between — throwing rolls the whole order
            // back (insert + items + earlier decrements), so the buyer
            // gets the written over-stock refusal instead of a second
            // order on the same last unit.
            const dec = await tx
              .update(schema.products)
              .set({ stock: sql`${schema.products.stock} - ${line.qty}` })
              .where(and(eq(schema.products.id, line.productId), gte(schema.products.stock, line.qty)))
              .returning({ id: schema.products.id });
            if (dec.length === 0) throw new Error(`OVERSOLD:${line.productId}`);
          }
      // Create a notification for every seller whose product is in this
      // order — EXCEPT for prepaid orders still behind the payment
      // verification gate: sellers are attributed + notified only when
      // the Admin verifies the payment (adminReviewOrderPayment), so an
      // unverified order never reaches a seller's Pending list, wallet
      // figures or notifications.
          if (!pm.startsWith("Prepaid — ")) {
            await notifySellersOfOrder(tx as unknown as Db, orderId, lines);
          }
          await tx.delete(schema.cartItems).where(eq(schema.cartItems.buyerId, args.buyerId));
        });
      } catch (e) {
        const m = String(e).match(/OVERSOLD:(\d+)/);
        if (m) {
          const pid = parseInt(m[1]!, 10);
          const p = await db.select().from(schema.products).where(eq(schema.products.id, pid)).limit(1);
          return {
            ok: false,
            error: p[0]
              ? p[0].stock > 0
                ? `Only ${p[0].stock} left in stock for "${p[0].name}" — please reduce its quantity in your cart and try again.`
                : `"${p[0].name}" is out of stock — please remove it from your cart and try again.`
              : "An item in your cart is no longer in stock — please check your cart and try again.",
            orderId: null,
            total: 0,
          };
        }
        throw e;
      }
      ctx.invalidateQueries();
      return { ok: true, error: null, orderId, total };
    },
  }),

  // Seller notifications: real rows created on order placement, plus a lazy
  // backfill for orders placed before notifications existed.
  listSellerNotifications: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number() }),
    response: z.object({
      notifications: z.array(
        z.object({
          id: z.number(),
          orderId: z.number(),
          productName: z.string(),
          amount: z.number(),
          isRead: z.boolean(),
          createdAt: z.string(),
        }),
      ),
      unreadCount: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const seller = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.sellerId))
        .limit(1);
      if (!seller[0] || seller[0].role !== "seller") {
        return { notifications: [], unreadCount: 0 };
      }
      // Backfill: any order attributed to this seller (order-time
      // attribution — NOT products added to the store later) without a
      // notification row gets one.
      const picks = await db
        .select()
        .from(schema.sellerProducts)
        .where(eq(schema.sellerProducts.sellerId, args.sellerId));
      const myIds = new Set(picks.map((p) => p.productId));
      const attr = await loadOrderAttribution(db);
      if (myIds.size > 0) {
        const existing = await db
          .select({ orderId: schema.sellerNotifications.orderId })
          .from(schema.sellerNotifications)
          .where(eq(schema.sellerNotifications.sellerId, args.sellerId));
        const have = new Set(existing.map((e) => e.orderId));
        const allOrders = await db.select().from(schema.orders).orderBy(desc(schema.orders.id));
        for (const o of allOrders) {
          if (o.status === "Cancelled" || have.has(o.id)) continue;
          // Payment gate: never backfill a seller notification for a
          // prepaid order whose payment is not verified yet.
          if (o.paymentStatus === "pending" || o.paymentStatus === "rejected") continue;
          const attrIds = attributedProductIds(attr, o.id, args.sellerId, myIds, o.sellerId);
          if (attrIds.size === 0) continue;
          const items = await db
            .select()
            .from(schema.orderItems)
            .where(eq(schema.orderItems.orderId, o.id));
          const mine = items.filter((it) => attrIds.has(it.productId));
          if (mine.length === 0) continue;
          const first = mine[0]!;
          const prod = await db
            .select({ name: schema.products.name })
            .from(schema.products)
            .where(eq(schema.products.id, first.productId))
            .limit(1);
          const amount = mine.reduce((s, it) => s + it.buyerPrice * it.qty, 0);
          try {
            await db.insert(schema.sellerNotifications).values({
              sellerId: args.sellerId,
              orderId: o.id,
              productName: prod[0]?.name ?? "Product",
              amount,
              isRead: 0,
              createdAt: o.createdAt,
            });
          } catch (e) {
            if (!String(e).includes("UNIQUE")) throw e;
          }
        }
      }
      // Cleanup of poisoned rows: the old backfill manufactured
      // notifications from current store picks for sellers whose
      // accounts were created AFTER the order was placed (the
      // ghost-order bug — e.g. new seller Ali + old Order #5). Such a
      // row can never be genuine, so delete it. Genuine rows (seller
      // existed at order time) are never touched by this.
      {
        const sc = attr.sellerCreatedAt.get(args.sellerId);
        if (sc) {
          const mine = await db
            .select()
            .from(schema.sellerNotifications)
            .where(eq(schema.sellerNotifications.sellerId, args.sellerId));
          for (const r of mine) {
            const oc = attr.orderCreatedAt.get(r.orderId);
            if (oc && sc.getTime() > oc.getTime()) {
              await db.delete(schema.sellerNotifications).where(eq(schema.sellerNotifications.id, r.id));
            }
          }
        }
      }
      const rows = await db
        .select()
        .from(schema.sellerNotifications)
        .where(eq(schema.sellerNotifications.sellerId, args.sellerId))
        .orderBy(desc(schema.sellerNotifications.id))
        .limit(30);
      const notifications = rows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        productName: r.productName,
        amount: r.amount,
        isRead: r.isRead === 1,
        createdAt: r.createdAt.toISOString(),
      }));
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.isRead).length,
      };
    },
  }),

  markSellerNotificationsSeen: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.sellerNotifications)
        .set({ isRead: 1 })
        .where(eq(schema.sellerNotifications.sellerId, args.sellerId));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // Wallet dot: how many wallet-credit events the seller has not
  // seen yet. Only the Wallet tab reads this; the bell reads
  // sellerNotifications and the banner reads sellerNotices, so a
  // credit never highlights anywhere else.
  getWalletUnread: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number() }),
    response: z.object({ unreadCount: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const seller = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!seller[0] || seller[0].role !== "seller") return { unreadCount: 0 };
      const rows = await db
        .select()
        .from(schema.sellerWalletEvents)
        .where(and(eq(schema.sellerWalletEvents.sellerId, args.sellerId), eq(schema.sellerWalletEvents.isRead, 0)));
      return { unreadCount: rows.length };
    },
  }),

  // Opening the Wallet tab marks its credit events seen, so the dot
  // stays gone after a reload. Mirrors markSellerNotificationsSeen.
  markWalletSeen: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.sellerWalletEvents)
        .set({ isRead: 1 })
        .where(and(eq(schema.sellerWalletEvents.sellerId, args.sellerId), eq(schema.sellerWalletEvents.isRead, 0)));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // Support tab dot (bottom nav): unread admin replies in the
  // customer's Live Chat thread. Nothing signals these outside today
  // (the bell is order-only, and buyers have no bell at all), so this
  // dot is new signal, not a duplicate of any existing one. Tickets
  // have no reply channel, so they are not counted here.
  getChatUnread: defineAction({
    auth: { arg: "userId" },
    request: z.object({ userId: z.number() }),
    response: z.object({ unreadCount: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.userId)).limit(1);
      if (!me[0] || me[0].role === "admin") return { unreadCount: 0 };
      const rows = await db
        .select()
        .from(schema.chatMessages)
        .where(and(eq(schema.chatMessages.userId, args.userId), eq(schema.chatMessages.sender, "admin"), eq(schema.chatMessages.isRead, 0)));
      return { unreadCount: rows.length };
    },
  }),

  // Opening Live Chat marks its admin replies seen, so the dot stays
  // gone after a reload. Mirrors markWalletSeen.
  markChatSeen: defineAction({
    auth: { arg: "userId" },
    request: z.object({ userId: z.number() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.chatMessages)
        .set({ isRead: 1 })
        .where(and(eq(schema.chatMessages.userId, args.userId), eq(schema.chatMessages.sender, "admin"), eq(schema.chatMessages.isRead, 0)));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  listBuyerOrders: defineAction({
    auth: { arg: "buyerId" },
    request: z.object({ buyerId: z.number() }),
    response: z.object({ orders: z.array(orderOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.buyerId, args.buyerId))
        .orderBy(desc(schema.orders.id));
      const orders = [];
      for (const o of rows) orders.push(await toOrderOut(db, o));
      return { orders };
    },
  }),

  // ---- Product reviews (verified purchase only) ----
  // A buyer can review a product only from a Delivered order that
  // contains it — one review per (order, product). Reviews show on the
  // product detail page with the buyer's first name and a "Verified
  // purchase" mark; hidden reviews (visible = 0) never render publicly.
  submitReview: defineAction({
    auth: { arg: "buyerId" },
    request: z.object({
      buyerId: z.number(),
      orderId: z.number(),
      productId: z.number(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(500),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), id: z.number().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const fail = (error: string) => ({ ok: false, error, id: null as number | null });
      const order = await db.select().from(schema.orders).where(eq(schema.orders.id, args.orderId)).limit(1);
      if (!order[0] || order[0].buyerId !== args.buyerId) return fail("This order was not found on your account.");
      if (order[0].status !== "Delivered") return fail("You can review a product only after its order is Delivered.");
      const item = await db.select().from(schema.orderItems).where(and(eq(schema.orderItems.orderId, args.orderId), eq(schema.orderItems.productId, args.productId))).limit(1);
      if (!item[0]) return fail("This product is not part of that order.");
      const existing = await db.select().from(schema.productReviews).where(and(eq(schema.productReviews.orderId, args.orderId), eq(schema.productReviews.productId, args.productId))).limit(1);
      if (existing[0]) return fail("You have already reviewed this product for this order.");
      const comment = (args.comment ?? "").trim();
      // Moderation (2026-10-31): a submitted review is PENDING and
      // hidden — it becomes public only when the admin approves it.
      const inserted = await db.insert(schema.productReviews).values({ productId: args.productId, buyerId: args.buyerId, orderId: args.orderId, rating: args.rating, comment, visible: 0, status: "pending" }).returning({ id: schema.productReviews.id });
      ctx.invalidateQueries();
      return { ok: true, error: null, id: inserted[0]?.id ?? null };
    },
  }),

  listProductReviews: defineAction({
    auth: "public",
    request: z.object({ productId: z.number() }),
    response: z.object({
      reviews: z.array(z.object({ id: z.number(), rating: z.number(), comment: z.string(), buyerName: z.string(), createdAt: z.string() })),
      avgRating: z.number(),
      count: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.productReviews).where(and(eq(schema.productReviews.productId, args.productId), eq(schema.productReviews.visible, 1), eq(schema.productReviews.status, "approved"))).orderBy(desc(schema.productReviews.id));
      const reviews = [];
      for (const r of rows) {
        const u = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, r.buyerId)).limit(1);
        const first = (u[0]?.name ?? "").trim().split(/\s+/)[0] ?? "";
        reviews.push({ id: r.id, rating: r.rating, comment: r.comment, buyerName: first || "Buyer", createdAt: r.createdAt.toISOString() });
      }
      const count = rows.length;
      const avgRating = count === 0 ? 0 : Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
      return { reviews, avgRating, count };
    },
  }),

  // Homepage "What Our Customers Say" carousel (2026-10-31): the newest
  // APPROVED + visible reviews across all products — same
  // verified-purchase rows as listProductReviews, so nothing here can
  // ever be invented: a review exists only when a buyer wrote it on a
  // Delivered order, and a pending, rejected or hidden review is never
  // returned. Public, like the per-product list; buyer names are
  // first-name-only, as there.
  listRecentReviews: defineAction({
    auth: "public",
    request: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
    response: z.object({
      reviews: z.array(z.object({ id: z.number(), productId: z.number(), productName: z.string(), buyerName: z.string(), rating: z.number(), comment: z.string(), createdAt: z.string() })),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.productReviews).where(and(eq(schema.productReviews.visible, 1), eq(schema.productReviews.status, "approved"))).orderBy(desc(schema.productReviews.id)).limit(args.limit);
      const reviews = [];
      for (const r of rows) {
        const p = await db.select({ name: schema.products.name }).from(schema.products).where(eq(schema.products.id, r.productId)).limit(1);
        const u = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, r.buyerId)).limit(1);
        const first = (u[0]?.name ?? "").trim().split(/\s+/)[0] ?? "";
        reviews.push({ id: r.id, productId: r.productId, productName: p[0]?.name ?? "Product", buyerName: first || "Buyer", rating: r.rating, comment: r.comment, createdAt: r.createdAt.toISOString() });
      }
      return { reviews };
    },
  }),

  listMyReviews: defineAction({
    auth: { arg: "buyerId" },
    request: z.object({ buyerId: z.number() }),
    response: z.object({ reviewed: z.array(z.object({ orderId: z.number(), productId: z.number() })) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.productReviews).where(eq(schema.productReviews.buyerId, args.buyerId));
      return { reviewed: rows.map((r) => ({ orderId: r.orderId, productId: r.productId })) };
    },
  }),

  listAllReviews: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({ reviews: z.array(z.object({ id: z.number(), productId: z.number(), productName: z.string(), buyerName: z.string(), orderId: z.number(), rating: z.number(), comment: z.string(), visible: z.number(), status: z.string(), createdAt: z.string() })) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { reviews: [] };
      const rows = await db.select().from(schema.productReviews).orderBy(desc(schema.productReviews.id));
      const out = [];
      for (const r of rows) {
        const p = await db.select({ name: schema.products.name }).from(schema.products).where(eq(schema.products.id, r.productId)).limit(1);
        const u = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, r.buyerId)).limit(1);
        out.push({ id: r.id, productId: r.productId, productName: p[0]?.name ?? "Product", buyerName: u[0]?.name ?? "", orderId: r.orderId, rating: r.rating, comment: r.comment, visible: r.visible, status: r.status, createdAt: r.createdAt.toISOString() });
      }
      return { reviews: out };
    },
  }),

  adminSetReviewVisible: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), reviewId: z.number(), visible: z.number().int().min(0).max(1) }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can moderate reviews." };
      await db.update(schema.productReviews).set({ visible: args.visible }).where(eq(schema.productReviews.id, args.reviewId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Review moderation (2026-10-31): a submitted review is pending and
  // never public until the admin approves it. Approve publishes it
  // (approved + visible); reject buries it (rejected + hidden). The
  // admin can re-approve a rejected review to restore it, and can hide
  // an approved review later via adminSetReviewVisible (unpublish).
  adminModerateReview: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), reviewId: z.number(), decision: z.enum(["approve", "reject"]) }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), status: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can moderate reviews.", status: null };
      const row = await db.select().from(schema.productReviews).where(eq(schema.productReviews.id, args.reviewId)).limit(1);
      if (!row[0]) return { ok: false, error: "Review not found.", status: null };
      const patch = args.decision === "approve" ? { status: "approved", visible: 1 } : { status: "rejected", visible: 0 };
      await db.update(schema.productReviews).set(patch).where(eq(schema.productReviews.id, args.reviewId));
      ctx.invalidateQueries();
      return { ok: true, error: null, status: patch.status };
    },
  }),

  // ---- Store-added carousel entries (Admin → Reviews) ----
  // Public list: visible entries only, newest first. No buyer, no
  // rating, no verified mark — the frontend labels every one of these
  // "Added by store" so they can never pass as customer reviews.
  listStoreEntries: defineAction({
    auth: "public",
    request: z.object({}),
    response: z.object({
      entries: z.array(z.object({ id: z.number(), text: z.string(), createdAt: z.string() })),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.storeReviews).where(eq(schema.storeReviews.visible, 1)).orderBy(desc(schema.storeReviews.id));
      return { entries: rows.map((r) => ({ id: r.id, text: r.text, createdAt: r.createdAt.toISOString() })) };
    },
  }),

  listAllStoreEntries: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({
      entries: z.array(z.object({ id: z.number(), text: z.string(), visible: z.number(), createdAt: z.string() })),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { entries: [] };
      const rows = await db.select().from(schema.storeReviews).orderBy(desc(schema.storeReviews.id));
      return { entries: rows.map((r) => ({ id: r.id, text: r.text, visible: r.visible, createdAt: r.createdAt.toISOString() })) };
    },
  }),

  adminAddStoreEntry: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), text: z.string().min(1).max(500) }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), id: z.number().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can add store entries.", id: null };
      const text = args.text.trim();
      if (!text) return { ok: false, error: "Write a message first.", id: null };
      const inserted = await db.insert(schema.storeReviews).values({ text, visible: 1 }).returning({ id: schema.storeReviews.id });
      ctx.invalidateQueries();
      return { ok: true, error: null, id: inserted[0]?.id ?? null };
    },
  }),

  adminSetStoreEntryVisible: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), entryId: z.number(), visible: z.number().int().min(0).max(1) }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can change store entries." };
      await db.update(schema.storeReviews).set({ visible: args.visible }).where(eq(schema.storeReviews.id, args.entryId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  adminDeleteStoreEntry: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), entryId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can delete store entries." };
      await db.delete(schema.storeReviews).where(eq(schema.storeReviews.id, args.entryId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Homepage reviews section ON/OFF (Admin → Reviews). Hiding the
  // section never touches any review or entry row.
  adminSetReviewsSectionEnabled: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), enabled: z.number().int().min(0).max(1) }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can change this setting." };
      const s = await getSettingsRow(db);
      await db.update(schema.settings).set({ reviewsSectionEnabled: args.enabled }).where(eq(schema.settings.id, s.id));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // ---- Cash on Delivery confirmation (WhatsApp-first) ----
  // Before dispatch, the fulfilling seller (or the Admin) confirms the
  // COD order with the customer on WhatsApp, then marks it confirmed.
  // The flag shows on every order surface (buyer, seller, Admin) so
  // nobody dispatches an unconfirmed COD order by mistake.
  markCodConfirmed: defineAction({
    auth: { arg: "actorId" },
    request: z.object({ actorRole: z.enum(["seller", "admin"]), actorId: z.number(), orderId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const fail = (error: string) => ({ ok: false, error });
      const order = await db.select().from(schema.orders).where(eq(schema.orders.id, args.orderId)).limit(1);
      if (!order[0]) return fail("This order was not found.");
      const o = order[0];
      if (o.paymentMethod !== "Cash on Delivery") return fail("Only Cash on Delivery orders need COD confirmation.");
      if (o.status !== "Pending" && o.status !== "Confirmed" && o.status !== "Shipped") return fail(`Order #${o.id} is ${o.status} — COD confirmation no longer applies.`);
      if (o.codConfirmed) return fail(`Order #${o.id} is already COD confirmed.`);
      if (args.actorRole === "admin") {
        const me = await db.select().from(schema.users).where(eq(schema.users.id, args.actorId)).limit(1);
        if (!me[0] || me[0].role !== "admin") return fail("Only the admin can mark COD confirmation.");
      } else {
        const me = await db.select().from(schema.users).where(eq(schema.users.id, args.actorId)).limit(1);
        if (!me[0] || me[0].role !== "seller") return fail("Only the fulfilling seller can mark COD confirmation.");
        const snap = await db.select().from(schema.orderSellerItems).where(and(eq(schema.orderSellerItems.orderId, args.orderId), eq(schema.orderSellerItems.sellerId, args.actorId))).limit(1);
        if (o.sellerId !== args.actorId && !snap[0]) return fail("This order is not attributed to your store.");
      }
      await db.update(schema.orders).set({ codConfirmed: 1, codConfirmedAt: new Date() }).where(eq(schema.orders.id, args.orderId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  sellerDashboard: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number() }),
    response: z.object({
      myProducts: z.array(productOut),
      orders: z.array(orderOut),
      // Order History: EVERY order containing this seller's products,
      // Cancelled included, newest first — a permanent record for the
      // Seller section. The working `orders` list above excludes
      // Cancelled orders; history never drops one.
      orderHistory: z.array(orderOut),
      totalProfit: z.number(),
      totalOrders: z.number(),
      itemsSold: z.number(),
      // Merchant "Shop Data" figures, all computed from this seller's real
      // orders (orders containing at least one of the seller's products).
      totalRevenue: z.number(),
      monthlyItems: z.number(),
      pendingShipment: z.number(),
      inTransit: z.number(),
      completed: z.number(),
      pendingPayment: z.number(),
      deliveredRevenue: z.number(),
      serviceRating: z.number().nullable(),
      logisticsRating: z.number().nullable(),
      overallRating: z.number().nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!me[0] || me[0].role !== "seller") throw new Error("Only seller accounts can view the seller dashboard.");
      const picks = await db
        .select()
        .from(schema.sellerProducts)
        .where(eq(schema.sellerProducts.sellerId, args.sellerId))
        .orderBy(desc(schema.sellerProducts.id));
      const myProducts = [];
      const myProductIds = new Set<number>();
      for (const pick of picks) {
        const p = await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, pick.productId))
          .limit(1);
        if (p[0]) {
          myProducts.push(toProductOut(p[0]));
          myProductIds.add(p[0].id);
        }
      }
      // Seller earnings view: every order attributed to this seller at
      // order time contributes its items' profit to the seller (the
      // dropshipping model the owner described) — products added to the
      // store later never pull in older orders.
      const attr = await loadOrderAttribution(db);
      const allOrders = await db
        .select()
        .from(schema.orders)
        .orderBy(desc(schema.orders.id));
      const sellerOrders = [];
      const sellerHistory = [];
      let totalProfit = 0;
      let itemsSold = 0;
      let totalRevenue = 0;
      let monthlyItems = 0;
      let pendingShipment = 0;
      let inTransit = 0;
      let completed = 0;
      let pendingPayment = 0;
      let deliveredRevenue = 0;
      const now = new Date();
      for (const o of allOrders) {
        // Payment gate: a prepaid order whose payment is still under
        // verification (or was rejected) never appears in the seller's
        // working orders OR order history — sellers only ever see
        // verified orders, exactly as before.
        if (o.paymentStatus === "pending" || o.paymentStatus === "rejected") continue;
        const attrIds = attributedProductIds(attr, o.id, args.sellerId, myProductIds, o.sellerId);
        if (attrIds.size === 0) continue;
        const items = await db
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.orderId, o.id));
        const mine = items.filter((it) => attrIds.has(it.productId));
        if (mine.length === 0) continue;
        const out = await toOrderOut(db, o);
        // History keeps every order — Cancelled ones too — so a completed
        // or cancelled order never disappears from the seller's record.
        sellerHistory.push(out);
        if (o.status === "Cancelled") continue;
        sellerOrders.push(out);
        let orderRevenue = 0;
        let orderItems = 0;
        for (const it of mine) {
          totalProfit += it.profitAmount * it.qty;
          itemsSold += it.qty;
          orderRevenue += it.buyerPrice * it.qty;
          orderItems += it.qty;
        }
        totalRevenue += orderRevenue;
        if (
          o.createdAt.getFullYear() === now.getFullYear() &&
          o.createdAt.getMonth() === now.getMonth()
        ) {
          monthlyItems += orderItems;
        }
        if (o.status === "Pending" || o.status === "Confirmed") {
          pendingShipment += 1;
          pendingPayment += 1;
        } else if (o.status === "Shipped") {
          inTransit += 1;
          pendingPayment += 1;
        } else if (o.status === "Delivered") {
          completed += 1;
          deliveredRevenue += orderRevenue;
        }
      }
      return {
        myProducts,
        orders: sellerOrders,
        orderHistory: sellerHistory,
        totalProfit,
        totalOrders: sellerOrders.length,
        itemsSold,
        totalRevenue,
        monthlyItems,
        pendingShipment,
        inTransit,
        completed,
        pendingPayment,
        deliveredRevenue,
        serviceRating: me[0].serviceRating ?? null,
        logisticsRating: me[0].logisticsRating ?? null,
        overallRating: me[0].overallRating ?? null,
      };
    },
  }),

  adminOverview: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({
      ok: z.boolean(),
      users: z.array(userOut),
      orders: z.array(orderOut),
      tickets: z.array(ticketOut),
      totalRevenue: z.number(),
      totalProfitPool: z.number(),
      totalWalletBalance: z.number(),
      totalPendingAmount: z.number(),
      totalUsedAmount: z.number(),
      totalOrderValue: z.number(),
      pendingShipments: z.number(),
      pendingWalletRequests: z.number(),
      pendingSupport: z.number(),
      totalProducts: z.number(),
      buyerStats: z.array(z.object({ userId: z.number(), orderCount: z.number(), totalSpent: z.number() })),
      orderSellerInfo: z.array(z.object({ orderId: z.number(), sellerNames: z.string(), sellerIds: z.string(), profit: z.number(), primarySellerId: z.number(), primarySellerName: z.string(), primaryStoreName: z.string(), primaryLoginId: z.string(), primaryContact: z.string(), primaryDeleted: z.boolean() })),
      recentNotifications: z.array(z.object({ id: z.number(), sellerId: z.number(), sellerName: z.string(), orderId: z.number(), productName: z.string(), amount: z.number(), isRead: z.boolean(), createdAt: z.string() })),
      deletedPlaceholderId: z.number(),
      orderDeletedInfo: z.array(z.object({ orderId: z.number(), sellerDeleted: z.boolean(), buyerDeleted: z.boolean() })),
      totalStoreVisits: z.number(),
      todayStoreVisits: z.number(),
      manualStoreVisits: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.adminId))
        .limit(1);
      if (!me[0] || me[0].role !== "admin") {
        return {
          ok: false, users: [], orders: [], tickets: [], totalRevenue: 0, totalProfitPool: 0,
          totalWalletBalance: 0, totalPendingAmount: 0, totalUsedAmount: 0, totalOrderValue: 0,
          pendingShipments: 0, pendingWalletRequests: 0, pendingSupport: 0, totalProducts: 0,
          buyerStats: [], orderSellerInfo: [], recentNotifications: [], deletedPlaceholderId: 0, orderDeletedInfo: [],
          totalStoreVisits: 0, todayStoreVisits: 0, manualStoreVisits: 0,
        };
      }
      // Site-wide store visits (counted from the day this feature went live).
      const visitTotalRows = await db.select({ n: sql<number>`count(*)::int` }).from(schema.storeVisits);
      const totalStoreVisits = visitTotalRows[0]?.n ?? 0;
      const visitTodayRows = await db.select({ n: sql<number>`count(*)::int` }).from(schema.storeVisits).where(sql`visit_day = CURRENT_DATE`);
      const todayStoreVisits = visitTodayRows[0]?.n ?? 0;
      const visitManualRows = await db.select({ n: sql<number>`count(*)::int` }).from(schema.storeVisits).where(sql`visitor_key LIKE 'admin-manual-%'`);
      const manualStoreVisits = visitManualRows[0]?.n ?? 0;
      const userRows = await db
        .select()
        .from(schema.users)
        .orderBy(desc(schema.users.id));
      const orderRows = await db
        .select()
        .from(schema.orders)
        .orderBy(desc(schema.orders.id));
      const orders = [];
      let totalRevenue = 0;
      let totalProfitPool = 0;
      for (const o of orderRows) {
        const out = await toOrderOut(db, o);
        orders.push(out);
        if (o.status !== "Cancelled") {
          totalRevenue += o.total;
          for (const it of out.items) {
            totalProfitPool += it.profitAmount * it.qty;
          }
        }
      }
      const ticketRows = await db
        .select()
        .from(schema.tickets)
        .orderBy(desc(schema.tickets.id));
      // Platform wallet totals + buyer stats + order->seller map + activity
      const sellerRows = userRows.filter((u) => u.role === "seller");
      let totalWalletBalance = 0; let totalPendingAmount = 0; let totalUsedAmount = 0;
      for (const s of sellerRows) { const f = await computeSellerFinance(db, s.id); totalWalletBalance += f.availableBalance; totalPendingAmount += f.totalPending; totalUsedAmount += f.usedAmount; }
      const prodRows = await db.select({ id: schema.products.id }).from(schema.products);
      const walletRows = await db.select().from(schema.walletTransactions).where(eq(schema.walletTransactions.status, "pending"));
      const chatRowsAll = await db.select().from(schema.chatMessages);
      const awaitingChats = new Set<number>();
      { const byU = new Map<number, string>(); for (const m of chatRowsAll) byU.set(m.userId, m.sender); void awaitingChats; void byU; }
      const pendingSupport = ticketRows.filter((tk) => tk.status === "Open").length;
      const buyerStatsMap = new Map<number, { userId: number; orderCount: number; totalSpent: number }>();
      for (const o of orderRows) { if (o.status === "Cancelled") continue; const cur = buyerStatsMap.get(o.buyerId) ?? { userId: o.buyerId, orderCount: 0, totalSpent: 0 }; cur.orderCount += 1; cur.totalSpent += o.total; buyerStatsMap.set(o.buyerId, cur); }
      const allPicks = await db.select().from(schema.sellerProducts);
      const prodToSellers = new Map<number, number[]>();
      for (const pk of allPicks) { const arr = prodToSellers.get(pk.productId) ?? []; arr.push(pk.sellerId); prodToSellers.set(pk.productId, arr); }
      const userById = new Map(userRows.map((u) => [u.id, u]));
      const orderSellerInfo: Array<{ orderId: number; sellerNames: string; sellerIds: string; profit: number; primarySellerId: number; primarySellerName: string; primaryStoreName: string; primaryLoginId: string; primaryContact: string; primaryDeleted: boolean }> = [];
      const orderDeletedInfo: Array<{ orderId: number; sellerDeleted: boolean; buyerDeleted: boolean }> = [];
      let snapRows: Array<{ orderId: number; sellerIdOriginal: number; sellerName: string; storeName: string }> = [];
      try { snapRows = await db.select().from(schema.orderSellerSnapshots); } catch { snapRows = []; }
      const snapsByOrder = new Map<number, typeof snapRows>();
      for (const s of snapRows) { const a = snapsByOrder.get(s.orderId) ?? []; a.push(s); snapsByOrder.set(s.orderId, a); }
      const placeholderRow = userRows.find((u) => u.email === "deleted-placeholder@system.local");
      const attr = await loadOrderAttribution(db);
      for (const o of orderRows) { const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, o.id)); const sIds = new Set<number>(); let profit = 0; for (const it of items) { profit += it.profitAmount * it.qty; for (const sid of prodToSellers.get(it.productId) ?? []) sIds.add(sid); } { const attributed = attributedSellerIds(attr, o.id, [...sIds], o.sellerId); sIds.clear(); for (const id of attributed) sIds.add(id); } const snaps = snapsByOrder.get(o.id) ?? []; const liveNames = [...sIds].map((id) => userById.get(id)?.storeName ?? userById.get(id)?.name ?? "Seller"); const snapNames = snaps.map((s) => s.storeName || s.sellerName); const allNames = [...liveNames, ...snapNames.filter((n) => !liveNames.includes(n))];
        // Primary shop for Admin → Orders grouping: exactly ONE shop per
        // order, so the by-shop counts always add up to the global
        // counts. Resolution: the order's own sellerId, then a deleted
        // seller kept in the order's snapshot, then the lowest live
        // seller id whose store carries an ordered product. 0 means the
        // order has no seller/shop on record (Unassigned).
        const candidateIds: number[] = [];
        if (o.sellerId) candidateIds.push(o.sellerId);
        for (const s of snaps) if (!candidateIds.includes(s.sellerIdOriginal)) candidateIds.push(s.sellerIdOriginal);
        for (const id of [...sIds].sort((a, b) => a - b)) if (!candidateIds.includes(id)) candidateIds.push(id);
        let primarySellerId = 0; let primarySellerName = ""; let primaryStoreName = ""; let primaryLoginId = ""; let primaryContact = ""; let primaryDeleted = false;
        if (candidateIds.length > 0) {
          primarySellerId = candidateIds[0]!;
          const pu = userById.get(primarySellerId);
          if (pu) {
            primarySellerName = pu.name;
            primaryStoreName = pu.storeName ?? "";
            primaryLoginId = pu.email ?? (pu.phone ? phoneDisplay(pu.phone, pu.country) : `Seller #${pu.id}`);
            primaryContact = [pu.email ?? null, pu.phone ? phoneDisplay(pu.phone, pu.country) : null].filter(Boolean).join(" · ");
          } else {
            const snap = snaps.find((s) => s.sellerIdOriginal === primarySellerId);
            primarySellerName = snap?.sellerName || `Seller #${primarySellerId}`;
            primaryStoreName = snap?.storeName ?? "";
            primaryLoginId = `Seller #${primarySellerId}`;
            primaryDeleted = true;
          }
        }
        orderSellerInfo.push({ orderId: o.id, sellerNames: allNames.join(", ") || "Main Store", sellerIds: [...sIds].join(","), profit, primarySellerId, primarySellerName, primaryStoreName, primaryLoginId, primaryContact, primaryDeleted }); orderDeletedInfo.push({ orderId: o.id, sellerDeleted: snaps.length > 0, buyerDeleted: !!placeholderRow && o.buyerId === placeholderRow.id }); }
      let recentNotifications: Array<{ id: number; sellerId: number; sellerName: string; orderId: number; productName: string; amount: number; isRead: boolean; createdAt: string }> = [];
      try { const notifRows = await db.select().from(schema.sellerNotifications).orderBy(desc(schema.sellerNotifications.id)).limit(20); recentNotifications = notifRows.map((n) => ({ id: n.id, sellerId: n.sellerId, sellerName: userById.get(n.sellerId)?.storeName ?? userById.get(n.sellerId)?.name ?? "Seller", orderId: n.orderId, productName: n.productName, amount: n.amount, isRead: n.isRead === 1, createdAt: n.createdAt.toISOString() })); } catch { recentNotifications = []; }
      return {
        ok: true,
        users: userRows.filter((u) => u.email !== "deleted-placeholder@system.local").map(toUserOut),
        orders,
        tickets: ticketRows.map(toTicketOut),
        totalRevenue,
        totalProfitPool,
        totalWalletBalance, totalPendingAmount, totalUsedAmount, totalOrderValue: totalRevenue,
        pendingShipments: orderRows.filter((o) => o.status === "Pending" || o.status === "Confirmed").length,
        pendingWalletRequests: walletRows.length,
        pendingSupport,
        totalProducts: prodRows.length,
        buyerStats: [...buyerStatsMap.values()],
        orderSellerInfo,
        recentNotifications,
        deletedPlaceholderId: placeholderRow?.id ?? 0,
        orderDeletedInfo,
        totalStoreVisits,
        todayStoreVisits,
        manualStoreVisits,
      };
    },
  }),

  adminUpsertProduct: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      id: z.number().nullable(),
      name: z.string().min(2).max(120),
      category: z.string().min(2).max(60),
      description: z.string().max(1000),
      basePrice: z.number().int().min(1).max(100000000),
      oldPrice: z.number().int().min(0).max(100000000).nullable(),
      profitPercent: z.number().int().min(0).max(200),
      stock: z.number().int().min(0).max(1000000),
      imageAsset: z.string().max(120).nullable(),
    }),
    response: z.object({ ok: z.literal(true), id: z.number() }),
    async handler(ctx, args): Promise<{ ok: true; id: number }> {
      const db = ctx.db<typeof schema>();
      const me = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.adminId))
        .limit(1);
      if (!me[0] || me[0].role !== "admin") {
        throw new Error("Only the admin can manage products.");
      }
      const values = {
        name: args.name.trim(),
        category: args.category.trim(),
        description: args.description.trim(),
        basePrice: args.basePrice,
        oldPrice: args.oldPrice && args.oldPrice > 0 ? args.oldPrice : null,
        profitPercent: args.profitPercent,
        stock: args.stock,
        imageAsset: args.imageAsset,
      };
      if (args.id) {
        await db
          .update(schema.products)
          .set(values)
          .where(eq(schema.products.id, args.id));
        ctx.invalidateQueries();
        return { ok: true as const, id: args.id };
      }
      const inserted = await db
        .insert(schema.products)
        .values(values)
        .returning({ id: schema.products.id });
      ctx.invalidateQueries();
      return { ok: true as const, id: inserted[0]!.id };
    },
  }),

  adminDeleteProduct: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), productId: z.number() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const me = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.adminId))
        .limit(1);
      if (!me[0] || me[0].role !== "admin") {
        throw new Error("Only the admin can manage products.");
      }
      await db
        .delete(schema.sellerProducts)
        .where(eq(schema.sellerProducts.productId, args.productId));
      await db
        .delete(schema.cartItems)
        .where(eq(schema.cartItems.productId, args.productId));
      await db
        .delete(schema.products)
        .where(eq(schema.products.id, args.productId));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  updateOrderStatus: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      orderId: z.number(),
      status: z.enum([
        "Pending",
        "Confirmed",
        "Shipped",
        "Delivered",
        "Cancelled",
      ]),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const me = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.adminId))
        .limit(1);
      if (!me[0] || me[0].role !== "admin") {
        throw new Error("Only the admin can change order status.");
      }
      const prev = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, args.orderId))
        .limit(1);
      // Delivered is TERMINAL (2026-10-29 security fix): a delivered
      // order can never move back (that re-credited wallet profit), and
      // Delivered is only reachable from Shipment — the Admin route is
      // Pending -> Shipped -> approve -> Delivered. Re-setting Delivered
      // on an already-Delivered order is a harmless no-op below.
      if (prev[0] && prev[0].status === "Delivered" && args.status !== "Delivered") {
        throw new Error(`Order #${args.orderId} is already Delivered — a delivered order cannot be moved back.`);
      }
      if (prev[0] && args.status === "Delivered" && prev[0].status !== "Delivered" && prev[0].status !== "Shipped") {
        throw new Error(`Order #${args.orderId} cannot be marked Delivered from ${prev[0].status} — move it to Shipment first, then approve it.`);
      }
      // Payment gate: an order whose prepaid payment is still under
      // verification cannot be moved through the delivery flow — the
      // Admin must Verify or Reject the payment first (cancelling it
      // outright stays possible).
      if (prev[0] && prev[0].paymentStatus === "pending" && args.status !== "Cancelled") {
        throw new Error(`Order #${args.orderId} is waiting for payment verification — please use Verify Payment or Reject Payment on the order first.`);
      }
      // Stock follows the status: placing the order took the items
      // out of stock, so moving INTO Cancelled gives them back, and
      // moving a Cancelled order back into the flow takes them out
      // again (refused in writing when the stock no longer covers
      // it). Before this, a cancelled order's stock was lost forever.
      if (prev[0] && prev[0].status !== args.status) {
        const items = await db
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.orderId, args.orderId));
        if (args.status === "Cancelled") {
          for (const it of items) {
            const p = await db.select().from(schema.products).where(eq(schema.products.id, it.productId)).limit(1);
            if (p[0]) {
              await db.update(schema.products).set({ stock: p[0].stock + it.qty }).where(eq(schema.products.id, it.productId));
            }
          }
        } else if (prev[0].status === "Cancelled") {
          for (const it of items) {
            const p = await db.select().from(schema.products).where(eq(schema.products.id, it.productId)).limit(1);
            if (p[0] && p[0].stock < it.qty) {
              throw new Error(`Order #${args.orderId} cannot be restored: only ${p[0].stock} of "${p[0].name}" is in stock now, but the order needs ${it.qty}.`);
            }
          }
          for (const it of items) {
            const p = await db.select().from(schema.products).where(eq(schema.products.id, it.productId)).limit(1);
            if (p[0]) {
              await db.update(schema.products).set({ stock: p[0].stock - it.qty }).where(eq(schema.products.id, it.productId));
            }
          }
        }
      }
      await db
        .update(schema.orders)
        .set({ status: args.status })
        .where(eq(schema.orders.id, args.orderId));
      // Moving an order INTO Delivered is the completion step of the
      // journey (normally Admin approval of a Shipment): the seller is
      // told their order is completed.
      if (args.status === "Delivered" && prev[0] && prev[0].status !== "Delivered") {
        await notifySellersOrderCompleted(db, args.orderId);
        await notifySellersWalletCredit(db, args.orderId);
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // Admin shipment review — the approval step of the order journey.
  // A seller's "Deliver Order" (wallet payment) moves an order Pending →
  // Shipped, where it waits for the Admin. "approve" completes it
  // (Delivered everywhere + the seller is notified); "return" sends it
  // back to Pending for the seller to fix and re-ship.
  adminReviewShippedOrder: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      orderId: z.number(),
      decision: z.enum(["approve", "return"]),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const fail = (error: string) => ({ ok: false, error });
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return fail("Only the admin can review shipped orders.");
      const ord = await db.select().from(schema.orders).where(eq(schema.orders.id, args.orderId)).limit(1);
      if (!ord[0]) return fail("Order not found — it may have been removed.");
      if (ord[0].status !== "Shipped") {
        return fail(`Order #${args.orderId} is ${ord[0].status} — only orders in Shipment (waiting for approval) can be approved or returned.`);
      }
      if (args.decision === "approve") {
        await db.update(schema.orders).set({ status: "Delivered" }).where(eq(schema.orders.id, args.orderId));
        await notifySellersOrderCompleted(db, args.orderId);
        await notifySellersWalletCredit(db, args.orderId);
      } else {
        await db.update(schema.orders).set({ status: "Pending" }).where(eq(schema.orders.id, args.orderId));
      }
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Buyer self-cancel (added 2026-10-29: the help text promised buyers
  // could cancel from My Orders, but no buyer cancel path existed).
  // Pending orders only. COD Pending and unverified-prepaid Pending may
  // cancel (the order never reached a seller); verified-prepaid Pending
  // must go through Customer Service, because money already changed
  // hands. Stock is restored exactly like the admin cancel paths do.
  // Money is NEVER touched here: no wallet movement, no refund (none
  // exists). The order row stays with status Cancelled, so it shows in
  // the seller's Order History exactly like other cancellations.
  cancelBuyerOrder: defineAction({
    auth: { arg: "buyerId", role: "buyer" },
    request: z.object({ orderId: z.number(), buyerId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const ord = await db.select().from(schema.orders).where(eq(schema.orders.id, args.orderId)).limit(1);
      if (!ord[0]) return { ok: false, error: "Order not found — it may have been removed." };
      if (ord[0].buyerId !== args.buyerId) return { ok: false, error: "This order does not belong to your account." };
      if (ord[0].status !== "Pending") return { ok: false, error: `Order #${args.orderId} is ${ord[0].status} — only Pending orders can be cancelled here.` };
      if (ord[0].paymentStatus === "verified") return { ok: false, error: `Order #${args.orderId} has a verified payment — please contact Customer Service to cancel it.` };
      const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, args.orderId));
      for (const it of items) {
        const p = await db.select().from(schema.products).where(eq(schema.products.id, it.productId)).limit(1);
        if (p[0]) {
          await db.update(schema.products).set({ stock: p[0].stock + it.qty }).where(eq(schema.products.id, it.productId));
        }
      }
      await db.update(schema.orders).set({ status: "Cancelled" }).where(eq(schema.orders.id, args.orderId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Payment verification gate for prepaid ("Pay First") BUYER orders.
  // The order sits in "Payment under verification" (paymentStatus
  // "pending") — visible to the buyer and the Admin, invisible to
  // sellers — until the Admin decides here:
  //  • verify → paymentStatus "verified": the order is released into
  //    the normal flow (sellers are attributed + notified exactly as a
  //    fresh order, then Deliver → Admin Approve → Delivered as usual).
  //  • reject (written reason REQUIRED) → the order is Cancelled, its
  //    stock is restored, and the buyer is told the reason in My Orders
  //    AND in their Live Chat thread with Customer Service.
  // COD orders and Admin quick-send orders have paymentStatus "none"
  // and never pass through this gate. Seller flows are untouched.
  adminReviewOrderPayment: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      orderId: z.number(),
      decision: z.enum(["verify", "reject"]),
      // Written rejection reason — required for "reject", shown to the
      // buyer verbatim.
      reason: z.string().max(500).optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const fail = (error: string) => ({ ok: false, error });
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return fail("Only the admin can verify order payments.");
      const ord = await db.select().from(schema.orders).where(eq(schema.orders.id, args.orderId)).limit(1);
      if (!ord[0]) return fail("Order not found — it may have been removed.");
      if (ord[0].paymentStatus !== "pending") {
        return fail(ord[0].paymentStatus === "verified"
          ? `Order #${args.orderId} — its payment is already verified.`
          : ord[0].paymentStatus === "rejected"
            ? `Order #${args.orderId} — its payment was already rejected and the order is cancelled.`
            : `Order #${args.orderId} does not need payment verification (it is not a Pay First order).`);
      }
      if (args.decision === "verify") {
        await db
          .update(schema.orders)
          .set({ paymentStatus: "verified", paymentVerifiedAt: new Date() })
          .where(eq(schema.orders.id, args.orderId));
        // Release the order to the sellers: attribution snapshot +
        // notifications, exactly as a normal checkout order gets at
        // placement time.
        const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, args.orderId));
        const lines = items.map((it) => ({ productId: it.productId, buyerPrice: it.buyerPrice, qty: it.qty }));
        await notifySellersOfOrder(db, args.orderId, lines);
        ctx.invalidateQueries();
        return { ok: true, error: null };
      }
      const reason = (args.reason ?? "").trim();
      if (!reason) {
        return fail("Please write a reason for rejecting this payment — the buyer will see it, so they know what went wrong.");
      }
      // Reject: cancel the order, restore the stock it held, record the
      // reason on the order (buyer's My Orders shows it) and tell the
      // buyer in their Live Chat thread with Customer Service.
      const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, args.orderId));
      for (const it of items) {
        const p = await db.select().from(schema.products).where(eq(schema.products.id, it.productId)).limit(1);
        if (p[0]) {
          await db.update(schema.products).set({ stock: p[0].stock + it.qty }).where(eq(schema.products.id, it.productId));
        }
      }
      await db
        .update(schema.orders)
        .set({ status: "Cancelled", paymentStatus: "rejected", paymentRejectReason: reason })
        .where(eq(schema.orders.id, args.orderId));
      try {
        await db.insert(schema.chatMessages).values({
          userId: ord[0].buyerId,
          sender: "admin",
          message: `Payment for your Order #${args.orderId} could not be verified, so the order has been cancelled. Reason: ${reason} If you did make this payment, please reply here in Live Chat with your payment proof and Customer Service will check it again.`,
        });
      } catch { /* the order itself already carries the reason for the buyer */ }
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Mark ONE order's seller notification as seen — the per-order "NEW"
  // highlight in the seller's Orders → Pending section clears when the
  // seller opens/views that order, and stays cleared.
  markSellerOrderViewed: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number(), orderId: z.number() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.sellerNotifications)
        .set({ isRead: 1 })
        .where(and(eq(schema.sellerNotifications.sellerId, args.sellerId), eq(schema.sellerNotifications.orderId, args.orderId)));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  createTicket: defineAction({
    auth: { optional: "userId" },
    request: z.object({
      userId: z.number().nullable(),
      name: z.string().min(2).max(80),
      email: z.string().email().max(120),
      subject: z.string().min(3).max(150),
      message: z.string().min(5).max(2000),
    }),
    response: z.object({ ok: z.literal(true), id: z.number() }),
    async handler(ctx, args): Promise<{ ok: true; id: number }> {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.tickets)
        .values({
          userId: args.userId,
          name: args.name.trim(),
          email: args.email.trim().toLowerCase(),
          subject: args.subject.trim(),
          message: args.message.trim(),
          status: "Open",
        })
        .returning({ id: schema.tickets.id });
      ctx.invalidateQueries();
      return { ok: true as const, id: inserted[0]!.id };
    },
  }),

  listMyTickets: defineAction({
    auth: { arg: "userId" },
    request: z.object({ userId: z.number() }),
    response: z.object({ tickets: z.array(ticketOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.tickets)
        .where(eq(schema.tickets.userId, args.userId))
        .orderBy(desc(schema.tickets.id));
      return { tickets: rows.map(toTicketOut) };
    },
  }),

  replyTicket: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      ticketId: z.number(),
      reply: z.string().min(1).max(2000),
      status: z.enum(["Open", "Answered", "Closed"]),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const me = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.adminId))
        .limit(1);
      if (!me[0] || me[0].role !== "admin") {
        throw new Error("Only the admin can reply to support tickets.");
      }
      await db
        .update(schema.tickets)
        .set({ reply: args.reply.trim(), status: args.status })
        .where(eq(schema.tickets.id, args.ticketId));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),
  // ---- Seller verification review (Admin) ----

  listSellerApplications: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({ applications: z.array(sellerApplicationOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.adminId))
        .limit(1);
      if (!me[0] || me[0].role !== "admin") {
        throw new Error("Only the admin can review seller applications.");
      }
      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.role, "seller"))
        .orderBy(desc(schema.users.id));
      const applications: SellerApplication[] = [];
      for (const r of rows) applications.push(await toSellerApplicationFull(db, r));
      return { applications };
    },
  }),

  reviewSeller: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      sellerId: z.number(),
      decision: z.enum(["approved", "rejected"]),
      reason: z.string().max(500).optional(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const me = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.adminId))
        .limit(1);
      if (!me[0] || me[0].role !== "admin") {
        throw new Error("Only the admin can review seller applications.");
      }
      const target = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.sellerId))
        .limit(1);
      if (!target[0] || target[0].role !== "seller") {
        throw new Error("Seller account not found.");
      }
      await db
        .update(schema.users)
        .set({ verificationStatus: args.decision })
        .where(eq(schema.users.id, args.sellerId));
      // Tell the seller in their account (a general Admin notice): on
      // approval, that they are verified and can now sell; on rejection,
      // the Admin's reason (or the standard wording) and the support route.
      const reason = (args.reason ?? "").trim();
      const message = args.decision === "approved"
        ? "Good news — your seller account has been VERIFIED by Customer Service ✓. You can now add products to your store and start selling."
        : `Your seller application was not approved by Customer Service.${reason ? ` Reason: ${reason}` : ""} Please contact Customer Service on Live Chat (Support) to fix this and apply again.`;
      try {
        await db.insert(schema.sellerNotices).values({
          sellerId: args.sellerId,
          orderId: null,
          message,
          isRead: 0,
        });
      } catch { /* notice is best-effort; the status change already saved */ }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // Fresh account STATUS for the token's owner (a seller waits for
  // verification, so an Admin approval/rejection shows up without the
  // seller having to sign out and back in). No id arg anymore: the
  // token IS the identity, so this endpoint cannot be used to look up
  // other accounts. The client merges these fields into the account it
  // already holds (see SellerView's sessionRefresh effect).
  refreshMySession: defineAction({
    auth: { any: true },
    request: z.object({}),
    response: z.object({ user: z.object({ id: z.number(), verificationStatus: z.string(), mustChangePassword: z.boolean() }).nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.users).where(eq(schema.users.id, ctx.auth!.userId)).limit(1);
      if (!rows[0] || rows[0].email === "deleted-placeholder@system.local") return { user: null };
      return { user: { id: rows[0].id, verificationStatus: rows[0].verificationStatus, mustChangePassword: rows[0].mustChangePassword === 1 } };
    },
  }),

  // Admin sets a seller's store ratings (1-5 stars each, or null for
  // "New"). Admin-only: a seller can never change their own ratings.
  adminSetSellerRatings: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      sellerId: z.number(),
      serviceRating: z.number().int().min(1).max(5).nullable(),
      logisticsRating: z.number().int().min(1).max(5).nullable(),
      overallRating: z.number().int().min(1).max(5).nullable(),
    }),
    response: z.object({ ok: z.literal(true), serviceRating: z.number().nullable(), logisticsRating: z.number().nullable(), overallRating: z.number().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") throw new Error("Only the admin can set seller ratings.");
      const target = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!target[0] || target[0].role !== "seller") throw new Error("Ratings can only be set for seller accounts.");
      await db.update(schema.users).set({ serviceRating: args.serviceRating, logisticsRating: args.logisticsRating, overallRating: args.overallRating }).where(eq(schema.users.id, args.sellerId));
      return { ok: true, serviceRating: args.serviceRating, logisticsRating: args.logisticsRating, overallRating: args.overallRating };
    },
  }),

  // Site-wide store visit, recorded once per visitor per UTC day. Public:
  // guests count too. The table UNIQUE guard drops same-day duplicates.
  recordStoreVisit: defineAction({
    auth: "public",
    request: z.object({ visitorKey: z.string().min(8).max(100) }),
    response: z.object({ ok: z.boolean(), counted: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const day = new Date().toISOString().slice(0, 10);
      const rows = await db.insert(schema.storeVisits).values({ visitorKey: args.visitorKey.trim(), visitDay: day }).onConflictDoNothing().returning({ id: schema.storeVisits.id });
      return { ok: true, counted: rows.length > 0 };
    },
  }),

  // Admin manually adds store visits (e.g. footfall the owner knows about
  // outside the site). Rows are tagged admin-manual-* so the Overview can
  // show how much of the total was added by hand vs counted automatically.
  adminAddStoreVisits: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), count: z.number().int().min(1).max(10000) }),
    response: z.object({ ok: z.literal(true), added: z.number(), totalNow: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") throw new Error("Only the admin can add store visits.");
      const day = new Date().toISOString().slice(0, 10);
      const stamp = Date.now();
      const CHUNK = 1000;
      for (let start = 0; start < args.count; start += CHUNK) {
        const n = Math.min(CHUNK, args.count - start);
        const values = [];
        for (let i = 0; i < n; i++) values.push({ visitorKey: `admin-manual-${stamp}-${start + i}`, visitDay: day });
        await db.insert(schema.storeVisits).values(values);
      }
      const totalRows = await db.select({ n: sql<number>`count(*)::int` }).from(schema.storeVisits);
      return { ok: true, added: args.count, totalNow: totalRows[0]?.n ?? 0 };
    },
  }),

  // Sign out: delete the caller's session row. Best-effort from the
  // client (local state is cleared regardless).
  logout: defineAction({
    auth: { any: true },
    request: z.object({}),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (ctx.auth) await db.delete(schema.userSessions).where(eq(schema.userSessions.tokenHash, ctx.auth.tokenHash));
      return { ok: true };
    },
  }),
  // ---- Live support chat (customer <-> Admin) ----

  sendChatMessage: defineAction({
    auth: { arg: "userId" },
    request: z.object({
      userId: z.number(),
      message: z.string().max(2000),
      attachment: chatAttachmentArg.optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), id: z.number().nullable() }),
    async handler(ctx, args): Promise<{ ok: boolean; error: string | null; id: number | null }> {
      const db = ctx.db<typeof schema>();
      const me = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.userId))
        .limit(1);
      if (!me[0] || me[0].role === "admin") {
        return { ok: false, error: "Sign in with a customer account to use live chat.", id: null };
      }
      const text = args.message.trim();
      if (!text && !args.attachment) {
        return { ok: false, error: "Write a message or attach a document first.", id: null };
      }
      let att: { blobKey: string; fileName: string; contentType: string; size: number } | null = null;
      if (args.attachment) {
        const stored = await storeChatAttachment(ctx, args.attachment);
        if (!stored.ok) return { ok: false, error: stored.error, id: null };
        att = stored;
      }
      const inserted = await db
        .insert(schema.chatMessages)
        .values({
          userId: args.userId,
          sender: "customer",
          message: text,
          attachmentBlobKey: att?.blobKey ?? null,
          attachmentFileName: att?.fileName ?? null,
          attachmentContentType: att?.contentType ?? null,
          attachmentSize: att?.size ?? null,
        })
        .returning({ id: schema.chatMessages.id });
      ctx.invalidateQueries();
      return { ok: true, error: null, id: inserted[0]!.id };
    },
  }),

  // Serves one chat attachment to the thread's own customer or to an
  // Admin — nobody else can fetch another customer's chat files.
  // Ownership check for signed blob URLs: is this blob referenced by a
  // row the user owns? (Seller documents, deposit screenshots, chat
  // attachments, order payment proofs.) Header-logo blobs are public by
  // design and handled separately; anything unreferenced is admin-only.
  getBlobSignedUrl: defineAction({
    auth: { any: true },
    request: z.object({ key: z.string().min(1).max(500) }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), url: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const key = args.key;
      const me = ctx.auth
        ? await db.select().from(schema.users).where(eq(schema.users.id, ctx.auth.userId)).limit(1)
        : [];
      if (!me[0]) return { ok: false, error: "Sign in required.", url: null };
      if (key.startsWith("header-logo/")) {
        return { ok: true, error: null, url: await ctx.blobs.signUrl(key) };
      }
      if (me[0].role === "admin") {
        return { ok: true, error: null, url: await ctx.blobs.signUrl(key) };
      }
      const u = me[0];
      const owned =
        [u.photoBlobKey, u.storeLogoBlobKey, u.docFrontBlobKey, u.docBackBlobKey].includes(key) ||
        (await db.select({ id: schema.walletTransactions.id }).from(schema.walletTransactions).where(and(eq(schema.walletTransactions.sellerId, u.id), eq(schema.walletTransactions.screenshotBlobKey, key))).limit(1)).length > 0 ||
        (await db.select({ id: schema.chatMessages.id }).from(schema.chatMessages).where(and(eq(schema.chatMessages.userId, u.id), eq(schema.chatMessages.attachmentBlobKey, key))).limit(1)).length > 0 ||
        (await db.select({ id: schema.orders.id }).from(schema.orders).where(and(eq(schema.orders.buyerId, u.id), eq(schema.orders.paymentProofBlobKey, key))).limit(1)).length > 0;
      if (!owned) return { ok: false, error: "This file does not belong to your account.", url: null };
      return { ok: true, error: null, url: await ctx.blobs.signUrl(key) };
    },
  }),

  getChatAttachmentUrl: defineAction({
    auth: { arg: "requesterId" },
    request: z.object({ requesterId: z.number(), messageId: z.number() }),
    response: z.object({ hasFile: z.boolean(), url: z.string().nullable(), fileName: z.string().nullable(), contentType: z.string().nullable(), size: z.number().nullable() }),
    async handler(ctx, args) {
      const empty = { hasFile: false, url: null, fileName: null, contentType: null, size: null };
      const db = ctx.db<typeof schema>();
      const requester = await db.select().from(schema.users).where(eq(schema.users.id, args.requesterId)).limit(1);
      if (!requester[0]) return empty;
      const rows = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.id, args.messageId)).limit(1);
      const m = rows[0];
      if (!m || !m.attachmentBlobKey) return empty;
      const isOwner = requester[0].role !== "admin" && m.userId === requester[0].id;
      const isAdmin = requester[0].role === "admin";
      if (!isOwner && !isAdmin) return empty;
      const url = await ctx.blobs.getUrl(m.attachmentBlobKey);
      return { hasFile: true, url, fileName: m.attachmentFileName ?? null, contentType: m.attachmentContentType ?? null, size: m.attachmentSize ?? null };
    },
  }),

  listChatMessages: defineAction({
    auth: { arg: "userId", adminOk: true },
    request: z.object({ userId: z.number() }),
    response: z.object({ messages: z.array(chatMessageOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.userId, args.userId))
        .orderBy(asc(schema.chatMessages.id));
      return { messages: rows.map(toChatOut) };
    },
  }),

  adminChatThreads: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({
      threads: z.array(
        z.object({
          userId: z.number(),
          customerName: z.string(),
          customerEmail: z.string(),
          lastMessage: z.string(),
          lastAt: z.string(),
          messageCount: z.number(),
          awaitingReply: z.boolean(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.adminId))
        .limit(1);
      if (!me[0] || me[0].role !== "admin") {
        throw new Error("Only the admin can read support chats.");
      }
      const rows = await db
        .select()
        .from(schema.chatMessages)
        .orderBy(asc(schema.chatMessages.id));
      const byUser = new Map<number, ChatRow[]>();
      for (const r of rows) {
        const list = byUser.get(r.userId) ?? [];
        list.push(r);
        byUser.set(r.userId, list);
      }
      const threads = [];
      for (const [userId, msgs] of byUser) {
        const u = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);
        const last = msgs[msgs.length - 1]!;
        threads.push({
          userId,
          customerName: u[0]?.name ?? "Customer",
          customerEmail: u[0]?.email ?? "",
          lastMessage: last.message || (last.attachmentFileName ? `📎 ${last.attachmentFileName}` : ""),
          lastAt: last.createdAt.toISOString(),
          messageCount: msgs.length,
          awaitingReply: last.sender === "customer",
        });
      }
      threads.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
      return { threads };
    },
  }),

  adminReplyChat: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      userId: z.number(),
      message: z.string().max(2000),
      attachment: chatAttachmentArg.optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), id: z.number().nullable() }),
    async handler(ctx, args): Promise<{ ok: boolean; error: string | null; id: number | null }> {
      const db = ctx.db<typeof schema>();
      const me = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.adminId))
        .limit(1);
      if (!me[0] || me[0].role !== "admin") {
        return { ok: false, error: "Only the admin can reply to support chats.", id: null };
      }
      const text = args.message.trim();
      if (!text && !args.attachment) {
        return { ok: false, error: "Write a message or attach a document first.", id: null };
      }
      let att: { blobKey: string; fileName: string; contentType: string; size: number } | null = null;
      if (args.attachment) {
        const stored = await storeChatAttachment(ctx, args.attachment);
        if (!stored.ok) return { ok: false, error: stored.error, id: null };
        att = stored;
      }
      const inserted = await db
        .insert(schema.chatMessages)
        .values({
          userId: args.userId,
          sender: "admin",
          message: text,
          attachmentBlobKey: att?.blobKey ?? null,
          attachmentFileName: att?.fileName ?? null,
          attachmentContentType: att?.contentType ?? null,
          attachmentSize: att?.size ?? null,
        })
        .returning({ id: schema.chatMessages.id });
      ctx.invalidateQueries();
      return { ok: true, error: null, id: inserted[0]!.id };
    },
  }),
  // ---- Seller wallet (deposit / withdraw requests, Admin approved) ----

  getWallet: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number() }),
    response: z.object({
      balance: z.number(),
      totalDeposited: z.number(),
      totalWithdrawn: z.number(),
      withdrawals: z.array(withdrawalOut),
      deposits: z.array(depositCreditOut),
      pendingWithdrawal: z.number(),
      pendingDeposit: z.number(),
      earnings: z.number(),
      availableBalance: z.number(),
      totalBalance: z.number(),
      pendingOrderHolds: z.number(),
      usedAmount: z.number(),
      totalAdminCredit: z.number(),
      earningsCleared: z.number(),
      pendingOrderEarnings: z.number(),
      totalPending: z.number(),
      totalOrderValue: z.number(),
      totalOrderPayments: z.number(),
      orderCount: z.number(),
      financeOrders: z.array(orderBreakdownOut),
      ledger: z.array(ledgerEntryOut),
      transactions: z.array(
        z.object({
          id: z.string(),
          type: z.enum(["deposit", "withdraw", "earning", "admin_credit", "order_payment", "admin_withdraw"]),
          amount: z.number(),
          method: z.string(),
          reference: z.string(),
          status: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const seller = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!seller[0] || seller[0].role !== "seller") throw new Error("Only seller accounts have a wallet.");
      const f = await computeSellerFinance(db, args.sellerId);
      const transactions = f.ledger.map((e) => ({
        id: e.id,
        type: (e.kind === "order_completed" ? "earning" : e.kind === "order_payment_held" || e.kind === "order_payment_released" ? "order_payment" : e.kind === "balance_correction" ? "admin_credit" : e.kind === "withdraw_paid" ? "withdraw" : e.kind) as "deposit" | "withdraw" | "earning" | "admin_credit" | "order_payment" | "admin_withdraw",
        amount: e.amount, method: e.method, reference: e.reference, status: e.status, createdAt: e.createdAt,
      }));
      return {
        balance: f.availableBalance,
        totalDeposited: f.totalDeposited,
        // ACTUALLY paid-out withdrawals only — NOT usedAmount, which
        // also contains order payments and is not a withdrawal figure.
        totalWithdrawn: f.totalWithdrawn,
        withdrawals: f.withdrawals,
        deposits: f.deposits,
        pendingWithdrawal: f.pendingWithdrawal,
        pendingDeposit: f.pendingDeposit,
        earnings: f.earningsCleared,
        availableBalance: f.availableBalance,
        totalBalance: f.totalBalance,
        pendingOrderHolds: f.pendingOrderHolds,
        usedAmount: f.usedAmount,
        totalAdminCredit: f.totalAdminCredit,
        earningsCleared: f.earningsCleared,
        pendingOrderEarnings: f.pendingOrderEarnings,
        totalPending: f.totalPending,
        totalOrderValue: f.totalOrderValue,
        totalOrderPayments: f.totalOrderPayments,
        orderCount: f.orderCount,
        financeOrders: f.orders,
        ledger: f.ledger,
        transactions,
      };
    },
  }),

  getSellerFinance: defineAction({
    auth: { arg: "actorId" },
    request: z.object({ actorId: z.number(), sellerId: z.number() }),
    response: financeOut,
    async handler(ctx, args): Promise<Finance> {
      const db = ctx.db<typeof schema>();
      const actor = await db.select().from(schema.users).where(eq(schema.users.id, args.actorId)).limit(1);
      if (!actor[0]) throw new Error("Sign in required.");
      if (actor[0].role !== "admin" && !(actor[0].role === "seller" && actor[0].id === args.sellerId)) throw new Error("You can only view your own wallet details.");
      return computeSellerFinance(db, args.sellerId);
    },
  }),


  uploadSellerDocument: defineAction({
    // PUBLIC by necessity: guest seller signup uploads documents BEFORE
    // the account exists (FileNameField -> registerSeller with the blob
    // keys). Storage abuse is bounded instead by lazy orphan cleanup:
    // each upload deletes <=100 blobs older than 24h with no owning row.
    auth: "public",
    request: z.object({
      fileName: z.string().min(1).max(200),
      contentType: z.string().min(1).max(100),
      dataBase64: z.string().min(1).max(6000000),
      kind: z.enum(["photo", "logo", "docFront", "docBack"]),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), blobKey: z.string().nullable(), fileName: z.string(), contentType: z.string(), size: z.number() }),
    async handler(ctx, args) {
      await cleanupOrphanBlobs(ctx);
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
      if (!allowed.includes(args.contentType)) return { ok: false, error: "Only JPG, PNG, WEBP, GIF or PDF files are allowed.", blobKey: null, fileName: args.fileName, contentType: args.contentType, size: 0 };
      let bytes: Uint8Array;
      try { bytes = new Uint8Array(Buffer.from(args.dataBase64, "base64")); } catch { return { ok: false, error: "The file could not be read. Please try again.", blobKey: null, fileName: args.fileName, contentType: args.contentType, size: 0 }; }
      if (bytes.length === 0) return { ok: false, error: "The selected file is empty.", blobKey: null, fileName: args.fileName, contentType: args.contentType, size: 0 };
      if (sniffFileType(bytes) !== args.contentType) return { ok: false, error: "The file's contents do not match its type — please choose a genuine JPG, PNG, WEBP, GIF or PDF file.", blobKey: null, fileName: args.fileName, contentType: args.contentType, size: 0 };
      if (bytes.length > 3 * 1024 * 1024) return { ok: false, error: "File is too large — maximum 3 MB. Please choose a smaller photo or scan.", blobKey: null, fileName: args.fileName, contentType: args.contentType, size: bytes.length };
      const safe = args.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      const key = `seller-docs/${args.kind}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safe}`;
      await ctx.blobs.put(key, bytes, { contentType: args.contentType });
      return { ok: true, error: null, blobKey: key, fileName: args.fileName, contentType: args.contentType, size: bytes.length };
    },
  }),

  saveDocumentUploads: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({
      sellerId: z.number(),
      photoBlobKey: z.string().max(500).optional(), photoFileName: z.string().max(200).optional(), photoContentType: z.string().max(100).optional(), photoSize: z.number().int().min(0).optional(),
      storeLogoBlobKey: z.string().max(500).optional(), storeLogoFileName: z.string().max(200).optional(), storeLogoContentType: z.string().max(100).optional(), storeLogoSize: z.number().int().min(0).optional(),
      docFrontBlobKey: z.string().max(500).optional(), docFrontFileName: z.string().max(200).optional(), docFrontContentType: z.string().max(100).optional(), docFrontSize: z.number().int().min(0).optional(),
      docBackBlobKey: z.string().max(500).optional(), docBackFileName: z.string().max(200).optional(), docBackContentType: z.string().max(100).optional(), docBackSize: z.number().int().min(0).optional(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const seller = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!seller[0]) throw new Error("Seller not found.");
      // Sellers save photo / store logo / ID documents as before. A BUYER
      // may save ONLY their own profile photo (Account → Profile); store
      // logo and ID-document saves stay seller-only and are refused here.
      if (seller[0].role === "buyer") {
        if (!args.photoBlobKey || args.storeLogoBlobKey || args.docFrontBlobKey || args.docBackBlobKey)
          throw new Error("Buyers can only change their profile photo here.");
      } else if (seller[0].role !== "seller") {
        throw new Error("Seller not found.");
      }
      // A supplied blob key must be a real, unattached seller-docs blob:
      // it must exist in blob storage, live under seller-docs/, and not
      // already belong to another user's documents — otherwise anyone
      // with a leaked key could attach someone else's document to their
      // own account.
      for (const key of [args.photoBlobKey, args.storeLogoBlobKey, args.docFrontBlobKey, args.docBackBlobKey]) {
        if (!key) continue;
        if (!key.startsWith("seller-docs/")) throw new Error("That upload is not a seller document — please upload the file again.");
        const brow = await db.select({ key: schema.blobs.key }).from(schema.blobs).where(eq(schema.blobs.key, key)).limit(1);
        if (!brow[0]) throw new Error("That upload was not found — please upload the file again.");
        const other = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(and(
            ne(schema.users.id, args.sellerId),
            sql`${schema.users.photoBlobKey} = ${key} OR ${schema.users.storeLogoBlobKey} = ${key} OR ${schema.users.docFrontBlobKey} = ${key} OR ${schema.users.docBackBlobKey} = ${key}`,
          ))
          .limit(1);
        if (other[0]) throw new Error("That upload already belongs to another account — please upload the file again.");
      }
      const patch: Record<string, unknown> = {};
      if (args.photoBlobKey) { patch.photoBlobKey = args.photoBlobKey; patch.photoContentType = args.photoContentType ?? null; patch.photoSize = args.photoSize ?? null; if (args.photoFileName) patch.photoFileName = args.photoFileName; }
      if (args.storeLogoBlobKey) { patch.storeLogoBlobKey = args.storeLogoBlobKey; patch.storeLogoContentType = args.storeLogoContentType ?? null; patch.storeLogoSize = args.storeLogoSize ?? null; if (args.storeLogoFileName) patch.storeLogoFileName = args.storeLogoFileName; }
      if (args.docFrontBlobKey) { patch.docFrontBlobKey = args.docFrontBlobKey; patch.docFrontContentType = args.docFrontContentType ?? null; patch.docFrontSize = args.docFrontSize ?? null; if (args.docFrontFileName) patch.docFrontFileName = args.docFrontFileName; }
      if (args.docBackBlobKey) { patch.docBackBlobKey = args.docBackBlobKey; patch.docBackContentType = args.docBackContentType ?? null; patch.docBackSize = args.docBackSize ?? null; if (args.docBackFileName) patch.docBackFileName = args.docBackFileName; }
      if (Object.keys(patch).length > 0) await db.update(schema.users).set(patch as never).where(eq(schema.users.id, args.sellerId));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  adminGetDocumentUrl: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), sellerId: z.number(), kind: z.enum(["photo", "logo", "docFront", "docBack"]) }),
    response: z.object({ hasFile: z.boolean(), url: z.string().nullable(), fileName: z.string().nullable(), contentType: z.string().nullable(), size: z.number().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") throw new Error("Only the admin can view seller documents.");
      const u = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!u[0]) return { hasFile: false, url: null, fileName: null, contentType: null, size: null };
      const s = u[0];
      const map = {
        photo: { key: s.photoBlobKey, name: s.photoFileName, ct: s.photoContentType, size: s.photoSize },
        logo: { key: s.storeLogoBlobKey, name: s.storeLogoFileName, ct: s.storeLogoContentType, size: s.storeLogoSize },
        docFront: { key: s.docFrontBlobKey, name: s.docFrontFileName, ct: s.docFrontContentType, size: s.docFrontSize },
        docBack: { key: s.docBackBlobKey, name: s.docBackFileName, ct: s.docBackContentType, size: s.docBackSize },
      } as const;
      const d = map[args.kind];
      if (!d.key) return { hasFile: false, url: null, fileName: d.name ?? null, contentType: d.ct ?? null, size: d.size ?? null };
      const url = await ctx.blobs.getUrl(d.key);
      return { hasFile: true, url, fileName: d.name ?? null, contentType: d.ct ?? null, size: d.size ?? null };
    },
  }),

  getMyDocumentUrl: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number(), kind: z.enum(["photo", "logo", "docFront", "docBack"]) }),
    response: z.object({ hasFile: z.boolean(), url: z.string().nullable(), fileName: z.string().nullable(), contentType: z.string().nullable(), size: z.number().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const u = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      // Sellers can fetch all their files; a buyer can fetch ONLY their
      // own profile photo (shown in Account → Profile). Anything else
      // reads as "no file", exactly like a missing record.
      if (!u[0] || (u[0].role !== "seller" && !(u[0].role === "buyer" && args.kind === "photo"))) return { hasFile: false, url: null, fileName: null, contentType: null, size: null };
      const s = u[0];
      const map = {
        photo: { key: s.photoBlobKey, name: s.photoFileName, ct: s.photoContentType, size: s.photoSize },
        logo: { key: s.storeLogoBlobKey, name: s.storeLogoFileName, ct: s.storeLogoContentType, size: s.storeLogoSize },
        docFront: { key: s.docFrontBlobKey, name: s.docFrontFileName, ct: s.docFrontContentType, size: s.docFrontSize },
        docBack: { key: s.docBackBlobKey, name: s.docBackFileName, ct: s.docBackContentType, size: s.docBackSize },
      } as const;
      const d = map[args.kind];
      if (!d.key) return { hasFile: false, url: null, fileName: d.name ?? null, contentType: d.ct ?? null, size: d.size ?? null };
      const url = await ctx.blobs.getUrl(d.key);
      return { hasFile: true, url, fileName: d.name ?? null, contentType: d.ct ?? null, size: d.size ?? null };
    },
  }),

  adminCreditSeller: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), sellerId: z.number(), amountInr: z.number().int().min(1).max(100000000), note: z.string().max(300).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), id: z.number().nullable(), newBalance: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can add amount to a seller wallet.", id: null, newBalance: 0 };
      const seller = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!seller[0] || seller[0].role !== "seller") return { ok: false, error: "Seller not found.", id: null, newBalance: 0 };
      if (!args.amountInr || args.amountInr <= 0) return { ok: false, error: "Amount must be more than zero.", id: null, newBalance: 0 };
      const inserted = await db.insert(schema.walletTransactions).values({ sellerId: args.sellerId, type: "admin_credit", amount: args.amountInr, method: "Customer Service Credit", reference: "Added by Customer Service", note: args.note?.trim() || "Manual credit", status: "completed" }).returning({ id: schema.walletTransactions.id });
      await insertWalletEvent(db, { sellerId: args.sellerId, kind: "admin_credit", amount: args.amountInr, reference: "Customer Service Credit", txId: inserted[0]!.id });
      const f = await computeSellerFinance(db, args.sellerId);
      ctx.invalidateQueries();
      return { ok: true, error: null, id: inserted[0]!.id, newBalance: f.availableBalance };
    },
  }),

  requestDeposit: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({
      sellerId: z.number(),
      amountInr: z.number().int().min(1).max(100000000),
      method: z.enum(["UPI", "Bank Transfer", "USDT (Crypto)"]),
      // Optional at the schema level: for EVERY method the seller may
      // attach a payment screenshot INSTEAD of typing the reference ID
      // — the handler enforces "reference ID OR screenshot" for all
      // methods (UPI, Bank Transfer and USDT alike).
      reference: z.string().max(120).optional(),
      note: z.string().max(300).optional(),
      screenshot: chatAttachmentArg.optional(),
    }),
    response: z.object({ ok: z.literal(true), id: z.number() }),
    async handler(ctx, args): Promise<{ ok: true; id: number }> {
      const db = ctx.db<typeof schema>();
      const seller = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.sellerId))
        .limit(1);
      if (!seller[0] || seller[0].role !== "seller") {
        throw new Error("Only seller accounts can request a deposit.");
      }
      if (seller[0].verificationStatus === "rejected") {
        throw new Error(
          "Your seller application was not approved. Please contact support before using the wallet.",
        );
      }
      if (seller[0].verificationStatus === "pending") {
        throw new Error(
          "Your account is pending verification by Customer Service. The wallet opens as soon as Customer Service verifies your account.",
        );
      }
      // Deposit Account ON/OFF (Admin → Deposit Settings): while OFF no
      // new deposit request is accepted, whatever the client shows.
      const depSettings = await getSettingsRow(db);
      if ((depSettings.depositsEnabled ?? 1) !== 1) {
        throw new Error("Deposits are currently OFF. Please contact Customer Service.");
      }
      // Payment Methods ON/OFF (Admin → Settings → Payment Methods):
      // a method switched OFF accepts no new deposit, whatever the
      // client shows.
      const methodOn =
        args.method === "UPI"
          ? (depSettings.paymentUpiEnabled ?? 1) === 1
          : args.method === "Bank Transfer"
            ? (depSettings.paymentBankEnabled ?? 1) === 1
            : (depSettings.paymentUsdtEnabled ?? 1) === 1;
      if (!methodOn) {
        throw new Error(`${args.method} deposits are currently OFF. Please choose another payment method, or contact Customer Service.`);
      }
      if (args.method === "USDT (Crypto)" && !(depSettings.usdtDepositAddress ?? "").trim()) {
        throw new Error("The USDT deposit address is being set up. Please contact Customer Service for deposit details.");
      }
      // Payment proof: the typed Transaction / UTR reference ID and/or
      // an attached payment screenshot. The rule is the SAME for every
      // method (UPI, Bank Transfer, USDT): at least ONE of the two is
      // required — with a screenshot attached, the reference ID above
      // is not needed. The request is refused only when BOTH are empty.
      const reference = (args.reference ?? "").trim();
      let shot: { blobKey: string; fileName: string; contentType: string; size: number } | null = null;
      if (args.screenshot) {
        const stored = await storeDepositScreenshot(ctx, args.screenshot);
        if (!stored.ok) throw new Error(stored.error);
        shot = stored;
      }
      if (!reference && !shot) {
        throw new Error("Please type the Transaction / UTR reference ID or attach a screenshot of your payment — one of the two is needed so Customer Service can verify your deposit.");
      }
      const inserted = await db
        .insert(schema.walletTransactions)
        .values({
          sellerId: args.sellerId,
          type: "deposit",
          amount: args.amountInr,
          method: args.method,
          reference,
          note: args.note?.trim() ?? "",
          status: "pending",
          screenshotBlobKey: shot?.blobKey ?? null,
          screenshotFileName: shot?.fileName ?? null,
          screenshotContentType: shot?.contentType ?? null,
          screenshotSize: shot?.size ?? null,
        })
        .returning({ id: schema.walletTransactions.id });
      ctx.invalidateQueries();
      return { ok: true as const, id: inserted[0]!.id };
    },
  }),

  requestWithdraw: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({
      sellerId: z.number(),
      amountInr: z.number().int().min(1).max(100000000),
      method: z.enum(["UPI", "Bank Account", "USDT (Crypto)"]),
      upiId: z.string().max(80).optional(),
      accountHolder: z.string().max(80).optional(),
      accountNumber: z.string().max(40).optional(),
      ifsc: z.string().max(20).optional(),
      bankName: z.string().max(80).optional(),
      // USDT payout destination: the seller's own USDT wallet address.
      usdtAddress: z.string().max(120).optional(),
      note: z.string().max(300).optional(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      id: z.number().nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const seller = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.sellerId))
        .limit(1);
      if (!seller[0] || seller[0].role !== "seller") {
        return { ok: false, error: "Only seller accounts can withdraw.", id: null };
      }
      if (seller[0].verificationStatus === "rejected") {
        return {
          ok: false,
          error:
            "Your seller application was not approved. Please contact support before using the wallet.",
          id: null,
        };
      }
      if (seller[0].verificationStatus === "pending") {
        return {
          ok: false,
          error:
            "Your account is pending verification by Customer Service. The wallet opens as soon as Customer Service verifies your account.",
          id: null,
        };
      }
      // Payment Methods ON/OFF (Admin → Settings → Payment Methods):
      // a method switched OFF accepts no new withdrawal either.
      const wdSettings = await getSettingsRow(db);
      const wdMethodOn =
        args.method === "UPI"
          ? (wdSettings.paymentUpiEnabled ?? 1) === 1
          : args.method === "Bank Account"
            ? (wdSettings.paymentBankEnabled ?? 1) === 1
            : (wdSettings.paymentUsdtEnabled ?? 1) === 1;
      if (!wdMethodOn) {
        return { ok: false, error: `${args.method} withdrawals are currently OFF. Please choose another payout method, or contact Customer Service.`, id: null };
      }
      let reference = "";
      let details = "";
      if (args.method === "USDT (Crypto)") {
        // USDT payout: the seller's wallet address is the destination
        // (stored as the reference, exactly like a UPI ID), with the
        // network recorded in details from the same saved deposit
        // network (BEP20 by default) so the Admin pays on the right
        // chain. The ledger amount stays INR; the actual USDT transfer
        // happens outside the app after approval, like UPI / bank.
        const addr = (args.usdtAddress ?? "").trim();
        if (!/^[A-Za-z0-9]{26,64}$/.test(addr)) {
          return { ok: false, error: "Please enter your USDT wallet address — it should be 26–64 letters/numbers with no spaces (a BEP20 address starts with 0x and is 42 characters). Please check and paste it again.", id: null };
        }
        reference = addr;
        details = `Network: ${(wdSettings.depositNetwork ?? "").trim() || "BEP20 (BNB Smart Chain)"}`;
      } else if (args.method === "UPI") {
        if (!args.upiId || args.upiId.trim().length < 4) {
          return { ok: false, error: "Please enter your UPI ID.", id: null };
        }
        reference = args.upiId.trim();
      } else {
        if (
          !args.accountHolder?.trim() ||
          !args.accountNumber?.trim() ||
          !args.ifsc?.trim() ||
          !args.bankName?.trim()
        ) {
          return {
            ok: false,
            error:
              "Please fill account holder, account number, IFSC and bank name.",
            id: null,
          };
        }
        reference = args.accountNumber.trim();
        details = `Holder: ${args.accountHolder.trim()} · IFSC: ${args.ifsc.trim().toUpperCase()} · Bank: ${args.bankName.trim()}`;
      }
      // Available balance comes from the ONE shared computation
      // (computeSellerFinance) — never a second formula here, so the
      // amount a seller may withdraw always matches their Wallet page.
      const balance = (await computeSellerFinance(db, args.sellerId)).availableBalance;
      if (args.amountInr > balance) {
        return {
          ok: false,
          error: `Amount exceeds your available balance (${balance}).`,
          id: null,
        };
      }
      const inserted = await db
        .insert(schema.walletTransactions)
        .values({
          sellerId: args.sellerId,
          type: "withdraw",
          amount: args.amountInr,
          method: args.method,
          reference,
          details,
          note: args.note?.trim() ?? "",
          status: "pending",
        })
        .returning({ id: schema.walletTransactions.id });
      ctx.invalidateQueries();
      return { ok: true, error: null, id: inserted[0]!.id };
    },
  }),

  adminWalletRequests: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({
      requests: z.array(
        z.object({
          id: z.number(),
          sellerId: z.number(),
          sellerName: z.string(),
          storeName: z.string().nullable(),
          type: z.string(),
          amount: z.number(),
          method: z.string(),
          reference: z.string(),
          details: z.string(),
          note: z.string(),
          status: z.string(),
          createdAt: z.string(),
          // Payout record for a withdrawal the Admin has paid: the
          // Admin's payment reference and when it was paid.
          paymentReference: z.string(),
          paidAt: z.string().nullable(),
          // True when a deposit request carries a payment screenshot
          // the Admin can open (getDepositScreenshotUrl).
          hasScreenshot: z.boolean(),
          // The seller's CURRENT available wallet balance (pending
          // withdrawal holds already taken out). The Pay & Withdraw
          // confirmation adds this request's held amount back to show
          // the balance before payment, and this value is the balance
          // after payment — one deduction, shown honestly.
          sellerAvailableBalance: z.number(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.adminId))
        .limit(1);
      if (!me[0] || me[0].role !== "admin") {
        throw new Error("Only the admin can review wallet requests.");
      }
      const rows = await db
        .select()
        .from(schema.walletTransactions)
        .orderBy(desc(schema.walletTransactions.id));
      const financeBySeller = new Map<number, number>();
      const requests = [];
      for (const r of rows) {
        const u = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, r.sellerId))
          .limit(1);
        if (!financeBySeller.has(r.sellerId)) {
          financeBySeller.set(r.sellerId, u[0] ? (await computeSellerFinance(db, r.sellerId)).availableBalance : 0);
        }
        requests.push({
          id: r.id,
          sellerId: r.sellerId,
          sellerName: u[0]?.name ?? "Seller",
          storeName: u[0]?.storeName ?? null,
          type: r.type,
          amount: r.amount,
          method: r.method,
          reference: r.reference,
          details: r.details,
          note: r.note,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          paymentReference: r.paymentReference ?? "",
          paidAt: r.paidAt ? r.paidAt.toISOString() : null,
          hasScreenshot: !!r.screenshotBlobKey,
          sellerAvailableBalance: financeBySeller.get(r.sellerId) ?? 0,
        });
      }
      return { requests };
    },
  }),

  // Serves the payment screenshot attached to ONE prepaid order. The
  // proof is private: ONLY the Admin and the buyer who placed (and
  // paid for) that order can open it — sellers and other buyers cannot.
  // (The request field keeps its original name; it carries the
  // requester's own account id.)
  getOrderPaymentProofUrl: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), orderId: z.number() }),
    response: z.object({ hasFile: z.boolean(), url: z.string().nullable(), fileName: z.string().nullable(), contentType: z.string().nullable(), size: z.number().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const empty = { hasFile: false, url: null, fileName: null, contentType: null, size: null };
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0]) throw new Error("Sign in to view a payment proof.");
      const ord = await db.select().from(schema.orders).where(eq(schema.orders.id, args.orderId)).limit(1);
      if (!ord[0] || !ord[0].paymentProofBlobKey) return empty;
      const isAdmin = me[0].role === "admin";
      const isOwningBuyer = me[0].role === "buyer" && ord[0].buyerId === me[0].id;
      if (!isAdmin && !isOwningBuyer) return empty;
      const url = await ctx.blobs.getUrl(ord[0].paymentProofBlobKey);
      return { hasFile: true, url, fileName: ord[0].paymentProofFileName ?? null, contentType: ord[0].paymentProofContentType ?? null, size: ord[0].paymentProofSize ?? null };
    },
  }),

  // Serves the payment screenshot attached to ONE deposit request, to
  // an Admin only, so it can be checked before approving the deposit.
  getDepositScreenshotUrl: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), txId: z.number() }),
    response: z.object({ hasFile: z.boolean(), url: z.string().nullable(), fileName: z.string().nullable(), contentType: z.string().nullable(), size: z.number().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const empty = { hasFile: false, url: null, fileName: null, contentType: null, size: null };
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") throw new Error("Only the admin can view deposit screenshots.");
      const tx = await db.select().from(schema.walletTransactions).where(eq(schema.walletTransactions.id, args.txId)).limit(1);
      if (!tx[0] || !tx[0].screenshotBlobKey) return empty;
      const url = await ctx.blobs.getUrl(tx[0].screenshotBlobKey);
      return { hasFile: true, url, fileName: tx[0].screenshotFileName ?? null, contentType: tx[0].screenshotContentType ?? null, size: tx[0].screenshotSize ?? null };
    },
  }),

  reviewWalletRequest: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      txId: z.number(),
      decision: z.enum(["approve", "reject"]),
      // Optional rejection reason, told to the customer in the notice.
      reason: z.string().max(300).optional(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const me = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, args.adminId))
        .limit(1);
      if (!me[0] || me[0].role !== "admin") {
        throw new Error("Only the admin can review wallet requests.");
      }
      const tx = await db
        .select()
        .from(schema.walletTransactions)
        .where(eq(schema.walletTransactions.id, args.txId))
        .limit(1);
      if (!tx[0] || tx[0].status !== "pending") {
        throw new Error("This request has already been processed.");
      }
      // Deposit approved -> funds become available. Withdrawal approved ->
      // marked completed (paid by the Admin outside the website, the held
      // amount is deducted). Rejected -> deposit adds nothing; a rejected
      // withdrawal releases its hold automatically.
      const status =
        args.decision === "reject"
          ? "rejected"
          : tx[0].type === "deposit"
            ? "approved"
            : "completed";
      await db
        .update(schema.walletTransactions)
        .set({ status })
        .where(eq(schema.walletTransactions.id, args.txId));
      // Deposit approved = money arrived: the Wallet dot's event.
      // Withdrawal approvals pay money OUT and rejections add nothing,
      // so neither creates an event.
      if (args.decision === "approve" && tx[0].type === "deposit") {
        await insertWalletEvent(db, { sellerId: tx[0].sellerId, kind: "deposit_approved", amount: tx[0].amount, reference: "Deposit", txId: tx[0].id });
      }
      // A rejection is told to the customer (with the reason, if given) as
      // a general notice on their account — nothing is deducted.
      if (args.decision === "reject") {
        const reason = (args.reason ?? "").trim();
        const what = tx[0].type === "withdraw" ? "withdrawal" : tx[0].type === "deposit" ? "deposit" : "wallet";
        await db.insert(schema.sellerNotices).values({
          sellerId: tx[0].sellerId,
          orderId: null,
          message: `Your ${what} request of ₹${tx[0].amount.toLocaleString("en-IN")} was rejected by Customer Service.${reason ? ` Reason: ${reason}` : ""} No amount was deducted from your wallet. Please contact Customer Service if you need help.`,
          isRead: 0,
        });
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // Admin PAYS OUT a pending withdrawal request from the Admin Panel
  // (Pay & Withdraw). The real money moves outside the website (UPI /
  // bank) by the Admin; this action records the payout in the app:
  // the request flips pending → "paid" on the SAME wallet row, so the
  // amount held since the request becomes the one and only deduction —
  // paying never deducts twice, and paying an already paid / rejected /
  // completed request is refused in writing and changes nothing.
  adminPayWithdrawal: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      txId: z.number(),
      // Optional payment reference the Admin types (e.g. UPI txn ID).
      paymentReference: z.string().max(120).optional(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      paidAmount: z.number(),
      newBalance: z.number(),
      paidAt: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const fail = (error: string) => ({ ok: false, error, paidAmount: 0, newBalance: 0, paidAt: null as string | null });
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return fail("Only the admin can pay a withdrawal from the Admin Panel.");
      const tx = await db.select().from(schema.walletTransactions).where(eq(schema.walletTransactions.id, args.txId)).limit(1);
      if (!tx[0]) return fail("This withdrawal request was not found — it may have been removed. Nothing was deducted.");
      const row = tx[0];
      if (row.type !== "withdraw") return fail("This is not a withdrawal request — only a withdrawal request can be paid out. Nothing was deducted.");
      if (row.status === "paid") return fail(`Withdrawal Request #${row.id} has already been Paid ✓ — it cannot be paid again. No amount was deducted.`);
      if (row.status === "rejected") return fail(`Withdrawal Request #${row.id} was Rejected — it cannot be paid. No amount was deducted.`);
      if (row.status === "completed") return fail(`Withdrawal Request #${row.id} was already approved and completed — paying it again would deduct the amount twice, so nothing was deducted.`);
      if (row.status !== "pending") return fail(`Withdrawal Request #${row.id} has already been processed. Nothing was deducted.`);
      const seller = await db.select().from(schema.users).where(eq(schema.users.id, row.sellerId)).limit(1);
      if (!seller[0] || seller[0].role !== "seller") return fail("The customer's account has been deleted — this withdrawal cannot be paid. Nothing was deducted.");
      if (!row.amount || row.amount <= 0) return fail("The withdrawal amount is ₹0 — there is nothing to pay. Nothing was deducted.");
      // Funds check: the request has held its amount since it was made,
      // so the balance before payment = available balance + this held
      // amount. It must cover the payout; otherwise refuse, change nothing.
      const before = await computeSellerFinance(db, row.sellerId);
      const balanceBefore = before.availableBalance + row.amount;
      if (balanceBefore < row.amount) {
        return fail(`Not enough wallet balance to pay this withdrawal: it needs ₹${row.amount.toLocaleString("en-IN")} but the customer's wallet balance is ₹${balanceBefore.toLocaleString("en-IN")}. Nothing was deducted.`);
      }
      const paidAt = new Date();
      const paymentReference = (args.paymentReference ?? "").trim();
      // One status flip on the same row = the single deduction. The held
      // amount (pending) and the paid amount (paid) both count once in
      // computeSellerFinance, so the balance moves exactly once.
      await db
        .update(schema.walletTransactions)
        .set({ status: "paid", paymentReference, paidAt })
        .where(eq(schema.walletTransactions.id, row.id));
      // Tell the customer on their account (general notice, like the
      // order-completed notice).
      await db.insert(schema.sellerNotices).values({
        sellerId: row.sellerId,
        orderId: null,
        message: `Your withdrawal of ₹${row.amount.toLocaleString("en-IN")} has been paid ✓${paymentReference ? ` Payment reference: ${paymentReference}.` : ""} It was sent to your ${row.method}${row.reference ? ` (${row.reference})` : ""}.`,
        isRead: 0,
      });
      const after = await computeSellerFinance(db, row.sellerId);
      ctx.invalidateQueries();
      return { ok: true, error: null, paidAmount: row.amount, newBalance: after.availableBalance, paidAt: paidAt.toISOString() };
    },
  }),

  // Admin DIRECT withdrawal from a seller's wallet (Seller detail →
  // Wallet tab, beside Add Amount): the Admin enters an amount and a
  // short note/reason; the amount is deducted once, one ledger line
  // "Admin Withdrawal — <note>" is added, and the customer is notified.
  adminDirectWithdraw: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      sellerId: z.number(),
      amountInr: z.number().int().min(1).max(100000000),
      note: z.string().max(300).optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), id: z.number().nullable(), newBalance: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const fail = (error: string) => ({ ok: false, error, id: null as number | null, newBalance: 0 });
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return fail("Only the admin can withdraw from a seller wallet.");
      const seller = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!seller[0] || seller[0].role !== "seller") return fail("Seller not found — the account may have been deleted. Nothing was deducted.");
      if (!args.amountInr || args.amountInr <= 0) return fail("Amount must be more than zero — please enter the amount to withdraw. Nothing was deducted.");
      const note = (args.note ?? "").trim();
      if (!note) return fail("Please write a short note / reason for this withdrawal — the customer sees it in the notice. Nothing was deducted.");
      const before = await computeSellerFinance(db, args.sellerId);
      if (args.amountInr > before.availableBalance) {
        return fail(`Not enough wallet balance for this withdrawal: it needs ₹${args.amountInr.toLocaleString("en-IN")} but the available balance is ₹${before.availableBalance.toLocaleString("en-IN")}. Nothing was deducted.`);
      }
      const inserted = await db.insert(schema.walletTransactions).values({
        sellerId: args.sellerId,
        type: "admin_withdraw",
        amount: args.amountInr,
        method: "Customer Service Withdrawal",
        reference: "Customer Service Withdrawal",
        note,
        status: "completed",
      }).returning({ id: schema.walletTransactions.id });
      await db.insert(schema.sellerNotices).values({
        sellerId: args.sellerId,
        orderId: null,
        message: `Customer Service Withdrawal: ₹${args.amountInr.toLocaleString("en-IN")} was withdrawn from your wallet by Customer Service. Reason: ${note}`,
        isRead: 0,
      });
      const after = await computeSellerFinance(db, args.sellerId);
      ctx.invalidateQueries();
      return { ok: true, error: null, id: inserted[0]!.id, newBalance: after.availableBalance };
    },
  }),

  adminDeleteAccount: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), userId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), role: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can delete accounts.", role: "" };
      if (args.adminId === args.userId) return { ok: false, error: "You cannot delete your own admin account.", role: "" };
      const target = await db.select().from(schema.users).where(eq(schema.users.id, args.userId)).limit(1);
      if (!target[0]) return { ok: false, error: "Account not found. It may already be deleted.", role: "" };
      if (target[0].role === "admin") return { ok: false, error: "Admin accounts cannot be deleted from here.", role: "" };
      const u = target[0];
      // Rows that reference users.id MUST go before the user row itself:
      // deleting the user first throws an FK violation and the whole
      // delete fails. This is exactly why Admin deletes stopped working
      // after login sessions, wallet events and notices were added —
      // the handler never cleaned them (and sessions were only cleared
      // AFTER the user delete, i.e. too late).
      await invalidateUserSessions(db, u.id);
      // Blob keys owned by this account (documents/photo/logo + chat
      // attachments + wallet screenshots) are collected BEFORE the rows
      // go, then deleted after: order payment proofs are NOT deleted —
      // orders stay as money history and keep their proof references.
      const ownBlobKeys: string[] = [];
      for (const k of [u.photoBlobKey, u.storeLogoBlobKey, u.docFrontBlobKey, u.docBackBlobKey]) if (k) ownBlobKeys.push(k);
      {
        const chats = await db.select({ attachmentBlobKey: schema.chatMessages.attachmentBlobKey }).from(schema.chatMessages).where(eq(schema.chatMessages.userId, u.id));
        for (const c of chats) if (c.attachmentBlobKey) ownBlobKeys.push(c.attachmentBlobKey);
        const shots = await db.select({ screenshotBlobKey: schema.walletTransactions.screenshotBlobKey }).from(schema.walletTransactions).where(eq(schema.walletTransactions.sellerId, u.id));
        for (const s of shots) if (s.screenshotBlobKey) ownBlobKeys.push(s.screenshotBlobKey);
      }
      await db.delete(schema.passwordResetRequests).where(eq(schema.passwordResetRequests.userId, u.id));
      await db.delete(schema.googleLoginCodes).where(eq(schema.googleLoginCodes.userId, u.id));
      let walletBal = 0;
      if (u.role === "seller") {
        const f = await computeSellerFinance(db, u.id);
        walletBal = f.availableBalance;
        // Snapshot seller name/store onto every order attributed to
        // this seller at order time BEFORE removing picks/records, so
        // the Admin order history keeps naming the right shop.
        const picks = await db.select().from(schema.sellerProducts).where(eq(schema.sellerProducts.sellerId, u.id));
        const myIds = new Set(picks.map((x) => x.productId));
        const attr = await loadOrderAttribution(db);
        {
          const allOrders = await db.select().from(schema.orders);
          for (const o of allOrders) {
            const attrIds = attributedProductIds(attr, o.id, u.id, myIds, o.sellerId);
            if (attrIds.size === 0) continue;
            const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, o.id));
            if (!items.some((it) => attrIds.has(it.productId))) continue;
            try { await db.insert(schema.orderSellerSnapshots).values({ orderId: o.id, sellerIdOriginal: u.id, sellerName: u.name, storeName: u.storeName ?? "" }); } catch (e) { if (!String(e).includes("UNIQUE")) throw e; }
          }
        }
        await db.insert(schema.deletedAccounts).values({ originalUserId: u.id, name: u.name, storeName: u.storeName, email: u.email, phone: u.phone, role: u.role, walletBalance: walletBal });
        await db.delete(schema.sellerProducts).where(eq(schema.sellerProducts.sellerId, u.id));
        await db.delete(schema.walletTransactions).where(eq(schema.walletTransactions.sellerId, u.id));
        await db.delete(schema.sellerNotifications).where(eq(schema.sellerNotifications.sellerId, u.id));
        await db.delete(schema.sellerWalletEvents).where(eq(schema.sellerWalletEvents.sellerId, u.id));
        await db.delete(schema.sellerNotices).where(eq(schema.sellerNotices.sellerId, u.id));
        await db.delete(schema.chatMessages).where(eq(schema.chatMessages.userId, u.id));
        await db.delete(schema.cartItems).where(eq(schema.cartItems.buyerId, u.id));
        await db.update(schema.tickets).set({ userId: null }).where(eq(schema.tickets.userId, u.id));
        // Orders STAY for money history (snapshotted above); only the
        // live seller link is nulled so the user row can go. The Admin
        // order view resolves the shop from the snapshot and flags the
        // order sellerDeleted.
        await db.update(schema.orders).set({ sellerId: null }).where(eq(schema.orders.sellerId, u.id));
        await db.delete(schema.users).where(eq(schema.users.id, u.id));
        for (const k of ownBlobKeys) await ctx.blobs.delete(k);
      } else {
        // Buyer: reassign orders to placeholder so order history + FK stay intact; order rows keep customerName/phone recorded at order time
        await db.insert(schema.deletedAccounts).values({ originalUserId: u.id, name: u.name, storeName: u.storeName, email: u.email, phone: u.phone, role: u.role, walletBalance: 0 });
        let ph = await db.select().from(schema.users).where(eq(schema.users.email, "deleted-placeholder@system.local")).limit(1);
        if (!ph[0]) { const ins = await db.insert(schema.users).values({ name: "Deleted Account", email: "deleted-placeholder@system.local", password: await hashPassword("deleted-no-login-" + Math.random().toString(36).slice(2) + Date.now().toString(36)), role: "buyer" }).returning(); ph = ins; }
        await db.update(schema.orders).set({ buyerId: ph[0]!.id }).where(eq(schema.orders.buyerId, u.id));
        await db.delete(schema.cartItems).where(eq(schema.cartItems.buyerId, u.id));
        await db.delete(schema.chatMessages).where(eq(schema.chatMessages.userId, u.id));
        // A buyer who reviewed products blocks the delete the same way
        // (productReviews.buyerId references users.id); account deletion
        // removes their reviews with the account.
        await db.delete(schema.productReviews).where(eq(schema.productReviews.buyerId, u.id));
        await db.update(schema.tickets).set({ userId: null }).where(eq(schema.tickets.userId, u.id));
        await db.delete(schema.users).where(eq(schema.users.id, u.id));
        for (const k of ownBlobKeys) await ctx.blobs.delete(k);
      }
      ctx.invalidateQueries();
      return { ok: true, error: null, role: u.role };
    },
  }),

  // --- Admin Accounts management (Gmail change / add admin / password) ---
  // PROTECTED OWNER ACCOUNT: exactly one — the FIRST admin ever created (lowest
  // admin id). It can never be removed and its role can never be taken
  // away; a Gmail change by itself (with its own current password) keeps
  // the same account/id, so it stays Protected under the new Gmail.
  // Every sensitive change verifies the CURRENT password ON THE BACKEND:
  // changing your Gmail/password needs YOUR current password; creating
  // another admin needs the CREATING admin's current password. The ONE
  // exception: the Protected owner account may reset a REGULAR admin's password
  // and remove a regular admin — authorized by the Protected owner account's OWN
  // current password. Regular admins have neither power (backend refuses).
  listAdminAccounts: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({
      viewerCanManageOthers: z.boolean(),
      protectedAdminId: z.number().nullable(),
      admins: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          email: z.string().nullable(),
          createdAt: z.string(),
          isProtected: z.boolean(),
          createdByEmail: z.string().nullable(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") throw new Error("Only the admin can view admin accounts.");
      const rows = await db.select().from(schema.users).where(eq(schema.users.role, "admin")).orderBy(asc(schema.users.id));
      // Never expose the internal deleted-placeholder account.
      const visible = rows.filter((r) => r.email !== "deleted-placeholder@system.local");
      const protectedAdminId = visible[0]?.id ?? null;
      return {
        viewerCanManageOthers: protectedAdminId !== null && protectedAdminId === args.adminId,
        protectedAdminId,
        admins: visible.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          createdAt: r.createdAt.toISOString(),
          isProtected: r.id === protectedAdminId,
          createdByEmail: r.adminCreatedByEmail ?? null,
        })),
      };
    },
  }),

  adminChangeOwnEmail: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      newEmail: z.string().max(120),
      currentPassword: z.string().max(100),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      newEmail: z.string().nullable(),
      user: userOut.nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") {
        return { ok: false, error: "Only a signed-in admin can change the admin Gmail.", newEmail: null, user: null };
      }
      const currentPassword = args.currentPassword ?? "";
      if (!currentPassword) {
        return { ok: false, error: "Current Password is required — please enter your current password to change your Gmail.", newEmail: null, user: null };
      }
      if (!(await verifyPassword(currentPassword, me[0].password))) {
        return { ok: false, error: "Current Password is wrong — the Gmail was not changed. Please enter the password for this admin account.", newEmail: null, user: null };
      }
      const newEmail = (args.newEmail ?? "").trim().toLowerCase();
      if (!newEmail || !isValidEmail(newEmail)) {
        return { ok: false, error: "New Gmail looks wrong — please enter a valid Gmail/email address like name@gmail.com.", newEmail: null, user: null };
      }
      if (me[0].email && me[0].email.toLowerCase() === newEmail) {
        return { ok: false, error: "This is already your current Gmail. Please enter a different new Gmail.", newEmail: null, user: null };
      }
      const dupe = await db.select().from(schema.users).where(eq(schema.users.email, newEmail)).limit(1);
      if (dupe[0]) {
        return { ok: false, error: "This Gmail is already used by another account. Please use a different Gmail.", newEmail: null, user: null };
      }
      const updated = await db.update(schema.users).set({ email: newEmail }).where(eq(schema.users.id, args.adminId)).returning();
      ctx.invalidateQueries();
      return { ok: true, error: null, newEmail, user: updated[0] ? toUserOut(updated[0]) : null };
    },
  }),

  adminCreateAdditionalAdmin: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      creatorPassword: z.string().max(100),
      name: z.string().max(80),
      email: z.string().max(120),
      password: z.string().min(8).max(100),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      user: userOut.nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") {
        return { ok: false, error: "Only a signed-in admin can add another admin account.", user: null };
      }
      if (!args.creatorPassword) {
        return { ok: false, error: "Your Current Password (creating admin) is required — please enter your own password to authorize creating a new admin.", user: null };
      }
      if (!(await verifyPassword(args.creatorPassword, me[0].password))) {
        return { ok: false, error: "Your Current Password is wrong — the new admin was not created. Please enter the password for your own admin account.", user: null };
      }
      const name = (args.name ?? "").trim();
      if (name.length < 2) {
        return { ok: false, error: "New Admin Name is missing — please enter the new admin's full name (at least 2 letters).", user: null };
      }
      const email = (args.email ?? "").trim().toLowerCase();
      if (!email || !isValidEmail(email)) {
        return { ok: false, error: "New Admin Gmail looks wrong — please enter a valid Gmail/email address like name@gmail.com.", user: null };
      }
      if (!args.password || args.password.length < 8) {
        return { ok: false, error: "New Admin Password is too short — please use at least 8 characters.", user: null };
      }
      const dupe = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
      if (dupe[0]) {
        return { ok: false, error: "This Gmail is already used by another account. Please use a different Gmail for the new admin.", user: null };
      }
      const inserted = await db.insert(schema.users).values({ name, email, password: await hashPassword(args.password), role: "admin", adminCreatedById: me[0].id, adminCreatedByEmail: me[0].email ?? null }).returning();
      ctx.invalidateQueries();
      return { ok: true, error: null, user: inserted[0] ? toUserOut(inserted[0]) : null };
    },
  }),

  adminChangeOwnPassword: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      currentPassword: z.string().max(100),
      newPassword: z.string().max(100),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") {
        return { ok: false, error: "Only a signed-in admin can change the admin password." };
      }
      if (!args.currentPassword) {
        return { ok: false, error: "Current Password is required — please enter the current password for this admin account." };
      }
      // The password being changed must belong to THIS account: verify the
      // entered current password against this admin's own stored password.
      if (!(await verifyPassword(args.currentPassword, me[0].password))) {
        return { ok: false, error: "Current Password is wrong — the password was not changed. Please enter the current password for this Gmail's account." };
      }
      if (!args.newPassword || args.newPassword.length < 8) {
        return { ok: false, error: "New Password is too short — please use at least 8 characters." };
      }
      if (args.newPassword === args.currentPassword) {
        return { ok: false, error: "New Password is the same as the current password. Please choose a different new password." };
      }
      await db.update(schema.users).set({ password: await hashPassword(args.newPassword) }).where(eq(schema.users.id, args.adminId));
      await invalidateUserSessions(db, args.adminId, ctx.auth?.tokenHash ?? null);
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Reset ANOTHER admin's password. Backend-only permission: only the
  // first-created admin account may do this, authorized by ITS OWN current
  // password. The protected first account itself can never be reset here,
  // and no other admin may use this at all. Messages stay plain.
  adminResetAdminPassword: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      targetAdminId: z.number(),
      actorPassword: z.string().max(100),
      newPassword: z.string().max(100),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this." };
      const rows = await db.select().from(schema.users).where(eq(schema.users.role, "admin")).orderBy(asc(schema.users.id));
      const visible = rows.filter((r) => r.email !== "deleted-placeholder@system.local");
      const protectedId = visible[0]?.id ?? null;
      if (protectedId === null || args.adminId !== protectedId) return { ok: false, error: "You do not have permission to do this." };
      if (args.targetAdminId === protectedId || args.targetAdminId === args.adminId) return { ok: false, error: "This admin account's password cannot be reset this way. Use Change My Password with its own current password instead." };
      const target = visible.find((r) => r.id === args.targetAdminId);
      if (!target) return { ok: false, error: "Admin account not found. It may already have been removed." };
      if (!args.actorPassword) return { ok: false, error: "Your Current Password is required — please enter your own password to authorize this reset." };
      if (!(await verifyPassword(args.actorPassword, me[0].password))) return { ok: false, error: "Your Current Password is wrong — the password was not reset. Please enter the password for your own admin account." };
      if (!args.newPassword || args.newPassword.length < 8) return { ok: false, error: "New Password is too short — please use at least 8 characters." };
      await db.update(schema.users).set({ password: await hashPassword(args.newPassword) }).where(eq(schema.users.id, args.targetAdminId));
      await invalidateUserSessions(db, args.targetAdminId);
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Remove ANOTHER admin account. Same backend-only permission as above:
  // only the first-created admin account, authorized by its own current
  // password. That account itself can never be removed by anyone.
  adminRemoveAdmin: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      targetAdminId: z.number(),
      actorPassword: z.string().max(100),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this." };
      const rows = await db.select().from(schema.users).where(eq(schema.users.role, "admin")).orderBy(asc(schema.users.id));
      const visible = rows.filter((r) => r.email !== "deleted-placeholder@system.local");
      const protectedId = visible[0]?.id ?? null;
      if (protectedId === null || args.adminId !== protectedId) return { ok: false, error: "You do not have permission to do this." };
      if (args.targetAdminId === protectedId || args.targetAdminId === args.adminId) return { ok: false, error: "This admin account cannot be removed." };
      const target = visible.find((r) => r.id === args.targetAdminId);
      if (!target) return { ok: false, error: "Admin account not found. It may already have been removed." };
      if (!args.actorPassword) return { ok: false, error: "Your Current Password is required — please enter your own password to authorize removing this admin." };
      if (!(await verifyPassword(args.actorPassword, me[0].password))) return { ok: false, error: "Your Current Password is wrong — the admin was not removed. Please enter the password for your own admin account." };
      await db.delete(schema.users).where(eq(schema.users.id, args.targetAdminId));
      await invalidateUserSessions(db, args.targetAdminId);
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // --- Forgot Password flow ---
  // Step 1 (public): identifier = Gmail OR mobile. ALWAYS returns the
  // same neutral ok, whether or not the account exists — it never reveals
  // account existence and never returns any password/hash. A request row
  // is created only when the account actually exists (and no pending
  // request for that account is already open).
  requestPasswordReset: defineAction({
    auth: "public",
    request: z.object({ identifier: z.string().max(120), storeName: z.string().max(120).optional(), lang: z.enum(["en", "hi", "ar"]).optional() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const identifier = (args.identifier ?? "").trim();
      const enteredStore = (args.storeName ?? "").trim();
      if (identifier) {
        let u: UserRow | undefined;
        if (identifier.includes("@")) {
          const rows = await db.select().from(schema.users).where(eq(schema.users.email, identifier.toLowerCase())).limit(1);
          u = rows[0];
        } else {
          const candidates = phoneCandidates(identifier);
          if (candidates.length > 0) u = await findUserByPhone(db, candidates);
        }
        if (u && u.email !== "deleted-placeholder@system.local") {
          // (a) Auto-message into that client's live-chat thread with
          // Customer Service / Admin — the client never types it. The
          // "Password Reset Request" prefix marks it in the chat list.
          const storePartEn = enteredStore ? ` Store Name: ${enteredStore}.` : "";
          const storePartHi = enteredStore ? ` Store Name: ${enteredStore}।` : "";
          const storePartAr = enteredStore ? ` اسم المتجر: ${enteredStore}.` : "";
          const autoMsg = args.lang === "hi"
            ? `Password Reset Request — मैं अपना पासवर्ड भूल गया हूँ। Login ID: ${identifier}।${storePartHi} कृपया मेरा पासवर्ड रीसेट करें।`
            : args.lang === "ar"
              ? `Password Reset Request — نسيت كلمة المرور الخاصة بي. معرّف تسجيل الدخول: ${identifier}.${storePartAr} يرجى إعادة تعيين كلمة المرور الخاصة بي.`
              : `Password Reset Request — I forgot my password. Login ID: ${identifier}.${storePartEn} Please reset my password.`;
          await db.insert(schema.chatMessages).values({ userId: u.id, sender: "customer", message: autoMsg });
          // (b) Password Reset Request record for the Admin Panel (only
          // when no pending request for this account is already open).
          const pending = await db.select().from(schema.passwordResetRequests).where(and(eq(schema.passwordResetRequests.userId, u.id), eq(schema.passwordResetRequests.status, "pending"))).limit(1);
          if (!pending[0]) {
            await db.insert(schema.passwordResetRequests).values({ userId: u.id, accountRole: u.role, storeName: enteredStore, name: u.name, email: u.email, phone: u.phone, status: "pending" });
          }
        }
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // Step 2 (Admin): list requests. Name/Gmail/mobile/role/time/status only
  // — never any password data.
  listPasswordResetRequests: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({
      viewerCanManageOthers: z.boolean(),
      requests: z.array(z.object({
        id: z.number(), userId: z.number(), accountRole: z.string(), name: z.string(),
        email: z.string().nullable(), phone: z.string().nullable(), status: z.string(), createdAt: z.string(),
        storeNameEntered: z.string(), accountStoreName: z.string().nullable(),
      })),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") throw new Error("Only the admin can view password reset requests.");
      const admins = await db.select().from(schema.users).where(eq(schema.users.role, "admin")).orderBy(asc(schema.users.id));
      const visibleAdmins = admins.filter((r) => r.email !== "deleted-placeholder@system.local");
      const protectedId = visibleAdmins[0]?.id ?? null;
      const rows = await db.select().from(schema.passwordResetRequests).orderBy(desc(schema.passwordResetRequests.id));
      return {
        viewerCanManageOthers: protectedId !== null && protectedId === args.adminId,
        requests: await Promise.all(rows.map(async (r) => {
          const acct = await db.select({ storeName: schema.users.storeName }).from(schema.users).where(eq(schema.users.id, r.userId)).limit(1);
          return { id: r.id, userId: r.userId, accountRole: r.accountRole, name: r.name, email: r.email, phone: r.phone, status: r.status, createdAt: r.createdAt.toISOString(), storeNameEntered: r.storeName ?? "", accountStoreName: acct[0]?.storeName ?? null };
        })),
      };
    },
  }),

  // Admin completes a reset: sets a NEW password chosen by the Admin
  // (stored hashed, never displayed back) and marks the request completed.
  // For ADMIN-account requests, only the first-created admin account may
  // do this (backend check); buyer/seller requests may be completed by
  // any signed-in admin.
  adminCompletePasswordReset: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), requestId: z.number(), newPassword: z.string().max(100) }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this." };
      const reqRows = await db.select().from(schema.passwordResetRequests).where(eq(schema.passwordResetRequests.id, args.requestId)).limit(1);
      if (!reqRows[0]) return { ok: false, error: "Reset request not found. It may already have been completed." };
      if (reqRows[0].status !== "pending") return { ok: false, error: "This reset request is already completed." };
      if (reqRows[0].accountRole === "admin") {
        const admins = await db.select().from(schema.users).where(eq(schema.users.role, "admin")).orderBy(asc(schema.users.id));
        const visibleAdmins = admins.filter((r) => r.email !== "deleted-placeholder@system.local");
        const protectedId = visibleAdmins[0]?.id ?? null;
        if (protectedId === null || args.adminId !== protectedId) return { ok: false, error: "You do not have permission to do this." };
      }
      if (!args.newPassword || args.newPassword.length < 8) return { ok: false, error: "New Password is too short — please use at least 8 characters." };
      const target = await db.select().from(schema.users).where(eq(schema.users.id, reqRows[0].userId)).limit(1);
      if (!target[0]) return { ok: false, error: "Account not found. It may have been removed." };
      await db.update(schema.users).set({ password: await hashPassword(args.newPassword), mustChangePassword: 1 }).where(eq(schema.users.id, reqRows[0].userId));
      await invalidateUserSessions(db, reqRows[0].userId);
      await db.update(schema.passwordResetRequests).set({ status: "completed", completedByAdminId: args.adminId, completedAt: new Date() }).where(eq(schema.passwordResetRequests.id, args.requestId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Self-service change password for ANY signed-in account (buyer, seller
  // or admin): the account's OWN current password is required and verified
  // on the backend; the new password is stored hashed only.
  adminSetUserPassword: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), userId: z.number(), newPassword: z.string().max(100), confirmPassword: z.string().max(100) }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), accountName: z.string().nullable(), loginId: z.string().nullable() }),
    async handler(ctx, args): Promise<{ ok: boolean; error: string | null; accountName: string | null; loginId: string | null }> {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only an Admin can set a customer password.", accountName: null, loginId: null };
      const actor = me[0];
      if (args.newPassword.length < 8) return { ok: false, error: "New Password must be at least 8 characters.", accountName: null, loginId: null };
      if (args.newPassword !== args.confirmPassword) return { ok: false, error: "New Password and Confirm Password do not match.", accountName: null, loginId: null };
      const rows = await db.select().from(schema.users).where(eq(schema.users.id, args.userId)).limit(1);
      const target = rows[0];
      if (!target) return { ok: false, error: "Account not found.", accountName: null, loginId: null };
      if (target.role === "admin") return { ok: false, error: "Admin passwords are managed from Settings → Admin Accounts.", accountName: null, loginId: null };
      await db.update(schema.users).set({ password: await hashPassword(args.newPassword), mustChangePassword: 1 }).where(eq(schema.users.id, target.id));
      await invalidateUserSessions(db, target.id);
      await db.update(schema.passwordResetRequests).set({ status: "completed", completedByAdminId: actor.id, completedAt: new Date() }).where(and(eq(schema.passwordResetRequests.userId, target.id), eq(schema.passwordResetRequests.status, "pending")));
      ctx.invalidateQueries();
      return { ok: true, error: null, accountName: target.name, loginId: target.email ?? (target.phone ? phoneDisplay(target.phone, target.country) : "") };
    },
  }),

  changeMyPassword: defineAction({
    auth: { arg: "userId" },
    request: z.object({ userId: z.number(), currentPassword: z.string().max(100), newPassword: z.string().max(100) }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.userId)).limit(1);
      if (!me[0]) return { ok: false, error: "Account not found. Please sign in again." };
      if (me[0].email === "deleted-placeholder@system.local") return { ok: false, error: "You do not have permission to do this." };
      if (!args.currentPassword) return { ok: false, error: "Current Password is required — please enter your current password." };
      if (!(await verifyPassword(args.currentPassword, me[0].password))) return { ok: false, error: "Current Password is wrong — the password was not changed. Please enter the current password for your account." };
      if (!args.newPassword || args.newPassword.length < 8) return { ok: false, error: "New Password is too short — please use at least 8 characters." };
      if (await verifyPassword(args.newPassword, me[0].password)) return { ok: false, error: "New Password is the same as the current password. Please choose a different new password." };
      await db.update(schema.users).set({ password: await hashPassword(args.newPassword), mustChangePassword: 0 }).where(eq(schema.users.id, args.userId));
      await invalidateUserSessions(db, args.userId, ctx.auth?.tokenHash ?? null);
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // --- Bulk Profit % (Admin → Products) ---
  // Preview and Apply share the same scope/mode validation. Preview never
  // writes; Apply updates products.profit_percent (the single stored value
  // that drives shop prices, seller profit and USD conversion). Past orders
  // are untouched — order_items already snapshot profit at order time.
  previewBulkProfit: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: bulkRequestSchema,
    response: bulkPreviewResponse,
    async handler(ctx, args): Promise<z.infer<typeof bulkPreviewResponse>> {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can change profit %. Sign in with an admin account.", count: 0, summary: "", samples: [] };
      const verr = bulkValidate(args);
      if (verr) return { ok: false, error: verr, count: 0, summary: "", samples: [] };
      const all = await db.select().from(schema.products).orderBy(asc(schema.products.category), asc(schema.products.name));
      const scoped = bulkFilterScope(all, args);
      type Sample = z.infer<typeof bulkSampleOut>;
      const samples: Sample[] = [];
      let count = 0;
      for (const p of scoped) {
        const np = bulkNewPercent(p.basePrice, args);
        if (np === null) continue;
        count += 1;
        if (samples.length < 5) {
          samples.push({ id: p.id, name: p.name, category: p.category, basePrice: p.basePrice, oldPercent: p.profitPercent, newPercent: np, oldBuyerPrice: p.basePrice + profitOf(p.basePrice, p.profitPercent), newBuyerPrice: p.basePrice + profitOf(p.basePrice, np) });
        }
      }
      const summary = `${bulkScopeLabel(args)} · ${bulkModeLabel(args)} · ${bulkDetail(args)}`;
      return { ok: true, error: null, count, summary, samples };
    },
  }),

  applyBulkProfit: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: bulkRequestSchema,
    response: bulkApplyResponse,
    async handler(ctx, args): Promise<z.infer<typeof bulkApplyResponse>> {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "Only the admin can change profit %. Sign in with an admin account.", updatedCount: 0, summary: "" };
      const verr = bulkValidate(args);
      if (verr) return { ok: false, error: verr, updatedCount: 0, summary: "" };
      const all = await db.select().from(schema.products);
      const scoped = bulkFilterScope(all, args);
      let updated = 0;
      for (const p of scoped) {
        const np = bulkNewPercent(p.basePrice, args);
        if (np === null) continue;
        await db.update(schema.products).set({ profitPercent: np }).where(eq(schema.products.id, p.id));
        updated += 1;
      }
      const summary = `${bulkScopeLabel(args)} · ${bulkModeLabel(args)} · ${bulkDetail(args)}`;
      if (updated > 0) {
        try {
          await db.insert(schema.bulkProfitHistory).values({ adminId: args.adminId, scopeLabel: bulkScopeLabel(args), modeLabel: bulkModeLabel(args), detail: bulkDetail(args), affectedCount: updated });
        } catch { /* history table may not exist on very old DBs — update itself already succeeded */ }
      }
      ctx.invalidateQueries();
      return { ok: true, error: null, updatedCount: updated, summary };
    },
  }),

  getBulkProfitHistory: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({ history: z.array(bulkHistoryOut) }),
    async handler(ctx, args): Promise<{ history: z.infer<typeof bulkHistoryOut>[] }> {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { history: [] };
      try {
        const rows = await db.select().from(schema.bulkProfitHistory).orderBy(desc(schema.bulkProfitHistory.id)).limit(10);
        return { history: rows.map((r) => ({ id: r.id, scopeLabel: r.scopeLabel, modeLabel: r.modeLabel, detail: r.detail, affectedCount: r.affectedCount, createdAt: r.createdAt.toISOString() })) };
      } catch { return { history: [] }; }
    },
  }),

  // --- Admin: Seller Products list + one-click Quick Send Order ---
  // adminListSellerProducts returns EVERY product any seller has added to
  // their store (the seller_products rows) with the seller/store and the
  // product's current price figures, so the Admin sees all of them in one
  // place instead of opening each seller one by one.
  adminListSellerProducts: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({
      ok: z.boolean(),
      rows: z.array(
        z.object({
          id: z.number(),
          sellerId: z.number(),
          sellerName: z.string(),
          storeName: z.string().nullable(),
          productId: z.number(),
          productName: z.string(),
          category: z.string(),
          basePrice: z.number(),
          profitPercent: z.number(),
          profitAmount: z.number(),
          sellingPrice: z.number(),
          stock: z.number(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, rows: [] };
      const picks = await db.select().from(schema.sellerProducts).orderBy(desc(schema.sellerProducts.id));
      const rows = [];
      for (const pick of picks) {
        const seller = await db.select().from(schema.users).where(eq(schema.users.id, pick.sellerId)).limit(1);
        const prod = await db.select().from(schema.products).where(eq(schema.products.id, pick.productId)).limit(1);
        if (!prod[0]) continue;
        const profitAmount = profitOf(prod[0].basePrice, prod[0].profitPercent);
        rows.push({
          id: pick.id,
          sellerId: pick.sellerId,
          sellerName: seller[0]?.name ?? "Seller",
          storeName: seller[0]?.storeName ?? null,
          productId: prod[0].id,
          productName: prod[0].name,
          category: prod[0].category,
          basePrice: prod[0].basePrice,
          profitPercent: prod[0].profitPercent,
          profitAmount,
          sellingPrice: prod[0].basePrice + profitAmount,
          stock: prod[0].stock,
          createdAt: pick.createdAt.toISOString(),
        });
      }
      return { ok: true, rows };
    },
  }),

  // --- Admin New Activity: highlights for everything customers do ---
  // Events are derived live from the real records (orders, chat threads,
  // wallet requests, tickets, password reset requests). admin_activity_
  // marks only records what the Admin has seen/hidden — the underlying
  // records are never changed by seeing or hiding an entry.
  adminActivityFeed: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({
      ok: z.boolean(),
      events: z.array(
        z.object({
          kind: z.string(),
          refId: z.number(),
          userId: z.number().nullable(),
          customerRole: z.string(),
          customerName: z.string(),
          storeName: z.string().nullable(),
          loginId: z.string(),
          detail: z.string(),
          amount: z.number().nullable(),
          status: z.string(),
          createdAt: z.string(),
          isNew: z.boolean(),
        }),
      ),
      counts: z.object({ orders: z.number(), chats: z.number(), wallet: z.number(), tickets: z.number(), resets: z.number(), total: z.number() }),
      newOrderIds: z.array(z.number()),
      newWalletIds: z.array(z.number()),
      newTicketIds: z.array(z.number()),
      newResetIds: z.array(z.number()),
      newChatUserIds: z.array(z.number()),
    }),
    async handler(ctx, args) {
      const empty = { ok: false, events: [], counts: { orders: 0, chats: 0, wallet: 0, tickets: 0, resets: 0, total: 0 }, newOrderIds: [], newWalletIds: [], newTicketIds: [], newResetIds: [], newChatUserIds: [] };
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return empty;
      type Mark = { seen: number; hidden: number; seenUpto: number };
      const markMap = new Map<string, Mark>();
      try {
        const markRows = await db.select().from(schema.adminActivityMarks);
        for (const m of markRows) markMap.set(`${m.kind}:${m.refId}`, { seen: m.seen, hidden: m.hidden, seenUpto: m.seenUpto });
      } catch { /* marks table may not exist on very old DBs */ }
      const markOf = (kind: string, refId: number): Mark => markMap.get(`${kind}:${refId}`) ?? { seen: 0, hidden: 0, seenUpto: 0 };
      const userRows = await db.select().from(schema.users);
      const userById = new Map(userRows.map((u) => [u.id, u]));
      const loginOf = (u: (typeof userRows)[number] | undefined, fallback: string): string => u?.email ?? (u?.phone ? phoneDisplay(u.phone, u.country) : fallback);
      type Ev = { kind: string; refId: number; userId: number | null; customerRole: string; customerName: string; storeName: string | null; loginId: string; detail: string; amount: number | null; status: string; createdAt: string; isNew: boolean; sortAt: number };
      const events: Ev[] = [];
      const newOrderIds: number[] = [];
      const newWalletIds: number[] = [];
      const newTicketIds: number[] = [];
      const newResetIds: number[] = [];
      const newChatUserIds: number[] = [];
      // Orders (buyers)
      const orderRows = await db.select().from(schema.orders).orderBy(desc(schema.orders.id));
      for (const o of orderRows) {
        const mk = markOf("order", o.id);
        const isNew = mk.seen !== 1;
        if (isNew) newOrderIds.push(o.id);
        if (mk.hidden === 1) continue;
        const buyer = userById.get(o.buyerId);
        events.push({ kind: "order", refId: o.id, userId: o.buyerId, customerRole: "buyer", customerName: o.customerName, storeName: null, loginId: loginOf(buyer, o.phone), detail: `Order #${o.id}`, amount: o.total, status: o.status, createdAt: o.createdAt.toISOString(), isNew, sortAt: o.createdAt.getTime() });
      }
      // Live chat threads whose latest message is from the customer
      const chatRows = await db.select().from(schema.chatMessages).orderBy(asc(schema.chatMessages.id));
      const lastByUser = new Map<number, (typeof chatRows)[number]>();
      for (const m of chatRows) lastByUser.set(m.userId, m);
      for (const [uid, last] of lastByUser) {
        if (last.sender !== "customer") continue;
        const u = userById.get(uid);
        if (!u || u.email === "deleted-placeholder@system.local") continue;
        const mk = markOf("chat", uid);
        const isNew = last.id > mk.seenUpto;
        if (isNew) newChatUserIds.push(uid);
        if (mk.hidden === 1 && !isNew) continue;
        events.push({ kind: "chat", refId: uid, userId: uid, customerRole: u.role, customerName: u.name, storeName: u.storeName, loginId: loginOf(u, ""), detail: (last.message || (last.attachmentFileName ? `📎 ${last.attachmentFileName}` : "")).slice(0, 140), amount: null, status: "awaiting", createdAt: last.createdAt.toISOString(), isNew, sortAt: last.createdAt.getTime() });
      }
      // Wallet deposit / withdraw requests (sellers)
      const txRows = await db.select().from(schema.walletTransactions).orderBy(desc(schema.walletTransactions.id));
      for (const tx of txRows) {
        if (tx.type === "admin_credit" || tx.type === "admin_withdraw") continue;
        const mk = markOf("wallet", tx.id);
        const isNew = mk.seen !== 1;
        if (isNew) newWalletIds.push(tx.id);
        if (mk.hidden === 1) continue;
        const seller = userById.get(tx.sellerId);
        events.push({ kind: "wallet", refId: tx.id, userId: tx.sellerId, customerRole: "seller", customerName: seller?.name ?? "Seller", storeName: seller?.storeName ?? null, loginId: loginOf(seller, ""), detail: tx.type === "order_payment" ? `Order payment · ${tx.reference}` : `${tx.type === "deposit" ? "Deposit" : "Withdraw"} request · ${tx.method}`, amount: tx.amount, status: tx.status, createdAt: tx.createdAt.toISOString(), isNew, sortAt: tx.createdAt.getTime() });
      }
      // Support tickets
      const ticketRows = await db.select().from(schema.tickets).orderBy(desc(schema.tickets.id));
      for (const tk of ticketRows) {
        const mk = markOf("ticket", tk.id);
        const isNew = mk.seen !== 1;
        if (isNew) newTicketIds.push(tk.id);
        if (mk.hidden === 1) continue;
        const u = tk.userId !== null ? userById.get(tk.userId) : undefined;
        events.push({ kind: "ticket", refId: tk.id, userId: tk.userId, customerRole: u?.role ?? "", customerName: tk.name, storeName: u?.storeName ?? null, loginId: tk.email, detail: tk.subject, amount: null, status: tk.status, createdAt: tk.createdAt.toISOString(), isNew, sortAt: tk.createdAt.getTime() });
      }
      // Password reset requests
      const resetRows = await db.select().from(schema.passwordResetRequests).orderBy(desc(schema.passwordResetRequests.id));
      for (const r of resetRows) {
        const mk = markOf("reset", r.id);
        const isNew = mk.seen !== 1;
        if (isNew) newResetIds.push(r.id);
        if (mk.hidden === 1) continue;
        const u = userById.get(r.userId);
        events.push({ kind: "reset", refId: r.id, userId: r.userId, customerRole: r.accountRole, customerName: r.name, storeName: r.storeName || u?.storeName || null, loginId: r.email ?? (r.phone ? phoneDisplay(r.phone, u?.country) : loginOf(u, "")), detail: "Password reset request", amount: null, status: r.status, createdAt: r.createdAt.toISOString(), isNew, sortAt: r.createdAt.getTime() });
      }
      events.sort((a, b) => b.sortAt - a.sortAt);
      const counts = { orders: newOrderIds.length, chats: newChatUserIds.length, wallet: newWalletIds.length, tickets: newTicketIds.length, resets: newResetIds.length, total: newOrderIds.length + newChatUserIds.length + newWalletIds.length + newTicketIds.length + newResetIds.length };
      return {
        ok: true,
        events: events.slice(0, 40).map(({ sortAt: _sortAt, ...rest }) => rest),
        counts,
        newOrderIds, newWalletIds, newTicketIds, newResetIds, newChatUserIds,
      };
    },
  }),

  // Mark one activity item as seen (highlight/count clears; record stays).
  adminMarkActivitySeen: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), kind: z.string().max(20), refId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this." };
      let seenUpto = 0;
      if (args.kind === "chat") {
        const msgs = await db.select({ id: schema.chatMessages.id }).from(schema.chatMessages).where(eq(schema.chatMessages.userId, args.refId)).orderBy(desc(schema.chatMessages.id)).limit(1);
        seenUpto = msgs[0]?.id ?? 0;
      }
      const existing = await db.select().from(schema.adminActivityMarks).where(and(eq(schema.adminActivityMarks.kind, args.kind), eq(schema.adminActivityMarks.refId, args.refId))).limit(1);
      if (existing[0]) {
        await db.update(schema.adminActivityMarks).set({ seen: 1, seenUpto: Math.max(existing[0].seenUpto, seenUpto) }).where(and(eq(schema.adminActivityMarks.kind, args.kind), eq(schema.adminActivityMarks.refId, args.refId)));
      } else {
        await db.insert(schema.adminActivityMarks).values({ kind: args.kind, refId: args.refId, seen: 1, hidden: 0, seenUpto });
      }
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Hide one entry from the New Activity list. The underlying record
  // (order, wallet request, ticket…) is NOT deleted — only the entry.
  adminDismissActivity: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), kind: z.string().max(20), refId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this." };
      // For chats the "seen" watermark is the newest message id: hiding
      // must record it too, otherwise the feed treats the same thread as
      // brand-new again on the next read and the entry pops back.
      let seenUpto = 0;
      if (args.kind === "chat") {
        const msgs = await db.select({ id: schema.chatMessages.id }).from(schema.chatMessages).where(eq(schema.chatMessages.userId, args.refId)).orderBy(desc(schema.chatMessages.id)).limit(1);
        seenUpto = msgs[0]?.id ?? 0;
      }
      const existing = await db.select().from(schema.adminActivityMarks).where(and(eq(schema.adminActivityMarks.kind, args.kind), eq(schema.adminActivityMarks.refId, args.refId))).limit(1);
      if (existing[0]) {
        await db.update(schema.adminActivityMarks).set({ seen: 1, hidden: 1, seenUpto: Math.max(existing[0].seenUpto, seenUpto) }).where(and(eq(schema.adminActivityMarks.kind, args.kind), eq(schema.adminActivityMarks.refId, args.refId)));
      } else {
        await db.insert(schema.adminActivityMarks).values({ kind: args.kind, refId: args.refId, seen: 1, hidden: 1, seenUpto });
      }
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Delete a customer's whole live-chat conversation (both sides see it
  // cleared; the customer can start a new chat afterwards).
  adminDeleteChatThread: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), userId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), deletedCount: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this.", deletedCount: 0 };
      const rows = await db.select({ id: schema.chatMessages.id, attachmentBlobKey: schema.chatMessages.attachmentBlobKey }).from(schema.chatMessages).where(eq(schema.chatMessages.userId, args.userId));
      await db.delete(schema.chatMessages).where(eq(schema.chatMessages.userId, args.userId));
      // The thread's attachments die with it: otherwise the blob bytes
      // stay reachable forever under their (signed, but once-issued)
      // URLs even though the owning rows are gone.
      for (const r of rows) {
        if (r.attachmentBlobKey) await ctx.blobs.delete(r.attachmentBlobKey);
      }
      // Clear the thread's activity entry as well.
      const existing = await db.select().from(schema.adminActivityMarks).where(and(eq(schema.adminActivityMarks.kind, "chat"), eq(schema.adminActivityMarks.refId, args.userId))).limit(1);
      if (existing[0]) {
        await db.update(schema.adminActivityMarks).set({ seen: 1, hidden: 1 }).where(and(eq(schema.adminActivityMarks.kind, "chat"), eq(schema.adminActivityMarks.refId, args.userId)));
      } else {
        await db.insert(schema.adminActivityMarks).values({ kind: "chat", refId: args.userId, seen: 1, hidden: 1, seenUpto: 0 });
      }
      ctx.invalidateQueries();
      return { ok: true, error: null, deletedCount: rows.length };
    },
  }),

  // Delete a support ticket (the ticket record itself).
  adminDeleteTicket: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), ticketId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this." };
      const rows = await db.select({ id: schema.tickets.id }).from(schema.tickets).where(eq(schema.tickets.id, args.ticketId)).limit(1);
      if (!rows[0]) return { ok: false, error: "Ticket not found. It may already have been deleted." };
      await db.delete(schema.tickets).where(eq(schema.tickets.id, args.ticketId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // --- Admin → Seller Accounts → seller detail: that seller's orders ---
  // The orders containing at least one of THIS seller's products, with
  // the seller's own figures per order (their sales share, their profit,
  // the payable product cost, whether they already paid it from their
  // wallet). Admin manages status right here with updateOrderStatus.
  adminGetSellerOrders: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), sellerId: z.number() }),
    response: z.object({
      ok: z.boolean(),
      orders: z.array(orderOut.extend({
        sellerAmount: z.number(),
        sellerProfit: z.number(),
        payableCost: z.number(),
        paidFromWallet: z.boolean(),
      })),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, orders: [] };
      const seller = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!seller[0] || seller[0].role !== "seller") return { ok: false, orders: [] };
      const f = await computeSellerFinance(db, args.sellerId);
      const finByOrder = new Map(f.orders.map((o) => [o.orderId, o]));
      const all = await db.select().from(schema.orders).orderBy(desc(schema.orders.id));
      const out = [];
      for (const o of all) {
        if (o.status === "Cancelled") continue;
        // Only orders attributed to this seller at order time (the same
        // set the wallet computes from) — an order must never show up
        // here with ₹0 figures just because the seller added one of its
        // products to their store later.
        const fin = finByOrder.get(o.id);
        if (!fin) continue;
        const base = await toOrderOut(db, o);
        out.push({
          ...base,
          sellerAmount: fin.orderAmount,
          sellerProfit: fin.profit,
          payableCost: fin.payableCost,
          paidFromWallet: fin.paidFromWallet,
        });
      }
      return { ok: true, orders: out };
    },
  }),

  // Admin → Seller Accounts → seller detail → Orders → Quick Send:
  // ONE click sends an order to THIS seller for ONE of their own added
  // products with just a quantity — no customer picker, no name / phone /
  // address form. The point is only that the seller sees a new incoming
  // order at their store ("a new order has arrived — complete it"), so the
  // order carries a system customer label. It is otherwise a real order:
  // same price / profit snapshot, stock decrement, seller notification,
  // status flow and wallet maths, with placedBy "admin".
  adminQuickSendSellerOrder: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      sellerId: z.number(),
      productId: z.number(),
      qty: z.number(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      orderId: z.number().nullable(),
      total: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const fail = (error: string) => ({ ok: false, error, orderId: null, total: 0 });
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return fail("You do not have permission to do this.");
      const seller = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!seller[0] || seller[0].role !== "seller") return fail("Seller not found — please open a seller account first.");
      const qty = Math.floor(args.qty);
      if (!Number.isFinite(qty) || qty < 1) return fail("Quantity must be at least 1.");
      if (qty > 99) return fail("Quantity is too large — please keep it at 99 or fewer.");
      const picks = await db.select().from(schema.sellerProducts).where(eq(schema.sellerProducts.sellerId, args.sellerId));
      if (!picks.some((p) => p.productId === args.productId)) return fail("This product is not in this seller's store — orders can only be sent for products the seller has added.");
      const p = await db.select().from(schema.products).where(eq(schema.products.id, args.productId)).limit(1);
      if (!p[0]) return fail("This product no longer exists — please refresh and try again.");
      const profitAmount = profitOf(p[0].basePrice, p[0].profitPercent);
      const buyerPrice = p[0].basePrice + profitAmount;
      const total = buyerPrice * qty;
      const inserted = await db
        .insert(schema.orders)
        .values({
          // The buyer slot holds the Admin's own account id only so the
          // order record stays valid; the visible customer label is the
          // system label below — no real customer is involved. The
          // seller slot names the ONE shop this order was sent to, so
          // every read (Admin shop grouping, seller Orders, wallet)
          // files it under that shop only.
          buyerId: args.adminId,
          sellerId: args.sellerId,
          customerName: "Order by Customer",
          phone: "",
          address: "",
          city: "",
          state: "",
          pinCode: "",
          paymentMethod: "Cash on Delivery",
          placedBy: "admin",
          total,
          status: "Pending",
        })
        .returning({ id: schema.orders.id });
      const orderId = inserted[0]!.id;
      const lines = [{ productId: p[0].id, qty, basePrice: p[0].basePrice, profitPercent: p[0].profitPercent, profitAmount, buyerPrice }];
      for (const line of lines) {
        await db.insert(schema.orderItems).values({ orderId, ...line });
        await db.update(schema.products).set({ stock: Math.max(0, p[0].stock - line.qty) }).where(eq(schema.products.id, line.productId));
      }
      // Attribute + notify ONLY the seller this order was sent to —
      // never every seller who carries the same product.
      await notifySellersOfOrder(db, orderId, lines, args.sellerId);
      ctx.invalidateQueries();
      return { ok: true, error: null, orderId, total };
    },
  }),

  // Admin sends a formal reminder NOTICE to a seller's account (per
  // pending order, or a general notice with orderId null). It appears in
  // the seller's notifications and as an alert banner on their dashboard
  // until that order is completed (or, for a general notice, dismissed).
  adminSendSellerNotice: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      sellerId: z.number(),
      orderId: z.number().nullable(),
      message: z.string().max(500),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), noticeId: z.number().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const fail = (error: string) => ({ ok: false, error, noticeId: null });
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return fail("You do not have permission to do this.");
      const seller = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!seller[0] || seller[0].role !== "seller") return fail("Seller not found — please open a seller account first.");
      const message = args.message.trim();
      if (message.length < 5) return fail("Notice message is too short — please write the notice message.");
      if (args.orderId !== null) {
        const ord = await db.select().from(schema.orders).where(eq(schema.orders.id, args.orderId)).limit(1);
        if (!ord[0]) return fail("Order not found — it may have been removed.");
      }
      const inserted = await db.insert(schema.sellerNotices).values({
        sellerId: args.sellerId,
        orderId: args.orderId,
        message,
        isRead: 0,
      }).returning({ id: schema.sellerNotices.id });
      ctx.invalidateQueries();
      return { ok: true, error: null, noticeId: inserted[0]!.id };
    },
  }),

  // The seller's active Admin notices: order notices stay active until
  // the seller SHIPS the order (Pending → Shipment — the seller has done
  // their part; Delivered/Cancelled also clear them); general notices
  // until dismissed.
  listSellerNotices: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number() }),
    response: z.object({
      notices: z.array(z.object({
        id: z.number(),
        orderId: z.number().nullable(),
        message: z.string(),
        orderStatus: z.string().nullable(),
        createdAt: z.string(),
      })),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const seller = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!seller[0] || seller[0].role !== "seller") return { notices: [] };
      const rows = await db.select().from(schema.sellerNotices)
        .where(eq(schema.sellerNotices.sellerId, args.sellerId))
        .orderBy(desc(schema.sellerNotices.id))
        .limit(20);
      const out = [];
      for (const n of rows) {
        if (n.orderId !== null) {
          const ord = await db.select().from(schema.orders).where(eq(schema.orders.id, n.orderId)).limit(1);
          const status = ord[0]?.status ?? null;
          if (!ord[0] || status === "Shipped" || status === "Delivered" || status === "Cancelled") continue;
          out.push({ id: n.id, orderId: n.orderId, message: n.message, orderStatus: status, createdAt: n.createdAt.toISOString() });
        } else {
          if (n.isRead === 1) continue;
          out.push({ id: n.id, orderId: null, message: n.message, orderStatus: null, createdAt: n.createdAt.toISOString() });
        }
      }
      return { notices: out };
    },
  }),

  // Dismiss a general (non-order) Admin notice. Order notices cannot be
  // dismissed — they clear once the seller ships the order.
  dismissSellerNotice: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number(), noticeId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.sellerNotices).where(eq(schema.sellerNotices.id, args.noticeId)).limit(1);
      if (!rows[0] || rows[0].sellerId !== args.sellerId) return { ok: false, error: "Notice not found." };
      if (rows[0].orderId !== null) return { ok: false, error: "This notice is about an order — it clears once you ship the order." };
      await db.update(schema.sellerNotices).set({ isRead: 1 }).where(eq(schema.sellerNotices.id, args.noticeId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Seller: pay an order's product cost from the wallet balance and
  // SHIP the order in one step — Pending → Shipment. The order is NOT
  // completed yet: it waits in Shipment for Admin approval, and only the
  // Admin's Approve (adminReviewShippedOrder / updateOrderStatus to
  // Delivered) moves it to Completed. The payable amount is the base
  // (product) cost of THIS seller's items in the order, read from the
  // same finance computation the wallet shows. Insufficient balance
  // refuses with both amounts and changes nothing.
  sellerPayOrderFromWallet: defineAction({
    auth: { arg: "sellerId" },
    request: z.object({ sellerId: z.number(), orderId: z.number() }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      paidAmount: z.number(),
      newBalance: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const fail = (error: string) => ({ ok: false, error, paidAmount: 0, newBalance: 0 });
      const seller = await db.select().from(schema.users).where(eq(schema.users.id, args.sellerId)).limit(1);
      if (!seller[0] || seller[0].role !== "seller") return fail("Only seller accounts have a wallet.");
      if (seller[0].verificationStatus === "rejected") return fail("Your seller application was not approved. Please contact support before using the wallet.");
      const ord = await db.select().from(schema.orders).where(eq(schema.orders.id, args.orderId)).limit(1);
      if (!ord[0]) return fail("Order not found — it may have been removed.");
      if (ord[0].status === "Delivered") return fail(`Order #${args.orderId} is already completed (Delivered).`);
      if (ord[0].status === "Shipped") return fail(`Order #${args.orderId} is already shipped — it is in Shipment, waiting for Customer Service approval.`);
      if (ord[0].status === "Cancelled") return fail(`Order #${args.orderId} was cancelled — it cannot be shipped.`);
      if (ord[0].paymentStatus === "pending") return fail(`Order #${args.orderId} is still waiting for its payment to be verified by Customer Service — it cannot be shipped yet.`);
      const f = await computeSellerFinance(db, args.sellerId);
      const fin = f.orders.find((o) => o.orderId === args.orderId);
      if (!fin) return fail(`Order #${args.orderId} does not contain any of your store's products.`);
      const payable = fin.payableCost;
      // Shipping holds the order cost: Available → Pending. The balance
      // check applies on EVERY ship (a returned order's hold was
      // released back to Available, and that money may have been spent
      // since). If the Admin returned this order after a first ship, the
      // wallet payment row already exists — re-shipping holds the SAME
      // payment again and must not create a second charge.
      let charged = 0;
      if (payable > 0) {
        if (f.availableBalance < payable) {
          return fail(`Not enough wallet balance for Order #${args.orderId}: this order needs ₹${payable.toLocaleString("en-IN")} but your available balance is ₹${f.availableBalance.toLocaleString("en-IN")}. Please add money to your wallet first (deposit) and try again.`);
        }
      }
      if (payable > 0 && !fin.paidFromWallet) {
        await db.insert(schema.walletTransactions).values({
          sellerId: args.sellerId,
          type: "order_payment",
          amount: payable,
          method: "Wallet",
          reference: `Order #${args.orderId}`,
          note: `Order Payment — Order #${args.orderId}`,
          status: "completed",
        });
        charged = payable;
      }
      // Ship it: Pending → Shipment (waiting for Admin approval). The
      // seller has done their part, so this order's "new order"
      // highlight and any Admin reminder notice for it clear here.
      await db.update(schema.orders).set({ status: "Shipped" }).where(eq(schema.orders.id, args.orderId));
      await db
        .update(schema.sellerNotifications)
        .set({ isRead: 1 })
        .where(and(eq(schema.sellerNotifications.sellerId, args.sellerId), eq(schema.sellerNotifications.orderId, args.orderId)));
      const after = await computeSellerFinance(db, args.sellerId);
      ctx.invalidateQueries();
      return { ok: true, error: null, paidAmount: charged, newBalance: after.availableBalance };
    },
  }),

  // Delete a password reset request record (e.g. a handled or duplicate
  // request the Admin wants off the list). The customer's account and
  // password are not touched.
  adminDeletePasswordResetRequest: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), requestId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this." };
      const rows = await db.select({ id: schema.passwordResetRequests.id }).from(schema.passwordResetRequests).where(eq(schema.passwordResetRequests.id, args.requestId)).limit(1);
      if (!rows[0]) return { ok: false, error: "Reset request not found. It may already have been deleted." };
      await db.delete(schema.passwordResetRequests).where(eq(schema.passwordResetRequests.id, args.requestId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Seed the external-products section once (only when the table is
  // empty), with the real merchant listings above. Idempotent — later
  // Admin edits/deletes are never overwritten.
  seedExternalProducts: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({ seeded: z.boolean(), count: z.number() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      await getSettingsRow(db);
      const existing = await db.select({ id: schema.externalProducts.id }).from(schema.externalProducts).limit(1);
      if (existing.length > 0) {
        const all = await db.select({ id: schema.externalProducts.id }).from(schema.externalProducts);
        return { seeded: false, count: all.length };
      }
      await db.insert(schema.externalProducts).values(SEED_EXTERNAL_PRODUCTS);
      ctx.invalidateQueries();
      return { seeded: true, count: SEED_EXTERNAL_PRODUCTS.length };
    },
  }),

  // Visitor list for "Shop from Other Platforms". When the Admin has
  // switched the section OFF, no products are returned at all.
  listExternalProducts: defineAction({
    auth: "public",
    request: z.object({}),
    response: z.object({ enabled: z.boolean(), products: z.array(externalProductOut) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const s = await getSettingsRow(db);
      const enabled = (s.externalProductsEnabled ?? 1) === 1;
      if (!enabled) return { enabled: false, products: [] };
      const rows = await db.select().from(schema.externalProducts).orderBy(asc(schema.externalProducts.category), asc(schema.externalProducts.id));
      return { enabled: true, products: rows.map(toExternalProductOut) };
    },
  }),

  // Admin list: every external product plus the ON/OFF state, even
  // while the section is OFF (so the Admin can manage it).
  adminListExternalProducts: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), enabled: z.boolean(), products: z.array(externalProductOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this.", enabled: false, products: [] };
      const s = await getSettingsRow(db);
      const rows = await db.select().from(schema.externalProducts).orderBy(asc(schema.externalProducts.category), asc(schema.externalProducts.id));
      return { ok: true, error: null, enabled: (s.externalProductsEnabled ?? 1) === 1, products: rows.map(toExternalProductOut) };
    },
  }),

  // Admin add / edit one external product. Written validation names
  // every missing or wrong field; the URL must be a full http(s) link
  // and the price a positive number.
  adminUpsertExternalProduct: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({
      adminId: z.number(),
      id: z.number().nullable(),
      name: z.string().max(300),
      brand: z.string().max(120),
      category: z.string().max(60),
      priceInr: z.number().int().min(0).max(100000000),
      merchant: z.string().max(120),
      productUrl: z.string().max(2000),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), id: z.number().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this — only the Admin can manage external products.", id: null };
      const err = validateExternalProduct(args);
      if (err) return { ok: false, error: err, id: null };
      const values = {
        name: args.name.trim(),
        brand: args.brand.trim(),
        category: args.category.trim(),
        priceInr: args.priceInr,
        merchant: args.merchant.trim(),
        productUrl: args.productUrl.trim(),
      };
      if (args.id !== null) {
        const rows = await db.select({ id: schema.externalProducts.id }).from(schema.externalProducts).where(eq(schema.externalProducts.id, args.id)).limit(1);
        if (!rows[0]) return { ok: false, error: "This external product was not found — it may already have been deleted.", id: null };
        await db.update(schema.externalProducts).set(values).where(eq(schema.externalProducts.id, args.id));
        ctx.invalidateQueries();
        return { ok: true, error: null, id: args.id };
      }
      const inserted = await db.insert(schema.externalProducts).values(values).returning();
      ctx.invalidateQueries();
      return { ok: true, error: null, id: inserted[0]!.id };
    },
  }),

  adminDeleteExternalProduct: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), productId: z.number() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this — only the Admin can manage external products." };
      const rows = await db.select({ id: schema.externalProducts.id }).from(schema.externalProducts).where(eq(schema.externalProducts.id, args.productId)).limit(1);
      if (!rows[0]) return { ok: false, error: "This external product was not found — it may already have been deleted." };
      await db.delete(schema.externalProducts).where(eq(schema.externalProducts.id, args.productId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  // Admin ON/OFF switch for the whole external section. OFF hides it
  // from visitors entirely; the products themselves are kept.
  setExternalProductsEnabled: defineAction({
    auth: { arg: "adminId", role: "admin" },
    request: z.object({ adminId: z.number(), enabled: z.boolean() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), enabled: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await db.select().from(schema.users).where(eq(schema.users.id, args.adminId)).limit(1);
      if (!me[0] || me[0].role !== "admin") return { ok: false, error: "You do not have permission to do this — only the Admin can switch the external products section on or off.", enabled: false };
      await getSettingsRow(db);
      await db.update(schema.settings).set({ externalProductsEnabled: args.enabled ? 1 : 0 }).where(eq(schema.settings.id, 1));
      ctx.invalidateQueries();
      return { ok: true, error: null, enabled: args.enabled };
    },
  }),
} satisfies ActionsModule;
