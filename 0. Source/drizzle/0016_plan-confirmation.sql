ALTER TABLE `time_blocks` ADD `source_plan_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `time_blocks_user_source_plan_idx` ON `time_blocks` (`user_id`,`source_plan_id`);
--> statement-breakpoint
WITH ranked AS (
  SELECT id, kind,
    row_number() OVER (
      PARTITION BY user_id, date, start_min, end_min, text, category_id, goal_id, project_id, todo_id, kind
      ORDER BY created_at, id
    ) AS position,
    dense_rank() OVER (
      ORDER BY user_id, date, start_min, end_min, text, category_id, goal_id, project_id, todo_id
    ) AS signature
  FROM time_blocks
)
UPDATE time_blocks AS actual
SET source_plan_id = plan.id
FROM ranked AS prior JOIN ranked AS plan
  ON plan.signature = prior.signature AND plan.position = prior.position AND plan.kind = 'plan'
WHERE prior.kind = 'actual' AND actual.id = prior.id;
--> statement-breakpoint
WITH linked AS (
  SELECT id, row_number() OVER (
    PARTITION BY user_id, google_task_list_id, google_task_id ORDER BY created_at, id
  ) AS position
  FROM todos WHERE google_task_id IS NOT NULL AND google_task_list_id IS NOT NULL
)
UPDATE todos SET google_task_id = NULL, google_task_list_id = NULL, google_task_updated_at = NULL
WHERE id IN (SELECT id FROM linked WHERE position > 1);
