-- Migration 0012: SEC fund enrichment tables
-- Adds five new tables to store the latest snapshot of SEC fund data for
-- performance, asset allocation, top-5 holdings, quarterly portfolio (full),
-- and monthly portfolio by asset type.
-- All tables reference fund_catalog.proj_id with ON DELETE CASCADE so stale
-- data is pruned automatically when a fund is removed from the catalog.

CREATE TABLE `fund_performance` (
	`proj_id` text NOT NULL REFERENCES `fund_catalog`(`proj_id`) ON DELETE CASCADE,
	`fund_class_name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`prospectus_type` text,
	`performance_type_desc` text NOT NULL,
	`reference_period` text NOT NULL,
	`performance_value` text,
	`last_upd_date` text,
	PRIMARY KEY(`proj_id`, `fund_class_name`, `performance_type_desc`, `reference_period`)
);
--> statement-breakpoint
CREATE INDEX `idx_fund_performance_proj` ON `fund_performance` (`proj_id`);
--> statement-breakpoint

CREATE TABLE `fund_asset_allocation` (
	`proj_id` text NOT NULL REFERENCES `fund_catalog`(`proj_id`) ON DELETE CASCADE,
	`start_date` text NOT NULL,
	`end_date` text,
	`prospectus_type` text,
	`asset_seq` integer NOT NULL,
	`asset_name` text,
	`asset_ratio` real,
	`last_upd_date` text,
	PRIMARY KEY(`proj_id`, `asset_seq`)
);
--> statement-breakpoint
CREATE INDEX `idx_fund_asset_alloc_proj` ON `fund_asset_allocation` (`proj_id`);
--> statement-breakpoint

CREATE TABLE `fund_top_holdings` (
	`proj_id` text NOT NULL REFERENCES `fund_catalog`(`proj_id`) ON DELETE CASCADE,
	`start_date` text NOT NULL,
	`end_date` text,
	`prospectus_type` text,
	`asset_seq` integer NOT NULL,
	`asset_name` text,
	`asset_ratio` real,
	`last_upd_date` text,
	PRIMARY KEY(`proj_id`, `asset_seq`)
);
--> statement-breakpoint
CREATE INDEX `idx_fund_top_holdings_proj` ON `fund_top_holdings` (`proj_id`);
--> statement-breakpoint

CREATE TABLE `fund_portfolio` (
	`proj_id` text NOT NULL REFERENCES `fund_catalog`(`proj_id`) ON DELETE CASCADE,
	`period` text NOT NULL,
	`as_of_date` text,
	`assetliab_id` text,
	`assetliab_desc` text,
	`issue_code` text,
	`isin_code` text,
	`issuer` text,
	`assetliab_value` real,
	`percent_nav` real,
	`last_upd_date` text,
	PRIMARY KEY(`proj_id`, `period`, `assetliab_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_fund_portfolio_proj` ON `fund_portfolio` (`proj_id`);
--> statement-breakpoint

CREATE TABLE `fund_portfolio_asset_type` (
	`proj_id` text NOT NULL REFERENCES `fund_catalog`(`proj_id`) ON DELETE CASCADE,
	`period` text NOT NULL,
	`assetliab_code` text NOT NULL,
	`assetliab_desc` text,
	`market_value` real,
	`percent_nav` real,
	PRIMARY KEY(`proj_id`, `period`, `assetliab_code`)
);
--> statement-breakpoint
CREATE INDEX `idx_fund_portfolio_asset_type_proj` ON `fund_portfolio_asset_type` (`proj_id`);
