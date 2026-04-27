import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { books } from '../db/schema';
import { Book } from '@/lib/types';
import { newId } from '@/lib/utils/id';

export const listBooksByYear = async (year: string): Promise<Book[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(books)
    .where(eq(books.year, year))
    .orderBy(asc(books.order))
    .all();
  return rows as Book[];
};

export const createBook = async (
  data: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Book> => {
  const db = getDb();
  const now = new Date().toISOString();
  const row: Book = { ...data, id: newId(), createdAt: now, updatedAt: now };
  await db.insert(books).values(row).run();
  return row;
};

export const updateBook = async (
  id: string,
  patch: Partial<Omit<Book, 'id' | 'createdAt'>>
): Promise<Book | null> => {
  const db = getDb();
  await db
    .update(books)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(books.id, id))
    .run();
  const row = await db.select().from(books).where(eq(books.id, id)).get();
  return (row as Book | undefined) ?? null;
};

export const deleteBook = async (id: string): Promise<void> => {
  const db = getDb();
  await db.delete(books).where(eq(books.id, id)).run();
};
