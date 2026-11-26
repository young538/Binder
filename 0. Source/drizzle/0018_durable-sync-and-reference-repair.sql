CREATE TABLE `google_event_updates` (
	`local_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`google_email` text NOT NULL,
	`revision` text NOT NULL,
	`lease` text,
	`lease_expires_at` text,
	FOREIGN KEY (`local_id`) REFERENCES `life_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `google_calendar_connections`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `google_event_updates_account` ON `google_event_updates` (`user_id`,`google_email`);--> statement-breakpoint
CREATE TABLE `google_task_deletions` (
	`user_id` text NOT NULL,
	`google_email` text NOT NULL,
	`list_id` text NOT NULL,
	`task_id` text NOT NULL,
	`todo_id` text NOT NULL,
	`not_before` text NOT NULL,
	PRIMARY KEY(`user_id`, `google_email`, `list_id`, `task_id`),
	FOREIGN KEY (`user_id`) REFERENCES `google_calendar_connections`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `google_calendar_connections` ADD `task_deletion_revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Required category links need a valid replacement per owner, including inside template JSON.
WITH required(user_id, category_id) AS (
  SELECT user_id, category_id FROM time_blocks
  UNION ALL
  SELECT template.user_id, json_extract(block.value, '$.categoryId')
  FROM weekly_templates AS template, json_each(template.blocks) AS block
), affected AS (
  SELECT DISTINCT r.user_id FROM required AS r WHERE NOT EXISTS (
    SELECT 1 FROM categories AS c WHERE c.user_id = r.user_id AND c.id = r.category_id
  )
)
INSERT INTO categories(id, user_id, name, color, "order")
SELECT lower(hex(randomblob(16))), a.user_id, '기타', '#9ca3af',
  (SELECT coalesce(max(c."order"), -1) + 1 FROM categories AS c WHERE c.user_id = a.user_id)
FROM affected AS a WHERE NOT EXISTS (SELECT 1 FROM categories AS c WHERE c.user_id = a.user_id AND c.name = '기타');
--> statement-breakpoint
UPDATE time_blocks AS b SET category_id = (
  SELECT id FROM categories WHERE user_id = b.user_id AND name = '기타' ORDER BY "order", id LIMIT 1
) WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id = b.user_id AND id = b.category_id);
--> statement-breakpoint
UPDATE weekly_templates AS t SET blocks = (
  SELECT json_group_array(json(CASE WHEN c.id IS NULL THEN json_set(b.value, '$.categoryId',
    (SELECT id FROM categories WHERE user_id = t.user_id AND name = '기타' ORDER BY "order", id LIMIT 1))
    ELSE b.value END) ORDER BY b.key)
  FROM json_each(t.blocks) AS b LEFT JOIN categories AS c
    ON c.user_id = t.user_id AND c.id = json_extract(b.value, '$.categoryId')
) WHERE EXISTS (
  SELECT 1 FROM json_each(t.blocks) AS b WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE user_id = t.user_id AND id = json_extract(b.value, '$.categoryId'))
);
--> statement-breakpoint
UPDATE projects AS item SET category_id = NULL WHERE category_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM categories WHERE user_id = item.user_id AND id = item.category_id);
--> statement-breakpoint
UPDATE habits AS item SET category_id = NULL WHERE category_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM categories WHERE user_id = item.user_id AND id = item.category_id);
--> statement-breakpoint
UPDATE todos AS item SET category_id = NULL WHERE category_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM categories WHERE user_id = item.user_id AND id = item.category_id);
--> statement-breakpoint
UPDATE finance_transactions AS item SET subscription_id = NULL WHERE subscription_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE user_id = item.user_id AND id = item.subscription_id);
--> statement-breakpoint
-- Earlier deletes contacted Google immediately. Undo those legacy snapshots as new unlinked tasks.
UPDATE todo_trash SET snapshot = json_remove(snapshot, '$.googleTaskId', '$.googleTaskListId', '$.googleTaskUpdatedAt')
WHERE json_extract(snapshot, '$.googleTaskId') IS NOT NULL;
