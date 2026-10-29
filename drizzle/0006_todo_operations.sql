CREATE TABLE `todo_create_requests` (
	`user_id` text NOT NULL,
	`request_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`response` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `request_key`)
);
--> statement-breakpoint
CREATE TABLE `todo_trash` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `todo_trash_user_idx` ON `todo_trash` (`user_id`);--> statement-breakpoint
CREATE INDEX `todo_trash_expiry_idx` ON `todo_trash` (`expires_at`);