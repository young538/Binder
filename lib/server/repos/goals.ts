import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { goals } from '../db/schema';
import { Goal } from '@/lib/types';
import { newId } from '@/lib/utils/id';

export const listGoals = async (userId: string): Promise<Goal[]> => {
  const db = getDb();
  const rows = await db.select().from(goals).where(eq(goals.userId, userId)).all();
  return rows as Goal[];
};

export const createGoal = async (
  userId: string,
  data: Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Goal> => {
  const db = getDb();
  const now = new Date().toISOString();
  const row: Goal = { ...data, id: newId(), userId, createdAt: now, updatedAt: now };
  await db.insert(goals).values(row).run();
  return row;
};

export const updateGoal = async (
  userId: string,
  id: string,
  patch: Partial<Omit<Goal, 'id' | 'userId' | 'createdAt'>>
): Promise<Goal | null> => {
  const db = getDb();
  await db
    .update(goals)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(goals.userId, userId), eq(goals.id, id)))
    .run();
  const row = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.id, id)))
    .get();
  return (row as Goal | undefined) ?? null;
};

export const deleteGoal = async (userId: string, id: string): Promise<void> => {
  const db = getDb();
  await db.delete(goals).where(and(eq(goals.userId, userId), eq(goals.id, id))).run();
};
