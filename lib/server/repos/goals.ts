import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { goals } from '../db/schema';
import { Goal } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import { stripUndefined } from '../db/patch';
import type { BinderDatabase } from '../db/connection';

/** User-scoped goals operations; accepts an isolated database for tests. */
export class GoalRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  async list(): Promise<Goal[]> {
    const userId = this.userId;
    const db = this.database;
    const rows = await db.select().from(goals).where(eq(goals.userId, userId)).all();
    return rows as Goal[];
  }

  async create(data: Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Goal> {
    const userId = this.userId;
    const db = this.database;
    const now = new Date().toISOString();
    const row: Goal = { ...data, id: newId(), userId, createdAt: now, updatedAt: now };
    await db.insert(goals).values(row).run();
    return row;
  }

  async update(id: string, patch: Partial<Omit<Goal, 'id' | 'userId' | 'createdAt'>>): Promise<Goal | null> {
    const userId = this.userId;
    const db = this.database;
    await db
      .update(goals)
      .set({ ...stripUndefined(patch), updatedAt: new Date().toISOString() })
      .where(and(eq(goals.userId, userId), eq(goals.id, id)))
      .run();
    const row = await db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.id, id)))
      .get();
    return (row as Goal | undefined) ?? null;
  }

  async delete(id: string): Promise<void> {
    const userId = this.userId;
    const db = this.database;
    await db.delete(goals).where(and(eq(goals.userId, userId), eq(goals.id, id))).run();
  }
}

// Compatibility functions for existing callers. New services can inject the repository.
export const listGoals = async (userId: string): Promise<Goal[]> =>
  new GoalRepository(getDb(), userId).list();

export const createGoal = async (userId: string, data: Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Goal> =>
  new GoalRepository(getDb(), userId).create(data);

export const updateGoal = async (userId: string, id: string, patch: Partial<Omit<Goal, 'id' | 'userId' | 'createdAt'>>): Promise<Goal | null> =>
  new GoalRepository(getDb(), userId).update(id, patch);

export const deleteGoal = async (userId: string, id: string): Promise<void> =>
  new GoalRepository(getDb(), userId).delete(id);
