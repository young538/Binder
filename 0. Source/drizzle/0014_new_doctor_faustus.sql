CREATE TABLE `finance_automation_configs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`token_hash` text,
	`token_prefix` text,
	`excel_password_enc` text,
	`last_import_at` text,
	`last_import_file_name` text,
	`last_import_status` text,
	`last_import_summary` text,
	`last_import_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_auto_token_hash_idx` ON `finance_automation_configs` (`token_hash`);