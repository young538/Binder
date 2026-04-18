import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { createBook, listByYear, updateBook, deleteBook } from '@/lib/repo/books';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('books', () => {
  it('creates and lists by year sorted by order', async () => {
    await createBook({ year: '2026', order: 2, title: 'B' });
    await createBook({ year: '2026', order: 1, title: 'A' });
    await createBook({ year: '2025', order: 1, title: 'X' });
    const b2026 = await listByYear('2026');
    expect(b2026.map(b => b.title)).toEqual(['A', 'B']);
    const b2025 = await listByYear('2025');
    expect(b2025).toHaveLength(1);
  });

  it('updates title', async () => {
    const b = await createBook({ year: '2026', order: 1, title: 'old' });
    await updateBook(b.id, { title: 'new' });
    const after = await db.books.get(b.id);
    expect(after?.title).toBe('new');
  });

  it('deletes', async () => {
    const b = await createBook({ year: '2026', order: 1, title: 'del' });
    await deleteBook(b.id);
    expect(await db.books.count()).toBe(0);
  });
});
