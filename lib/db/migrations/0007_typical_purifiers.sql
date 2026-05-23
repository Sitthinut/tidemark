CREATE TABLE `account_tier` (
	`user_id` text PRIMARY KEY NOT NULL,
	`tier` text DEFAULT 'free' NOT NULL,
	`granted_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `usage` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `date`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `buckets` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `chat_threads` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `journal_entries` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `model_portfolios` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `plans` ADD `user_id` text REFERENCES user(id);