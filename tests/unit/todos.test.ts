import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import {
  createTodo,
  toggleDone,
  listByDate,
  listByDateRange,
  listByParentGoal,
} from '@/lib/repo/todos';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('todos repo (date-based)', () => {
  it('creates and lists by date', async () => {
    await createTodo({ title: 'A', date: '2026-04-13', done: false, order: 0 });
    await createTodo({ title: 'B', date: '2026-04-13', done: false, order: 1 });
    await createTodo({ title: 'C', date: '2026-04-14', done: false, order: 0 });
    const d13 = await listByDate('2026-04-13');
    expect(d13).toHaveLength(2);
    expect(d13.map(t => t.title)).toEqual(['A', 'B']);
  });

  it('listByDateRange returns todos within range sorted by date then order', async () => {
    await createTodo({ title: 'Y', date: '2026-04-20', done: false, order: 0 });
    await createTodo({ title: 'X', date: '2026-04-13', done: false, order: 1 });
    await createTodo({ title: 'W', date: '2026-04-13', done: false, order: 0 });
    await createTodo({ title: 'Z', date: '2026-04-25', done: false, order: 0 });
    const range = await listByDateRange('2026-04-13', '2026-04-19');
    expect(range.map(t => t.title)).toEqual(['W', 'X']);
  });

  it('toggles done', async () => {
    const t = await createTodo({ title: 'X', date: '2026-04-13', done: false, order: 0 });
    await toggleDone(t.id);
    const after = await db.todos.get(t.id);
    expect(after?.done).toBe(true);
  });

  it('listByParentGoal filters by parentGoalId', async () => {
    await createTodo({ title: 'A', date: '2026-04-13', parentGoalId: 'g1', done: false, order: 0 });
    await createTodo({ title: 'B', date: '2026-04-14', parentGoalId: 'g1', done: false, order: 0 });
    await createTodo({ title: 'C', date: '2026-04-15', parentGoalId: 'g2', done: false, order: 0 });
    const g1 = await listByParentGoal('g1');
    expect(g1).toHaveLength(2);
  });
});
