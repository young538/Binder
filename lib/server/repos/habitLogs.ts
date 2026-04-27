import 'server-only';
import { and, between, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { habitLogs, habits, annualGoals } from '../db/schema';
import { HabitLog } from '@/lib/types';
import { newId } from '@/lib/utils/id';

const bumpLinkedAnnualGoal = async (
  habitId: string,
  date: string,
  delta: 1 | -1
): Promise<void> => {
  const db = getDb();
  const habit = await db.select().from(habits).where(eq(habits.id, habitId)).get();
  if (!habit?.annualGoalId) return;
  const ag = await db.select().from(annualGoals).where(eq(annualGoals.id, habit.annualGoalId)).get();
  if (!ag) return;
  if (date.slice(0, 4) !== ag.year) return;
  const monthIdx = Number(date.slice(5, 7)) - 1;
  if (monthIdx < 0 || monthIdx > 11) return;
  const actuals = [...ag.monthlyActuals];
  const current = actuals[monthIdx] ?? 0;
  actuals[monthIdx] = Math.max(0, current + delta);
  await db
    .update(annualGoals)
    .set({ monthlyActuals: actuals, updatedAt: new Date().toISOString() })
    .where(eq(annualGoals.id, habit.annualGoalId))
    .run();
};

export const toggleHabit = async (habitId: string, date: string): Promise<boolean> => {
  const db = getDb();
  const existing = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)))
    .get();
  if (existing) {
    await db.delete(habitLogs).where(eq(habitLogs.id, existing.id)).run();
    await bumpLinkedAnnualGoal(habitId, date, -1);
    return false;
  }
  const row: HabitLog = {
    id: newId(),
    habitId,
    date,
    createdAt: new Date().toISOString(),
  };
  await db.insert(habitLogs).values(row).run();
  await bumpLinkedAnnualGoal(habitId, date, 1);
  return true;
};

export const listLogsForRange = async (
  startDate: string,
  endDate: string
): Promise<HabitLog[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(habitLogs)
    .where(between(habitLogs.date, startDate, endDate))
    .all();
  return rows as HabitLog[];
};
