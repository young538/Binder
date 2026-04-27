import 'server-only';
import { asc, between, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { timeBlocks } from '../db/schema';
import { TimeBlock } from '@/lib/types';
import { newId } from '@/lib/utils/id';

export const getTimeBlocksInRange = async (
  startDate: string,
  endDate: string
): Promise<TimeBlock[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(timeBlocks)
    .where(between(timeBlocks.date, startDate, endDate))
    .orderBy(asc(timeBlocks.date), asc(timeBlocks.startMin))
    .all();
  return rows as TimeBlock[];
};

export const createTimeBlock = async (
  data: Omit<TimeBlock, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TimeBlock> => {
  const db = getDb();
  const now = new Date().toISOString();
  const row: TimeBlock = { ...data, id: newId(), createdAt: now, updatedAt: now };
  await db.insert(timeBlocks).values(row).run();
  return row;
};

export const updateTimeBlock = async (
  id: string,
  patch: Partial<Omit<TimeBlock, 'id' | 'createdAt'>>
): Promise<TimeBlock | null> => {
  const db = getDb();
  await db
    .update(timeBlocks)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(timeBlocks.id, id))
    .run();
  const row = await db.select().from(timeBlocks).where(eq(timeBlocks.id, id)).get();
  return (row as TimeBlock | undefined) ?? null;
};

export const deleteTimeBlock = async (id: string): Promise<void> => {
  const db = getDb();
  await db.delete(timeBlocks).where(eq(timeBlocks.id, id)).run();
};
