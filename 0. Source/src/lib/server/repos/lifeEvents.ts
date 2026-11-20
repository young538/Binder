import 'server-only';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import type { ParsedIcsEvent } from '@/lib/ics';
import type { LifeEvent } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import type { BinderDatabase } from '../db/connection';
import { stripUndefined } from '../db/patch';
import { lifeEvents } from '../db/schema';

type NewLifeEvent = Omit<LifeEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
type LifeEventPatch = Partial<NewLifeEvent>;

/** User-scoped life events, D-Days, anniversaries, and idempotent .ics imports. */
export class LifeEventRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(filters?: { startDate?: string; endDate?: string }): LifeEvent[] {
    const rows = this.database
      .select()
      .from(lifeEvents)
      .where(eq(lifeEvents.userId, this.userId))
      .orderBy(asc(lifeEvents.date), asc(lifeEvents.startMin), asc(lifeEvents.id))
      .all() as LifeEvent[];

    if (!filters?.startDate && !filters?.endDate) return rows;
    const start = filters.startDate ?? '0000-01-01';
    const end = filters.endDate ?? '9999-12-31';
    return rows.filter(row => {
      if (row.kind === 'anniversary') return true;
      const rowEnd = row.endDate && row.endDate >= row.date ? row.endDate : row.date;
      return row.date <= end && rowEnd >= start;
    });
  }

  create(data: NewLifeEvent): LifeEvent {
    const timestamp = this.now().toISOString();
    const row: LifeEvent = {
      ...data,
      id: newId(),
      userId: this.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.insert(lifeEvents).values(row).run();
    return row;
  }

  update(id: string, patch: LifeEventPatch): LifeEvent | null {
    const predicate = and(eq(lifeEvents.userId, this.userId), eq(lifeEvents.id, id));
    const existing = this.database.select().from(lifeEvents).where(predicate).get() as LifeEvent | undefined;
    if (!existing) return null;
    const timestamp = this.now().toISOString();
    return this.database
      .update(lifeEvents)
      .set({ ...stripUndefined(patch), updatedAt: timestamp })
      .where(predicate)
      .returning()
      .get() as LifeEvent;
  }

  delete(id: string): void {
    this.database
      .delete(lifeEvents)
      .where(and(eq(lifeEvents.userId, this.userId), eq(lifeEvents.id, id)))
      .run();
  }

  importIcsEvents(parsed: ParsedIcsEvent[]): { imported: number; updated: number; total: number } {
    return this.database.transaction(tx => {
      const existingRows = tx
        .select()
        .from(lifeEvents)
        .where(and(eq(lifeEvents.userId, this.userId), isNotNull(lifeEvents.externalUid)))
        .all() as LifeEvent[];

      const byUid = new Map<string, LifeEvent>();
      for (const row of existingRows) {
        if (row.externalUid) byUid.set(row.externalUid, row);
      }

      const timestamp = this.now().toISOString();
      let imported = 0;
      let updated = 0;

      for (const item of parsed) {
        const existing = byUid.get(item.externalUid);
        if (existing) {
          const next = tx
            .update(lifeEvents)
            .set({
              title: item.title,
              date: item.date,
              endDate: item.endDate,
              allDay: item.allDay,
              startMin: item.startMin,
              endMin: item.endMin,
              note: item.note,
              updatedAt: timestamp,
            })
            .where(and(eq(lifeEvents.userId, this.userId), eq(lifeEvents.id, existing.id)))
            .returning()
            .get() as LifeEvent;
          byUid.set(item.externalUid, next);
          updated++;
        } else {
          const created: LifeEvent = {
            id: newId(),
            userId: this.userId,
            title: item.title,
            date: item.date,
            endDate: item.endDate,
            kind: 'event',
            allDay: item.allDay,
            startMin: item.startMin,
            endMin: item.endMin,
            color: null,
            personId: null,
            projectId: null,
            goalId: null,
            externalUid: item.externalUid,
            note: item.note,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          tx.insert(lifeEvents).values(created).run();
          byUid.set(item.externalUid, created);
          imported++;
        }
      }

      return { imported, updated, total: parsed.length };
    }, { behavior: 'immediate' });
  }
}
