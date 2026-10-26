ALTER TABLE `orders` ADD COLUMN `payment_status` text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `payment_reject_reason` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `payment_verified_at` integer;
