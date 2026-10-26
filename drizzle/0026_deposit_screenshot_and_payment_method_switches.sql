ALTER TABLE `wallet_transactions` ADD COLUMN `screenshot_blob_key` text;
--> statement-breakpoint
ALTER TABLE `wallet_transactions` ADD COLUMN `screenshot_file_name` text;
--> statement-breakpoint
ALTER TABLE `wallet_transactions` ADD COLUMN `screenshot_content_type` text;
--> statement-breakpoint
ALTER TABLE `wallet_transactions` ADD COLUMN `screenshot_size` integer;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `payment_upi_enabled` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `payment_bank_enabled` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `payment_usdt_enabled` integer DEFAULT 1 NOT NULL;
