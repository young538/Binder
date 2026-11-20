// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { TodoActions } from '@/lib/server/todos/actions';
import { todos, timeBlocks, todoTrash, categories, goals } from '@/lib/server/db/schema';
import type { Todo } from '@/lib/types';

let connection: DatabaseConnection;
let clock: Date;
const draft = { title: '한글 할 일', scope: 'day', scopeKey: '2026-12-31', status: 'pending', order: 0 } as const;
beforeEach(() => { connection = new DatabaseConnection({ filename: () => ':memory:', migrationsFolder: path.resolve('drizzle') }); clock = new Date('2026-12-31T12:00:00Z'); });
afterEach(() => connection.close());
const actions = (user = 'a') => new TodoActions(connection.get(), user, () => clock);

describe('atomic TODO actions', () => {
  it('replays a creation once per user and rejects different contents with the same key', () => {
    const a = actions();
    const first = a.create(draft, 'request-123');
    expect(a.create({ ...draft }, 'request-123')).toEqual(first);
    expect(() => a.create({ ...draft, title: 'changed' }, 'request-123')).toThrow('다른 내용');
    expect(actions('b').create(draft, 'request-123').id).not.toBe(first.id);
    expect(connection.get().select().from(todos).all()).toHaveLength(2);
    a.remove(first.id);
    expect(a.create(draft, 'request-123')).toEqual(first);
    expect(connection.get().select().from(todos).where(eq(todos.userId, 'a')).all()).toHaveLength(0);
  });

  it('preserves identity and time-block links on delete/undo and isolates other users', () => {
    const a = actions(); const db = connection.get();
    const item = a.create(draft);
    db.insert(timeBlocks).values({ id: 'block', userId: 'a', date: draft.scopeKey, startMin: 600, endMin: 630, text: 'plan', kind: 'plan', categoryId: 'cat', todoId: item.id, createdAt: clock.toISOString(), updatedAt: clock.toISOString() }).run();
    expect(actions('b').remove(item.id)).toEqual({ ok: true });
    const removed = a.remove(item.id);
    expect(a.remove(item.id)).toEqual(removed);
    expect(() => actions('b').restore(item.id)).toThrow('찾을 수');
    expect(a.restore(item.id)).toMatchObject({ id: item.id, title: item.title });
    expect(a.restore(item.id).id).toBe(item.id);
    expect(db.select().from(timeBlocks).get()?.todoId).toBe(item.id);
    expect(db.select().from(todoTrash).all()).toHaveLength(0);
  });

  it('expires undo after 30 seconds and clears missing category/goal on restoration', () => {
    const a = actions(); const db = connection.get(); const timestamp = clock.toISOString();
    db.insert(categories).values({ id: 'cat', userId: 'a', name: 'category', color: '#fff', order: 0 }).run();
    db.insert(goals).values({ id: 'goal', userId: 'a', title: 'goal', level: 'oneThing', order: 0, createdAt: timestamp, updatedAt: timestamp }).run();
    const item = a.create({ ...draft, categoryId: 'cat', parentGoalId: 'goal' });
    a.remove(item.id);
    db.delete(categories).run(); db.delete(goals).run();
    expect(a.restore(item.id)).toMatchObject({ categoryId: null, parentGoalId: null });
    a.remove(item.id);
    clock = new Date(clock.getTime() + 30000);
    expect(() => a.restore(item.id)).toThrow('시간이 지났');
  });

  it('moves only selected unfinished daily TODOs once, across a year boundary, appending their order', () => {
    const a = actions();
    const first = a.create(draft);
    const delayed = a.create({ ...draft, status: 'postponed', order: 1 });
    const skipped: Todo[] = [a.create({ ...draft, status: 'done' }), a.create({ ...draft, scope: 'year', scopeKey: '2026' }), actions('b').create(draft)];
    const existing = a.create({ ...draft, scopeKey: '2027-01-01', order: 3 });
    const ids = [first.id, delayed.id, ...skipped.map(item => item.id)];
    expect(a.rollover(draft.scopeKey, ids)).toEqual({ moved: 2, date: '2027-01-01' });
    expect(a.rollover(draft.scopeKey, ids).moved).toBe(0);
    const rows = connection.get().select().from(todos).all();
    expect(rows.find(row => row.id === first.id)).toMatchObject({ scopeKey: '2027-01-01', order: 4 });
    expect(rows.find(row => row.id === delayed.id)).toMatchObject({ scopeKey: '2027-01-01', order: 5, status: 'postponed' });
    for (const item of [...skipped, existing]) expect(rows.find(row => row.id === item.id)?.scopeKey).toBe(item.scopeKey);
  });
});
