import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import {
  createSnapshot,
  listSnapshots,
  restoreSnapshot,
} from '@/lib/snapshots';
import { createCategory } from '@/lib/repo/categories';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('snapshots', () => {
  it('creates and lists snapshots', async () => {
    await createCategory({ name: 'X', color: '#000', order: 0 });
    await createSnapshot('manual', 'test');
    const list = await listSnapshots();
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('manual');
    expect(list[0].label).toBe('test');
  });

  it('restore brings back data', async () => {
    await createCategory({ name: 'First', color: '#111', order: 0 });
    const snap = await createSnapshot('manual', 'before');
    await db.categories.clear();
    expect(await db.categories.count()).toBe(0);
    await restoreSnapshot(snap.id);
    const after = await db.categories.toArray();
    expect(after.some(c => c.name === 'First')).toBe(true);
  });

  it('trims to 5 latest', async () => {
    for (let i = 0; i < 7; i++) {
      await createSnapshot('auto');
      await new Promise(r => setTimeout(r, 5));
    }
    const list = await listSnapshots();
    expect(list.length).toBeLessThanOrEqual(5);
  });
});
