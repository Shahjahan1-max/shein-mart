ALTER TABLE `settings` ADD COLUMN `usdt_deposit_address` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `deposit_network` text DEFAULT 'BEP20 (BNB Smart Chain)' NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `deposits_enabled` integer DEFAULT 1 NOT NULL;
