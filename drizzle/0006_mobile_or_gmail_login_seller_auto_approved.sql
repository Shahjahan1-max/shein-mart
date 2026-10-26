PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  store_name TEXT,
  phone TEXT,
  created_at INTEGER NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'none',
  address TEXT,
  city TEXT,
  state TEXT,
  pin_code TEXT,
  date_of_birth TEXT,
  photo_file_name TEXT,
  store_description TEXT,
  store_logo_file_name TEXT,
  store_address TEXT,
  business_type TEXT,
  gst_number TEXT,
  doc_type TEXT,
  doc_number TEXT,
  doc_front_file_name TEXT,
  doc_back_file_name TEXT
);
--> statement-breakpoint
INSERT INTO users_new (id, name, email, password, role, store_name, phone, created_at, verification_status, address, city, state, pin_code, date_of_birth, photo_file_name, store_description, store_logo_file_name, store_address, business_type, gst_number, doc_type, doc_number, doc_front_file_name, doc_back_file_name)
SELECT id, name, email, password, role, store_name, phone, created_at, verification_status, address, city, state, pin_code, date_of_birth, photo_file_name, store_description, store_logo_file_name, store_address, business_type, gst_number, doc_type, doc_number, doc_front_file_name, doc_back_file_name FROM users;
--> statement-breakpoint
DROP TABLE users;
--> statement-breakpoint
ALTER TABLE users_new RENAME TO users;
--> statement-breakpoint
UPDATE users SET verification_status = 'approved' WHERE role = 'seller' AND verification_status = 'pending';
--> statement-breakpoint
PRAGMA foreign_keys=ON;
