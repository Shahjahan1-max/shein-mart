ALTER TABLE `orders` ADD COLUMN `payment_reference` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `payment_proof_blob_key` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `payment_proof_file_name` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `payment_proof_content_type` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `payment_proof_size` integer;
