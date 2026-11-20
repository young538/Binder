import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { sortMetricEntries, type LifeMetricWithEntries } from '@/lib/metrics';
import type { LifeMetric, LifeMetricEntry } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import type { BinderDatabase } from '../db/connection';
import { stripUndefined } from '../db/patch';
import { metricEntries, metrics } from '../db/schema';

type NewMetric = Omit<LifeMetric, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
type MetricPatch = Partial<NewMetric>;
type EntryInput = Omit<LifeMetricEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

/** User-scoped state metrics and date-keyed numeric entries. */
export class MetricRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(): LifeMetric[] {
    return this.database
      .select()
      .from(metrics)
      .where(eq(metrics.userId, this.userId))
      .orderBy(asc(metrics.order), asc(metrics.createdAt), asc(metrics.id))
      .all() as LifeMetric[];
  }

  listWithEntries(): LifeMetricWithEntries[] {
    return this.database.transaction(tx => {
      const metricRows = tx
        .select()
        .from(metrics)
        .where(eq(metrics.userId, this.userId))
        .orderBy(asc(metrics.order), asc(metrics.createdAt), asc(metrics.id))
        .all() as LifeMetric[];
      const entryRows = tx
        .select()
        .from(metricEntries)
        .where(eq(metricEntries.userId, this.userId))
        .orderBy(asc(metricEntries.date), asc(metricEntries.id))
        .all() as LifeMetricEntry[];

      const byMetric = new Map<string, LifeMetricEntry[]>();
      for (const entry of entryRows) {
        const list = byMetric.get(entry.metricId);
        if (list) list.push(entry);
        else byMetric.set(entry.metricId, [entry]);
      }

      return metricRows.map(metric => ({
        metric,
        entries: sortMetricEntries(byMetric.get(metric.id) ?? []),
      }));
    });
  }

  create(data: NewMetric): LifeMetric {
    const timestamp = this.now().toISOString();
    const row: LifeMetric = {
      ...data,
      id: newId(),
      userId: this.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.insert(metrics).values(row).run();
    return row;
  }

  update(id: string, patch: MetricPatch): LifeMetric | null {
    const predicate = and(eq(metrics.userId, this.userId), eq(metrics.id, id));
    const existing = this.database.select().from(metrics).where(predicate).get() as LifeMetric | undefined;
    if (!existing) return null;
    const timestamp = this.now().toISOString();
    return this.database
      .update(metrics)
      .set({ ...stripUndefined(patch), updatedAt: timestamp })
      .where(predicate)
      .returning()
      .get() as LifeMetric;
  }

  delete(id: string): void {
    this.database.transaction(tx => {
      tx.delete(metricEntries)
        .where(and(eq(metricEntries.userId, this.userId), eq(metricEntries.metricId, id)))
        .run();
      tx.delete(metrics)
        .where(and(eq(metrics.userId, this.userId), eq(metrics.id, id)))
        .run();
    }, { behavior: 'immediate' });
  }

  upsertEntry(data: EntryInput): LifeMetricEntry {
    return this.database.transaction(tx => {
      const predicate = and(
        eq(metricEntries.userId, this.userId),
        eq(metricEntries.metricId, data.metricId),
        eq(metricEntries.date, data.date),
      );
      const existing = tx.select().from(metricEntries).where(predicate).get() as LifeMetricEntry | undefined;
      const timestamp = this.now().toISOString();

      if (existing) {
        return tx
          .update(metricEntries)
          .set({
            value: data.value,
            note: data.note ?? null,
            updatedAt: timestamp,
          })
          .where(and(eq(metricEntries.userId, this.userId), eq(metricEntries.id, existing.id)))
          .returning()
          .get() as LifeMetricEntry;
      }

      const created: LifeMetricEntry = {
        id: newId(),
        userId: this.userId,
        metricId: data.metricId,
        date: data.date,
        value: data.value,
        note: data.note ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      tx.insert(metricEntries).values(created).run();
      return created;
    }, { behavior: 'immediate' });
  }

  deleteEntry(entryId: string): void {
    this.database
      .delete(metricEntries)
      .where(and(eq(metricEntries.userId, this.userId), eq(metricEntries.id, entryId)))
      .run();
  }
}
