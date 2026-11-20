CREATE TABLE `google_calendar_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`google_email` text NOT NULL,
	`access_token_enc` text NOT NULL,
	`refresh_token_enc` text NOT NULL,
	`token_expires_at` text NOT NULL,
	`selected_calendar_ids` text NOT NULL,
	`push_calendar_id` text NOT NULL,
	`calendar_meta` text NOT NULL,
	`sync_enabled` integer DEFAULT true NOT NULL,
	`auto_push_events` integer DEFAULT true NOT NULL,
	`last_synced_at` text,
	`last_sync_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `life_events` ADD `google_calendar_id` text;--> statement-breakpoint
ALTER TABLE `life_events` ADD `google_event_id` text;--> statement-breakpoint
ALTER TABLE `life_events` ADD `google_updated_at` text;--> statement-breakpoint
CREATE INDEX `life_events_user_google_idx` ON `life_events` (`user_id`,`google_calendar_id`,`google_event_id`);