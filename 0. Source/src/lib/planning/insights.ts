import { toSeoulDate } from '@/lib/utils/seoulTime';
import type { Goal, Habit, HabitLog, TimeBlock, Todo } from '@/lib/types';

export interface GoalReview {
  goal: Goal;
  descendantCount: number;
  pendingTodos: Todo[];
  completedTodos: number;
  habits: { id: string; name: string; checks: number }[];
  actualMinutes: number;
  inactive: boolean;
}

/** Each goal includes its descendants exactly once, even with malformed cyclic imports. */
export function reviewGoals(goals: Goal[], todos: Todo[], habits: Habit[], logs: HabitLog[], blocks: TimeBlock[], start: string, end: string): GoalReview[] {
  const reviews = new Map<string, GoalReview>(goals.map(goal => [goal.id, {
    goal, descendantCount: 0, pendingTodos: [], completedTodos: 0, habits: [], actualMinutes: 0, inactive: true,
  }]));
  function* lineage(id?: string | null): Generator<GoalReview> {
    const seen = new Set<string>();
    let review = id ? reviews.get(id) : undefined;
    while (review && !seen.has(review.goal.id)) {
      seen.add(review.goal.id);
      yield review;
      review = review.goal.parentId ? reviews.get(review.goal.parentId) : undefined;
    }
  }

  for (const goal of goals) {
    for (const review of lineage(goal.id)) {
      if (review.goal.id !== goal.id) review.descendantCount++;
    }
  }
  for (const todo of todos) {
    if (!todo.parentGoalId || !reviews.has(todo.parentGoalId)) continue;
    if (todo.status === 'pending' || todo.status === 'postponed') {
      for (const review of lineage(todo.parentGoalId)) review.pendingTodos.push(todo);
    } else if (todo.status === 'done') {
      const completed = todo.completedAt ? new Date(todo.completedAt) : null;
      if (completed && !Number.isFinite(completed.getTime())) continue;
      const day = completed ? toSeoulDate(completed) : todo.scope === 'day' ? todo.scopeKey : '';
      if (day >= start && day <= end) {
        for (const review of lineage(todo.parentGoalId)) review.completedTodos++;
      }
    }
  }
  const checkedDates = new Map<string, Set<string>>();
  for (const log of logs) {
    if (log.date < start || log.date > end) continue;
    const dates = checkedDates.get(log.habitId);
    if (dates) dates.add(log.date);
    else checkedDates.set(log.habitId, new Set([log.date]));
  }
  for (const habit of habits) {
    for (const review of lineage(habit.parentGoalId)) {
      review.habits.push({ id: habit.id, name: habit.name, checks: checkedDates.get(habit.id)?.size ?? 0 });
    }
  }
  for (const block of blocks) {
    if (block.kind !== 'actual' || block.date < start || block.date > end) continue;
    for (const review of lineage(block.goalId)) review.actualMinutes += block.endMin - block.startMin;
  }
  for (const review of reviews.values()) {
    review.inactive = review.completedTodos === 0 && review.actualMinutes === 0 && review.habits.every(h => h.checks === 0);
  }
  return [...reviews.values()];
}

export function comparePlanActual(blocks: TimeBlock[]) {
  const rows = new Map<string, { categoryId: string; plan: number; actual: number }>();
  for (const block of blocks) {
    const row = rows.get(block.categoryId) ?? { categoryId: block.categoryId, plan: 0, actual: 0 };
    row[block.kind] += block.endMin - block.startMin;
    rows.set(block.categoryId, row);
  }
  return [...rows.values()].map(row => ({ ...row, difference: row.actual - row.plan }));
}
