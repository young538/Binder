// @vitest-environment node
import { afterEach, beforeEach, expect, it } from 'vitest';
import path from 'node:path';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { SearchRepository } from '@/lib/server/search/repository';
import { UserRepositories } from '@/lib/server/repos';
import * as s from '@/lib/server/db/schema';

let connection: DatabaseConnection;
beforeEach(() => { connection = new DatabaseConnection({ filename: () => ':memory:', migrationsFolder: path.resolve('drizzle') }); });
afterEach(() => connection.close());

it('searches all text domains with ownership, literal wildcard characters, and valid destinations', async () => {
  const db = connection.get(); const timestamp = new Date().toISOString();
  for (const userId of ['a', 'b']) {
    const repo = new UserRepositories(db, userId);
    await repo.todos.create({ title: '검색 %_ 할 일', note: 'body', scope: 'day', scopeKey: '2026-10-29', status: 'pending', order: 0 });
    await repo.goals.create({ title: '검색 %_ 목표', level: 'oneThing', order: 0 });
    await repo.categories.create({ name: '검색 %_', color: '#fff', order: 0 });
    await repo.focusNotes.upsert('week', 'week:2026-W44', '검색 %_ 노트');
    await repo.retrospectives.upsert('daily', '2026-10-29', { template: { reading: '검색 %_ 읽기' } });
    const common = { userId, createdAt: timestamp, updatedAt: timestamp, order: 0 };
    db.insert(s.annualGoals).values({ ...common, id: `annual-${userId}`, title: '검색 %_', year: '2026', monthlyTargets: Array(12).fill(null), monthlyActuals: Array(12).fill(null) }).run();
    db.insert(s.habits).values({ ...common, id: `habit-${userId}`, name: '검색 %_', color: '#fff' }).run();
    db.insert(s.books).values({ ...common, id: `book-${userId}`, title: '검색 %_', year: '2026' }).run();
    db.insert(s.timeBlocks).values({ ...common, id: `block-${userId}`, text: '검색 %_', date: '2026-10-29', startMin: 10, endMin: 20, categoryId: 'cat' }).run();
  }
  const search = new SearchRepository(db, 'a');
  const result = search.search('%_');
  expect(result.items).toHaveLength(9);
  expect(new Set(result.items.map(item => item.kind)).size).toBe(9);
  expect(result.items.find(item => item.kind === 'focusNotes')?.href).toBe('/week/2026-W44');
  expect(result.items.find(item => item.kind === 'retrospectives')?.href).toBe('/daily/2026-10-29');
  expect(search.search('%_', 'books').items).toHaveLength(1);
  expect(search.search("' OR 1=1 --").items).toHaveLength(0);
  expect(new SearchRepository(db, 'nobody').search('검색').items).toHaveLength(0);
});

it('paginates deterministically without duplicate or missing results', async () => {
  const db = connection.get(); const repo = new UserRepositories(db, 'a');
  for (let i = 0; i < 25; i++) await repo.todos.create({ title: `Find ${i}`, scope: 'day', scopeKey: '2026-10-29', status: 'pending', order: i });
  const search = new SearchRepository(db, 'a');
  const first = search.search('FIND'); const next = search.search('find', undefined, 20);
  expect(first.items).toHaveLength(20); expect(first.hasMore).toBe(true);
  expect(next.items).toHaveLength(5); expect(next.hasMore).toBe(false);
  expect(new Set([...first.items, ...next.items].map(item => item.id)).size).toBe(25);
});
