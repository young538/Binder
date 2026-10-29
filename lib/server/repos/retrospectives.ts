import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { retrospectives } from '../db/schema';
import { Retrospective } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import { stripUndefined } from '../db/patch';
import type { BinderDatabase } from '../db/connection';

/** User-scoped retrospectives operations; accepts an isolated database for tests. */
export class RetrospectiveRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  async get(type: 'daily' | 'weekly', dateOrWeek: string): Promise<Retrospective | null> {
    const userId = this.userId;
    const db = this.database;
    const row = await db
      .select()
      .from(retrospectives)
      .where(
        and(
          eq(retrospectives.userId, userId),
          eq(retrospectives.type, type),
          eq(retrospectives.dateOrWeek, dateOrWeek)
        )
      )
      .get();
    return (row as Retrospective | undefined) ?? null;
  }

  async upsert(type: 'daily' | 'weekly', dateOrWeek: string, data: Partial<Omit<Retrospective, 'id' | 'userId' | 'type' | 'dateOrWeek' | 'createdAt' | 'updatedAt'>>): Promise<Retrospective> {
    const userId = this.userId;
    const db = this.database;
    // Keep the read/merge/write in one immediate SQLite transaction. Independent
    // editors patch individual template fields without replacing their siblings.
    return db.transaction(tx => {
      const existing = tx.select().from(retrospectives).where(and(
        eq(retrospectives.userId, userId),
        eq(retrospectives.type, type),
        eq(retrospectives.dateOrWeek, dateOrWeek),
      )).get();
      const now = new Date().toISOString();
      const patch = stripUndefined(data);
      if (existing) {
        return tx.update(retrospectives).set({
          ...patch,
          ...(data.template ? { template: { ...existing.template, ...stripUndefined(data.template) } } : {}),
          updatedAt: now,
        }).where(and(eq(retrospectives.userId, userId), eq(retrospectives.id, existing.id)))
          .returning().get() as Retrospective;
      }
      return tx.insert(retrospectives).values({
        ...patch,
        id: newId(),
        userId,
        type,
        dateOrWeek,
        template: data.template ?? {},
        createdAt: now,
        updatedAt: now,
      }).returning().get() as Retrospective;
    }, { behavior: 'immediate' });
  }
}

// Compatibility functions for existing callers. New services can inject the repository.
export const getRetrospective = async (userId: string, type: 'daily' | 'weekly', dateOrWeek: string): Promise<Retrospective | null> =>
  new RetrospectiveRepository(getDb(), userId).get(type, dateOrWeek);

export const upsertRetrospective = async (userId: string, type: 'daily' | 'weekly', dateOrWeek: string, data: Partial<Omit<Retrospective, 'id' | 'userId' | 'type' | 'dateOrWeek' | 'createdAt' | 'updatedAt'>>): Promise<Retrospective> =>
  new RetrospectiveRepository(getDb(), userId).upsert(type, dateOrWeek, data);
