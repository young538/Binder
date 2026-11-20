import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { habits, habitLogs } from '../db/schema';
import { Habit } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import { preserveAnnualActualBaseline, syncAnnualTargets } from './annualGoalAggregates';
import { stripUndefined } from '../db/patch';
import type { BinderDatabase } from '../db/connection';

/** User-scoped habits operations; accepts an isolated database for tests. */
export class HabitRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  async list(): Promise<Habit[]> {
    const userId = this.userId;
    const db = this.database;
    const rows = await db
      .select()
      .from(habits)
      .where(eq(habits.userId, userId))
      .orderBy(asc(habits.order))
      .all();
    return rows as Habit[];
  }

  async syncAnnualGoal(annualGoalId: string): Promise<void> {
    const userId = this.userId;
    this.database.transaction(tx => syncAnnualTargets(tx, userId, annualGoalId), { behavior: 'immediate' });
  }

  async create(data: Omit<Habit, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Habit> {
    const userId = this.userId;
    const db = this.database;
    const now = new Date().toISOString();
    const row: Habit = { ...data, id: newId(), userId, createdAt: now, updatedAt: now };
    db.transaction(tx => {
      if (row.annualGoalId) preserveAnnualActualBaseline(tx, userId, row.annualGoalId);
      tx.insert(habits).values(row).run();
      if (row.annualGoalId) syncAnnualTargets(tx, userId, row.annualGoalId);
    }, { behavior: 'immediate' });
    return row;
  }

  async update(id: string, patch: Partial<Omit<Habit, 'id' | 'userId' | 'createdAt'>>): Promise<Habit | null> {
    const userId = this.userId;
    return this.database.transaction(tx => {
      const before = tx.select().from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.id, id))).get();
      if (!before) return null;
      const affected = new Set([before.annualGoalId, patch.annualGoalId].filter((value): value is string => !!value));
      for (const goalId of affected) preserveAnnualActualBaseline(tx, userId, goalId);
      tx.update(habits).set({ ...stripUndefined(patch), updatedAt: new Date().toISOString() })
        .where(and(eq(habits.userId, userId), eq(habits.id, id))).run();
      for (const goalId of affected) syncAnnualTargets(tx, userId, goalId);
      return tx.select().from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.id, id))).get() as Habit;
    }, { behavior: 'immediate' });
  }

  async delete(id: string): Promise<void> {
    const userId = this.userId;
    this.database.transaction(tx => {
      const before = tx.select().from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.id, id))).get();
      if (!before) return;
      if (before.annualGoalId) preserveAnnualActualBaseline(tx, userId, before.annualGoalId);
      tx.delete(habitLogs).where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitId, id))).run();
      tx.delete(habits).where(and(eq(habits.userId, userId), eq(habits.id, id))).run();
      if (before.annualGoalId) syncAnnualTargets(tx, userId, before.annualGoalId);
    }, { behavior: 'immediate' });
  }
}

// Compatibility functions for existing callers. New services can inject the repository.
export const listHabits = async (userId: string): Promise<Habit[]> =>
  new HabitRepository(getDb(), userId).list();

export const syncAnnualGoalFromHabits = async (userId: string, annualGoalId: string): Promise<void> =>
  new HabitRepository(getDb(), userId).syncAnnualGoal(annualGoalId);

export const createHabit = async (userId: string, data: Omit<Habit, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Habit> =>
  new HabitRepository(getDb(), userId).create(data);

export const updateHabit = async (userId: string, id: string, patch: Partial<Omit<Habit, 'id' | 'userId' | 'createdAt'>>): Promise<Habit | null> =>
  new HabitRepository(getDb(), userId).update(id, patch);

export const deleteHabit = async (userId: string, id: string): Promise<void> =>
  new HabitRepository(getDb(), userId).delete(id);
