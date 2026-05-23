ALTER TABLE `chat_threads` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_threads` ADD `archived_at` text;