import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { annualGoals } from '../db/schema';
import { AnnualGoal } from '@/lib/types';
import { newId } from '@/lib/utils/id';

const EMPTY_12 = (): (number | null)[] => Array(12).fill(null);

export const listAnnualGoalsByYear = async (
  userId: string,
  year: string
): Promise<AnnualGoal[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(annualGoals)
    .where(and(eq(annualGoals.userId, userId), eq(annualGoals.year, year)))
    .orderBy(asc(annualGoals.order))
    .all();
  return rows as AnnualGoal[];
};

export const createAnnualGoal = async (
  userId: string,
  year: string,
  order: number
): Promise<AnnualGoal> => {
  const db = getDb();
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
  await db.insert(annualGoals).values(row).run();
  return row;
};

export const updateAnnualGoal = async (
  userId: string,
  id: string,
  patch: Partial<Omit<AnnualGoal, 'id' | 'userId' | 'createdAt'>>
): Promise<AnnualGoal | null> => {
  const db = getDb();
  await db
    .update(annualGoals)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(annualGoals.userId, userId), eq(annualGoals.id, id)))
    .run();
  const row = await db
    .select()
    .from(annualGoals)
    .where(and(eq(annualGoals.userId, userId), eq(annualGoals.id, id)))
    .get();
  return (row as AnnualGoal | undefined) ?? null;
};

export const deleteAnnualGoal = async (userId: string, id: string): Promise<void> => {
  const db = getDb();
  await db
    .delete(annualGoals)
    .where(and(eq(annualGoals.userId, userId), eq(annualGoals.id, id)))
    .run();
};

export const ensureSeven = async (userId: string, year: string): Promise<AnnualGoal[]> => {
  const existing = await listAnnualGoalsByYear(userId, year);
  if (existing.length >= 7) return existing;
  const toCreate = 7 - existing.length;
  const startOrder = existing.length > 0 ? Math.max(...existing.map(g => g.order)) + 1 : 1;
  for (let i = 0; i < toCreate; i++) {
    await createAnnualGoal(userId, year, startOrder + i);
  }
  return listAnnualGoalsByYear(userId, year);
};
