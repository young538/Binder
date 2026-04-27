import 'server-only';
import { and, between, eq } from 'drizzle-orm';
import { getDb } from './db/client';
import { annualGoals, habits, habitLogs, timeBlocks, todos } from './db/schema';
import { AnnualGoal, Habit, HabitSchedule, TimeBlock, Weekday } from '@/lib/types';
import { toIsoDate } from '@/lib/utils/date';
import { addDays, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';

export const effectiveMonthlyTarget = (
  ag: Pick<AnnualGoal, 'target' | 'monthlyTargets'>,
  monthIdx: number
): number | null => {
  const explicit = ag.monthlyTargets?.[monthIdx];
  if (explicit !== null && explicit !== undefined) return explicit;
  if (!ag.target || ag.target <= 0) return null;
  return ag.target / 12;
};

export const expectedCountInMonth = (
  schedule: HabitSchedule | undefined,
  monthStart: Date,
  monthEnd: Date
): number => {
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const sched: HabitSchedule = schedule ?? { kind: 'daily' };
  if (sched.kind === 'daily') return days.length;
  if (sched.kind === 'weekdays') {
    const set = new Set<Weekday>(sched.days);
    return days.filter(d => set.has(d.getDay() as Weekday)).length;
  }
  if (sched.kind === 'perWeek') {
    return Math.round(sched.count * (days.length / 7));
  }
  return sched.count;
};

export interface GoalProgress {
  goalId: string;
  numeric?: { target: number; current: number; percent: number };
  habits?: {
    total: number;
    thisMonthLogs: number;
    expectedThisMonth: number;
    percent: number;
  };
  todos?: {
    total: number;
    done: number;
    postponed: number;
    delegated: number;
    cancelled: number;
    pending: number;
    percent: number;
  };
  timeInvested: { weekMin: number; monthMin: number; yearMin: number };
  overall: number;
}

export const computeGoalProgress = async (
  goalId: string,
  now: Date = new Date()
): Promise<GoalProgress> => {
  const db = getDb();
  const year = String(now.getFullYear());

  const annualRows = (await db
    .select()
    .from(annualGoals)
    .where(eq(annualGoals.parentGoalId, goalId))
    .all()) as AnnualGoal[];
  const ag = annualRows.find(g => g.year === year);
  let numeric: GoalProgress['numeric'];
  if (ag && ag.target && ag.target > 0) {
    const current = ag.monthlyActuals.reduce<number>((s, v) => s + (v ?? 0), 0);
    const percent = Math.min(100, Math.round((current / ag.target) * 100));
    numeric = { target: ag.target, current, percent };
  }

  const habitRows = (await db
    .select()
    .from(habits)
    .where(eq(habits.parentGoalId, goalId))
    .all()) as Habit[];
  let habitStats: GoalProgress['habits'];
  if (habitRows.length > 0) {
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const startStr = toIsoDate(monthStart);
    const endStr = toIsoDate(monthEnd);
    const habitIds = new Set(habitRows.map(h => h.id));
    const logs = await db
      .select()
      .from(habitLogs)
      .where(between(habitLogs.date, startStr, endStr))
      .all();
    const relevantLogs = logs.filter(l => habitIds.has(l.habitId));
    const expected = habitRows.reduce(
      (sum, h) => sum + expectedCountInMonth(h.schedule, monthStart, monthEnd),
      0
    );
    const percent =
      expected > 0 ? Math.min(100, Math.round((relevantLogs.length / expected) * 100)) : 0;
    habitStats = {
      total: habitRows.length,
      thisMonthLogs: relevantLogs.length,
      expectedThisMonth: expected,
      percent,
    };
  }

  const allTodos = await db
    .select()
    .from(todos)
    .where(eq(todos.parentGoalId, goalId))
    .all();
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
  const tbs = (await db
    .select()
    .from(timeBlocks)
    .where(and(eq(timeBlocks.goalId, goalId), between(timeBlocks.date, yearStartStr, yearEndStr)))
    .all()) as TimeBlock[];
  const inRange = (tb: TimeBlock, s: string, e: string) => tb.date >= s && tb.date <= e;
  const dur = (tb: TimeBlock) => tb.endMin - tb.startMin;
  const weekMin = tbs
    .filter(tb => inRange(tb, weekStartStr, weekEndStr))
    .reduce((s, tb) => s + dur(tb), 0);
  const monthMin = tbs
    .filter(tb => inRange(tb, monthStartStr, monthEndStr))
    .reduce((s, tb) => s + dur(tb), 0);
  const yearMin = tbs.reduce((s, tb) => s + dur(tb), 0);
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
};
