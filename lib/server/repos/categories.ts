import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { categories } from '../db/schema';
import { Category } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import type { BinderDatabase } from '../db/connection';

/** User-scoped categories operations; accepts an isolated database for tests. */
export class CategoryRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  async list(): Promise<Category[]> {
    const userId = this.userId;
    const db = this.database;
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.order))
      .all();
    return rows as Category[];
  }

  async create(data: Omit<Category, 'id' | 'userId'>): Promise<Category> {
    const userId = this.userId;
    const db = this.database;
    const row: Category = { ...data, id: newId(), userId };
    await db.insert(categories).values(row).run();
    return row;
  }

  async update(id: string, patch: Partial<Omit<Category, 'id' | 'userId'>>): Promise<Category | null> {
    const userId = this.userId;
    const db = this.database;
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
  }

  async delete(id: string): Promise<void> {
    const userId = this.userId;
    const db = this.database;
    await db
      .delete(categories)
      .where(and(eq(categories.userId, userId), eq(categories.id, id)))
      .run();
  }
}

// Compatibility functions for existing callers. New services can inject the repository.
export const listCategories = async (userId: string): Promise<Category[]> =>
  new CategoryRepository(getDb(), userId).list();

export const createCategory = async (userId: string, data: Omit<Category, 'id' | 'userId'>): Promise<Category> =>
  new CategoryRepository(getDb(), userId).create(data);

export const updateCategory = async (userId: string, id: string, patch: Partial<Omit<Category, 'id' | 'userId'>>): Promise<Category | null> =>
  new CategoryRepository(getDb(), userId).update(id, patch);

export const deleteCategory = async (userId: string, id: string): Promise<void> =>
  new CategoryRepository(getDb(), userId).delete(id);
