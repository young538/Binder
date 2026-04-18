import { db, markDirty } from '../db';
import { Retrospective } from '../types';
import { newId } from '../utils/id';

export const upsertRetrospective = async (
  type: 'daily' | 'weekly',
  dateOrWeek: string,
  data: Partial<Omit<Retrospective, 'id' | 'type' | 'dateOrWeek' | 'createdAt' | 'updatedAt'>>
): Promise<Retrospective> => {
  const existing = await db.retrospectives.where({ type, dateOrWeek }).first();
  const now = new Date().toISOString();
  if (existing) {
    const updated: Retrospective = { ...existing, ...data, updatedAt: now };
    await db.retrospectives.put(updated);
    await markDirty();
    return updated;
  }
  const created: Retrospective = {
    id: newId(),
    type,
    dateOrWeek,
    template: {},
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await db.retrospectives.put(created);
  await markDirty();
  return created;
};

export const getRetrospective = (type: 'daily' | 'weekly', dateOrWeek: string) =>
  db.retrospectives.where({ type, dateOrWeek }).first();
