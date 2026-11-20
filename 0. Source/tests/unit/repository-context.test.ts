// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { UserRepositories } from '@/lib/server/repos';
import { focusNotes } from '@/lib/server/db/schema';

const connections: DatabaseConnection[] = [];
function database() {
  const connection = new DatabaseConnection({ filename: () => ':memory:', migrationsFolder: path.join(process.cwd(), 'drizzle') });
  connections.push(connection);
  return connection.get();
}
afterEach(() => { connections.splice(0).forEach(connection => connection.close()); });

describe('injected user repositories', () => {
  it('uses the supplied database and owner for reads, writes, and nested operations', async () => {
    const db = database();
    const a = new UserRepositories(db, 'a');
    const b = new UserRepositories(db, 'b');
    const isolated = new UserRepositories(database(), 'a');
    const todo = await a.todos.create({ title: 'mine', scope: 'day', scopeKey: '2026-10-29', status: 'pending', order: 0 });
    expect(await b.todos.update(todo.id, { title: 'other' })).toBeNull();
    await b.todos.delete(todo.id);
    expect(await a.todos.toggleDone(todo.id)).toMatchObject({ status: 'done', userId: 'a' });
    expect(await b.todos.list()).toEqual([]);
    expect(await isolated.todos.list()).toEqual([]);
    const category = await a.categories.create({ name: 'category', color: '#123456', order: 0 });
    expect(await b.categories.update(category.id, { name: 'other' })).toBeNull();
    expect(await a.categories.list()).toHaveLength(1);
    await a.retrospectives.upsert('daily', '2026-10-29', { template: { reading: 'book' } });
    await a.retrospectives.upsert('daily', '2026-10-29', { template: { good: 'done' } });
    expect((await a.retrospectives.get('daily', '2026-10-29'))?.template).toEqual({ reading: 'book', good: 'done' });
    expect(await b.retrospectives.get('daily', '2026-10-29')).toBeNull();
  });

  it('keeps first note creation and annual seeding atomic under simultaneous calls', async () => {
    const db = database();
    const repository = new UserRepositories(db, 'a');
    await Promise.all(Array.from({ length: 5 }, (_, i) => repository.focusNotes.upsert('day', '2026-10-29', String(i))));
    expect(db.select().from(focusNotes).all()).toHaveLength(1);
    expect((await repository.focusNotes.get('day', '2026-10-29'))?.text).toBe('4');
    await Promise.all([repository.annualGoals.ensureSeven('2026'), repository.annualGoals.ensureSeven('2026')]);
    const goals = await repository.annualGoals.listByYear('2026');
    expect(goals).toHaveLength(7);
    expect(goals.map(goal => goal.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
