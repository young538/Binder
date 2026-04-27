import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { goals } from '../db/schema';
import { Goal } from '@/lib/types';
import { newId } from '@/lib/utils/id';

export const listGoals = async (): Promise<Goal[]> => {
  const db = getDb();
  const rows = await db.select().from(goals).all();
  return rows as Goal[];
};

export const createGoal = async (
  data: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Goal> => {
  const db = getDb();
  const now = new Date().toISOString();
  const row: Goal = { ...data, id: newId(), createdAt: now, updatedAt: now };
  await db.insert(goals).values(row).run();
  return row;
};

export const updateGoal = async (
  id: string,
  patch: Partial<Omit<Goal, 'id' | 'createdAt'>>
): Promise<Goal | null> => {
  const db = getDb();
  await db
    .update(goals)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(goals.id, id))
    .run();
  const row = await db.select().from(goals).where(eq(goals.id, id)).get();
  return (row as Goal | undefined) ?? null;
};

export const deleteGoal = async (id: string): Promise<void> => {
  const db = getDb();
  await db.delete(goals).where(eq(goals.id, id)).run();
};
