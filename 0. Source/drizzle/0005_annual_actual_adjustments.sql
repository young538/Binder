ALTER TABLE annual_goals ADD COLUMN monthly_actual_adjustments text;
--> statement-breakpoint
-- Preserve the legacy displayed totals as a baseline. Historical drift cannot
-- be distinguished from a manual edit; subsequent totals use live logs.
UPDATE annual_goals SET monthly_actual_adjustments = (
  SELECT json_group_array(
    CASE WHEN m.value IS NULL AND (
      SELECT count(*) FROM (
        SELECT DISTINCT l.habit_id, l.date FROM habit_logs l
        JOIN habits h ON h.id = l.habit_id AND h.user_id = l.user_id
        WHERE h.annual_goal_id = annual_goals.id AND h.user_id = annual_goals.user_id
          AND substr(l.date, 1, 4) = annual_goals.year
          AND CAST(substr(l.date, 6, 2) AS integer) = CAST(m.key AS integer) + 1
      )
    ) = 0 THEN NULL ELSE coalesce(m.value, 0) - (
      SELECT count(*) FROM (
        SELECT DISTINCT l.habit_id, l.date FROM habit_logs l
        JOIN habits h ON h.id = l.habit_id AND h.user_id = l.user_id
        WHERE h.annual_goal_id = annual_goals.id AND h.user_id = annual_goals.user_id
          AND substr(l.date, 1, 4) = annual_goals.year
          AND CAST(substr(l.date, 6, 2) AS integer) = CAST(m.key AS integer) + 1
      )
    ) END
  ) FROM json_each(annual_goals.monthly_actuals) m
);
