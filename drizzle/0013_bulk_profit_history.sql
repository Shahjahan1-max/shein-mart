CREATE TABLE `bulk_profit_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `admin_id` integer NOT NULL,
  `scope_label` text DEFAULT '' NOT NULL,
  `mode_label` text DEFAULT '' NOT NULL,
  `detail` text DEFAULT '' NOT NULL,
  `affected_count` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL
);
