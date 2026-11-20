CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`order` integer NOT NULL,
	`goal_id` text,
	`category_id` text,
	`deadline` text,
	`outcome` text,
	`note` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_user_idx` ON `projects` (`user_id`);--> statement-breakpoint
CREATE INDEX `projects_goal_idx` ON `projects` (`goal_id`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`user_id`,`status`);--> statement-breakpoint
ALTER TABLE `todos` ADD `project_id` text;--> statement-breakpoint
CREATE INDEX `todos_project_idx` ON `todos` (`project_id`);