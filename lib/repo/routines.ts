import { db, markDirty } from '../db';
import { Routine } from '../types';
import { newId } from '../utils/id';

export const createRoutine = async (
  data: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Routine> => {
  const now = new Date().toISOString();
  const r: Routine = { ...data, id: newId(), createdAt: now, updatedAt: now };
  await db.routines.put(r);
  await markDirty();
  return r;
};

export const updateRoutine = async (
  id: string,
  patch: Partial<Omit<Routine, 'id' | 'createdAt'>>
) => {
  await db.routines.update(id, { ...patch, updatedAt: new Date().toISOString() });
  await markDirty();
};

export const deleteRoutine = async (id: string) => {
  await db.routines.delete(id);
  await markDirty();
};

export const listAllRoutines = async (): Promise<Routine[]> => {
  const items = await db.routines.toArray();
  return items.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.order - b.order;
  });
};

export const listRoutinesByDay = async (dayOfWeek: number): Promise<Routine[]> => {
  const items = await db.routines.where('dayOfWeek').equals(dayOfWeek).toArray();
  return items.sort((a, b) => a.order - b.order);
};
