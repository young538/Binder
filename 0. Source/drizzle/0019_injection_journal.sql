CREATE TABLE `injection_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pen_id` text NOT NULL,
	`taken_at` text NOT NULL,
	`amount_mcg` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `injection_entries_owner_pen` ON `injection_entries` (`user_id`,`pen_id`);--> statement-breakpoint
CREATE TABLE `injection_pens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`drug` text NOT NULL,
	`name` text NOT NULL,
	`capacity_mcg` integer NOT NULL,
	`closed` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `injection_pens_owner` ON `injection_pens` (`user_id`);