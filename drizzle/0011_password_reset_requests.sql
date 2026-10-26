CREATE TABLE `password_reset_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL REFERENCES `users`(`id`),
	`account_role` text DEFAULT '' NOT NULL,
	`store_name` text DEFAULT '' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`email` text,
	`phone` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_by_admin_id` integer,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
