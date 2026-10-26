CREATE TABLE `order_seller_items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `order_id` integer NOT NULL,
  `seller_id` integer NOT NULL,
  `product_id` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `order_seller_items_order_idx` ON `order_seller_items` (`order_id`);
--> statement-breakpoint
CREATE INDEX `order_seller_items_seller_idx` ON `order_seller_items` (`seller_id`);
