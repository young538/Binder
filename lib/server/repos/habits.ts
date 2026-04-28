import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { habits, annualGoals } from '../db/schema';
import { Habit } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import { computeHabitYearBreakdown } from '@/lib/utils/habitSchedule';

export const listHabits = async (userId: string): Promise<Habit[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(habits)
    .where(eq(habits.userId, userId))
    .orderBy(asc(habits.order))
    .all();
  return rows as Habit[];
};

export const syncAnnualGoalFromHabits = async (
  userId: string,
  annualGoalId: string
): Promise<void> => {
  const db = getDb();
  const ag = await db
    .select()
    .from(annualGoals)
    .where(and(eq(annualGoals.userId, userId), eq(annualGoals.id, annualGoalId)))
    .get();
  if (!ag) return;
  const linked = (await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.annualGoalId, annualGoalId)))
    .all()) as Habit[];
  if (linked.length === 0) return;
  const monthlyTargets: number[] = Array(12).fill(0);
  for (const h of linked) {
    const b = computeHabitYearBreakdown(h.schedule, ag.year);
    b.monthlyTargets.forEach((v, i) => { monthlyTargets[i] += v; });
  }
  const target = monthlyTargets.reduce((s, v) => s + v, 0);
  await db
    .update(annualGoals)
    .set({
      target,
      monthlyTargets: monthlyTargets as (number | null)[],
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(annualGoals.userId, userId), eq(annualGoals.id, annualGoalId)))
    .run();
};

export const createHabit = async (
  userId: string,
  data: Omit<Habit, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Habit> => {
  const db = getDb();
  const now = new Date().toISOString();
  const row: Habit = { ...data, id: newId(), userId, createdAt: now, updatedAt: now };
  await db.insert(habits).values(row).run();
  if (row.annualGoalId) await syncAnnualGoalFromHabits(userId, row.annualGoalId);
  return row;
};

export const updateHabit = async (
  userId: string,
  id: string,
  patch: Partial<Omit<Habit, 'id' | 'userId' | 'createdAt'>>
): Promise<Habit | null> => {
  const db = getDb();
  const before = (await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.id, id)))
    .get()) as Habit | undefined;
  await db
    .update(habits)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(habits.userId, userId), eq(habits.id, id)))
    .run();
  const after = (await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.id, id)))
    .get()) as Habit | undefined;
  const affected = new Set<string>();
  if (before?.annualGoalId) affected.add(before.annualGoalId);
  if (after?.annualGoalId) affected.add(after.annualGoalId);
  for (const agId of affected) await syncAnnualGoalFromHabits(userId, agId);
  return after ?? null;
};

export const deleteHabit = async (userId: string, id: string): Promise<void> => {
  const db = getDb();
  const before = (await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.id, id)))
    .get()) as Habit | undefined;
  // habitLogs cascaded via separate delete (no FK cascade)
  const { habitLogs } = await import('../db/schema');
  await db
    .delete(habitLogs)
    .where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitId, id)))
    .run();
  await db.delete(habits).where(and(eq(habits.userId, userId), eq(habits.id, id))).run();
  if (before?.annualGoalId) await syncAnnualGoalFromHabits(userId, before.annualGoalId);
};
