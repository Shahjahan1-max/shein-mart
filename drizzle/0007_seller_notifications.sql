CREATE TABLE seller_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES users(id),
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_name TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL DEFAULT 0,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX seller_notifications_seller_idx ON seller_notifications (seller_id, is_read);
--> statement-breakpoint
CREATE UNIQUE INDEX seller_notifications_seller_order_unique ON seller_notifications (seller_id, order_id);
