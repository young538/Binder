import 'server-only';
import { and, desc, eq, sum } from 'drizzle-orm';
import type { EntryInput, InjectionJournal, PenInput } from '@/lib/injections';
import type { BinderDatabase, DatabaseSession } from '../db/connection';
import { injectionEntries, injectionPens } from '../db/schema';
import { DomainError } from '../errors';

function matches<T extends object>(row: T, input: Partial<T>) {
  return (Object.keys(input) as (keyof T)[]).every(key => row[key] === input[key]);
}

function checkVersion(row: { userId: string; updatedAt: string } | undefined, userId: string, version: string | null) {
  if (row && row.userId !== userId) throw new DomainError('기록을 찾을 수 없어요.', 404);
  if ((row?.updatedAt ?? null) !== version) throw new DomainError('기록이 변경됐어요. 목록을 새로 불러와 주세요.', 409);
}

export class InjectionRepository {
  constructor(private db: BinderDatabase, private userId: string) {}

  journal(): InjectionJournal {
    return this.db.transaction(tx => ({
      pens: tx.select().from(injectionPens).where(eq(injectionPens.userId, this.userId)).orderBy(desc(injectionPens.createdAt)).all(),
      entries: tx.select().from(injectionEntries).where(eq(injectionEntries.userId, this.userId)).orderBy(desc(injectionEntries.takenAt), desc(injectionEntries.id)).all(),
    }));
  }

  private used(tx: DatabaseSession, penId: string) {
    const used = tx.select({ total: sum(injectionEntries.amountMcg) }).from(injectionEntries)
      .where(and(eq(injectionEntries.userId, this.userId), eq(injectionEntries.penId, penId))).get();
    return Number(used?.total ?? 0);
  }

  savePen(id: string, data: PenInput, version: string | null) {
    return this.db.transaction(tx => {
      const predicate = eq(injectionPens.id, id);
      const old = tx.select().from(injectionPens).where(predicate).get();
      if (old?.userId === this.userId && matches(old, data)) return old;
      checkVersion(old, this.userId, version);
      const used = this.used(tx, id);
      if (used > data.capacityMcg) throw new DomainError('펜 총량이 이미 기록한 투여량보다 작아요.', 409);
      if (used && old?.drug !== data.drug) throw new DomainError('주사 기록이 있는 펜의 약은 바꿀 수 없어요.', 409);
      const updatedAt = new Date(Math.max(Date.now(), old ? Date.parse(old.updatedAt) + 1 : 0)).toISOString();
      if (old) return tx.update(injectionPens).set({ ...data, updatedAt }).where(predicate).returning().get();
      return tx.insert(injectionPens).values({ ...data, id, userId: this.userId, updatedAt, createdAt: updatedAt }).returning().get();
    }, { behavior: 'immediate' });
  }

  saveEntry(id: string, data: EntryInput, version: string | null) {
    return this.db.transaction(tx => {
      const predicate = eq(injectionEntries.id, id);
      const old = tx.select().from(injectionEntries).where(predicate).get();
      if (old?.userId === this.userId && matches(old, data)) return old;
      checkVersion(old, this.userId, version);
      const pen = tx.select().from(injectionPens).where(and(eq(injectionPens.id, data.penId), eq(injectionPens.userId, this.userId))).get();
      if (!pen) throw new DomainError('펜을 찾을 수 없어요.', 404);
      if (pen.closed && old?.penId !== pen.id) throw new DomainError('사용 종료한 펜이에요.', 409);
      const previous = old?.penId === pen.id ? old.amountMcg : 0;
      if (this.used(tx, pen.id) - previous + data.amountMcg > pen.capacityMcg) {
        throw new DomainError('누적 투여량이 펜의 표시 총량을 초과해요. 펜과 입력 단위를 확인해 주세요.', 409);
      }
      const updatedAt = new Date(Math.max(Date.now(), old ? Date.parse(old.updatedAt) + 1 : 0)).toISOString();
      if (old) return tx.update(injectionEntries).set({ ...data, updatedAt }).where(predicate).returning().get();
      return tx.insert(injectionEntries).values({ ...data, id, userId: this.userId, createdAt: updatedAt, updatedAt }).returning().get();
    }, { behavior: 'immediate' });
  }

  remove(kind: 'pens' | 'entries', id: string, version: string | null) {
    this.db.transaction(tx => {
      const table = kind === 'pens' ? injectionPens : injectionEntries;
      const owned = and(eq(table.userId, this.userId), eq(table.id, id));
      const row = tx.select().from(table).where(owned).get();
      if (!row) return;
      checkVersion(row, this.userId, version);
      if (kind === 'pens' && this.used(tx, id)) throw new DomainError('주사 기록이 있는 펜은 사용 종료로 표시해 주세요.', 409);
      tx.delete(table).where(owned).run();
    }, { behavior: 'immediate' });
  }
}
