CREATE TABLE `feeder_look_through_holdings` (
	`proj_id` text NOT NULL,
	`rank` integer NOT NULL,
	`name` text NOT NULL,
	`ticker` text,
	`asset_class` text,
	`isin` text,
	`weight_pct` real,
	`as_of_date` text,
	`fetched_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`proj_id`, `rank`),
	FOREIGN KEY (`proj_id`) REFERENCES `fund_catalog`(`proj_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_feeder_look_through_proj` ON `feeder_look_through_holdings` (`proj_id`);--> statement-breakpoint
CREATE TABLE `feeder_master_map` (
	`proj_id` text PRIMARY KEY NOT NULL,
	`master_isin` text NOT NULL,
	`master_name` text,
	`provider` text DEFAULT 'ishares' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`proj_id`) REFERENCES `fund_catalog`(`proj_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_feeder_master_map_isin` ON `feeder_master_map` (`master_isin`);