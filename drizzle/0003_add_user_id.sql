ALTER TABLE `annual_goals` ADD `user_id` text NOT NULL DEFAULT 'pending-admin';--> statement-breakpoint
CREATE INDEX `annual_goals_user_idx` ON `annual_goals` (`user_id`);--> statement-breakpoint
ALTER TABLE `books` ADD `user_id` text NOT NULL DEFAULT 'pending-admin';--> statement-breakpoint
CREATE INDEX `books_user_idx` ON `books` (`user_id`);--> statement-breakpoint
ALTER TABLE `categories` ADD `user_id` text NOT NULL DEFAULT 'pending-admin';--> statement-breakpoint
CREATE INDEX `categories_user_idx` ON `categories` (`user_id`);--> statement-breakpoint
ALTER TABLE `focus_notes` ADD `user_id` text NOT NULL DEFAULT 'pending-admin';--> statement-breakpoint
CREATE INDEX `focus_notes_user_idx` ON `focus_notes` (`user_id`);--> statement-breakpoint
ALTER TABLE `goals` ADD `user_id` text NOT NULL DEFAULT 'pending-admin';--> statement-breakpoint
CREATE INDEX `goals_user_idx` ON `goals` (`user_id`);--> statement-breakpoint
ALTER TABLE `habit_logs` ADD `user_id` text NOT NULL DEFAULT 'pending-admin';--> statement-breakpoint
CREATE INDEX `habit_logs_user_idx` ON `habit_logs` (`user_id`);--> statement-breakpoint
ALTER TABLE `habits` ADD `user_id` text NOT NULL DEFAULT 'pending-admin';--> statement-breakpoint
CREATE INDEX `habits_user_idx` ON `habits` (`user_id`);--> statement-breakpoint
ALTER TABLE `retrospectives` ADD `user_id` text NOT NULL DEFAULT 'pending-admin';--> statement-breakpoint
CREATE INDEX `retrospectives_user_idx` ON `retrospectives` (`user_id`);--> statement-breakpoint
ALTER TABLE `time_blocks` ADD `user_id` text NOT NULL DEFAULT 'pending-admin';--> statement-breakpoint
CREATE INDEX `time_blocks_user_idx` ON `time_blocks` (`user_id`);--> statement-breakpoint
ALTER TABLE `todos` ADD `user_id` text NOT NULL DEFAULT 'pending-admin';--> statement-breakpoint
CREATE INDEX `todos_user_idx` ON `todos` (`user_id`);
