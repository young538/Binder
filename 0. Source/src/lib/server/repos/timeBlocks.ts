import 'server-only';
import { and, asc, between, eq, inArray } from 'drizzle-orm';
import { DomainError } from '../errors';
import { timeBlocks } from '../db/schema';
import { TimeBlock } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import { stripUndefined } from '../db/patch';
import type { BinderDatabase, DatabaseSession } from '../db/connection';

type BlockInput = Omit<TimeBlock, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

function recordPlanActual(tx: DatabaseSession, plan: TimeBlock, timestamp: string, values: BlockInput = plan) {
  const inserted = tx.insert(timeBlocks).values({
    ...values, id: newId(), userId: plan.userId, kind: 'actual', sourcePlanId: plan.id,
    date: plan.date, createdAt: timestamp, updatedAt: timestamp,
  }).onConflictDoNothing({ target: [timeBlocks.userId, timeBlocks.sourcePlanId] }).returning().get();
  return inserted as TimeBlock | undefined;
}

export function confirmPlans(tx: DatabaseSession, userId: string, date: string, ids: string[] | undefined, now: string) {
  if (ids?.length === 0) return 0;
  const plans = tx.select().from(timeBlocks).where(and(
    eq(timeBlocks.userId, userId), eq(timeBlocks.date, date), eq(timeBlocks.kind, 'plan'),
    ids ? inArray(timeBlocks.id, ids) : undefined,
  )).all() as TimeBlock[];
  let created = 0;
  for (const plan of plans) {
    if (recordPlanActual(tx, plan, now)) created++;
  }
  return created;
}

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

  async create(data: BlockInput): Promise<TimeBlock> {
    const userId = this.userId;
    const db = this.database;
    const now = new Date().toISOString();
    if (data.sourcePlanId) {
      const planId = data.sourcePlanId;
      return db.transaction(tx => {
        const plan = tx.select().from(timeBlocks).where(and(eq(timeBlocks.userId, userId),
          eq(timeBlocks.id, planId), eq(timeBlocks.date, data.date), eq(timeBlocks.kind, 'plan'))).get();
        if (!plan || data.kind !== 'actual') throw new DomainError('원본 계획을 찾을 수 없습니다.', 400);
        const created = recordPlanActual(tx, plan as TimeBlock, now, data);
        return created ?? tx.select().from(timeBlocks).where(and(
          eq(timeBlocks.userId, userId), eq(timeBlocks.sourcePlanId, planId),
        )).get() as TimeBlock;
      }, { behavior: 'immediate' });
    }
    const row: TimeBlock = {
      ...data,
      goalId: data.goalId ?? null,
      projectId: data.projectId ?? null,
      todoId: data.todoId ?? null,
      sourcePlanId: null,
      id: newId(),
      userId,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(timeBlocks).values(row).run();
    return row;
  }

  async update(id: string, patch: Partial<Omit<TimeBlock, 'id' | 'userId' | 'createdAt'>>): Promise<TimeBlock | null> {
    const owned = eq(timeBlocks.userId, this.userId);
    return this.database.transaction(tx => {
      const predicate = and(owned, eq(timeBlocks.id, id));
      const existing = tx.select().from(timeBlocks).where(predicate).get();
      if (!existing) return null;
      const moved = (patch.date !== undefined && patch.date !== existing.date)
        || (patch.kind !== undefined && patch.kind !== existing.kind);
      if (moved && existing.kind === 'plan') {
        tx.update(timeBlocks).set({ sourcePlanId: null }).where(and(owned, eq(timeBlocks.sourcePlanId, id))).run();
      }
      return tx.update(timeBlocks).set({
        ...stripUndefined(patch), sourcePlanId: moved ? null : existing.sourcePlanId, updatedAt: new Date().toISOString(),
      }).where(predicate).returning().get() as TimeBlock;
    }, { behavior: 'immediate' });
  }

  async delete(id: string): Promise<void> {
    const owned = eq(timeBlocks.userId, this.userId);
    this.database.transaction(tx => {
      tx.update(timeBlocks).set({ sourcePlanId: null }).where(and(owned, eq(timeBlocks.sourcePlanId, id))).run();
      tx.delete(timeBlocks).where(and(owned, eq(timeBlocks.id, id))).run();
    }, { behavior: 'immediate' });
  }

  confirmPlansAsActual(date: string, blockIds?: string[]): { created: number } {
    return this.database.transaction(tx => ({
      created: confirmPlans(tx, this.userId, date, blockIds?.length ? blockIds : undefined, new Date().toISOString()),
    }), { behavior: 'immediate' });
  }
}
