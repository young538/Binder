import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { books } from '../db/schema';
import { Book } from '@/lib/types';
import { newId } from '@/lib/utils/id';

export const listBooksByYear = async (userId: string, year: string): Promise<Book[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(books)
    .where(and(eq(books.userId, userId), eq(books.year, year)))
    .orderBy(asc(books.order))
    .all();
  return rows as Book[];
};

export const createBook = async (
  userId: string,
  data: Omit<Book, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Book> => {
  const db = getDb();
  const now = new Date().toISOString();
  const row: Book = { ...data, id: newId(), userId, createdAt: now, updatedAt: now };
  await db.insert(books).values(row).run();
  return row;
};

export const updateBook = async (
  userId: string,
  id: string,
  patch: Partial<Omit<Book, 'id' | 'userId' | 'createdAt'>>
): Promise<Book | null> => {
  const db = getDb();
  await db
    .update(books)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(books.userId, userId), eq(books.id, id)))
    .run();
  const row = await db
    .select()
    .from(books)
    .where(and(eq(books.userId, userId), eq(books.id, id)))
    .get();
  return (row as Book | undefined) ?? null;
};

export const deleteBook = async (userId: string, id: string): Promise<void> => {
  const db = getDb();
  await db.delete(books).where(and(eq(books.userId, userId), eq(books.id, id))).run();
};
