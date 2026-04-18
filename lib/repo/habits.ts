import { db, markDirty } from '../db';
import { Habit } from '../types';
import { newId } from '../utils/id';

export const createHabit = async (
  data: Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Habit> => {
  const now = new Date().toISOString();
  const h: Habit = { ...data, id: newId(), createdAt: now, updatedAt: now };
  await db.habits.put(h);
  await markDirty();
  return h;
};

export const updateHabit = async (
  id: string,
  patch: Partial<Omit<Habit, 'id' | 'createdAt'>>
) => {
  await db.habits.update(id, { ...patch, updatedAt: new Date().toISOString() });
  await markDirty();
};

export const deleteHabit = async (id: string) => {
  await db.transaction('rw', [db.habits, db.habitLogs], async () => {
    await db.habits.delete(id);
    await db.habitLogs.where('habitId').equals(id).delete();
  });
  await markDirty();
};

export const listHabits = async (): Promise<Habit[]> => {
  const items = await db.habits.toArray();
  return items.sort((a, b) => a.order - b.order);
};
