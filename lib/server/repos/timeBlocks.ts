import 'server-only';
import { and, asc, between, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { timeBlocks } from '../db/schema';
import { TimeBlock } from '@/lib/types';
import { newId } from '@/lib/utils/id';

export const getTimeBlocksInRange = async (
  userId: string,
  startDate: string,
  endDate: string
): Promise<TimeBlock[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, userId), between(timeBlocks.date, startDate, endDate)))
    .orderBy(asc(timeBlocks.date), asc(timeBlocks.startMin))
    .all();
  return rows as TimeBlock[];
};

export const createTimeBlock = async (
  userId: string,
  data: Omit<TimeBlock, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<TimeBlock> => {
  const db = getDb();
  const now = new Date().toISOString();
  const row: TimeBlock = { ...data, id: newId(), userId, createdAt: now, updatedAt: now };
  await db.insert(timeBlocks).values(row).run();
  return row;
};

export const updateTimeBlock = async (
  userId: string,
  id: string,
  patch: Partial<Omit<TimeBlock, 'id' | 'userId' | 'createdAt'>>
): Promise<TimeBlock | null> => {
  const db = getDb();
  await db
    .update(timeBlocks)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, id)))
    .run();
  const row = await db
    .select()
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, id)))
    .get();
  return (row as TimeBlock | undefined) ?? null;
};

export const deleteTimeBlock = async (userId: string, id: string): Promise<void> => {
  const db = getDb();
  await db
    .delete(timeBlocks)
    .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, id)))
    .run();
};
