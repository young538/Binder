import { db } from './db';
import { AnnualGoal, TimeBlock } from './types';
import { listByParentGoal } from './repo/todos';
import { toIsoDate } from './utils/date';
import { addDays, startOfMonth, endOfMonth } from 'date-fns';

export interface GoalProgress {
  goalId: string;
  numeric?: {
    target: number;
    current: number;
    percent: number;
  };
  habits?: {
    total: number;
    thisMonthLogs: number;
    daysInMonth: number;
    percent: number;
  };
  routines?: {
    total: number;
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
  timeInvested: {
    weekMin: number;
    monthMin: number;
    yearMin: number;
  };
  overall: number;
}

export const computeGoalProgress = async (
  goalId: string,
  now: Date = new Date()
): Promise<GoalProgress> => {
  const year = String(now.getFullYear());

  // 1) AnnualGoals linked
  const annualGoals = await db.annualGoals.where('parentGoalId').equals(goalId).toArray();
  const ag: AnnualGoal | undefined = annualGoals.find(g => g.year === year);
  let numeric: GoalProgress['numeric'];
  if (ag && ag.target && ag.target > 0) {
    const current = ag.monthlyActuals.reduce<number>((s, v) => s + (v ?? 0), 0);
    const percent = Math.min(100, Math.round((current / ag.target) * 100));
    numeric = { target: ag.target, current, percent };
  }

  // 2) Habits
  const habits = await db.habits.where('parentGoalId').equals(goalId).toArray();
  let habitStats: GoalProgress['habits'];
  if (habits.length > 0) {
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86400000) + 1;
    const startStr = toIsoDate(monthStart);
    const endStr = toIsoDate(monthEnd);
    const habitIds = new Set(habits.map(h => h.id));
    const logs = await db.habitLogs.where('date').between(startStr, endStr, true, true).toArray();
    const relevantLogs = logs.filter(l => habitIds.has(l.habitId));
    const expected = habits.length * daysInMonth;
    const percent = expected > 0 ? Math.min(100, Math.round((relevantLogs.length / expected) * 100)) : 0;
    habitStats = {
      total: habits.length,
      thisMonthLogs: relevantLogs.length,
      daysInMonth,
      percent,
    };
  }

  // 3) Routines
  const routines = await db.routines.where('parentGoalId').equals(goalId).toArray();
  const routineStats = routines.length > 0 ? { total: routines.length } : undefined;

  // 4) TODOs
  const allTodos = await listByParentGoal(goalId);
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

  // 5) TimeBlocks
  const weekStart = addDays(now, -((now.getDay() + 6) % 7)); // Monday
  const weekStartStr = toIsoDate(weekStart);
  const weekEndStr = toIsoDate(addDays(weekStart, 6));
  const monthStartStr = toIsoDate(startOfMonth(now));
  const monthEndStr = toIsoDate(endOfMonth(now));
  const yearStartStr = `${year}-01-01`;
  const yearEndStr = `${year}-12-31`;
  const tbs: TimeBlock[] = await db.timeBlocks.where('goalId').equals(goalId).toArray();
  const inRange = (tb: TimeBlock, s: string, e: string) => tb.date >= s && tb.date <= e;
  const dur = (tb: TimeBlock) => tb.endMin - tb.startMin;
  const weekMin = tbs.filter(tb => inRange(tb, weekStartStr, weekEndStr)).reduce((s, tb) => s + dur(tb), 0);
  const monthMin = tbs.filter(tb => inRange(tb, monthStartStr, monthEndStr)).reduce((s, tb) => s + dur(tb), 0);
  const yearMin = tbs.filter(tb => inRange(tb, yearStartStr, yearEndStr)).reduce((s, tb) => s + dur(tb), 0);
  const timeInvested = { weekMin, monthMin, yearMin };

  // 6) Overall weighted (simple average of available percents)
  const parts: number[] = [];
  if (numeric) parts.push(numeric.percent);
  if (habitStats) parts.push(habitStats.percent);
  if (todoStats) parts.push(todoStats.percent);
  const overall = parts.length > 0
    ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
    : 0;

  return {
    goalId,
    numeric,
    habits: habitStats,
    routines: routineStats,
    todos: todoStats,
    timeInvested,
    overall,
  };
};

export const computeMultipleProgress = async (
  goalIds: string[],
  now: Date = new Date()
): Promise<Map<string, GoalProgress>> => {
  const map = new Map<string, GoalProgress>();
  await Promise.all(goalIds.map(async id => {
    const p = await computeGoalProgress(id, now);
    map.set(id, p);
  }));
  return map;
};
