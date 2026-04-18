import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, onDirty } from '@/lib/db';
import { createTimeBlock, getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { createCategory } from '@/lib/repo/categories';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('timeBlocks repo', () => {
  it('create and retrieve time block', async () => {
    const cat = await createCategory({ name: 'Test', color: '#fff', order: 0 });
    const block = await createTimeBlock({
      date: '2026-04-18',
      startMin: 540,
      endMin: 600,
      text: 'unit test',
      categoryId: cat.id,
    });
    expect(block.id).toBeTruthy();
    expect(block.createdAt).toBeTruthy();
  });

  it('range query returns blocks within week', async () => {
    const cat = await createCategory({ name: 'Test', color: '#fff', order: 0 });
    await createTimeBlock({ date: '2026-04-13', startMin: 540, endMin: 600, text: 'a', categoryId: cat.id });
    await createTimeBlock({ date: '2026-04-20', startMin: 540, endMin: 600, text: 'b', categoryId: cat.id });
    const blocks = await getTimeBlocksInRange('2026-04-13', '2026-04-19');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('a');
  });
});

describe('onDirty subscription', () => {
  it('fires on markDirty', async () => {
    let fired = 0;
    const unsub = onDirty(() => { fired += 1; });
    await createCategory({ name: 'X', color: '#000', order: 0 });
    expect(fired).toBeGreaterThan(0);
    unsub();
  });
});
