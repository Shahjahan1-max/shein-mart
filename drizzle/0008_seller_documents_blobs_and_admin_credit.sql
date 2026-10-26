ALTER TABLE users ADD COLUMN photo_blob_key TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN photo_content_type TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN photo_size INTEGER;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN store_logo_blob_key TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN store_logo_content_type TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN store_logo_size INTEGER;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN doc_front_blob_key TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN doc_front_content_type TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN doc_front_size INTEGER;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN doc_back_blob_key TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN doc_back_content_type TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN doc_back_size INTEGER;
