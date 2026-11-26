CREATE TABLE `google_event_deletions` (
	`user_id` text NOT NULL,
	`google_email` text NOT NULL,
	`calendar_id` text NOT NULL,
	`event_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `google_email`, `calendar_id`, `event_id`),
	FOREIGN KEY (`user_id`) REFERENCES `google_calendar_connections`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `google_calendar_connections` ADD `event_deletion_revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE goals AS item SET parent_id = NULL
WHERE parent_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM goals AS g WHERE g.user_id = item.user_id AND g.id = item.parent_id
);
--> statement-breakpoint
UPDATE todos AS item SET parent_goal_id = NULL
WHERE parent_goal_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM goals AS g WHERE g.user_id = item.user_id AND g.id = item.parent_goal_id
);
--> statement-breakpoint
UPDATE annual_goals AS item SET parent_goal_id = NULL
WHERE parent_goal_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM goals AS g WHERE g.user_id = item.user_id AND g.id = item.parent_goal_id
);
--> statement-breakpoint
UPDATE habits AS item SET parent_goal_id = NULL
WHERE parent_goal_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM goals AS g WHERE g.user_id = item.user_id AND g.id = item.parent_goal_id
);
--> statement-breakpoint
UPDATE projects AS item SET goal_id = NULL
WHERE goal_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM goals AS g WHERE g.user_id = item.user_id AND g.id = item.goal_id
);
--> statement-breakpoint
UPDATE time_blocks AS item SET goal_id = NULL
WHERE goal_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM goals AS g WHERE g.user_id = item.user_id AND g.id = item.goal_id
);
--> statement-breakpoint
UPDATE metrics AS item SET goal_id = NULL
WHERE goal_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM goals AS g WHERE g.user_id = item.user_id AND g.id = item.goal_id
);
--> statement-breakpoint
UPDATE binder_notes AS item SET goal_id = NULL
WHERE goal_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM goals AS g WHERE g.user_id = item.user_id AND g.id = item.goal_id
);
--> statement-breakpoint
UPDATE life_events AS item SET goal_id = NULL
WHERE goal_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM goals AS g WHERE g.user_id = item.user_id AND g.id = item.goal_id
);
--> statement-breakpoint
UPDATE weekly_templates AS template SET blocks = (
  SELECT json_group_array(json(CASE
    WHEN json_extract(block.value, '$.goalId') IS NOT NULL AND goal.id IS NULL
    THEN json_remove(block.value, '$.goalId') ELSE block.value END) ORDER BY block.key)
  FROM json_each(template.blocks) AS block
  LEFT JOIN goals AS goal ON goal.user_id = template.user_id AND goal.id = json_extract(block.value, '$.goalId')
) WHERE EXISTS (
  SELECT 1 FROM json_each(template.blocks) AS block
  WHERE json_extract(block.value, '$.goalId') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM goals AS goal WHERE goal.user_id = template.user_id AND goal.id = json_extract(block.value, '$.goalId')
  )
);
