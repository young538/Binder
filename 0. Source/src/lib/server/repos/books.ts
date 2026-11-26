import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { books } from '../db/schema';
import { Book } from '@/lib/types';
import { listDailyReadings, updateDailyReading } from './dailyReadings';
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
    return this.database.transaction(tx => {
      const now = new Date().toISOString();
      const row = tx.update(books)
        .set({ ...stripUndefined(patch), updatedAt: now })
        .where(and(eq(books.userId, userId), eq(books.id, id))).returning().get();
      if (!row) return null;

      if (typeof patch.title === 'string' && patch.title.trim() !== '') {
        for (const reading of listDailyReadings(tx, userId)) {
          if (reading.entry.bookId === id && reading.entry.bookTitle !== row.title) {
            updateDailyReading(tx, userId, reading.id, { ...reading.entry, bookTitle: row.title }, now);
          }
        }
      }

      return row as Book;
    }, { behavior: 'immediate' });
  }

  async delete(id: string): Promise<void> {
    const userId = this.userId;
    const db = this.database;
    await db.delete(books).where(and(eq(books.userId, userId), eq(books.id, id))).run();
  }
}
