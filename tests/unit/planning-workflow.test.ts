// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq, sql } from 'drizzle-orm';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { TodoActions } from '@/lib/server/todos/actions';
import { UserRepositories } from '@/lib/server/repos';
import { BackupService } from '@/lib/server/backup/service';
import * as schema from '@/lib/server/db/schema';
import { nextRepeatDate, nextRetroTarget } from '@/lib/todos/planning';
import { comparePlanActual, reviewGoals } from '@/lib/planning/insights';
import { validateFields, validateRelationships } from '@/lib/validation/mutations';
import { parseReadingEntry } from '@/lib/reading';
import type { Goal, TimeBlock, TodoRepeatRule } from '@/lib/types';

let connection: DatabaseConnection;
const now = new Date('2026-12-31T16:00:00.000Z'); // Seoul: Jan 1
const times = { createdAt: now.toISOString(), updatedAt: now.toISOString() };
const draft = { title: '주간 정리', scope: 'day', scopeKey: '2026-12-31', status: 'pending', order: 0 } as const;
beforeEach(() => { connection = new DatabaseConnection({ filename: () => ':memory:', migrationsFolder: path.resolve('drizzle') }); });
afterEach(() => connection.close());
const actions = (userId = 'a') => new TodoActions(connection.get(), userId, () => now);
const repos = (userId = 'a') => new UserRepositories(connection.get(), userId);

describe('planning workflow', () => {
  it('migrates an existing database without changing historical TODO data', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'binder-migration-'));
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite);
    const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8'));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 7);
    fs.mkdirSync(path.join(folder, 'meta'));
    fs.writeFileSync(path.join(folder, 'meta/_journal.json'), JSON.stringify(journal));
    try {
      for (const entry of journal.entries) fs.copyFileSync(`drizzle/${entry.tag}.sql`, path.join(folder, `${entry.tag}.sql`));
      migrate(db, { migrationsFolder: folder });
      sqlite.prepare('INSERT INTO todos (id,user_id,title,scope,scope_key,status,"order",created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run('old', 'a', '기존 기록', 'day', '2026-12-31', 'done', 2, times.createdAt, times.updatedAt);
      const before = sqlite.prepare('SELECT * FROM todos').get() as Record<string, unknown>;
      migrate(db, { migrationsFolder: path.resolve('drizzle') });
      const after = sqlite.prepare('SELECT * FROM todos').get() as Record<string, unknown>;
      for (const [key, value] of Object.entries(before)) expect(after[key]).toEqual(value);
      expect(after).toMatchObject({ repeat_rule: null, source_retro: null, completed_at: null, repeat_generated: 0 });
    } finally {
      sqlite.close();
      // Only remove the individual fixture files created in this unique temporary folder.
      for (const entry of journal.entries) fs.rmSync(path.join(folder, `${entry.tag}.sql`), { force: true });
      fs.rmSync(path.join(folder, 'meta/_journal.json'));
      fs.rmdirSync(path.join(folder, 'meta')); fs.rmdirSync(folder);
    }
  });
  it('deduplicates only the same reflection action and permits a new action after deletion', () => {
    const sourceRetro = { type: 'daily' as const, dateOrWeek: '2026-12-30' };
    const first = actions().create({ ...draft, sourceRetro }, 'retro-first');
    expect(actions().create({ ...draft, sourceRetro }, 'retro-second').id).toBe(first.id);
    expect(actions().create(draft).id).not.toBe(first.id);
    actions().remove(first.id);
    expect(actions().create({ ...draft, sourceRetro }, 'retro-first').id).toBe(first.id);
    expect(actions().create({ ...draft, sourceRetro }, 'retro-new-action').id).not.toBe(first.id);
  });
  it('keeps recurrence atomic, user scoped, and generates only once across retries and undo', () => {
    const todo = actions().create({ ...draft, repeatRule: { unit: 'week', interval: 1, basis: 'scheduled' } });
    expect(actions('b').update(todo.id, { status: 'done' })).toBeNull();
    actions().update(todo.id, { status: 'done' });
    actions().update(todo.id, { status: 'done' });
    actions().update(todo.id, { status: 'pending' });
    actions().update(todo.id, {}, true);
    const rows = connection.get().select().from(schema.todos).all();
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.id !== todo.id)).toMatchObject({ scopeKey: '2027-01-07', status: 'pending', repeatGenerated: false });
    expect(rows.find(row => row.id === todo.id)).toMatchObject({ completedAt: now.toISOString(), repeatGenerated: true });
  });

  it('uses the Seoul completion date and rolls back completion if generating the next task fails', () => {
    const todo = actions().create({ ...draft, repeatRule: { unit: 'day', interval: 2, basis: 'completed' } });
    connection.get().run(sql`CREATE TRIGGER fail_repeat BEFORE INSERT ON todos BEGIN SELECT RAISE(ABORT, 'failure'); END`);
    expect(() => actions().update(todo.id, { status: 'done' })).toThrow();
    expect(connection.get().select().from(schema.todos).get()?.status).toBe('pending');
    connection.get().run(sql`DROP TRIGGER fail_repeat`);
    actions().update(todo.id, { status: 'done' });
    expect(connection.get().select().from(schema.todos).all().find(row => row.id !== todo.id)?.scopeKey).toBe('2027-01-03');
  });

  it('handles month ends and year boundaries for repeat and retrospective destinations', () => {
    const rule: TodoRepeatRule = { unit: 'month', interval: 1, basis: 'scheduled' };
    expect(nextRepeatDate('2028-01-31', rule, '2028-02-03')).toBe('2028-02-29');
    expect(nextRetroTarget({ type: 'daily', dateOrWeek: '2026-12-31' })).toEqual({ scope: 'day', scopeKey: '2027-01-01' });
    expect(nextRetroTarget({ type: 'weekly', dateOrWeek: '2026-W53' })).toEqual({ scope: 'week', scopeKey: '2027-W01' });
  });

  it('validates inbox, repeat rules and immutable server completion fields', () => {
    expect(() => validateRelationships('todos', { ...draft, scope: 'inbox', scopeKey: 'inbox' })).not.toThrow();
    expect(() => validateRelationships('todos', { ...draft, scope: 'inbox', scopeKey: '2026-12-31' })).toThrow();
    expect(() => validateRelationships('todos', { ...draft, scope: 'inbox', scopeKey: 'inbox', repeatRule: { unit: 'day', interval: 1, basis: 'scheduled' } })).toThrow();
    for (const repeatRule of [{ unit: 'day', interval: 0, basis: 'scheduled' }, { unit: 'day', interval: 1, basis: 'unknown' }]) {
      expect(() => validateFields('todos', { ...draft, repeatRule })).toThrow();
    }
    expect(() => validateFields('todos', { completedAt: times.createdAt }, true)).toThrow();
    expect(() => validateFields('todos', { repeatGenerated: false }, true)).toThrow();
  });

  it('preserves source links and repeat generation state in portable backups, including older documents', () => {
    const todo = actions().create({ ...draft, sourceRetro: { type: 'daily', dateOrWeek: '2026-12-30' }, repeatRule: { unit: 'day', interval: 1, basis: 'scheduled' } });
    actions().update(todo.id, { status: 'done' });
    actions().create({ ...draft, scope: 'inbox', scopeKey: 'inbox' });
    const backups = new BackupService(() => connection.get());
    const exported = backups.exportFor('a');
    backups.importFor('a', { mode: 'replace', data: exported });
    actions().update(todo.id, { status: 'pending' }); actions().update(todo.id, { status: 'done' });
    expect(backups.exportFor('a').todos).toHaveLength(3);
    expect(backups.exportFor('a').todos.find(row => row.id === todo.id)?.sourceRetro).toEqual({ type: 'daily', dateOrWeek: '2026-12-30' });
    backups.importFor('b', { mode: 'replace', data: { version: 10, todos: [{ ...draft, id: 'legacy', ...times }] } });
    expect(backups.exportFor('b').todos[0].repeatGenerated).toBe(false);
  });

  it('snapshots plans only, previews preserved offsets, applies without TODO links and prevents repeated application', async () => {
    const db = connection.get();
    db.insert(schema.categories).values({ id: 'cat', userId: 'a', name: '공부', color: '#123456', order: 0 }).run();
    const plan = { id: 'plan', userId: 'a', date: '2026-12-28', startMin: 540, endMin: 600, text: '집중', kind: 'plan', categoryId: 'cat', todoId: 'original', ...times };
    db.insert(schema.timeBlocks).values([plan, { ...plan, id: 'actual', kind: 'actual' }]).run();
    const template = repos().weeklyTemplates.create('평일', '2026-W53');
    expect(template.blocks).toHaveLength(1);
    expect(template.blocks[0]).toMatchObject({ dayOffset: 0, startMin: 540 });
    expect(repos('b').weeklyTemplates.list()).toEqual([]);
    expect(() => repos('b').weeklyTemplates.apply(template.id, '2027-W01')).toThrow();
    expect(repos().weeklyTemplates.apply(template.id, '2027-W01')).toEqual({ added: 1, skipped: 0 });
    expect(repos().weeklyTemplates.apply(template.id, '2027-W01')).toEqual({ added: 0, skipped: 1 });
    const blocks = await repos().timeBlocks.listInRange('2027-01-04', '2027-01-10');
    expect(blocks[0]).toMatchObject({ date: '2027-01-04', todoId: null, kind: 'plan' });
    repos().weeklyTemplates.delete(template.id);
    expect((await repos().timeBlocks.listInRange('2027-01-04', '2027-01-10'))).toHaveLength(1);
  });

  it('rejects invalid nested template references before backup replacement', () => {
    actions().create(draft);
    const backups = new BackupService(() => connection.get());
    const template = { id: 'template', name: 'invalid', blocks: [{ dayOffset: 0, startMin: 30, endMin: 60, text: '', categoryId: 'foreign' }], ...times };
    connection.get().insert(schema.categories).values({ id: 'foreign', userId: 'b', name: 'foreign', color: '#fff', order: 0 }).run();
    expect(() => backups.importFor('a', { mode: 'replace', data: { weeklyTemplates: [template] } })).toThrow('Invalid reference');
    expect(backups.exportFor('a').todos).toHaveLength(1);
  });

  it('collects same-book reading across years without mixing identical titles or owners', async () => {
    const book = await repos().books.create({ title: '같은 제목', year: '2026', order: 0 });
    const other = await repos().books.create({ title: '같은 제목', year: '2027', order: 1 });
    for (const [id, date, bookId, pages, userId] of [
      ['r1', '2026-12-31', book.id, 20, 'a'], ['r2', '2027-01-01', book.id, 30, 'a'],
      ['r3', '2027-01-02', other.id, 90, 'a'], ['r4', '2027-01-03', book.id, 100, 'b'],
    ] as const) connection.get().insert(schema.retrospectives).values({ id, userId, type: 'daily', dateOrWeek: date, template: { reading: JSON.stringify({ bookId, pages, memo: date }) }, ...times }).run();
    expect(repos().insights.bookHistory(book.id)).toMatchObject({ totalPages: 50, readingDays: 2 });
    expect(() => repos('b').insights.bookHistory(book.id)).toThrow();
    expect(parseReadingEntry('null').memo).toBe('null');
    expect(parseReadingEntry('기존 노트').memo).toBe('기존 노트');
  });

  it('rolls descendants into review once and separates plan-only records from execution', () => {
    const goal = { id: 'root', userId: 'a', title: '목표', level: 'oneThing', order: 0, ...times } as Goal;
    const child = { ...goal, id: 'child', parentId: goal.id };
    const blocks = [{ id: 'actual', userId: 'a', goalId: child.id, date: '2026-12-31', startMin: 600, endMin: 660, kind: 'actual', categoryId: 'cat', text: '', ...times },
      { id: 'plan', userId: 'a', goalId: child.id, date: '2026-12-31', startMin: 600, endMin: 720, kind: 'plan', categoryId: 'cat', text: '', ...times }] as TimeBlock[];
    const reviews = reviewGoals([goal, child], [], [], [], blocks, '2026-12-18', '2026-12-31');
    expect(reviews[0]).toMatchObject({ descendantCount: 1, actualMinutes: 60, inactive: false });
    expect(reviewGoals([goal, child], [], [], [], blocks.filter(block => block.kind === 'plan'), '2026-12-18', '2026-12-31')[0].inactive).toBe(true);
    expect(comparePlanActual(blocks)).toEqual([{ categoryId: 'cat', plan: 120, actual: 60, difference: -60 }]);
    expect(reviewGoals([{ ...goal, parentId: child.id }, child], [], [], [], [], '2026-12-18', '2026-12-31')[0].descendantCount).toBe(1);
  });

  it('does not expose another account in goal review', async () => {
    await repos().goals.create({ title: 'private', level: 'oneThing', order: 0 });
    expect(repos('b').insights.goalReview('2026-12-31').goals).toEqual([]);
    expect(connection.get().select().from(schema.goals).where(eq(schema.goals.userId, 'a')).all()).toHaveLength(1);
  });
});
