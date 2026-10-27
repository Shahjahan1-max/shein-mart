import { integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// Postgres conversion of schema.ts: same tables and columns. Differences:
// autoincrement ids use serial(); timestamp_ms columns use timestamptz;
// enum text columns use plain text() (handlers only pass valid values);
// integer 0/1 columns stay integers (handlers use 0/1, not booleans).

// Users: role is "buyer" | "seller" | "admin". Accounts register with
// Gmail (email) OR an Indian mobile number — whichever is used, the other
// is optional, so email is nullable (SQLite UNIQUE allows many NULLs) and
// login finds the account by either identifier; phone is stored
// normalised to 10 digits. Seller accounts collect the full application
// (personal details, store details, Indian ID document — uploaded files
// are stored as blobs and viewable in the Admin Panel). New applications
// start as verificationStatus "pending": the Admin verifies or rejects
// them from Admin → Seller Accounts (reviewSeller), and only "approved"
// sellers can add products, sell or use the wallet. Sellers approved
// under the earlier auto-approve behaviour keep their "approved" status.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  password: text("password").notNull(),
  role: text("role").notNull(),
  storeName: text("store_name"),
  phone: text("phone"),
  // Country chosen at signup (buyer register + seller application step 1).
  // Profile information only — it never changes currency, language or
  // pricing. Null for accounts created before the field existed.
  country: text("country"),
  verificationStatus: text("verification_status")
    .notNull()
    .default("none"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pinCode: text("pin_code"),
  dateOfBirth: text("date_of_birth"),
  photoFileName: text("photo_file_name"),
  storeDescription: text("store_description"),
  storeLogoFileName: text("store_logo_file_name"),
  storeAddress: text("store_address"),
  businessType: text("business_type"),
  gstNumber: text("gst_number"),
  docType: text("doc_type"),
  docNumber: text("doc_number"),
  docFrontFileName: text("doc_front_file_name"),
  docBackFileName: text("doc_back_file_name"),
  photoBlobKey: text("photo_blob_key"),
  photoContentType: text("photo_content_type"),
  photoSize: integer("photo_size"),
  storeLogoBlobKey: text("store_logo_blob_key"),
  storeLogoContentType: text("store_logo_content_type"),
  storeLogoSize: integer("store_logo_size"),
  docFrontBlobKey: text("doc_front_blob_key"),
  docFrontContentType: text("doc_front_content_type"),
  docFrontSize: integer("doc_front_size"),
  docBackBlobKey: text("doc_back_blob_key"),
  docBackContentType: text("doc_back_content_type"),
  docBackSize: integer("doc_back_size"),
  // For admin accounts created by another admin: who created this admin.
  // The protected owner account is NOT a column — it is always the first admin
  // ever created (lowest admin id), so its identity survives a Gmail
  // change and can never be transferred or removed.
  adminCreatedById: integer("admin_created_by_id"),
  adminCreatedByEmail: text("admin_created_by_email"),
  // 1 when the current password was set by Admin / Customer Service (a
  // temporary password): the customer is asked to set their own password
  // after signing in, and the flag clears when they do.
  mustChangePassword: integer("must_change_password").notNull().default(0),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Main-store catalog. profit_percent is the store-wide profit rule applied
// per product: profit = round(base_price * profit_percent / 100) and the
// buyer price through a seller = base_price + profit.
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    basePrice: integer("base_price").notNull(),
    oldPrice: integer("old_price"),
    profitPercent: integer("profit_percent").notNull().default(20),
    stock: integer("stock").notNull().default(50),
    imageAsset: text("image_asset"),
    imageSourceUrl: text("image_source_url"),
    // Internal marker: "curated" for the hand-maintained catalog,
    // "bulk" for products auto-generated from Admin → Products (bulk add).
    catalogSource: text("catalog_source").notNull().default("curated"),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("products_name_unique").on(t.name)],
);

// A seller's pick: a main-store product added to that seller's own store.
export const sellerProducts = pgTable("seller_products", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => users.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id")
    .notNull()
    .references(() => users.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  qty: integer("qty").notNull().default(1),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id")
    .notNull()
    .references(() => users.id),
  sellerId: integer("seller_id").references(() => users.id),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull().default(""),
  pinCode: text("pin_code").notNull().default(""),
  paymentMethod: text("payment_method").notNull().default("Cash on Delivery"),
  // Prepaid orders ("Pay First" at checkout): the buyer's transaction
  // reference and/or payment screenshot (bytes in blob storage, viewed
  // by the Admin from the order). Empty / null for Cash on Delivery.
  paymentReference: text("payment_reference").notNull().default(""),
  paymentProofBlobKey: text("payment_proof_blob_key"),
  paymentProofFileName: text("payment_proof_file_name"),
  paymentProofContentType: text("payment_proof_content_type"),
  paymentProofSize: integer("payment_proof_size"),
  // Prepaid ("Pay First") payment verification gate — BUYER orders only.
  // "none" = no gate (Cash on Delivery + Admin quick-send orders);
  // "pending" = paid first, waiting for the Admin to verify the proof:
  // the order is visible to the buyer and the Admin but is NOT released
  // to any seller (no seller notification / attribution snapshot, and
  // every seller-facing read skips it). "verified" = Admin verified the
  // payment and the order entered the normal Pending → Shipment →
  // Delivered flow. "rejected" = Admin rejected the payment with a
  // written reason (payment_reject_reason); the order is Cancelled and
  // its stock was restored. Seller accounts/flows never use this gate.
  paymentStatus: text("payment_status")
    .notNull()
    .default("none"),
  paymentRejectReason: text("payment_reject_reason").notNull().default(""),
  paymentVerifiedAt: timestamp("payment_verified_at", { precision: 3, withTimezone: true, mode: "date" }),
  // Who placed the order: "customer" (normal checkout) or "admin" (created
  // by the Admin from the Admin Panel's Send Order form). Shown on the
  // order so records stay honest about where the order came from.
  placedBy: text("placed_by").notNull().default("customer"),
  total: integer("total").notNull(),
  status: text("status")
    .notNull()
    .default("Pending"),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  qty: integer("qty").notNull(),
  basePrice: integer("base_price").notNull(),
  profitPercent: integer("profit_percent").notNull(),
  profitAmount: integer("profit_amount").notNull(),
  buyerPrice: integer("buyer_price").notNull(),
});

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status")
    .notNull()
    .default("Open"),
  reply: text("reply"),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Live support chat between a signed-in customer and the Admin. One thread
// per customer (user_id); sender is "customer" or "admin".
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  sender: text("sender").notNull(),
  message: text("message").notNull(),
  // Optional file attached to the message (e.g. a payment-proof
  // screenshot or PDF the customer sends in chat). The bytes live in
  // blob storage; only the key + display metadata are kept here. The
  // attachment belongs to this customer's thread only and is served
  // through getChatAttachmentUrl to the thread owner or an Admin.
  attachmentBlobKey: text("attachment_blob_key"),
  attachmentFileName: text("attachment_file_name"),
  attachmentContentType: text("attachment_content_type"),
  attachmentSize: integer("attachment_size"),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Seller wallet ledger: deposit and withdrawal REQUESTS. Amounts are
// integer INR. A deposit counts towards the balance only once the Admin
// approves it; a withdrawal holds its amount while pending, deducts it when
// the Admin marks it completed (paid outside the website), and returns it
// when rejected. Order earnings are not rows here — they are computed from
// delivered orders in getWallet and merged into the history view.
//
// Withdrawal payout (Admin Panel → Pay & Withdraw): a pending withdrawal
// the Admin actually pays out flips to status "paid" — the SAME single
// row, so the pending hold becomes the one deduction (never two). The
// Admin's own payment reference (e.g. UPI transaction ID) is stored in
// payment_reference and the payout moment in paid_at; the customer's own
// payout destination stays in reference/details as submitted. A direct
// Admin withdrawal (no customer request) is a row of type "admin_withdraw"
// created already "completed", deducting once at creation.
export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  method: text("method").notNull().default(""),
  reference: text("reference").notNull().default(""),
  details: text("details").notNull().default(""),
  note: text("note").notNull().default(""),
  // Admin's payment reference for a paid withdrawal (e.g. UPI txn ID).
  paymentReference: text("payment_reference").notNull().default(""),
  // When the Admin paid the withdrawal (Pay & Withdraw). Null until paid.
  paidAt: timestamp("paid_at", { precision: 3, withTimezone: true, mode: "date" }),
  // Optional payment screenshot attached to a DEPOSIT request: the
  // seller may type the Transaction Hash / Reference OR attach a
  // screenshot of the payment (for USDT, one of the two is required).
  // The bytes live in blob storage; the Admin views the screenshot from
  // the wallet request before approving. Null for requests without one.
  screenshotBlobKey: text("screenshot_blob_key"),
  screenshotFileName: text("screenshot_file_name"),
  screenshotContentType: text("screenshot_content_type"),
  screenshotSize: integer("screenshot_size"),
  status: text("status")
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Seller order notifications: one row per (seller, order) when an order
// contains at least one of that seller's products. Created in placeOrder
// and lazily backfilled in listSellerNotifications for older orders.
// is_read flips to 1 when the seller opens the bell panel or the Orders tab.
export const sellerNotifications = pgTable("seller_notifications", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => users.id),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  productName: text("product_name").notNull().default(""),
  amount: integer("amount").notNull().default(0),
  isRead: integer("is_read").notNull().default(0),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Single-row editable store settings (store name, support contacts,
// default profit %). Edited from the Admin panel. Also carries the
// store-wide Theme & Design choice (colour scheme + layout design, set
// by the Admin and applied to every visitor) and the record of the last
// one-click price-list refresh.
export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  storeName: text("store_name").notNull().default("sheinstore"),
  supportWhatsapp: text("support_whatsapp").notNull().default(""),
  supportEmail: text("support_email").notNull().default(""),
  defaultProfitPercent: integer("default_profit_percent").notNull().default(20),
  colorScheme: text("color_scheme").notNull().default("navy"),
  layoutDesign: text("layout_design").notNull().default("classic"),
  // Seller deposit destination managed from Admin → Settings → Deposit
  // Settings. The QR shown to sellers is generated in the client from
  // this exact saved address string. depositsEnabled is the Admin's
  // ON/OFF switch for the whole deposit area (balances/history untouched).
  usdtDepositAddress: text("usdt_deposit_address").notNull().default(""),
  depositNetwork: text("deposit_network").notNull().default("BEP20 (BNB Smart Chain)"),
  depositsEnabled: integer("deposits_enabled").notNull().default(1),
  // Admin-editable line shown under the deposit address card on the
  // seller Wallet → Deposit page ("contact Customer Service for the
  // local account / UPI"). Empty = the app's built-in default line.
  localDepositNote: text("local_deposit_note").notNull().default(""),
  // Language & Prices switches (Admin → Settings → Language & Prices).
  // English is always ON (the fallback language) so it has no switch.
  // Hindi / Arabic each have their own ON/OFF; INR / USD / USDT price
  // display each have their own ON/OFF. All default ON. Visitor pickers
  // show only what is ON; a selection switched OFF falls back (language
  // → English, currency → INR or the first currency still ON).
  langHindiEnabled: integer("lang_hindi_enabled").notNull().default(1),
  langArabicEnabled: integer("lang_arabic_enabled").notNull().default(1),
  currencyInrEnabled: integer("currency_inr_enabled").notNull().default(1),
  currencyUsdEnabled: integer("currency_usd_enabled").notNull().default(1),
  currencyUsdtEnabled: integer("currency_usdt_enabled").notNull().default(1),
  // Shop from Other Platforms (external products) ON/OFF switch.
  // OFF hides the whole external section from visitors.
  externalProductsEnabled: integer("external_products_enabled").notNull().default(1),
  // Payment Methods ON/OFF switches (Admin → Settings → Payment
  // Methods): UPI, Bank Account and USDT, each independent, all ON by
  // default. An OFF method is hidden from the seller deposit Payment
  // method picker and the withdraw method options, and requestDeposit /
  // requestWithdraw refuse it server-side too. USDT OFF also hides the
  // Deposit Address card/QR. Existing requests, balances and history
  // are never touched by these switches.
  paymentUpiEnabled: integer("payment_upi_enabled").notNull().default(1),
  paymentBankEnabled: integer("payment_bank_enabled").notNull().default(1),
  paymentUsdtEnabled: integer("payment_usdt_enabled").notNull().default(1),
  lastPriceSyncAt: timestamp("last_price_sync_at", { precision: 3, withTimezone: true, mode: "date" }),
  lastPriceSyncNote: text("last_price_sync_note").notNull().default(""),
});

// External products sold on OTHER platforms ("Shop from Other
// Platforms"). These are NOT sheinstore products: they never enter the
// main catalog, carts, orders, seller stores or wallets. Each row is a
// factual listing (name, brand, price as listed on the merchant's site,
// merchant name) whose product_url links out to the merchant's own
// product page, where the visitor buys. Managed from Admin → External
// Products; seeded once with real merchant listings.
export const externalProducts = pgTable("external_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand").notNull().default(""),
  category: text("category").notNull(),
  priceInr: integer("price_inr").notNull(),
  merchant: text("merchant").notNull(),
  productUrl: text("product_url").notNull(),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Formal reminder notices the Admin sends to a seller's account (e.g.
// "your Order #12 is still pending — please complete it"). A notice with
// an order_id stays active until the seller ships that order (or it is
// Delivered/Cancelled); a general notice (order_id null) stays until the
// seller dismisses it. General notices are also how the seller is told
// an order was completed after Admin approval.
export const sellerNotices = pgTable("seller_notices", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => users.id),
  orderId: integer("order_id").references(() => orders.id),
  message: text("message").notNull().default(""),
  isRead: integer("is_read").notNull().default(0),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Order-time seller attribution snapshot: one row per (order, seller,
// product) recorded when the order is placed — which sellers carried
// which ordered products AT THAT MOMENT. Finance, seller dashboards and
// the Admin order grouping read attribution from here for orders that
// have rows, so a seller who adds (or removes) a product later can never
// gain (or lose) another seller's past orders. Orders placed before this
// table existed have no rows; reads for them fall back to the order-time
// seller_notifications record, then to current store picks.
export const orderSellerItems = pgTable("order_seller_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  productId: integer("product_id").notNull(),
});

export const orderSellerSnapshots = pgTable("order_seller_snapshots", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  sellerIdOriginal: integer("seller_id_original").notNull(),
  sellerName: text("seller_name").notNull().default(""),
  storeName: text("store_name").notNull().default(""),
});

// Password reset requests (Forgot Password flow). Created when a client
// submits their Gmail/mobile on the login form — the public action always
// replies neutrally and a row exists ONLY when the account exists. No
// password or hash is ever stored here or returned anywhere. The Admin
// completes a request by setting a NEW password (stored hashed) and the
// request flips to "completed".
export const passwordResetRequests = pgTable("password_reset_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  accountRole: text("account_role").notNull().default(""),
  storeName: text("store_name").notNull().default(""),
  name: text("name").notNull().default(""),
  email: text("email"),
  phone: text("phone"),
  status: text("status").notNull().default("pending"),
  completedByAdminId: integer("completed_by_admin_id"),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "date" }).notNull().$defaultFn(() => new Date()),
  completedAt: timestamp("completed_at", { precision: 3, withTimezone: true, mode: "date" }),
});

export const bulkProfitHistory = pgTable("bulk_profit_history", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  scopeLabel: text("scope_label").notNull().default(""),
  modeLabel: text("mode_label").notNull().default(""),
  detail: text("detail").notNull().default(""),
  affectedCount: integer("affected_count").notNull().default(0),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "date" }).notNull().$defaultFn(() => new Date()),
});

// Admin "New Activity" marks: one row per activity item the Admin has
// seen or hidden. kind is "order" | "chat" | "wallet" | "ticket" |
// "reset"; ref_id is the source row's id (for "chat" it is the customer's
// user id and seen_upto stores the newest chat message id the Admin has
// seen, so a newer customer message highlights the thread again). The
// underlying records are never touched by these marks — hiding an entry
// only removes it from the Admin's New Activity list.
export const adminActivityMarks = pgTable("admin_activity_marks", {
  kind: text("kind").notNull(),
  refId: integer("ref_id").notNull(),
  seen: integer("seen").notNull().default(0),
  hidden: integer("hidden").notNull().default(0),
  seenUpto: integer("seen_upto").notNull().default(0),
});

export const deletedAccounts = pgTable("deleted_accounts", {
  id: serial("id").primaryKey(),
  originalUserId: integer("original_user_id").notNull(),
  name: text("name").notNull().default(""),
  storeName: text("store_name"),
  email: text("email"),
  phone: text("phone"),
  role: text("role").notNull().default(""),
  walletBalance: integer("wallet_balance").notNull().default(0),
  deletedAt: timestamp("deleted_at", { precision: 3, withTimezone: true, mode: "date" }).notNull().$defaultFn(() => new Date()),
});

// Uploaded file bytes for the standalone backend (replaces the hosted
// runtime's blob storage). Handlers keep fileName/size metadata in their
// own rows; only the key, content type and base64 bytes live here.
export const blobs = pgTable("blobs", {
  key: text("key").primaryKey(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  dataBase64: text("data_base64").notNull(),
});
