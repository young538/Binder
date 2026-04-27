import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { categories } from '../db/schema';
import { Category } from '@/lib/types';
import { newId } from '@/lib/utils/id';

export const listCategories = async (): Promise<Category[]> => {
  const db = getDb();
  const rows = await db.select().from(categories).orderBy(asc(categories.order)).all();
  return rows as Category[];
};

export const createCategory = async (
  data: Omit<Category, 'id'>
): Promise<Category> => {
  const db = getDb();
  const row: Category = { ...data, id: newId() };
  await db.insert(categories).values(row).run();
  return row;
};

export const updateCategory = async (
  id: string,
  patch: Partial<Omit<Category, 'id'>>
): Promise<Category | null> => {
  const db = getDb();
  await db.update(categories).set(patch).where(eq(categories.id, id)).run();
  const row = await db.select().from(categories).where(eq(categories.id, id)).get();
  return (row as Category | undefined) ?? null;
};

export const deleteCategory = async (id: string): Promise<void> => {
  const db = getDb();
  await db.delete(categories).where(eq(categories.id, id)).run();
};
