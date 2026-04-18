import { db, markDirty } from '../db';
import { Goal, GoalLevel } from '../types';
import { newId } from '../utils/id';

export const createGoal = async (
  data: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Goal> => {
  const now = new Date().toISOString();
  const goal: Goal = { ...data, id: newId(), createdAt: now, updatedAt: now };
  await db.goals.put(goal);
  await markDirty();
  return goal;
};

export const updateGoal = async (id: string, patch: Partial<Omit<Goal, 'id' | 'createdAt'>>) => {
  await db.goals.update(id, { ...patch, updatedAt: new Date().toISOString() });
  await markDirty();
};

export const deleteGoal = async (id: string) => {
  await db.goals.delete(id);
  await markDirty();
};

export const listGoalsByLevel = async (level: GoalLevel): Promise<Goal[]> =>
  db.goals.where('level').equals(level).toArray();

export const listChildren = async (parentId: string): Promise<Goal[]> =>
  db.goals.where('parentId').equals(parentId).toArray();
