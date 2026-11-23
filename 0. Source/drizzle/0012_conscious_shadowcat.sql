ALTER TABLE `google_calendar_connections` ADD `tasks_sync_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `google_calendar_connections` ADD `tasks_auto_push` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `google_calendar_connections` ADD `tasks_selected_list_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `google_calendar_connections` ADD `tasks_default_list_id` text;--> statement-breakpoint
ALTER TABLE `google_calendar_connections` ADD `tasks_list_meta` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `google_calendar_connections` ADD `tasks_project_map` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `google_calendar_connections` ADD `tasks_last_synced_at` text;--> statement-breakpoint
ALTER TABLE `google_calendar_connections` ADD `tasks_last_sync_error` text;--> statement-breakpoint
ALTER TABLE `todos` ADD `google_task_list_id` text;--> statement-breakpoint
ALTER TABLE `todos` ADD `google_task_id` text;--> statement-breakpoint
ALTER TABLE `todos` ADD `google_task_updated_at` text;--> statement-breakpoint
CREATE INDEX `todos_user_google_task_idx` ON `todos` (`user_id`,`google_task_list_id`,`google_task_id`);