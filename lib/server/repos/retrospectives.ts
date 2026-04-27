import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { retrospectives } from '../db/schema';
import { Retrospective } from '@/lib/types';
import { newId } from '@/lib/utils/id';

export const getRetrospective = async (
  type: 'daily' | 'weekly',
  dateOrWeek: string
): Promise<Retrospective | null> => {
  const db = getDb();
  const row = await db
    .select()
    .from(retrospectives)
    .where(and(eq(retrospectives.type, type), eq(retrospectives.dateOrWeek, dateOrWeek)))
    .get();
  return (row as Retrospective | undefined) ?? null;
};

export const upsertRetrospective = async (
  type: 'daily' | 'weekly',
  dateOrWeek: string,
  data: Partial<Omit<Retrospective, 'id' | 'type' | 'dateOrWeek' | 'createdAt' | 'updatedAt'>>
): Promise<Retrospective> => {
  const db = getDb();
  const existing = await getRetrospective(type, dateOrWeek);
  const now = new Date().toISOString();
  if (existing) {
    const updated: Retrospective = { ...existing, ...data, updatedAt: now };
    await db
      .update(retrospectives)
      .set(updated)
      .where(eq(retrospectives.id, existing.id))
      .run();
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
  await db.insert(retrospectives).values(created).run();
  return created;
};
