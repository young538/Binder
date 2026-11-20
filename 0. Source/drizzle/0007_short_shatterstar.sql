CREATE TABLE `weekly_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`blocks` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `weekly_templates_user_idx` ON `weekly_templates` (`user_id`);--> statement-breakpoint
ALTER TABLE `todos` ADD `repeat_rule` text;--> statement-breakpoint
ALTER TABLE `todos` ADD `source_retro` text;--> statement-breakpoint
ALTER TABLE `todos` ADD `completed_at` text;--> statement-breakpoint
ALTER TABLE `todos` ADD `repeat_generated` integer DEFAULT false NOT NULL;