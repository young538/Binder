import 'server-only';
import { and, between, eq } from 'drizzle-orm';
import { getDb } from './db/client';
import { annualGoals, habits, habitLogs, timeBlocks, todos } from './db/schema';
import { AnnualGoal, Habit, HabitLog, TimeBlock } from '@/lib/types';
import { toIsoDate, weekDates } from '@/lib/utils/date';
import { addDays, startOfMonth, endOfMonth } from 'date-fns';

import { computeHabitStatsForRange, expectedHabitCountInRange } from '@/lib/utils/habitSchedule';
import { projectAnnualGoal } from './repos/annualGoalAggregates';

export const effectiveMonthlyTarget = (
  ag: Pick<AnnualGoal, 'target' | 'monthlyTargets'>,
  monthIdx: number
): number | null => {
  const explicit = ag.monthlyTargets?.[monthIdx];
  if (explicit !== null && explicit !== undefined) return explicit;
  if (!ag.target || ag.target <= 0) return null;
  return ag.target / 12;
};

export const expectedCountInMonth = expectedHabitCountInRange;

import type { GoalProgress } from '@/lib/progress/types';
export type { GoalProgress } from '@/lib/progress/types';
import type { BinderDatabase } from './db/connection';

export class GoalProgressService {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  async calculate(goalId: string, now: Date = new Date()): Promise<GoalProgress> {
    const userId = this.userId;
    const db = this.database;
    const year = String(now.getFullYear());

    const annualRows = (db
      .select()
      .from(annualGoals)
      .where(and(eq(annualGoals.userId, userId), eq(annualGoals.parentGoalId, goalId)))
      .all()).filter(row => row.year === year).map(row => projectAnnualGoal(db, row));
    let numeric: GoalProgress['numeric'];
    const numericGoals = annualRows.filter(goal => (goal.target ?? 0) > 0);
    const target = numericGoals.reduce((sum, goal) => sum + (goal.target ?? 0), 0);
    if (target > 0) {
      const current = numericGoals.reduce((sum, goal) => sum + goal.monthlyActuals.reduce<number>((s, value) => s + (value ?? 0), 0), 0);
      numeric = { target, current, percent: Math.min(100, Math.round(current / target * 100)) };
    }

    const habitRows = (db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.parentGoalId, goalId)))
      .all()) as Habit[];
    let habitStats: GoalProgress['habits'];
    if (habitRows.length > 0) {
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const startStr = toIsoDate(monthStart);
      const endStr = toIsoDate(monthEnd);
      const logs = db
        .select({ id: habitLogs.id, userId: habitLogs.userId, habitId: habitLogs.habitId, date: habitLogs.date, createdAt: habitLogs.createdAt })
        .from(habitLogs)
        .innerJoin(habits, and(eq(habits.id, habitLogs.habitId), eq(habits.userId, habitLogs.userId)))
        .where(and(eq(habitLogs.userId, userId), eq(habits.parentGoalId, goalId), between(habitLogs.date, startStr, endStr)))
        .all();
      const stats = computeHabitStatsForRange(habitRows, logs as HabitLog[], monthStart, monthEnd);
      habitStats = { total: stats.total, thisMonthLogs: stats.logs, expectedThisMonth: stats.expected, percent: stats.percent };
    }

    const allTodos = (db
      .select()
      .from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.parentGoalId, goalId)))
      .all()).filter(todo => {
        const month = toIsoDate(now).slice(0, 7);
        if (todo.scope === 'year') return todo.scopeKey === year;
        if (todo.scope === 'month' || todo.scope === 'day') return todo.scopeKey.slice(0, 7) === month;
        if (todo.scope === 'week') {
          const dates = weekDates(todo.scopeKey).map(toIsoDate);
          return dates[0] <= toIsoDate(endOfMonth(now)) && dates[6] >= toIsoDate(startOfMonth(now));
        }
        return false;
      });
    let todoStats: GoalProgress['todos'];
    if (allTodos.length > 0) {
      const counts = {
        total: allTodos.length,
        done: allTodos.filter(t => t.status === 'done').length,
        postponed: allTodos.filter(t => t.status === 'postponed').length,
        delegated: allTodos.filter(t => t.status === 'delegated').length,
        cancelled: allTodos.filter(t => t.status === 'cancelled').length,
        pending: allTodos.filter(t => t.status === 'pending').length,
      };
      const percent = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
      todoStats = { ...counts, percent };
    }

    const weekStart = addDays(now, -((now.getDay() + 6) % 7));
    const weekStartStr = toIsoDate(weekStart);
    const weekEndStr = toIsoDate(addDays(weekStart, 6));
    const monthStartStr = toIsoDate(startOfMonth(now));
    const monthEndStr = toIsoDate(endOfMonth(now));
    const yearStartStr = `${year}-01-01`;
    const yearEndStr = `${year}-12-31`;
    const tbs = (db
      .select()
      .from(timeBlocks)
      .where(
        and(
          eq(timeBlocks.userId, userId),
          eq(timeBlocks.goalId, goalId),
          eq(timeBlocks.kind, 'actual'),
          between(timeBlocks.date, weekStartStr < yearStartStr ? weekStartStr : yearStartStr,
            weekEndStr > yearEndStr ? weekEndStr : yearEndStr)
        )
      )
      .all()) as TimeBlock[];
    const inRange = (tb: TimeBlock, s: string, e: string) => tb.date >= s && tb.date <= e;
    const dur = (tb: TimeBlock) => Math.max(0, tb.endMin - tb.startMin);
    const weekMin = tbs
      .filter(tb => inRange(tb, weekStartStr, weekEndStr))
      .reduce((s, tb) => s + dur(tb), 0);
    const monthMin = tbs
      .filter(tb => inRange(tb, monthStartStr, monthEndStr))
      .reduce((s, tb) => s + dur(tb), 0);
    const yearMin = tbs.filter(tb => inRange(tb, yearStartStr, yearEndStr)).reduce((s, tb) => s + dur(tb), 0);
    const timeInvested = { weekMin, monthMin, yearMin };

    const parts: number[] = [];
    if (numeric) parts.push(numeric.percent);
    if (habitStats) parts.push(habitStats.percent);
    if (todoStats) parts.push(todoStats.percent);
    const overall =
      parts.length > 0 ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;

    return {
      goalId,
      numeric,
      habits: habitStats,
      todos: todoStats,
      timeInvested,
      overall,
    };
  }
}

export const computeGoalProgress = async (userId: string, goalId: string, now: Date = new Date()): Promise<GoalProgress> =>
  new GoalProgressService(getDb(), userId).calculate(goalId, now);
