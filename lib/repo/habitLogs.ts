import { db, markDirty } from '../db';
import { HabitLog } from '../types';
import { newId } from '../utils/id';

export const toggleHabit = async (
  habitId: string,
  date: string
): Promise<boolean> => {
  const existing = await db.habitLogs.where({ habitId, date }).first();
  if (existing) {
    await db.habitLogs.delete(existing.id);
    await markDirty();
    return false;
  }
  const log: HabitLog = {
    id: newId(),
    habitId,
    date,
    createdAt: new Date().toISOString(),
  };
  await db.habitLogs.put(log);
  await markDirty();
  return true;
};

export const listLogsForRange = async (
  startDate: string,
  endDate: string
): Promise<HabitLog[]> => {
  return db.habitLogs.where('date').between(startDate, endDate, true, true).toArray();
};
