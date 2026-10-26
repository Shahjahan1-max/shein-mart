ALTER TABLE users ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE users ADD COLUMN address TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN city TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN state TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN pin_code TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN date_of_birth TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN photo_file_name TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN store_description TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN store_logo_file_name TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN store_address TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN business_type TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN gst_number TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN doc_type TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN doc_number TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN doc_front_file_name TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN doc_back_file_name TEXT;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN state TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN pin_code TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  sender TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
