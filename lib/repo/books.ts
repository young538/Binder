import { db, markDirty } from '../db';
import { Book } from '../types';
import { newId } from '../utils/id';

export const createBook = async (
  data: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Book> => {
  const now = new Date().toISOString();
  const b: Book = { ...data, id: newId(), createdAt: now, updatedAt: now };
  await db.books.put(b);
  await markDirty();
  return b;
};

export const updateBook = async (
  id: string,
  patch: Partial<Omit<Book, 'id' | 'createdAt'>>
) => {
  await db.books.update(id, { ...patch, updatedAt: new Date().toISOString() });
  await markDirty();
};

export const deleteBook = async (id: string) => {
  await db.books.delete(id);
  await markDirty();
};

export const listByYear = async (year: string): Promise<Book[]> => {
  const items = await db.books.where('year').equals(year).toArray();
  return items.sort((a, b) => a.order - b.order);
};
