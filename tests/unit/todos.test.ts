import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { createTodo, toggleDone, listByPeriod, existsForPeriod } from '@/lib/repo/todos';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('todos repo', () => {
  it('creates and lists by period', async () => {
    await createTodo({ title: 'A', period: 'weekly', periodKey: 'week:2026-W16', done: false, order: 0 });
    await createTodo({ title: 'B', period: 'weekly', periodKey: 'week:2026-W16', done: false, order: 1 });
    await createTodo({ title: 'C', period: 'weekly', periodKey: 'week:2026-W17', done: false, order: 0 });
    const w16 = await listByPeriod('weekly', 'week:2026-W16');
    expect(w16).toHaveLength(2);
    expect(w16.map(t => t.title)).toEqual(['A', 'B']);
  });

  it('toggles done', async () => {
    const t = await createTodo({ title: 'X', period: 'monthly', periodKey: 'month:2026-04', done: false, order: 0 });
    await toggleDone(t.id);
    const after = await db.todos.get(t.id);
    expect(after?.done).toBe(true);
  });

  it('existsForPeriod detects duplicates', async () => {
    await createTodo({ title: 'Y', parentGoalId: 'g1', period: 'monthly', periodKey: 'month:2026-04', done: false, order: 0 });
    expect(await existsForPeriod('monthly', 'month:2026-04', 'g1')).toBe(true);
    expect(await existsForPeriod('monthly', 'month:2026-05', 'g1')).toBe(false);
  });
});
