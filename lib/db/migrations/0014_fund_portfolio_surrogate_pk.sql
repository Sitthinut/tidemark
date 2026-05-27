PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_fund_portfolio` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proj_id` text NOT NULL,
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
	FOREIGN KEY (`proj_id`) REFERENCES `fund_catalog`(`proj_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_fund_portfolio`("proj_id", "period", "as_of_date", "assetliab_id", "assetliab_desc", "issue_code", "isin_code", "issuer", "assetliab_value", "percent_nav", "last_upd_date") SELECT "proj_id", "period", "as_of_date", "assetliab_id", "assetliab_desc", "issue_code", "isin_code", "issuer", "assetliab_value", "percent_nav", "last_upd_date" FROM `fund_portfolio`;--> statement-breakpoint
DROP TABLE `fund_portfolio`;--> statement-breakpoint
ALTER TABLE `__new_fund_portfolio` RENAME TO `fund_portfolio`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_fund_portfolio_proj` ON `fund_portfolio` (`proj_id`);