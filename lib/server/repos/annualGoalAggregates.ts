import 'server-only';
import { and, between, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { annualGoals, habits, habitLogs } from '../db/schema';
import { AnnualGoal, Habit } from '@/lib/types';
import { computeHabitYearBreakdown } from '@/lib/utils/habitSchedule';

type Db = Pick<ReturnType<typeof getDb>, 'select' | 'update'>;
type StoredGoal = typeof annualGoals.$inferSelect;

export const automaticMonthlyActuals = (db: Db, goal: Pick<StoredGoal, 'id' | 'userId' | 'year'>): number[] => {
  const logs = db.select({ habitId: habitLogs.habitId, date: habitLogs.date })
    .from(habitLogs)
    .innerJoin(habits, and(eq(habits.id, habitLogs.habitId), eq(habits.userId, habitLogs.userId)))
    .where(and(eq(habits.userId, goal.userId), eq(habits.annualGoalId, goal.id),
      between(habitLogs.date, `${goal.year}-01-01`, `${goal.year}-12-31`))).all();
  const counts = Array<number>(12).fill(0);
  const seen = new Set<string>();
  for (const log of logs) {
    const key = `${log.habitId}:${log.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts[Number(log.date.slice(5, 7)) - 1] += 1;
  }
  return counts;
};

export const actualAdjustments = (goal: StoredGoal, automatic: number[]): (number | null)[] =>
  goal.monthlyActualAdjustments ?? goal.monthlyActuals.map((value, i) =>
    value === null && automatic[i] === 0 ? null : (value ?? 0) - automatic[i]);

// Also initializes old backup rows before their linked logs or habits mutate.
export const preserveAnnualActualBaseline = (db: Db, userId: string, id: string): void => {
  const goal = db.select().from(annualGoals)
    .where(and(eq(annualGoals.userId, userId), eq(annualGoals.id, id))).get();
  if (!goal || goal.monthlyActualAdjustments !== null) return;
  db.update(annualGoals).set({ monthlyActualAdjustments: actualAdjustments(goal, automaticMonthlyActuals(db, goal)) })
    .where(and(eq(annualGoals.userId, userId), eq(annualGoals.id, id))).run();
};

export const projectAnnualGoal = (db: Db, goal: StoredGoal): AnnualGoal => {
  const automatic = automaticMonthlyActuals(db, goal);
  const offsets = actualAdjustments(goal, automatic);
  const { monthlyActualAdjustments: _offsets, ...publicGoal } = goal;
  void _offsets;
  return {
    ...publicGoal,
    monthlyActuals: offsets.map((value, i) => value === null && automatic[i] === 0
      ? null : Math.max(0, (value ?? 0) + automatic[i])),
  } as AnnualGoal;
};

export const syncAnnualTargets = (db: Db, userId: string, id: string): void => {
  const goal = db.select().from(annualGoals)
    .where(and(eq(annualGoals.userId, userId), eq(annualGoals.id, id))).get();
  if (!goal) return;
  const linked = db.select().from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.annualGoalId, id))).all() as Habit[];
  const monthlyTargets = Array<number>(12).fill(0);
  for (const habit of linked) {
    computeHabitYearBreakdown(habit.schedule, goal.year).monthlyTargets.forEach((n, i) => { monthlyTargets[i] += n; });
  }
  db.update(annualGoals).set({ monthlyTargets, target: monthlyTargets.reduce((a, b) => a + b, 0), updatedAt: new Date().toISOString() })
    .where(and(eq(annualGoals.userId, userId), eq(annualGoals.id, id))).run();
};
