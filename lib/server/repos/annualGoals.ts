import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { annualGoals } from '../db/schema';
import { AnnualGoal } from '@/lib/types';
import { newId } from '@/lib/utils/id';

const EMPTY_12 = (): (number | null)[] => Array(12).fill(null);

export const listAnnualGoalsByYear = async (year: string): Promise<AnnualGoal[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(annualGoals)
    .where(eq(annualGoals.year, year))
    .orderBy(asc(annualGoals.order))
    .all();
  return rows as AnnualGoal[];
};

export const createAnnualGoal = async (year: string, order: number): Promise<AnnualGoal> => {
  const db = getDb();
  const now = new Date().toISOString();
  const row: AnnualGoal = {
    id: newId(),
    year,
    order,
    title: '',
    monthlyTargets: EMPTY_12(),
    monthlyActuals: EMPTY_12(),
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(annualGoals).values(row).run();
  return row;
};

export const updateAnnualGoal = async (
  id: string,
  patch: Partial<Omit<AnnualGoal, 'id' | 'createdAt'>>
): Promise<AnnualGoal | null> => {
  const db = getDb();
  await db
    .update(annualGoals)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(annualGoals.id, id))
    .run();
  const row = await db.select().from(annualGoals).where(eq(annualGoals.id, id)).get();
  return (row as AnnualGoal | undefined) ?? null;
};

export const deleteAnnualGoal = async (id: string): Promise<void> => {
  const db = getDb();
  await db.delete(annualGoals).where(eq(annualGoals.id, id)).run();
};

export const ensureSeven = async (year: string): Promise<AnnualGoal[]> => {
  const existing = await listAnnualGoalsByYear(year);
  if (existing.length >= 7) return existing;
  const toCreate = 7 - existing.length;
  const startOrder = existing.length > 0 ? Math.max(...existing.map(g => g.order)) + 1 : 1;
  for (let i = 0; i < toCreate; i++) {
    await createAnnualGoal(year, startOrder + i);
  }
  return listAnnualGoalsByYear(year);
};
