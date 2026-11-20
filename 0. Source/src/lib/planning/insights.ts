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
  return goals.map(goal => {
    const ids = new Set([goal.id]);
    const queue = [goal.id];
    for (let i = 0; i < queue.length; i++) {
      for (const child of goals.filter(item => item.parentId === queue[i])) {
        if (!ids.has(child.id)) { ids.add(child.id); queue.push(child.id); }
      }
    }
    const linkedTodos = todos.filter(todo => todo.parentGoalId && ids.has(todo.parentGoalId));
    const completedTodos = linkedTodos.filter(todo => {
      const day = todo.completedAt
        ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(todo.completedAt))
        : todo.scope === 'day' ? todo.scopeKey : '';
      return todo.status === 'done' && day >= start && day <= end;
    }).length;
    const linkedHabits = habits.filter(habit => habit.parentGoalId && ids.has(habit.parentGoalId)).map(habit => ({
      id: habit.id, name: habit.name,
      checks: new Set(logs.filter(log => log.habitId === habit.id && log.date >= start && log.date <= end).map(log => log.date)).size,
    }));
    const actualMinutes = blocks.filter(block => block.kind === 'actual' && block.goalId && ids.has(block.goalId) && block.date >= start && block.date <= end)
      .reduce((sum, block) => sum + block.endMin - block.startMin, 0);
    return {
      goal, descendantCount: ids.size - 1,
      pendingTodos: linkedTodos.filter(todo => todo.status === 'pending' || todo.status === 'postponed'),
      completedTodos, habits: linkedHabits, actualMinutes,
      inactive: completedTodos === 0 && actualMinutes === 0 && linkedHabits.every(habit => habit.checks === 0),
    };
  });
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
