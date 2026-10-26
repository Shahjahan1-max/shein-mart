CREATE TABLE order_seller_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  seller_id_original INTEGER NOT NULL,
  seller_name TEXT NOT NULL DEFAULT '',
  store_name TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE UNIQUE INDEX order_seller_snapshots_order_seller_unique ON order_seller_snapshots (order_id, seller_id_original);
--> statement-breakpoint
CREATE TABLE deleted_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_user_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  store_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT '',
  wallet_balance INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER NOT NULL
);
