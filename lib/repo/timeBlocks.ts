import { db, markDirty } from '../db';
import { TimeBlock } from '../types';
import { newId } from '../utils/id';

export const createTimeBlock = async (
  data: Omit<TimeBlock, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TimeBlock> => {
  const now = new Date().toISOString();
  const block: TimeBlock = { ...data, id: newId(), createdAt: now, updatedAt: now };
  await db.timeBlocks.put(block);
  await markDirty();
  return block;
};

export const updateTimeBlock = async (
  id: string,
  patch: Partial<Omit<TimeBlock, 'id' | 'createdAt'>>
): Promise<void> => {
  await db.timeBlocks.update(id, { ...patch, updatedAt: new Date().toISOString() });
  await markDirty();
};

export const deleteTimeBlock = async (id: string): Promise<void> => {
  await db.timeBlocks.delete(id);
  await markDirty();
};

export const getTimeBlocksInRange = async (
  startDate: string,
  endDate: string
): Promise<TimeBlock[]> =>
  db.timeBlocks.where('date').between(startDate, endDate, true, true).toArray();
