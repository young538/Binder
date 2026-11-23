import 'server-only';
import { endOfMonth, getDaysInMonth, parseISO } from 'date-fns';
import { and, asc, between, desc, eq, inArray, or } from 'drizzle-orm';
import { ulid } from 'ulid';
import { monthEndDate, type FinanceImportRow } from '@/lib/finance';
import { toMonthlyAmount } from '@/lib/subscriptions';
import type { FinanceBudget, FinanceTransaction, FinanceTransactionKind } from '@/lib/types';
import type { BinderDatabase } from '../db/connection';
import { financeBudgets, financeTransactions, subscriptions } from '../db/schema';

const newId = () => ulid();

function monthDiff(fromYyyymm: string, toYyyymm: string): number {
  const [fy, fm] = fromYyyymm.split('-').map(Number);
  const [ty, tm] = toYyyymm.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** User-scoped repository for personal income/expense transactions and monthly budgets. */
export class FinanceRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  listTransactions(filters?: {
    month?: string;
    startDate?: string;
    endDate?: string;
    kind?: FinanceTransactionKind;
  }): FinanceTransaction[] {
    const conditions = [eq(financeTransactions.userId, this.userId)];

    if (filters?.month) {
      conditions.push(
        between(financeTransactions.date, `${filters.month}-01`, monthEndDate(filters.month)),
      );
    } else if (filters?.startDate && filters?.endDate) {
      conditions.push(
        between(financeTransactions.date, filters.startDate, filters.endDate),
      );
    }
    if (filters?.kind) {
      conditions.push(eq(financeTransactions.kind, filters.kind));
    }

    return this.database
      .select()
      .from(financeTransactions)
      .where(and(...conditions))
      .orderBy(
        desc(financeTransactions.date),
        desc(financeTransactions.time),
        desc(financeTransactions.createdAt),
        asc(financeTransactions.id),
      )
      .all() as FinanceTransaction[];
  }

  getTransactionById(id: string): FinanceTransaction | null {
    const row = this.database
      .select()
      .from(financeTransactions)
      .where(and(eq(financeTransactions.userId, this.userId), eq(financeTransactions.id, id)))
      .get();
    return (row as FinanceTransaction | undefined) ?? null;
  }

  createTransaction(
    data: Omit<FinanceTransaction, 'id' | 'userId' | 'externalHash' | 'createdAt' | 'updatedAt'> & {
      externalHash?: string | null;
    },
  ): FinanceTransaction {
    const timestamp = this.now().toISOString();
    const row: FinanceTransaction = {
      id: newId(),
      userId: this.userId,
      date: data.date,
      time: data.time ?? null,
      kind: data.kind,
      amount: data.amount,
      currency: data.currency ?? 'KRW',
      category: data.category.trim(),
      subCategory: data.subCategory?.trim() || null,
      merchant: data.merchant.trim(),
      paymentMethod: data.paymentMethod?.trim() || null,
      note: data.note?.trim() || null,
      excluded: Boolean(data.excluded),
      source: data.source ?? 'manual',
      externalHash: data.externalHash ?? null,
      subscriptionId: data.subscriptionId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.insert(financeTransactions).values(row).run();
    return row;
  }

  updateTransaction(
    id: string,
    patch: Partial<Omit<FinanceTransaction, 'id' | 'userId' | 'externalHash' | 'createdAt'>>,
  ): FinanceTransaction | null {
    const existing = this.getTransactionById(id);
    if (!existing) return null;
    const timestamp = this.now().toISOString();
    const updated = this.database
      .update(financeTransactions)
      .set({
        ...(patch.date !== undefined ? { date: patch.date } : {}),
        ...(patch.time !== undefined ? { time: patch.time } : {}),
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
        ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
        ...(patch.category !== undefined ? { category: patch.category.trim() } : {}),
        ...(patch.subCategory !== undefined
          ? { subCategory: patch.subCategory?.trim() || null }
          : {}),
        ...(patch.merchant !== undefined ? { merchant: patch.merchant.trim() } : {}),
        ...(patch.paymentMethod !== undefined
          ? { paymentMethod: patch.paymentMethod?.trim() || null }
          : {}),
        ...(patch.note !== undefined ? { note: patch.note?.trim() || null } : {}),
        ...(patch.excluded !== undefined ? { excluded: Boolean(patch.excluded) } : {}),
        ...(patch.source !== undefined ? { source: patch.source } : {}),
        ...(patch.subscriptionId !== undefined ? { subscriptionId: patch.subscriptionId } : {}),
        updatedAt: timestamp,
      })
      .where(and(eq(financeTransactions.userId, this.userId), eq(financeTransactions.id, id)))
      .returning()
      .get();
    return (updated as FinanceTransaction | undefined) ?? null;
  }

  deleteTransaction(id: string): { ok: true } {
    this.database
      .delete(financeTransactions)
      .where(and(eq(financeTransactions.userId, this.userId), eq(financeTransactions.id, id)))
      .run();
    return { ok: true };
  }

  findExistingHashes(hashes: string[]): Set<string> {
    const existing = new Set<string>();
    const unique = [...new Set(hashes.filter(Boolean))];
    for (let i = 0; i < unique.length; i += 400) {
      const chunk = unique.slice(i, i + 400);
      const rows = this.database
        .select({ externalHash: financeTransactions.externalHash })
        .from(financeTransactions)
        .where(
          and(
            eq(financeTransactions.userId, this.userId),
            inArray(financeTransactions.externalHash, chunk),
          ),
        )
        .all();
      for (const r of rows) {
        if (r.externalHash) existing.add(r.externalHash);
      }
    }
    return existing;
  }

  importTransactions(rows: FinanceImportRow[]): { inserted: number; duplicates: number } {
    const timestamp = this.now().toISOString();
    return this.database.transaction(tx => {
      const existing = new Set<string>();
      const allHashes = [...new Set(rows.map(r => r.externalHash).filter(Boolean))];
      for (let i = 0; i < allHashes.length; i += 400) {
        const chunk = allHashes.slice(i, i + 400);
        const found = tx
          .select({ externalHash: financeTransactions.externalHash })
          .from(financeTransactions)
          .where(
            and(
              eq(financeTransactions.userId, this.userId),
              inArray(financeTransactions.externalHash, chunk),
            ),
          )
          .all();
        for (const r of found) {
          if (r.externalHash) existing.add(r.externalHash);
        }
      }

      const toInsert: FinanceTransaction[] = [];
      let duplicates = 0;

      for (const row of rows) {
        if (existing.has(row.externalHash)) {
          duplicates++;
          continue;
        }
        existing.add(row.externalHash);
        toInsert.push({
          id: newId(),
          userId: this.userId,
          date: row.date,
          time: row.time ?? null,
          kind: row.kind,
          amount: row.amount,
          currency: row.currency,
          category: row.category,
          subCategory: row.subCategory ?? null,
          merchant: row.merchant,
          paymentMethod: row.paymentMethod ?? null,
          note: row.note ?? null,
          excluded: false,
          source: row.source,
          externalHash: row.externalHash,
          subscriptionId: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      for (let i = 0; i < toInsert.length; i += 100) {
        tx.insert(financeTransactions).values(toInsert.slice(i, i + 100)).run();
      }

      return { inserted: toInsert.length, duplicates };
    }, { behavior: 'immediate' });
  }

  listBudgets(yyyymm?: string): FinanceBudget[] {
    const whereClause = yyyymm
      ? and(
          eq(financeBudgets.userId, this.userId),
          or(eq(financeBudgets.yyyymm, 'default'), eq(financeBudgets.yyyymm, yyyymm)),
        )
      : eq(financeBudgets.userId, this.userId);
    return this.database
      .select()
      .from(financeBudgets)
      .where(whereClause)
      .orderBy(asc(financeBudgets.yyyymm), asc(financeBudgets.category))
      .all() as FinanceBudget[];
  }

  upsertBudget(input: { yyyymm: string; category: string; amount: number }): FinanceBudget {
    const timestamp = this.now().toISOString();
    const category = input.category.trim();
    return this.database.transaction(tx => {
      const existing = tx
        .select()
        .from(financeBudgets)
        .where(
          and(
            eq(financeBudgets.userId, this.userId),
            eq(financeBudgets.yyyymm, input.yyyymm),
            eq(financeBudgets.category, category),
          ),
        )
        .get();
      if (existing) {
        return tx
          .update(financeBudgets)
          .set({ amount: input.amount, updatedAt: timestamp })
          .where(and(eq(financeBudgets.userId, this.userId), eq(financeBudgets.id, existing.id)))
          .returning()
          .get() as FinanceBudget;
      }
      const created: FinanceBudget = {
        id: newId(),
        userId: this.userId,
        yyyymm: input.yyyymm,
        category,
        amount: input.amount,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      tx.insert(financeBudgets).values(created).run();
      return created;
    }, { behavior: 'immediate' });
  }

  deleteBudget(id: string): { ok: true } {
    this.database
      .delete(financeBudgets)
      .where(and(eq(financeBudgets.userId, this.userId), eq(financeBudgets.id, id)))
      .run();
    return { ok: true };
  }

  syncSubscriptionsForMonth(yyyymm: string): { created: number; skipped: number } {
    const timestamp = this.now().toISOString();
    const monthStart = `${yyyymm}-01`;
    const daysInMonth = getDaysInMonth(endOfMonth(parseISO(monthStart)));

    return this.database.transaction(tx => {
      const activeSubs = tx
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, this.userId), eq(subscriptions.status, 'active')))
        .all();

      const hashes = activeSubs.map(sub => `sub:${sub.id}:${yyyymm}`);
      const existingSet = new Set<string>();
      for (let i = 0; i < hashes.length; i += 400) {
        const chunk = hashes.slice(i, i + 400);
        if (chunk.length === 0) continue;
        const rows = tx
          .select({ externalHash: financeTransactions.externalHash })
          .from(financeTransactions)
          .where(
            and(
              eq(financeTransactions.userId, this.userId),
              inArray(financeTransactions.externalHash, chunk),
            ),
          )
          .all();
        for (const r of rows) {
          if (r.externalHash) existingSet.add(r.externalHash);
        }
      }

      let created = 0;
      let skipped = 0;
      const toInsert: FinanceTransaction[] = [];

      for (const sub of activeSubs) {
        const hash = `sub:${sub.id}:${yyyymm}`;
        if (existingSet.has(hash)) {
          skipped++;
          continue;
        }

        let amountForMonth: number | null = null;
        if (sub.billingCycle === 'monthly') {
          amountForMonth = sub.amount;
        } else if (sub.billingCycle === 'weekly') {
          amountForMonth = Math.round(toMonthlyAmount(sub.amount, 'weekly'));
        } else if (sub.billingCycle === 'quarterly') {
          if (sub.nextBillingDate) {
            const diff = monthDiff(sub.nextBillingDate.slice(0, 7), yyyymm);
            if (diff % 3 === 0) amountForMonth = sub.amount;
          } else {
            amountForMonth = Math.round(toMonthlyAmount(sub.amount, 'quarterly'));
          }
        } else if (sub.billingCycle === 'yearly') {
          if (sub.nextBillingDate) {
            if (sub.nextBillingDate.slice(0, 7) === yyyymm) amountForMonth = sub.amount;
          } else {
            amountForMonth = Math.round(toMonthlyAmount(sub.amount, 'yearly'));
          }
        }

        if (amountForMonth === null) {
          skipped++;
          continue;
        }

        const billingDayRaw =
          sub.billingDay ??
          (sub.nextBillingDate ? Number(sub.nextBillingDate.slice(8, 10)) : 1);
        const day = Math.max(1, Math.min(daysInMonth, Number.isFinite(billingDayRaw) ? billingDayRaw : 1));
        const date = `${yyyymm}-${String(day).padStart(2, '0')}`;

        toInsert.push({
          id: newId(),
          userId: this.userId,
          date,
          time: null,
          kind: 'expense',
          amount: Math.round(amountForMonth * 100) / 100,
          currency: (sub.currency as FinanceTransaction['currency']) || 'KRW',
          category: sub.category?.trim() || '구독/고정비',
          subCategory: null,
          merchant: sub.name,
          paymentMethod: sub.paymentMethod?.trim() || null,
          note: sub.note?.trim() || '구독 고정비 자동 반영',
          excluded: false,
          source: 'subscription',
          externalHash: hash,
          subscriptionId: sub.id,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        created++;
      }

      if (toInsert.length > 0) {
        tx.insert(financeTransactions).values(toInsert).run();
      }

      return { created, skipped };
    }, { behavior: 'immediate' });
  }
}
