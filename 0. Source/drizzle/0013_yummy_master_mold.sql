CREATE TABLE `finance_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`yyyymm` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `finance_budgets_user_month_idx` ON `finance_budgets` (`user_id`,`yyyymm`);--> statement-breakpoint
CREATE TABLE `finance_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`time` text,
	`kind` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'KRW' NOT NULL,
	`category` text NOT NULL,
	`sub_category` text,
	`merchant` text NOT NULL,
	`payment_method` text,
	`note` text,
	`excluded` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`external_hash` text,
	`subscription_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `finance_tx_user_date_idx` ON `finance_transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `finance_tx_user_kind_date_idx` ON `finance_transactions` (`user_id`,`kind`,`date`);--> statement-breakpoint
CREATE INDEX `finance_tx_user_hash_idx` ON `finance_transactions` (`user_id`,`external_hash`);