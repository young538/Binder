CREATE TABLE `annual_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`year` text NOT NULL,
	`order` integer NOT NULL,
	`title` text NOT NULL,
	`deadline` text,
	`action` text,
	`metric` text,
	`target` integer,
	`monthly_targets` text NOT NULL,
	`monthly_actuals` text NOT NULL,
	`parent_goal_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `annual_goals_year_idx` ON `annual_goals` (`year`);--> statement-breakpoint
CREATE INDEX `annual_goals_parent_idx` ON `annual_goals` (`parent_goal_id`);--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`year` text NOT NULL,
	`order` integer NOT NULL,
	`category` text,
	`title` text NOT NULL,
	`one_thing` text,
	`keywords` text,
	`review_url` text,
	`started_at` text,
	`finished_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `books_year_idx` ON `books` (`year`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `focus_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`scope_key` text NOT NULL,
	`text` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `focus_notes_scope_idx` ON `focus_notes` (`scope`,`scope_key`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`parent_id` text,
	`level` text NOT NULL,
	`color` text,
	`order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `goals_parent_idx` ON `goals` (`parent_id`);--> statement-breakpoint
CREATE INDEX `goals_level_idx` ON `goals` (`level`);--> statement-breakpoint
CREATE TABLE `habit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `habit_logs_habit_idx` ON `habit_logs` (`habit_id`);--> statement-breakpoint
CREATE INDEX `habit_logs_date_idx` ON `habit_logs` (`date`);--> statement-breakpoint
CREATE INDEX `habit_logs_habit_date_idx` ON `habit_logs` (`habit_id`,`date`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`order` integer NOT NULL,
	`schedule` text,
	`category_id` text,
	`note` text,
	`parent_goal_id` text,
	`annual_goal_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `habits_parent_idx` ON `habits` (`parent_goal_id`);--> statement-breakpoint
CREATE INDEX `habits_annual_idx` ON `habits` (`annual_goal_id`);--> statement-breakpoint
CREATE TABLE `retrospectives` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`date_or_week` text NOT NULL,
	`rating` integer,
	`template` text NOT NULL,
	`free_text` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `retrospectives_type_date_idx` ON `retrospectives` (`type`,`date_or_week`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`first_day_of_week` text NOT NULL,
	`grid_minutes` integer NOT NULL,
	`day_start_hour` integer NOT NULL,
	`day_end_hour` integer NOT NULL,
	`theme` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `time_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL,
	`text` text NOT NULL,
	`category_id` text NOT NULL,
	`goal_id` text,
	`todo_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `time_blocks_date_idx` ON `time_blocks` (`date`);--> statement-breakpoint
CREATE INDEX `time_blocks_goal_idx` ON `time_blocks` (`goal_id`);--> statement-breakpoint
CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`scope` text NOT NULL,
	`scope_key` text NOT NULL,
	`status` text NOT NULL,
	`order` integer NOT NULL,
	`parent_goal_id` text,
	`priority` integer,
	`category_id` text,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `todos_scope_idx` ON `todos` (`scope`,`scope_key`);--> statement-breakpoint
CREATE INDEX `todos_parent_idx` ON `todos` (`parent_goal_id`);