import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import {
  createTodo,
  toggleDone,
  setStatus,
  listByScope,
  listDayTodosInRange,
  listByParentGoal,
} from '@/lib/repo/todos';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('todos (scoped)', () => {
  it('creates day, week, month todos', async () => {
    await createTodo({ title: 'day', scope: 'day', scopeKey: '2026-04-13', status: 'pending', order: 0 });
    await createTodo({ title: 'week', scope: 'week', scopeKey: '2026-W16', status: 'pending', order: 0 });
    await createTodo({ title: 'month', scope: 'month', scopeKey: '2026-04', status: 'pending', order: 0 });
    expect((await listByScope('day', '2026-04-13'))[0].title).toBe('day');
    expect((await listByScope('week', '2026-W16'))[0].title).toBe('week');
    expect((await listByScope('month', '2026-04'))[0].title).toBe('month');
  });

  it('listDayTodosInRange only returns day scope within range', async () => {
    await createTodo({ title: 'a', scope: 'day', scopeKey: '2026-04-13', status: 'pending', order: 0 });
    await createTodo({ title: 'b', scope: 'day', scopeKey: '2026-04-20', status: 'pending', order: 0 });
    await createTodo({ title: 'c', scope: 'week', scopeKey: '2026-W16', status: 'pending', order: 0 });
    const r = await listDayTodosInRange('2026-04-13', '2026-04-19');
    expect(r.map(t => t.title)).toEqual(['a']);
  });

  it('toggles done', async () => {
    const t = await createTodo({ title: 'X', scope: 'day', scopeKey: '2026-04-13', status: 'pending', order: 0 });
    await toggleDone(t.id);
    expect((await db.todos.get(t.id))?.status).toBe('done');
    await toggleDone(t.id);
    expect((await db.todos.get(t.id))?.status).toBe('pending');
  });

  it('setStatus cycles through all statuses', async () => {
    const t = await createTodo({ title: 'Y', scope: 'day', scopeKey: '2026-04-13', status: 'pending', order: 0 });
    await setStatus(t.id, 'postponed');
    expect((await db.todos.get(t.id))?.status).toBe('postponed');
    await setStatus(t.id, 'delegated');
    expect((await db.todos.get(t.id))?.status).toBe('delegated');
    await setStatus(t.id, 'cancelled');
    expect((await db.todos.get(t.id))?.status).toBe('cancelled');
    await setStatus(t.id, 'done');
    expect((await db.todos.get(t.id))?.status).toBe('done');
  });

  it('listByParentGoal returns across scopes', async () => {
    await createTodo({ title: 'd', scope: 'day', scopeKey: '2026-04-13', parentGoalId: 'g1', status: 'pending', order: 0 });
    await createTodo({ title: 'w', scope: 'week', scopeKey: '2026-W16', parentGoalId: 'g1', status: 'pending', order: 0 });
    expect((await listByParentGoal('g1')).length).toBe(2);
  });
});
