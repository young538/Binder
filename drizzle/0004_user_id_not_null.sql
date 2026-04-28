PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_annual_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
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
INSERT INTO `__new_annual_goals`("id", "user_id", "year", "order", "title", "deadline", "action", "metric", "target", "monthly_targets", "monthly_actuals", "parent_goal_id", "created_at", "updated_at") SELECT "id", "user_id", "year", "order", "title", "deadline", "action", "metric", "target", "monthly_targets", "monthly_actuals", "parent_goal_id", "created_at", "updated_at" FROM `annual_goals`;--> statement-breakpoint
DROP TABLE `annual_goals`;--> statement-breakpoint
ALTER TABLE `__new_annual_goals` RENAME TO `annual_goals`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `annual_goals_year_idx` ON `annual_goals` (`year`);--> statement-breakpoint
CREATE INDEX `annual_goals_parent_idx` ON `annual_goals` (`parent_goal_id`);--> statement-breakpoint
CREATE INDEX `annual_goals_user_idx` ON `annual_goals` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_books` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
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
INSERT INTO `__new_books`("id", "user_id", "year", "order", "category", "title", "one_thing", "keywords", "review_url", "started_at", "finished_at", "created_at", "updated_at") SELECT "id", "user_id", "year", "order", "category", "title", "one_thing", "keywords", "review_url", "started_at", "finished_at", "created_at", "updated_at" FROM `books`;--> statement-breakpoint
DROP TABLE `books`;--> statement-breakpoint
ALTER TABLE `__new_books` RENAME TO `books`;--> statement-breakpoint
CREATE INDEX `books_year_idx` ON `books` (`year`);--> statement-breakpoint
CREATE INDEX `books_user_idx` ON `books` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`order` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "user_id", "name", "color", "order") SELECT "id", "user_id", "name", "color", "order" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
CREATE INDEX `categories_user_idx` ON `categories` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_focus_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`scope_key` text NOT NULL,
	`text` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_focus_notes`("id", "user_id", "scope", "scope_key", "text", "updated_at") SELECT "id", "user_id", "scope", "scope_key", "text", "updated_at" FROM `focus_notes`;--> statement-breakpoint
DROP TABLE `focus_notes`;--> statement-breakpoint
ALTER TABLE `__new_focus_notes` RENAME TO `focus_notes`;--> statement-breakpoint
CREATE INDEX `focus_notes_scope_idx` ON `focus_notes` (`scope`,`scope_key`);--> statement-breakpoint
CREATE INDEX `focus_notes_user_idx` ON `focus_notes` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`parent_id` text,
	`level` text NOT NULL,
	`color` text,
	`order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_goals`("id", "user_id", "title", "parent_id", "level", "color", "order", "created_at", "updated_at") SELECT "id", "user_id", "title", "parent_id", "level", "color", "order", "created_at", "updated_at" FROM `goals`;--> statement-breakpoint
DROP TABLE `goals`;--> statement-breakpoint
ALTER TABLE `__new_goals` RENAME TO `goals`;--> statement-breakpoint
CREATE INDEX `goals_parent_idx` ON `goals` (`parent_id`);--> statement-breakpoint
CREATE INDEX `goals_level_idx` ON `goals` (`level`);--> statement-breakpoint
CREATE INDEX `goals_user_idx` ON `goals` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_habit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_habit_logs`("id", "user_id", "habit_id", "date", "created_at") SELECT "id", "user_id", "habit_id", "date", "created_at" FROM `habit_logs`;--> statement-breakpoint
DROP TABLE `habit_logs`;--> statement-breakpoint
ALTER TABLE `__new_habit_logs` RENAME TO `habit_logs`;--> statement-breakpoint
CREATE INDEX `habit_logs_habit_idx` ON `habit_logs` (`habit_id`);--> statement-breakpoint
CREATE INDEX `habit_logs_date_idx` ON `habit_logs` (`date`);--> statement-breakpoint
CREATE INDEX `habit_logs_habit_date_idx` ON `habit_logs` (`habit_id`,`date`);--> statement-breakpoint
CREATE INDEX `habit_logs_user_idx` ON `habit_logs` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_habits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
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
INSERT INTO `__new_habits`("id", "user_id", "name", "color", "order", "schedule", "category_id", "note", "parent_goal_id", "annual_goal_id", "created_at", "updated_at") SELECT "id", "user_id", "name", "color", "order", "schedule", "category_id", "note", "parent_goal_id", "annual_goal_id", "created_at", "updated_at" FROM `habits`;--> statement-breakpoint
DROP TABLE `habits`;--> statement-breakpoint
ALTER TABLE `__new_habits` RENAME TO `habits`;--> statement-breakpoint
CREATE INDEX `habits_parent_idx` ON `habits` (`parent_goal_id`);--> statement-breakpoint
CREATE INDEX `habits_annual_idx` ON `habits` (`annual_goal_id`);--> statement-breakpoint
CREATE INDEX `habits_user_idx` ON `habits` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_retrospectives` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`date_or_week` text NOT NULL,
	`rating` integer,
	`template` text NOT NULL,
	`free_text` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_retrospectives`("id", "user_id", "type", "date_or_week", "rating", "template", "free_text", "created_at", "updated_at") SELECT "id", "user_id", "type", "date_or_week", "rating", "template", "free_text", "created_at", "updated_at" FROM `retrospectives`;--> statement-breakpoint
DROP TABLE `retrospectives`;--> statement-breakpoint
ALTER TABLE `__new_retrospectives` RENAME TO `retrospectives`;--> statement-breakpoint
CREATE INDEX `retrospectives_type_date_idx` ON `retrospectives` (`type`,`date_or_week`);--> statement-breakpoint
CREATE INDEX `retrospectives_user_idx` ON `retrospectives` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_time_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL,
	`text` text NOT NULL,
	`kind` text DEFAULT 'plan' NOT NULL,
	`category_id` text NOT NULL,
	`goal_id` text,
	`todo_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_time_blocks`("id", "user_id", "date", "start_min", "end_min", "text", "kind", "category_id", "goal_id", "todo_id", "created_at", "updated_at") SELECT "id", "user_id", "date", "start_min", "end_min", "text", "kind", "category_id", "goal_id", "todo_id", "created_at", "updated_at" FROM `time_blocks`;--> statement-breakpoint
DROP TABLE `time_blocks`;--> statement-breakpoint
ALTER TABLE `__new_time_blocks` RENAME TO `time_blocks`;--> statement-breakpoint
CREATE INDEX `time_blocks_date_idx` ON `time_blocks` (`date`);--> statement-breakpoint
CREATE INDEX `time_blocks_goal_idx` ON `time_blocks` (`goal_id`);--> statement-breakpoint
CREATE INDEX `time_blocks_kind_idx` ON `time_blocks` (`kind`);--> statement-breakpoint
CREATE INDEX `time_blocks_user_idx` ON `time_blocks` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_todos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
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
INSERT INTO `__new_todos`("id", "user_id", "title", "scope", "scope_key", "status", "order", "parent_goal_id", "priority", "category_id", "note", "created_at", "updated_at") SELECT "id", "user_id", "title", "scope", "scope_key", "status", "order", "parent_goal_id", "priority", "category_id", "note", "created_at", "updated_at" FROM `todos`;--> statement-breakpoint
DROP TABLE `todos`;--> statement-breakpoint
ALTER TABLE `__new_todos` RENAME TO `todos`;--> statement-breakpoint
CREATE INDEX `todos_scope_idx` ON `todos` (`scope`,`scope_key`);--> statement-breakpoint
CREATE INDEX `todos_parent_idx` ON `todos` (`parent_goal_id`);--> statement-breakpoint
CREATE INDEX `todos_user_idx` ON `todos` (`user_id`);