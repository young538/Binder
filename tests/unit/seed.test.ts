import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { seedIfEmpty } from '@/lib/seed';

beforeEach(async () => { await db.delete(); await db.open(); });

describe('seed', () => {
  it('seeds 6 default categories when empty', async () => {
    await seedIfEmpty();
    const cats = await db.categories.toArray();
    expect(cats).toHaveLength(6);
    expect(cats.map(c => c.name)).toContain('업무');
    expect(cats.map(c => c.name)).toContain('건강/운동');
  });

  it('does not seed when categories exist', async () => {
    await db.categories.put({ id: 'x', name: 'Existing', color: '#000', order: 0 });
    await seedIfEmpty();
    const cats = await db.categories.toArray();
    expect(cats).toHaveLength(1);
  });
});
