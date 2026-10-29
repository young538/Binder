import 'server-only';
import { and, between, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { habitLogs, habits } from '../db/schema';
import { HabitLog } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import { preserveAnnualActualBaseline } from './annualGoalAggregates';
import type { BinderDatabase } from '../db/connection';

/** User-scoped habitLogs operations; accepts an isolated database for tests. */
export class HabitLogRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  async toggle(habitId: string, date: string): Promise<boolean> {
    const userId = this.userId;
    return this.database.transaction(tx => {
      const habit = tx.select().from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.id, habitId))).get();
      if (!habit) throw new Error('Habit not found');
      if (habit.annualGoalId) preserveAnnualActualBaseline(tx, userId, habit.annualGoalId);
      const predicate = and(eq(habitLogs.userId, userId), eq(habitLogs.habitId, habitId), eq(habitLogs.date, date));
      const existing = tx.select().from(habitLogs).where(predicate).get();
      if (existing) {
        // Remove all legacy duplicates as one logical completion.
        tx.delete(habitLogs).where(predicate).run();
        return false;
      }
      tx.insert(habitLogs).values({ id: newId(), userId, habitId, date, createdAt: new Date().toISOString() }).run();
      return true;
    }, { behavior: 'immediate' });
  }

  async listInRange(startDate: string, endDate: string): Promise<HabitLog[]> {
    const userId = this.userId;
    const db = this.database;
    const rows = await db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), between(habitLogs.date, startDate, endDate)))
      .all();
    return rows as HabitLog[];
  }
}

// Compatibility functions for existing callers. New services can inject the repository.
export const toggleHabit = async (userId: string, habitId: string, date: string): Promise<boolean> =>
  new HabitLogRepository(getDb(), userId).toggle(habitId, date);

export const listLogsForRange = async (userId: string, startDate: string, endDate: string): Promise<HabitLog[]> =>
  new HabitLogRepository(getDb(), userId).listInRange(startDate, endDate);
