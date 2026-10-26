CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  store_name TEXT,
  phone TEXT,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  base_price INTEGER NOT NULL,
  old_price INTEGER,
  profit_percent INTEGER NOT NULL DEFAULT 20,
  stock INTEGER NOT NULL DEFAULT 50,
  image_asset TEXT,
  image_source_url TEXT,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE seller_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  seller_id INTEGER REFERENCES users(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Cash on Delivery',
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  base_price INTEGER NOT NULL,
  profit_percent INTEGER NOT NULL,
  profit_amount INTEGER NOT NULL,
  buyer_price INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  reply TEXT,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  store_name TEXT NOT NULL DEFAULT 'sheinstore',
  support_whatsapp TEXT NOT NULL DEFAULT '',
  support_email TEXT NOT NULL DEFAULT '',
  default_profit_percent INTEGER NOT NULL DEFAULT 20
);
