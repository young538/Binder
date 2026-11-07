import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { books } from '../db/schema';
import { Book } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import { stripUndefined } from '../db/patch';
import type { BinderDatabase } from '../db/connection';

/** User-scoped books operations; accepts an isolated database for tests. */
export class BookRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  listAll(): Book[] {
    return this.database.select().from(books).where(eq(books.userId, this.userId)).orderBy(asc(books.year), asc(books.order)).all();
  }

  async listByYear(year: string): Promise<Book[]> {
    const userId = this.userId;
    const db = this.database;
    const rows = await db
      .select()
      .from(books)
      .where(and(eq(books.userId, userId), eq(books.year, year)))
      .orderBy(asc(books.order))
      .all();
    return rows as Book[];
  }

  async create(data: Omit<Book, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Book> {
    const userId = this.userId;
    const db = this.database;
    const now = new Date().toISOString();
    const row: Book = { ...data, id: newId(), userId, createdAt: now, updatedAt: now };
    await db.insert(books).values(row).run();
    return row;
  }

  async update(id: string, patch: Partial<Omit<Book, 'id' | 'userId' | 'createdAt'>>): Promise<Book | null> {
    const userId = this.userId;
    const db = this.database;
    await db
      .update(books)
      .set({ ...stripUndefined(patch), updatedAt: new Date().toISOString() })
      .where(and(eq(books.userId, userId), eq(books.id, id)))
      .run();
    const row = await db
      .select()
      .from(books)
      .where(and(eq(books.userId, userId), eq(books.id, id)))
      .get();
    return (row as Book | undefined) ?? null;
  }

  async delete(id: string): Promise<void> {
    const userId = this.userId;
    const db = this.database;
    await db.delete(books).where(and(eq(books.userId, userId), eq(books.id, id))).run();
  }
}

// Compatibility functions for existing callers. New services can inject the repository.
export const listBooksByYear = async (userId: string, year: string): Promise<Book[]> =>
  new BookRepository(getDb(), userId).listByYear(year);

export const createBook = async (userId: string, data: Omit<Book, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Book> =>
  new BookRepository(getDb(), userId).create(data);

export const updateBook = async (userId: string, id: string, patch: Partial<Omit<Book, 'id' | 'userId' | 'createdAt'>>): Promise<Book | null> =>
  new BookRepository(getDb(), userId).update(id, patch);

export const deleteBook = async (userId: string, id: string): Promise<void> =>
  new BookRepository(getDb(), userId).delete(id);
