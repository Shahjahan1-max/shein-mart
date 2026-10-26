ALTER TABLE `chat_messages` ADD COLUMN `attachment_blob_key` text;
--> statement-breakpoint
ALTER TABLE `chat_messages` ADD COLUMN `attachment_file_name` text;
--> statement-breakpoint
ALTER TABLE `chat_messages` ADD COLUMN `attachment_content_type` text;
--> statement-breakpoint
ALTER TABLE `chat_messages` ADD COLUMN `attachment_size` integer;
