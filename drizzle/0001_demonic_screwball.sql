ALTER TABLE `time_blocks` ADD `kind` text DEFAULT 'plan' NOT NULL;--> statement-breakpoint
CREATE INDEX `time_blocks_kind_idx` ON `time_blocks` (`kind`);