PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`user_id` text PRIMARY KEY NOT NULL DEFAULT 'pending-admin',
	`first_day_of_week` text NOT NULL,
	`grid_minutes` integer NOT NULL,
	`day_start_hour` integer NOT NULL,
	`day_end_hour` integer NOT NULL,
	`theme` text NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_settings`("user_id", "first_day_of_week", "grid_minutes", "day_start_hour", "day_end_hour", "theme")
SELECT 'pending-admin', "first_day_of_week", "grid_minutes", "day_start_hour", "day_end_hour", "theme" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
