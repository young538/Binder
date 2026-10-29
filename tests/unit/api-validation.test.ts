// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb, closeDb, schema } from '@/lib/server/db/client';
import { validateFields, validateRelationships } from '@/lib/server/validation';
import { POST as createTodoRoute } from '@/app/api/todos/route';
import { PATCH as patchTodoRoute } from '@/app/api/todos/[id]/route';
import { POST as createBlockRoute } from '@/app/api/time-blocks/route';
import { PATCH as patchBlockRoute } from '@/app/api/time-blocks/[id]/route';
import { POST as logHabitRoute } from '@/app/api/habit-logs/route';
import { PATCH as patchSettingsRoute } from '@/app/api/settings/route';
import { PUT as retroRoute } from '@/app/api/retrospectives/route';
import { POST as importRoute } from '@/app/api/import/route';
import { GET as exportRoute } from '@/app/api/export/route';

const auth = vi.hoisted(() => ({ userId: '' }));
vi.mock('@/lib/server/auth', () => ({ requireSession: async () => ({ userId: auth.userId }) }));
const dbPath = path.join(process.cwd(), 'tmp-test', `api-validation-${process.pid}.sqlite`);
const request = (body: unknown) => new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const todo = { title: 'Task', scope: 'day', scopeKey: '2026-04-28', status: 'pending', order: 0 };
const now = '2026-04-28T00:00:00.000Z';

beforeEach(() => {
  process.env.DB_PATH = dbPath;
  process.env.APP_USERNAME = 'admin';
  process.env.APP_PASSWORD_HASH = 'placeholder';
  const db = getDb();
  auth.userId = db.select().from(schema.users).where(eq(schema.users.username, 'admin')).get()!.id;
});
afterEach(() => {
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force: true });
});

describe('mutation request boundary', () => {
  it.each([null, [], 'body', { ...todo, id: 'injected' }, { ...todo, userId: 'other' }, { ...todo, createdAt: now }, { ...todo, updatedAt: now }, { ...todo, surprise: 1 }, { ...todo, status: 'bad' }, { ...todo, order: 0.5 }, { ...todo, priority: 4 }, { ...todo, scopeKey: '2026-02-30' }])('rejects malformed create payload %# without writing', async body => {
    expect((await createTodoRoute(request(body))).status).toBe(400);
    expect(getDb().select().from(schema.todos).all()).toHaveLength(0);
  });

  it('returns 400 for malformed JSON', async () => {
    const response = await createTodoRoute(new Request('http://localhost/api/todos', { method: 'POST', body: '{' }));
    expect(response.status).toBe(400);
  });

  it.each(['id', 'userId', 'createdAt', 'updatedAt'])('rejects immutable PATCH %s and retains ownership', async field => {
    const created = await (await createTodoRoute(request(todo))).json();
    expect((await patchTodoRoute(request({ [field]: 'attacker' }), ctx(created.id))).status).toBe(400);
    const stored = getDb().select().from(schema.todos).get()!;
    expect(stored.id).toBe(created.id);
    expect(stored.userId).toBe(auth.userId);
    expect(stored.createdAt).toBe(created.createdAt);
    expect(stored.updatedAt).toBe(created.updatedAt);
  });

  it('checks changed scope against the persisted scopeKey', async () => {
    const created = await (await createTodoRoute(request(todo))).json();
    expect((await patchTodoRoute(request({ scope: 'year' }), ctx(created.id))).status).toBe(400);
    expect((await patchTodoRoute(request({ scope: 'year', scopeKey: '2026' }), ctx(created.id))).status).toBe(200);
  });

  it('clears TODO priority with null through the request boundary and SQLite', async () => {
    const created = await (await createTodoRoute(request({ ...todo, priority: 3 }))).json();
    expect((await patchTodoRoute(request({ priority: null }), ctx(created.id))).status).toBe(200);
    expect(getDb().select().from(schema.todos).where(eq(schema.todos.id, created.id)).get()?.priority).toBeNull();
    expect((await patchTodoRoute(request({ priority: 1 }), ctx(created.id))).status).toBe(200);
    expect(getDb().select().from(schema.todos).where(eq(schema.todos.id, created.id)).get()?.priority).toBe(1);
  });

  it('rejects foreign and missing references but permits owned links and null clears', async () => {
    getDb().insert(schema.goals).values({ id: 'foreign-goal', userId: 'other', title: 'Other', level: 'oneThing', order: 0, createdAt: now, updatedAt: now }).run();
    getDb().insert(schema.goals).values({ id: 'owned-goal', userId: auth.userId, title: 'Mine', level: 'oneThing', order: 0, createdAt: now, updatedAt: now }).run();
    for (const parentGoalId of ['foreign-goal', 'missing']) expect((await createTodoRoute(request({ ...todo, parentGoalId }))).status).toBe(400);
    const created = await (await createTodoRoute(request({ ...todo, parentGoalId: 'owned-goal', note: 'Note' }))).json();
    expect((await patchTodoRoute(request({ parentGoalId: 'foreign-goal' }), ctx(created.id))).status).toBe(400);
    const cleared = await patchTodoRoute(request({ parentGoalId: null, note: null, title: '' }), ctx(created.id));
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({ parentGoalId: null, note: null, title: '' });
  });

  it('rejects foreign habit logging', async () => {
    getDb().insert(schema.habits).values({ id: 'other-habit', userId: 'other', name: 'Other', color: '#fff', order: 0, createdAt: now, updatedAt: now }).run();
    expect((await logHabitRoute(request({ habitId: 'other-habit', date: '2026-04-28' }))).status).toBe(400);
    expect(getDb().select().from(schema.habitLogs).all()).toHaveLength(0);
  });

  it('validates time bounds and interval ordering against the persisted other endpoint', async () => {
    const category = getDb().select().from(schema.categories).where(eq(schema.categories.userId, auth.userId)).get()!;
    const block = { date: '2026-04-28', startMin: 600, endMin: 660, text: '', kind: 'plan', categoryId: category.id };
    for (const change of [{ startMin: -1 }, { endMin: 1441 }, { endMin: 600 }, { startMin: 600.5 }, { kind: 'other' }, { categoryId: 'missing' }]) expect((await createBlockRoute(request({ ...block, ...change }))).status).toBe(400);
    const created = await (await createBlockRoute(request(block))).json();
    expect((await patchBlockRoute(request({ startMin: 700 }), ctx(created.id))).status).toBe(400);
    expect((await patchBlockRoute(request({ endMin: 1440 }), ctx(created.id))).status).toBe(200);
  });

  it('validates settings fields and merged hour interval', async () => {
    for (const patch of [{ theme: 'system' }, { gridMinutes: 15 }, { dayStartHour: 23 }, { userId: 'other' }]) expect((await patchSettingsRoute(request(patch))).status).toBe(400);
    expect((await patchSettingsRoute(request({ dayStartHour: 0, dayEndHour: 24 }))).status).toBe(200);
  });

  it('validates retrospective nested fields and real ISO weeks', async () => {
    for (const body of [{ type: 'monthly', dateOrWeek: '2026-04' }, { type: 'daily', dateOrWeek: '2026-02-29' }, { type: 'weekly', dateOrWeek: '2025-W53' }, { type: 'daily', dateOrWeek: '2026-04-28', template: { good: 4 } }, { type: 'daily', dateOrWeek: '2026-04-28', template: { extra: '' } }, { type: 'daily', dateOrWeek: '2026-04-28', rating: 6 }]) expect((await retroRoute(request(body))).status).toBe(400);
    expect((await retroRoute(request({ type: 'weekly', dateOrWeek: '2026-W53', template: { good: '' } }))).status).toBe(200);
  });

  it('validates schedules, monthly array lengths and URL protocols', () => {
    for (const schedule of [{ kind: 'daily', count: 1 }, { kind: 'weekdays', days: [0, 0] }, { kind: 'weekdays', days: [7] }, { kind: 'perWeek', count: 100 }, { kind: 'perMonth', count: 0 }]) expect(() => validateFields('habits', { schedule }, true)).toThrow();
    expect(() => validateFields('habits', { schedule: { kind: 'perWeek', count: 99 } }, true)).not.toThrow();
    expect(() => validateFields('settings', {}, true)).toThrow();
    expect(() => validateFields('annualGoals', { monthlyActuals: [1] }, true)).toThrow();
    expect(() => validateFields('books', { reviewUrl: 'javascript:alert(1)' }, true)).toThrow();
    expect(() => validateFields('books', { reviewUrl: null, startedAt: null }, true)).not.toThrow();
    expect(() => validateRelationships('focusNotes', { scope: 'week', scopeKey: 'week:2026-W18' })).not.toThrow();
  });
});

describe('backup validation', () => {
  it('rejects invalid replace input before deleting existing data', async () => {
    await createTodoRoute(request(todo));
    for (const body of [{ mode: 'other', data: {} }, { mode: 'replace', data: { todos: {} } }, { mode: 'replace', data: { todos: [{ id: 'bad' }] } }]) expect((await importRoute(request(body))).status).toBe(400);
    expect(getDb().select().from(schema.todos).all()).toHaveLength(1);
  });

  it('rejects cross-user backup references and conflicting row IDs', async () => {
    getDb().insert(schema.goals).values({ id: 'foreign-goal', userId: 'other', title: 'Other', level: 'oneThing', order: 0, createdAt: now, updatedAt: now }).run();
    const row = { ...todo, id: 'imported', createdAt: now, updatedAt: now, parentGoalId: 'foreign-goal' };
    expect((await importRoute(request({ mode: 'merge', data: { todos: [row] } }))).status).toBe(400);
    const foreign = getDb().select().from(schema.goals).where(eq(schema.goals.id, 'foreign-goal')).get();
    expect((await importRoute(request({ mode: 'merge', data: { goals: [foreign] } }))).status).toBe(400);
    expect(getDb().select().from(schema.todos).all()).toHaveLength(0);
  });

  it('accepts an exported backup with SQLite nulls and owned references', async () => {
    await createTodoRoute(request(todo));
    const backup = await (await exportRoute()).json();
    const response = await importRoute(request({ mode: 'replace', data: backup }));
    expect(response.status).toBe(200);
    expect(getDb().select().from(schema.todos).get()).toMatchObject({ ...todo, userId: auth.userId });
  });
});
