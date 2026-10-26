ALTER TABLE `settings` ADD COLUMN `color_scheme` text DEFAULT 'navy' NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `layout_design` text DEFAULT 'classic' NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `last_price_sync_at` integer;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `last_price_sync_note` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `seller_notices` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `seller_id` integer NOT NULL REFERENCES `users`(`id`),
  `order_id` integer REFERENCES `orders`(`id`),
  `message` text NOT NULL DEFAULT '',
  `is_read` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL
);
