CREATE TABLE `binder_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`review_date` text,
	`decision_outcome` text,
	`goal_id` text,
	`project_id` text,
	`source_retro` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `binder_notes_user_idx` ON `binder_notes` (`user_id`);--> statement-breakpoint
CREATE INDEX `binder_notes_user_kind_idx` ON `binder_notes` (`user_id`,`kind`);--> statement-breakpoint
CREATE INDEX `binder_notes_goal_idx` ON `binder_notes` (`goal_id`);--> statement-breakpoint
CREATE INDEX `binder_notes_project_idx` ON `binder_notes` (`project_id`);--> statement-breakpoint
CREATE TABLE `daily_checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`sleep_hours` real,
	`energy` integer,
	`stress` integer,
	`mood` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_checkins_user_date_idx` ON `daily_checkins` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `daily_checkins_user_idx` ON `daily_checkins` (`user_id`);--> statement-breakpoint
CREATE TABLE `life_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`end_date` text,
	`kind` text NOT NULL,
	`all_day` integer DEFAULT true NOT NULL,
	`start_min` integer,
	`end_min` integer,
	`color` text,
	`person_id` text,
	`project_id` text,
	`goal_id` text,
	`external_uid` text,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `life_events_user_date_idx` ON `life_events` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `life_events_person_idx` ON `life_events` (`person_id`);--> statement-breakpoint
CREATE INDEX `life_events_user_uid_idx` ON `life_events` (`user_id`,`external_uid`);--> statement-breakpoint
CREATE TABLE `metric_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`metric_id` text NOT NULL,
	`date` text NOT NULL,
	`value` real NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `metric_entries_metric_date_idx` ON `metric_entries` (`user_id`,`metric_id`,`date`);--> statement-breakpoint
CREATE INDEX `metric_entries_user_idx` ON `metric_entries` (`user_id`);--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`direction` text NOT NULL,
	`target_value` real,
	`goal_id` text,
	`color` text NOT NULL,
	`order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `metrics_user_idx` ON `metrics` (`user_id`);--> statement-breakpoint
CREATE INDEX `metrics_goal_idx` ON `metrics` (`goal_id`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`relationship` text,
	`cadence_days` integer,
	`last_contact_at` text,
	`birthday` text,
	`gift_ideas` text,
	`note` text,
	`order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `people_user_idx` ON `people` (`user_id`);--> statement-breakpoint
ALTER TABLE `time_blocks` ADD `project_id` text;--> statement-breakpoint
CREATE INDEX `time_blocks_project_idx` ON `time_blocks` (`project_id`);