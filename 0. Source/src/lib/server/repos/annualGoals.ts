import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { annualGoals, habits } from '../db/schema';
import { AnnualGoal } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import { stripUndefined } from '../db/patch';
import { actualAdjustments, automaticMonthlyActuals, projectAnnualGoal, syncAnnualTargets } from './annualGoalAggregates';
const EMPTY_12 = (): (number | null)[] => Array(12).fill(null);
import type { BinderDatabase } from '../db/connection';

/** User-scoped annualGoals operations; accepts an isolated database for tests. */
export class AnnualGoalRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  async listByYear(year: string): Promise<AnnualGoal[]> {
    const userId = this.userId;
    const db = this.database;
    const rows = await db
      .select()
      .from(annualGoals)
      .where(and(eq(annualGoals.userId, userId), eq(annualGoals.year, year)))
      .orderBy(asc(annualGoals.order))
      .all();
    return rows.map(row => projectAnnualGoal(db, row));
  }

  async create(year: string, order: number): Promise<AnnualGoal> {
    const userId = this.userId;
    const db = this.database;
    const now = new Date().toISOString();
    const row: AnnualGoal = {
      id: newId(),
      userId,
      year,
      order,
      title: '',
      monthlyTargets: EMPTY_12(),
      monthlyActuals: EMPTY_12(),
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(annualGoals).values({ ...row, monthlyActualAdjustments: EMPTY_12() }).run();
    return row;
  }

  async update(id: string, patch: Partial<Omit<AnnualGoal, 'id' | 'userId' | 'createdAt'>>): Promise<AnnualGoal | null> {
    const userId = this.userId;
    return this.database.transaction(tx => {
      const before = tx.select().from(annualGoals)
        .where(and(eq(annualGoals.userId, userId), eq(annualGoals.id, id))).get();
      if (!before) return null;
      const { monthlyActuals, ...rest } = stripUndefined(patch);
      if (rest.monthlyTargets !== undefined) {
        rest.target = rest.monthlyTargets.reduce<number>((sum, value) => sum + (value ?? 0), 0);
      }
      const automatic = automaticMonthlyActuals(tx, { ...before, year: rest.year ?? before.year });
      const monthlyActualAdjustments = monthlyActuals === undefined
        ? actualAdjustments(before, automaticMonthlyActuals(tx, before))
        : monthlyActuals.map((value, i) => value === null && automatic[i] === 0 ? null : (value ?? 0) - automatic[i]);
      tx.update(annualGoals).set({ ...rest, monthlyActualAdjustments, updatedAt: new Date().toISOString() })
        .where(and(eq(annualGoals.userId, userId), eq(annualGoals.id, id))).run();
      const linked = tx.select({ id: habits.id }).from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.annualGoalId, id))).get();
      if (linked) syncAnnualTargets(tx, userId, id);
      const row = tx.select().from(annualGoals)
        .where(and(eq(annualGoals.userId, userId), eq(annualGoals.id, id))).get()!;
      return projectAnnualGoal(tx, row);
    }, { behavior: 'immediate' });
  }

  async delete(id: string): Promise<void> {
    const userId = this.userId;
    this.database.transaction(tx => {
      tx.update(habits).set({ annualGoalId: null, updatedAt: new Date().toISOString() })
        .where(and(eq(habits.userId, userId), eq(habits.annualGoalId, id))).run();
      tx.delete(annualGoals).where(and(eq(annualGoals.userId, userId), eq(annualGoals.id, id))).run();
    }, { behavior: 'immediate' });
  }

  async ensureSeven(year: string): Promise<AnnualGoal[]> {
    return this.database.transaction(tx => {
      const predicate = and(eq(annualGoals.userId, this.userId), eq(annualGoals.year, year));
      const existing = tx.select().from(annualGoals).where(predicate).all();
      const startOrder = existing.length ? Math.max(...existing.map(goal => goal.order)) + 1 : 1;
      const now = new Date().toISOString();
      for (let i = 0;i < 7 - existing.length;i++) {
        tx.insert(annualGoals).values({
          id: newId(), userId: this.userId, year, order: startOrder + i, title: '',
          monthlyTargets: EMPTY_12(), monthlyActuals: EMPTY_12(), monthlyActualAdjustments: EMPTY_12(),
          createdAt: now, updatedAt: now,
        }).run();
      }
      return tx.select().from(annualGoals).where(predicate).orderBy(asc(annualGoals.order)).all()
        .map(row => projectAnnualGoal(tx, row));
    }, { behavior: 'immediate' });
  }
}

// Compatibility functions for existing callers. New services can inject the repository.
export const listAnnualGoalsByYear = async (userId: string, year: string): Promise<AnnualGoal[]> =>
  new AnnualGoalRepository(getDb(), userId).listByYear(year);

export const createAnnualGoal = async (userId: string, year: string, order: number): Promise<AnnualGoal> =>
  new AnnualGoalRepository(getDb(), userId).create(year, order);

export const updateAnnualGoal = async (userId: string, id: string, patch: Partial<Omit<AnnualGoal, 'id' | 'userId' | 'createdAt'>>): Promise<AnnualGoal | null> =>
  new AnnualGoalRepository(getDb(), userId).update(id, patch);

export const deleteAnnualGoal = async (userId: string, id: string): Promise<void> =>
  new AnnualGoalRepository(getDb(), userId).delete(id);

export const ensureSeven = async (userId: string, year: string): Promise<AnnualGoal[]> =>
  new AnnualGoalRepository(getDb(), userId).ensureSeven(year);
