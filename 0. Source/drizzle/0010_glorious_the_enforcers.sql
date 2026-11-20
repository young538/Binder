CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`billing_cycle` text NOT NULL,
	`billing_day` integer,
	`next_billing_date` text,
	`status` text NOT NULL,
	`category` text,
	`payment_method` text,
	`auto_renew` integer DEFAULT true NOT NULL,
	`url` text,
	`note` text,
	`order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `subscriptions_user_idx` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_user_status_idx` ON `subscriptions` (`user_id`,`status`);