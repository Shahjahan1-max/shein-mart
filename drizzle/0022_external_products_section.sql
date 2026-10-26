ALTER TABLE `settings` ADD COLUMN `external_products_enabled` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE TABLE `external_products` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `name` text NOT NULL,
  `brand` text NOT NULL DEFAULT '',
  `category` text NOT NULL,
  `price_inr` integer NOT NULL,
  `merchant` text NOT NULL,
  `product_url` text NOT NULL,
  `created_at` integer NOT NULL
);
