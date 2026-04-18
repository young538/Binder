import { db, markDirty } from '../db';
import { Category } from '../types';
import { newId } from '../utils/id';

export const createCategory = async (
  data: Omit<Category, 'id'>
): Promise<Category> => {
  const cat: Category = { ...data, id: newId() };
  await db.categories.put(cat);
  await markDirty();
  return cat;
};

export const updateCategory = async (id: string, patch: Partial<Omit<Category, 'id'>>) => {
  await db.categories.update(id, patch);
  await markDirty();
};

export const deleteCategory = async (id: string) => {
  await db.categories.delete(id);
  await markDirty();
};

export const listCategories = async (): Promise<Category[]> =>
  db.categories.orderBy('order').toArray();
