// Standalone backend for the sheinstore marketplace (Render + Postgres).
// Serves the same 96 actions as the hosted version over plain HTTP:
//   GET  /            -> "sheinstore backend is running"
//   GET  /health      -> "ok"
//   POST /actions     -> { action, args } -> the action's response JSON
//   GET  /blobs/:key  -> uploaded file bytes (content-type preserved)
//   POST /seed        -> one-time full data import; refuses unless every
//                        data table is empty (prevents later abuse).
// Env: DATABASE_URL (Postgres), PORT, RENDER_EXTERNAL_URL (used to build
// absolute blob URLs; falls back to relative /blobs URLs when unset).
// Without DATABASE_URL the service still starts and answers health checks,
// but /actions returns 503 until the database is configured.
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { pbkdf2Sync, randomBytes, createHash } from "node:crypto";
import { Actions } from "./src/actions.pg";
import * as schema from "./src/schema.pg";
import type { Ctx } from "./src/space-shim";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

// DDL matching src/schema.pg.ts (CREATE TABLE IF NOT EXISTS; safe to run
// on every boot). Serial PKs for autoincrement ids; integer 0/1 columns
// stay integers (handlers use 0/1, not booleans); timestamps as timestamptz.
const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, password TEXT NOT NULL,
  role TEXT NOT NULL, store_name TEXT, phone TEXT, country TEXT,
  verification_status TEXT NOT NULL DEFAULT 'none', address TEXT, city TEXT, state TEXT,
  pin_code TEXT, date_of_birth TEXT, photo_file_name TEXT, store_description TEXT,
  store_logo_file_name TEXT, store_address TEXT, business_type TEXT, gst_number TEXT,
  doc_type TEXT, doc_number TEXT, doc_front_file_name TEXT, doc_back_file_name TEXT,
  photo_blob_key TEXT, photo_content_type TEXT, photo_size INTEGER,
  store_logo_blob_key TEXT, store_logo_content_type TEXT, store_logo_size INTEGER,
  doc_front_blob_key TEXT, doc_front_content_type TEXT, doc_front_size INTEGER,
  doc_back_blob_key TEXT, doc_back_content_type TEXT, doc_back_size INTEGER,
  admin_created_by_id INTEGER, admin_created_by_email TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', base_price INTEGER NOT NULL, old_price INTEGER,
  profit_percent INTEGER NOT NULL DEFAULT 20, stock INTEGER NOT NULL DEFAULT 50,
  image_asset TEXT, image_source_url TEXT, catalog_source TEXT NOT NULL DEFAULT 'curated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_name_unique UNIQUE (name)
);
CREATE TABLE IF NOT EXISTS seller_products (
  id SERIAL PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY, buyer_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id), qty INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY, buyer_id INTEGER NOT NULL REFERENCES users(id),
  seller_id INTEGER REFERENCES users(id), customer_name TEXT NOT NULL, phone TEXT NOT NULL,
  address TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL DEFAULT '',
  pin_code TEXT NOT NULL DEFAULT '', payment_method TEXT NOT NULL DEFAULT 'Cash on Delivery',
  payment_reference TEXT NOT NULL DEFAULT '', payment_proof_blob_key TEXT,
  payment_proof_file_name TEXT, payment_proof_content_type TEXT, payment_proof_size INTEGER,
  payment_status TEXT NOT NULL DEFAULT 'none', payment_reject_reason TEXT NOT NULL DEFAULT '',
  payment_verified_at TIMESTAMPTZ, placed_by TEXT NOT NULL DEFAULT 'customer',
  total INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id), qty INTEGER NOT NULL,
  base_price INTEGER NOT NULL, profit_percent INTEGER NOT NULL,
  profit_amount INTEGER NOT NULL, buyer_price INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), name TEXT NOT NULL,
  email TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open', reply TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), sender TEXT NOT NULL,
  message TEXT NOT NULL, attachment_blob_key TEXT, attachment_file_name TEXT,
  attachment_content_type TEXT, attachment_size INTEGER, is_read INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Existing databases created before the Support dot: add the column.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_read INTEGER NOT NULL DEFAULT 0;
-- One-time backfill guard: admin messages from before this feature
-- (cutoff 2026-10-28 06:00 UTC, set at authoring time, before the
-- deploy) are treated as already seen, so old threads never light a
-- dot. Messages after the cutoff are genuinely new and are never
-- touched by this statement on later boots.
UPDATE chat_messages SET is_read = 1 WHERE sender = 'admin' AND is_read = 0 AND created_at < '2026-10-28 06:00:00+00';
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id SERIAL PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES users(id), type TEXT NOT NULL,
  amount INTEGER NOT NULL, method TEXT NOT NULL DEFAULT '', reference TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
  payment_reference TEXT NOT NULL DEFAULT '', paid_at TIMESTAMPTZ,
  screenshot_blob_key TEXT, screenshot_file_name TEXT, screenshot_content_type TEXT,
  screenshot_size INTEGER, status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS seller_notifications (
  id SERIAL PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES users(id),
  order_id INTEGER NOT NULL REFERENCES orders(id), product_name TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL DEFAULT 0, is_read INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS seller_wallet_events (
  id SERIAL PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0,
  reference TEXT NOT NULL DEFAULT '', order_id INTEGER, tx_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY, store_name TEXT NOT NULL DEFAULT 'sheinstore',
  support_whatsapp TEXT NOT NULL DEFAULT '', support_email TEXT NOT NULL DEFAULT '',
  support_telegram TEXT NOT NULL DEFAULT '',
  default_profit_percent INTEGER NOT NULL DEFAULT 20, color_scheme TEXT NOT NULL DEFAULT 'navy',
  layout_design TEXT NOT NULL DEFAULT 'classic', usdt_deposit_address TEXT NOT NULL DEFAULT '',
  deposit_network TEXT NOT NULL DEFAULT 'BEP20 (BNB Smart Chain)',
  deposits_enabled INTEGER NOT NULL DEFAULT 1, local_deposit_note TEXT NOT NULL DEFAULT '',
  lang_hindi_enabled INTEGER NOT NULL DEFAULT 1, lang_arabic_enabled INTEGER NOT NULL DEFAULT 1,
  currency_inr_enabled INTEGER NOT NULL DEFAULT 1, currency_usd_enabled INTEGER NOT NULL DEFAULT 1,
  currency_usdt_enabled INTEGER NOT NULL DEFAULT 1, external_products_enabled INTEGER NOT NULL DEFAULT 1,
  payment_upi_enabled INTEGER NOT NULL DEFAULT 1, payment_bank_enabled INTEGER NOT NULL DEFAULT 1,
  payment_usdt_enabled INTEGER NOT NULL DEFAULT 1, last_price_sync_at TIMESTAMPTZ,
  last_price_sync_note TEXT NOT NULL DEFAULT '',
  header_logo_blob_key TEXT, header_logo_content_type TEXT, header_logo_size INTEGER,
  header_logo_url TEXT NOT NULL DEFAULT ''
);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS header_logo_blob_key TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS header_logo_content_type TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS header_logo_size INTEGER;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS header_logo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS support_telegram TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS external_products (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL, price_inr INTEGER NOT NULL, merchant TEXT NOT NULL,
  product_url TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS seller_notices (
  id SERIAL PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES users(id),
  order_id INTEGER REFERENCES orders(id), message TEXT NOT NULL DEFAULT '',
  is_read INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_seller_items (
  id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL, seller_id INTEGER NOT NULL, product_id INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS order_seller_snapshots (
  id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL, seller_id_original INTEGER NOT NULL,
  seller_name TEXT NOT NULL DEFAULT '', store_name TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
  account_role TEXT NOT NULL DEFAULT '', store_name TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '', email TEXT, phone TEXT, status TEXT NOT NULL DEFAULT 'pending',
  completed_by_admin_id INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS bulk_profit_history (
  id SERIAL PRIMARY KEY, admin_id INTEGER NOT NULL, scope_label TEXT NOT NULL DEFAULT '',
  mode_label TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '',
  affected_count INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_activity_marks (
  kind TEXT NOT NULL, ref_id INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0, seen_upto INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS deleted_accounts (
  id SERIAL PRIMARY KEY, original_user_id INTEGER NOT NULL, name TEXT NOT NULL DEFAULT '',
  store_name TEXT, email TEXT, phone TEXT, role TEXT NOT NULL DEFAULT '',
  wallet_balance INTEGER NOT NULL DEFAULT 0, deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS blobs (
  key TEXT PRIMARY KEY, content_type TEXT NOT NULL, size INTEGER NOT NULL, data_base64 TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_reviews (
  id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id),
  buyer_id INTEGER NOT NULL REFERENCES users(id), order_id INTEGER NOT NULL REFERENCES orders(id),
  rating INTEGER NOT NULL, comment TEXT NOT NULL DEFAULT '', visible INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_reviews_order_product_unique UNIQUE (order_id, product_id)
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_confirmed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_confirmed_at TIMESTAMPTZ;
CREATE OR REPLACE FUNCTION guard_wallet_ledger() RETURNS trigger AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount OR OLD.type IS DISTINCT FROM NEW.type OR OLD.seller_id IS DISTINCT FROM NEW.seller_id THEN
    RAISE EXCEPTION 'wallet ledger rows are append-only: amount, type and seller cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS wallet_ledger_guard ON wallet_transactions;
CREATE TRIGGER wallet_ledger_guard BEFORE UPDATE OF amount, type, seller_id ON wallet_transactions FOR EACH ROW EXECUTE FUNCTION guard_wallet_ledger();
CREATE TABLE IF NOT EXISTS google_oauth_states (
  state TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS google_login_codes (
  code TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

// FK-safe insert order for /seed (parents before children).
const SEED_ORDER = [
  "users", "products", "settings", "external_products", "seller_products",
  "cart_items", "orders", "order_items", "tickets", "chat_messages",
  "wallet_transactions", "seller_notifications", "seller_notices",
  "order_seller_items", "order_seller_snapshots", "password_reset_requests",
  "bulk_profit_history", "admin_activity_marks", "deleted_accounts",
];

const SERIAL_TABLES = new Set([
  "users", "products", "seller_products", "cart_items", "orders", "order_items",
  "tickets", "chat_messages", "wallet_transactions", "seller_notifications",
  "external_products", "seller_notices", "order_seller_items",
  "order_seller_snapshots", "password_reset_requests", "bulk_profit_history",
  "deleted_accounts",
]);

// DB columns that hold millisecond timestamps in the old SQLite dump.
const TIMESTAMP_COLUMNS: Record<string, Set<string>> = {
  users: new Set(["created_at"]),
  products: new Set(["created_at"]),
  seller_products: new Set(["created_at"]),
  cart_items: new Set(["created_at"]),
  orders: new Set(["created_at", "payment_verified_at"]),
  tickets: new Set(["created_at"]),
  chat_messages: new Set(["created_at"]),
  wallet_transactions: new Set(["created_at", "paid_at"]),
  seller_notifications: new Set(["created_at"]),
  settings: new Set(["last_price_sync_at"]),
  external_products: new Set(["created_at"]),
  seller_notices: new Set(["created_at"]),
  password_reset_requests: new Set(["created_at", "completed_at"]),
  bulk_profit_history: new Set(["created_at"]),
  deleted_accounts: new Set(["deleted_at"]),
};

function makeCtx(db: any, pool: any, baseUrl: string): Ctx {
  return {
    db: () => db,
    blobs: {
      put: async (key, bytes, opts) => {
        const dataBase64 = Buffer.from(bytes).toString("base64");
        await pool.query(
          `INSERT INTO blobs (key, content_type, size, data_base64) VALUES ($1, $2, $3, $4)
           ON CONFLICT (key) DO UPDATE SET content_type = EXCLUDED.content_type, size = EXCLUDED.size, data_base64 = EXCLUDED.data_base64`,
          [key, opts.contentType, bytes.length, dataBase64],
        );
      },
      getUrl: async (key) => `${baseUrl}/blobs/${encodeURIComponent(key)}`,
    },
    invalidateQueries: () => {},
  };
}

export function createHandler(db: any, pool: any, baseUrl: string) {
  const ctx = db ? makeCtx(db, pool, baseUrl) : null;
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return new Response(url.pathname === "/health" ? "ok" : "sheinstore backend is running", {
        headers: { "content-type": "text/plain", ...corsHeaders },
      });
    }
    if (req.method === "GET" && url.pathname.startsWith("/blobs/")) {
      if (!pool) return new Response("Database not configured", { status: 503 });
      const key = decodeURIComponent(url.pathname.slice("/blobs/".length));
      const res = await pool.query(
        "SELECT data_base64, content_type FROM blobs WHERE key = $1", [key],
      );
      if (res.rows.length === 0) return new Response("Not found", { status: 404 });
      const bytes = Buffer.from(res.rows[0].data_base64, "base64");
      return new Response(bytes as any, {
        headers: { "content-type": res.rows[0].content_type, ...corsHeaders },
      });
    }
    if (req.method === "POST" && url.pathname === "/actions") {
      if (!ctx) return json({ ok: false, error: "Database not configured" }, 503);
      let body: any;
      try {
        body = await req.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON" }, 400);
      }
      const def = (Actions as any)[body?.action];
      if (!def) return json({ ok: false, error: `Unknown action: ${body?.action}` }, 404);
      let parsed: any;
      try {
        parsed = def.request.parse(body?.args ?? {});
      } catch {
        return json({ ok: false, error: "Invalid request" }, 400);
      }
      // ---- Login-session enforcement (see space-shim AuthPolicy) ----
      // Public actions skip this entirely. Every other action needs a
      // valid token, and arg/role checks run against the TOKEN's user —
      // never against a caller-passed id. An action without an auth
      // policy is rejected (fail-closed): every action must be tagged.
      const policy = (def as any).auth;
      let auth: { userId: number; role: string; tokenHash: string } | null = null;
      if (policy !== "public") {
        const fail = (error: string, status: number) => json({ ok: false, error }, status);
        if (policy === undefined) return fail("Sign in required.", 401);
        const optionalField = typeof policy === "object" && policy !== null && "optional" in policy ? (policy as any).optional : null;
        const optionalValue = optionalField ? parsed?.[optionalField] : undefined;
        if (!(optionalField && (optionalValue === null || optionalValue === undefined))) {
          const token = typeof body?.token === "string" ? body.token : null;
          if (!token) return fail("Sign in required.", 401);
          const tokenHash = createHash("sha256").update(token).digest("hex");
          const db = ctx.db();
          const srow = await db.select().from(schema.userSessions).where(eq(schema.userSessions.tokenHash, tokenHash)).limit(1);
          const urow = srow[0]
            ? await db.select().from(schema.users).where(eq(schema.users.id, srow[0].userId)).limit(1)
            : [];
          if (!srow[0] || !urow[0]) return fail("Sign in required.", 401);
          auth = { userId: urow[0].id, role: urow[0].role, tokenHash };
          if (typeof policy === "object" && policy !== null && "admin" in policy) {
            if (auth.role !== "admin") return fail("Not allowed.", 403);
          } else if (typeof policy === "object" && policy !== null && "arg" in policy) {
            // adminOk: a valid admin token bypasses the id match (Admin
            // reading customer threads). Any other mismatch is a real
            // permission failure, not a dead session.
            const adminBypass = (policy as any).adminOk === true && auth.role === "admin";
            if (!adminBypass) {
              if (parsed?.[(policy as any).arg] !== auth.userId) return fail("Not allowed.", 403);
              if ((policy as any).role && auth.role !== (policy as any).role) return fail("Not allowed.", 403);
            }
          } else if (typeof policy === "object" && policy !== null && "any" in policy) {
            // any valid token suffices
          } else if (typeof policy === "object" && policy !== null && "optional" in policy) {
            if (optionalValue !== auth.userId) return fail("Not allowed.", 403);
          } else {
            return fail("Sign in required.", 401);
          }
        }
      }
      // Per-request ctx: handlers share db/blobs via spread, but auth is
      // this request's own (never mutate the shared ctx across requests).
      const reqCtx = { ...ctx, auth };
      try {
        const result = await def.handler(reqCtx, parsed);
        return json(result);
      } catch (e) {
        console.error(`action ${body.action} failed`, e);
        return json({ ok: false, error: "Server error" }, 500);
      }
    }
    if (req.method === "POST" && url.pathname === "/seed") {
      if (!pool) return json({ ok: false, error: "Database not configured" }, 503);
      let body: any;
      try {
        body = await req.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON" }, 400);
      }
      const tables = body?.tables;
      if (!tables || typeof tables !== "object" || Array.isArray(tables)) {
        return json({ ok: false, error: "Expected { tables: { ... } }" }, 400);
      }
      for (const name of Object.keys(tables)) {
        if (!SEED_ORDER.includes(name)) {
          return json({ ok: false, error: `Unknown table: ${name}` }, 400);
        }
      }
      // Settings is the one exception to the empty-guard: reading settings
      // (getSettings, or the frontend's first visit) auto-creates a default
      // row on an empty database, so a fresh database is never truly empty
      // in this table. When the dump carries its own settings row, the
      // auto-created default is replaced wholesale by the import; every
      // other table keeps the strict empty-guard.
      const dumpHasSettings = Array.isArray(tables.settings) && tables.settings.length > 0;
      for (const name of SEED_ORDER) {
        if (name === "settings" && dumpHasSettings) continue;
        const count = await pool.query(`SELECT COUNT(*)::int AS n FROM "${name}"`);
        if (count.rows[0].n > 0) {
          return json({ ok: false, error: `Database is not empty (${name} already has rows)` }, 409);
        }
      }
      if (dumpHasSettings) {
        await pool.query("DELETE FROM settings");
      }
      const counts: Record<string, number> = {};
      for (const name of SEED_ORDER) {
        const rows = tables[name] ?? [];
        if (!Array.isArray(rows)) return json({ ok: false, error: `${name} is not an array` }, 400);
        const tsCols = TIMESTAMP_COLUMNS[name] ?? new Set<string>();
        for (const row of rows) {
          const cols = Object.keys(row);
          if (cols.length === 0) continue;
          const values = cols.map((c) => {
            const v = row[c];
            if (v === null || v === undefined) return null;
            if (tsCols.has(c) && typeof v === "number") return new Date(v).toISOString();
            return v;
          });
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
          const colList = cols.map((c) => `"${c}"`).join(", ");
          await pool.query(`INSERT INTO "${name}" (${colList}) VALUES (${placeholders})`, values);
        }
        counts[name] = rows.length;
        if (SERIAL_TABLES.has(name)) {
          await pool.query(
            `SELECT setval(pg_get_serial_sequence('${name}', 'id'), COALESCE((SELECT MAX(id) FROM "${name}"), 1), EXISTS (SELECT 1 FROM "${name}"))`,
          );
        }
      }
      const blobRows = body?.blobs ?? [];
      if (!Array.isArray(blobRows)) return json({ ok: false, error: "blobs is not an array" }, 400);
      for (const b of blobRows) {
        await pool.query(
          `INSERT INTO blobs (key, content_type, size, data_base64) VALUES ($1, $2, $3, $4)
           ON CONFLICT (key) DO UPDATE SET content_type = EXCLUDED.content_type, size = EXCLUDED.size, data_base64 = EXCLUDED.data_base64`,
          [b.key, b.contentType, b.size, b.dataBase64],
        );
      }
      counts.blobs = blobRows.length;
      return json({ ok: true, counts });
    }

    // ---- Google sign-in (OAuth 2.0) ----
    // Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (set in the Render
    // dashboard; never shared in chat). The sign-in page button only
    // appears once both are set (getSettings.googleSignInEnabled).
    // The redirect URI registered in Google Cloud must match exactly:
    // <backend>/auth/google/callback
    const backendOrigin = (process.env.GOOGLE_REDIRECT_BASE ?? baseUrl ?? "").replace(/\/$/, "") || (() => { try { return new URL(req.url).origin; } catch { return "https://shein-mart.onrender.com"; } })();
    const frontendOrigin = (process.env.FRONTEND_URL ?? "https://www.sheinmart.com").replace(/\/$/, "");
    const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${backendOrigin}/auth/google/callback`;
    const googleErrorRedirect = (code: string) => new Response(null, { status: 302, headers: { Location: `${frontendOrigin}/?google_error=${encodeURIComponent(code)}`, ...corsHeaders } });
    const randomHex = (bytes = 32) => { const buf = new Uint8Array(bytes); crypto.getRandomValues(buf); return Array.from(buf).map((x) => x.toString(16).padStart(2, "0")).join(""); };
    if (req.method === "GET" && url.pathname === "/auth/google/start") {
      if (!pool) return new Response("Database not configured", { status: 503 });
      const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
      if (!clientId || !clientSecret) {
        return new Response("Google sign-in is not configured yet. The store owner needs to add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the Render dashboard.", { status: 400, headers: { "content-type": "text/plain", ...corsHeaders } });
      }
      const state = randomHex(16);
      await pool.query("DELETE FROM google_oauth_states WHERE created_at < now() - interval '10 minutes'");
      await pool.query("INSERT INTO google_oauth_states (state) VALUES ($1)", [state]);
      const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      auth.searchParams.set("client_id", clientId);
      auth.searchParams.set("redirect_uri", googleRedirectUri);
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("scope", "openid email profile");
      auth.searchParams.set("access_type", "online");
      auth.searchParams.set("prompt", "select_account");
      auth.searchParams.set("state", state);
      return new Response(null, { status: 302, headers: { Location: auth.toString(), ...corsHeaders } });
    }
    if (req.method === "GET" && url.pathname === "/auth/google/callback") {
      if (!pool) return new Response("Database not configured", { status: 503 });
      if (url.searchParams.get("error")) return googleErrorRedirect("denied");
      const code = url.searchParams.get("code") ?? "";
      const state = url.searchParams.get("state") ?? "";
      if (!code || !state) return googleErrorRedirect("missing");
      const st = await pool.query("DELETE FROM google_oauth_states WHERE state = $1 AND created_at > now() - interval '10 minutes' RETURNING state", [state]);
      if (st.rows.length === 0) return googleErrorRedirect("invalid_state");
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID ?? "",
            client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
            code,
            grant_type: "authorization_code",
            redirect_uri: googleRedirectUri,
          }),
        });
        const tokens: any = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !tokens.access_token) return googleErrorRedirect("exchange_failed");
        const meRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const me: any = await meRes.json().catch(() => ({}));
        const email = typeof me.email === "string" ? me.email.toLowerCase() : "";
        const verified = me.email_verified === true || me.verified_email === true;
        if (!meRes.ok || !email || !verified) return googleErrorRedirect("email_not_verified");
        const name = typeof me.name === "string" && me.name.trim() ? me.name.trim().slice(0, 80) : (email.split("@")[0] ?? "Google User");
        const existing = await pool.query("SELECT id FROM users WHERE lower(email) = $1 LIMIT 1", [email]);
        let userId: number;
        if (existing.rows.length > 0) {
          userId = existing.rows[0].id;
        } else {
          // Unusable random password in the app's own pbkdf2$ format, so
          // an OAuth-created row stays well-formed (password login can
          // never guess it).
          const salt = randomBytes(16);
          const hash = pbkdf2Sync(randomHex(32), salt, 60000, 32, "sha256").toString("hex");
          const stored = `pbkdf2$60000$${salt.toString("hex")}$${hash}`;
          const ins = await pool.query("INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'buyer') RETURNING id", [name, email, stored]);
          userId = ins.rows[0].id;
        }
        await pool.query("DELETE FROM google_login_codes WHERE created_at < now() - interval '10 minutes'");
        const loginCode = randomHex(32);
        await pool.query("INSERT INTO google_login_codes (code, user_id) VALUES ($1, $2)", [loginCode, userId]);
        return new Response(null, { status: 302, headers: { Location: `${frontendOrigin}/?google_code=${loginCode}`, ...corsHeaders } });
      } catch (e) {
        console.error("google callback failed", e);
        return googleErrorRedirect("server_error");
      }
    }
    return new Response("Not found", { status: 404, headers: corsHeaders });
  };
}

export async function ensureTables(pool: any) {
  await pool.query(DDL);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  let db: any = null;
  let pool: any = null;
  if (connectionString) {
    pool = new Pool({ connectionString });
    db = drizzle(pool);
    try {
      await ensureTables(pool);
      console.log("Database tables ready");
    } catch (e) {
      console.error("Database setup failed (tables may be incomplete):", e);
    }
  } else {
    console.warn("DATABASE_URL is not set; serving health checks only until it is configured.");
  }
  const baseUrl = process.env.RENDER_EXTERNAL_URL ?? "";
  const port = Number(process.env.PORT || 3000);
  Bun.serve({ port, fetch: createHandler(db, pool, baseUrl) });
  console.log(`Listening on port ${port}...`);
}

if (import.meta.main) {
  main();
}
