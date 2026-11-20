import 'server-only';
import { and, asc, between, eq } from 'drizzle-orm';
import type { DailyCheckin } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import type { BinderDatabase } from '../db/connection';
import { stripUndefined } from '../db/patch';
import { dailyCheckins } from '../db/schema';

type CheckinUpsert = Omit<DailyCheckin, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

/** User-scoped daily bio/condition check-ins; unique per user and date. */
export class DailyCheckinRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getByDate(date: string): DailyCheckin | null {
    const row = this.database
      .select()
      .from(dailyCheckins)
      .where(and(eq(dailyCheckins.userId, this.userId), eq(dailyCheckins.date, date)))
      .get();
    return (row as DailyCheckin | undefined) ?? null;
  }

  listInRange(startDate: string, endDate: string): DailyCheckin[] {
    return this.database
      .select()
      .from(dailyCheckins)
      .where(and(eq(dailyCheckins.userId, this.userId), between(dailyCheckins.date, startDate, endDate)))
      .orderBy(asc(dailyCheckins.date))
      .all() as DailyCheckin[];
  }

  upsert(data: CheckinUpsert): DailyCheckin {
    return this.database.transaction(tx => {
      const existing = tx
        .select()
        .from(dailyCheckins)
        .where(and(eq(dailyCheckins.userId, this.userId), eq(dailyCheckins.date, data.date)))
        .get() as DailyCheckin | undefined;

      const timestamp = this.now().toISOString();
      const { date, ...fields } = data;
      const patch = stripUndefined(fields);

      if (existing) {
        return tx
          .update(dailyCheckins)
          .set({ ...patch, updatedAt: timestamp })
          .where(and(eq(dailyCheckins.userId, this.userId), eq(dailyCheckins.id, existing.id)))
          .returning()
          .get() as DailyCheckin;
      }

      const created: DailyCheckin = {
        id: newId(),
        userId: this.userId,
        date,
        sleepHours: fields.sleepHours ?? null,
        energy: fields.energy ?? null,
        stress: fields.stress ?? null,
        mood: fields.mood ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      tx.insert(dailyCheckins).values(created).run();
      return created;
    }, { behavior: 'immediate' });
  }
}
