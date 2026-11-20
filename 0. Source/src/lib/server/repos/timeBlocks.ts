import 'server-only';
import { and, asc, between, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { timeBlocks } from '../db/schema';
import { TimeBlock } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import { stripUndefined } from '../db/patch';
import type { BinderDatabase } from '../db/connection';

/** User-scoped timeBlocks operations; accepts an isolated database for tests. */
export class TimeBlockRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  async listInRange(startDate: string, endDate: string): Promise<TimeBlock[]> {
    const userId = this.userId;
    const db = this.database;
    const rows = await db
      .select()
      .from(timeBlocks)
      .where(and(eq(timeBlocks.userId, userId), between(timeBlocks.date, startDate, endDate)))
      .orderBy(asc(timeBlocks.date), asc(timeBlocks.startMin))
      .all();
    return rows as TimeBlock[];
  }

  async create(data: Omit<TimeBlock, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<TimeBlock> {
    const userId = this.userId;
    const db = this.database;
    const now = new Date().toISOString();
    const row: TimeBlock = { ...data, id: newId(), userId, createdAt: now, updatedAt: now };
    await db.insert(timeBlocks).values(row).run();
    return row;
  }

  async update(id: string, patch: Partial<Omit<TimeBlock, 'id' | 'userId' | 'createdAt'>>): Promise<TimeBlock | null> {
    const userId = this.userId;
    const db = this.database;
    await db
      .update(timeBlocks)
      .set({ ...stripUndefined(patch), updatedAt: new Date().toISOString() })
      .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, id)))
      .run();
    const row = await db
      .select()
      .from(timeBlocks)
      .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, id)))
      .get();
    return (row as TimeBlock | undefined) ?? null;
  }

  async delete(id: string): Promise<void> {
    const userId = this.userId;
    const db = this.database;
    await db
      .delete(timeBlocks)
      .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, id)))
      .run();
  }

  confirmPlansAsActual(date: string, blockIds?: string[]): { created: number } {
    const filterSet = blockIds && blockIds.length > 0 ? new Set(blockIds) : null;
    const blockKey = (b: Pick<TimeBlock, 'startMin' | 'endMin' | 'text'>) =>
      `${b.startMin}:${b.endMin}:${b.text}`;

    return this.database.transaction(tx => {
      const plans = tx
        .select()
        .from(timeBlocks)
        .where(and(eq(timeBlocks.userId, this.userId), eq(timeBlocks.date, date), eq(timeBlocks.kind, 'plan')))
        .orderBy(asc(timeBlocks.startMin), asc(timeBlocks.id))
        .all() as TimeBlock[];

      const actuals = tx
        .select()
        .from(timeBlocks)
        .where(and(eq(timeBlocks.userId, this.userId), eq(timeBlocks.date, date), eq(timeBlocks.kind, 'actual')))
        .all() as TimeBlock[];

      const existingKeys = new Set(actuals.map(blockKey));
      const now = new Date().toISOString();
      let created = 0;

      for (const plan of plans) {
        if (filterSet && !filterSet.has(plan.id)) continue;
        const key = blockKey(plan);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        tx.insert(timeBlocks)
          .values({
            id: newId(),
            userId: this.userId,
            date: plan.date,
            startMin: plan.startMin,
            endMin: plan.endMin,
            text: plan.text,
            kind: 'actual',
            categoryId: plan.categoryId,
            goalId: plan.goalId ?? null,
            projectId: plan.projectId ?? null,
            todoId: plan.todoId ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        created++;
      }

      return { created };
    }, { behavior: 'immediate' });
  }
}

// Compatibility functions for existing callers. New services can inject the repository.
export const getTimeBlocksInRange = async (userId: string, startDate: string, endDate: string): Promise<TimeBlock[]> =>
  new TimeBlockRepository(getDb(), userId).listInRange(startDate, endDate);

export const createTimeBlock = async (userId: string, data: Omit<TimeBlock, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<TimeBlock> =>
  new TimeBlockRepository(getDb(), userId).create(data);

export const updateTimeBlock = async (userId: string, id: string, patch: Partial<Omit<TimeBlock, 'id' | 'userId' | 'createdAt'>>): Promise<TimeBlock | null> =>
  new TimeBlockRepository(getDb(), userId).update(id, patch);

export const deleteTimeBlock = async (userId: string, id: string): Promise<void> =>
  new TimeBlockRepository(getDb(), userId).delete(id);
