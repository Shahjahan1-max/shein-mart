ALTER TABLE `settings` ADD COLUMN `lang_hindi_enabled` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `lang_arabic_enabled` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `currency_inr_enabled` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `currency_usd_enabled` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `currency_usdt_enabled` integer DEFAULT 1 NOT NULL;
