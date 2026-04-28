import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { categories } from '../db/schema';
import { Category } from '@/lib/types';
import { newId } from '@/lib/utils/id';

export const listCategories = async (userId: string): Promise<Category[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.order))
    .all();
  return rows as Category[];
};

export const createCategory = async (
  userId: string,
  data: Omit<Category, 'id' | 'userId'>
): Promise<Category> => {
  const db = getDb();
  const row: Category = { ...data, id: newId(), userId };
  await db.insert(categories).values(row).run();
  return row;
};

export const updateCategory = async (
  userId: string,
  id: string,
  patch: Partial<Omit<Category, 'id' | 'userId'>>
): Promise<Category | null> => {
  const db = getDb();
  await db
    .update(categories)
    .set(patch)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .run();
  const row = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .get();
  return (row as Category | undefined) ?? null;
};

export const deleteCategory = async (userId: string, id: string): Promise<void> => {
  const db = getDb();
  await db
    .delete(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .run();
};
