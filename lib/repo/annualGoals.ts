import { db, markDirty } from '../db';
import { AnnualGoal } from '../types';
import { newId } from '../utils/id';

const EMPTY_12 = (): (number | null)[] => Array(12).fill(null);

export const createAnnualGoal = async (year: string, order: number): Promise<AnnualGoal> => {
  const now = new Date().toISOString();
  const goal: AnnualGoal = {
    id: newId(),
    year,
    order,
    title: '',
    monthlyTargets: EMPTY_12(),
    monthlyActuals: EMPTY_12(),
    createdAt: now,
    updatedAt: now,
  };
  await db.annualGoals.put(goal);
  await markDirty();
  return goal;
};

export const updateAnnualGoal = async (
  id: string,
  patch: Partial<Omit<AnnualGoal, 'id' | 'createdAt'>>
): Promise<void> => {
  await db.annualGoals.update(id, { ...patch, updatedAt: new Date().toISOString() });
  await markDirty();
};

export const deleteAnnualGoal = async (id: string): Promise<void> => {
  await db.annualGoals.delete(id);
  await markDirty();
};

export const listByYear = async (year: string): Promise<AnnualGoal[]> => {
  const items = await db.annualGoals.where('year').equals(year).toArray();
  return items.sort((a, b) => a.order - b.order);
};

export const ensureSeven = async (year: string): Promise<AnnualGoal[]> => {
  const existing = await listByYear(year);
  if (existing.length >= 7) return existing;
  const toCreate = 7 - existing.length;
  const startOrder = existing.length > 0 ? Math.max(...existing.map(g => g.order)) + 1 : 1;
  for (let i = 0; i < toCreate; i++) {
    await createAnnualGoal(year, startOrder + i);
  }
  return listByYear(year);
};
