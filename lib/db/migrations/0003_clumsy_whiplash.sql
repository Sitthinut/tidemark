CREATE TABLE `user_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`category` text NOT NULL,
	`content` text NOT NULL,
	`source` text NOT NULL,
	`source_session_id` text,
	`source_turn_ids` text,
	`confidence` real,
	`valid_from` text NOT NULL,
	`valid_until` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`source_session_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_user_pref_active` ON `user_preferences` (`user_id`,`valid_until`);--> statement-breakpoint
CREATE INDEX `idx_user_pref_category` ON `user_preferences` (`user_id`,`category`,`valid_until`);--> statement-breakpoint
ALTER TABLE `chat_threads` ADD `deleted_at` text;