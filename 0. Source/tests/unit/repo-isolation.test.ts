import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';

const TMP_DB = path.join(process.cwd(), 'tmp-test', `iso-${Date.now()}.sqlite`);

beforeEach(() => {
  process.env.DB_PATH = TMP_DB;
  process.env.APP_USERNAME = 'admin';
  process.env.APP_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A';
  process.env.SESSION_SECRET = 'a'.repeat(64);
});
afterEach(async () => {
  const { closeDb } = await import('@/lib/server/db/client');
  closeDb();
  if (fs.existsSync(TMP_DB)) fs.rmSync(TMP_DB);
  const wal = `${TMP_DB}-wal`; if (fs.existsSync(wal)) fs.rmSync(wal);
  const shm = `${TMP_DB}-shm`; if (fs.existsSync(shm)) fs.rmSync(shm);
});

const seedSecondUser = async () => {
  const { getDb, schema } = await import('@/lib/server/db/client');
  const db = getDb();
  const adminRow = db.select().from(schema.users).where(eq(schema.users.username, 'admin')).get();
  const otherId = ulid();
  const now = new Date().toISOString();
  db.insert(schema.users).values({
    id: otherId,
    username: 'userB',
    passwordHash: 'placeholder',
    createdAt: now,
    updatedAt: now,
  }).run();
  return { adminId: adminRow!.id, otherId };
};

describe('repo isolation: todos', () => {
  it('listTodos for user A excludes user B todos', async () => {
    const { adminId, otherId } = await seedSecondUser();
    const { createTodo, listTodos } = await import('@/lib/server/repos/todos');
    await createTodo(adminId, { title: 'admin todo', scope: 'day', scopeKey: '2026-04-28', status: 'pending', order: 0 });
    await createTodo(otherId, { title: 'B todo', scope: 'day', scopeKey: '2026-04-28', status: 'pending', order: 0 });

    const adminList = await listTodos(adminId, { scope: 'day', scopeKey: '2026-04-28' });
    expect(adminList).toHaveLength(1);
    expect(adminList[0].title).toBe('admin todo');
    expect(adminList[0].userId).toBe(adminId);

    const bList = await listTodos(otherId, { scope: 'day', scopeKey: '2026-04-28' });
    expect(bList).toHaveLength(1);
    expect(bList[0].title).toBe('B todo');
  });

  it('updateTodo cannot modify another user todo', async () => {
    const { adminId, otherId } = await seedSecondUser();
    const { createTodo, updateTodo, listTodos } = await import('@/lib/server/repos/todos');
    const adminTodo = await createTodo(adminId, { title: 'admin original', scope: 'day', scopeKey: '2026-04-28', status: 'pending', order: 0 });

    // userB attempts to update adminTodo by guessing the id
    const result = await updateTodo(otherId, adminTodo.id, { title: 'hijacked' });
    expect(result).toBeNull(); // returns null because WHERE matched 0 rows

    const adminList = await listTodos(adminId, { scope: 'day', scopeKey: '2026-04-28' });
    expect(adminList[0].title).toBe('admin original');
  });

  it('deleteTodo cannot delete another user todo', async () => {
    const { adminId, otherId } = await seedSecondUser();
    const { createTodo, deleteTodo, listTodos } = await import('@/lib/server/repos/todos');
    const adminTodo = await createTodo(adminId, { title: 'admin keep', scope: 'day', scopeKey: '2026-04-28', status: 'pending', order: 0 });

    await deleteTodo(otherId, adminTodo.id);

    const adminList = await listTodos(adminId, { scope: 'day', scopeKey: '2026-04-28' });
    expect(adminList).toHaveLength(1);
  });
});

describe('repo isolation: categories', () => {
  it('listCategories returns only the calling user categories', async () => {
    const { adminId, otherId } = await seedSecondUser();
    const { listCategories, createCategory } = await import('@/lib/server/repos/categories');
    await createCategory(otherId, { name: 'B-only', color: '#abcdef', order: 100 });

    const adminCats = await listCategories(adminId);
    // admin has the 8 default seeded categories + 0 B-only
    expect(adminCats.every(c => c.userId === adminId)).toBe(true);
    expect(adminCats.find(c => c.name === 'B-only')).toBeUndefined();

    const bCats = await listCategories(otherId);
    expect(bCats.every(c => c.userId === otherId)).toBe(true);
    expect(bCats.some(c => c.name === 'B-only')).toBe(true);
  });
});

describe('repo isolation: goals', () => {
  it('listGoals isolates per user', async () => {
    const { adminId, otherId } = await seedSecondUser();
    const { createGoal, listGoals } = await import('@/lib/server/repos/goals');
    await createGoal(adminId, { title: 'admin goal', level: 'oneThing', order: 0 });
    await createGoal(otherId, { title: 'B goal', level: 'oneThing', order: 0 });

    const adminGoals = await listGoals(adminId);
    expect(adminGoals).toHaveLength(1);
    expect(adminGoals[0].title).toBe('admin goal');

    const bGoals = await listGoals(otherId);
    expect(bGoals).toHaveLength(1);
    expect(bGoals[0].title).toBe('B goal');
  });
});

describe('repo isolation: habitLogs', () => {
  it('listLogsForRange isolates per user; toggleHabit only affects calling user', async () => {
    const { adminId, otherId } = await seedSecondUser();
    const { createHabit } = await import('@/lib/server/repos/habits');
    const { toggleHabit, listLogsForRange } = await import('@/lib/server/repos/habitLogs');

    const adminHabit = await createHabit(adminId, { name: 'admin habit', color: '#fff', order: 0 });
    const bHabit = await createHabit(otherId, { name: 'B habit', color: '#000', order: 0 });

    // Both users log on the same date
    await toggleHabit(adminId, adminHabit.id, '2026-04-28');
    await toggleHabit(otherId, bHabit.id, '2026-04-28');

    const adminLogs = await listLogsForRange(adminId, '2026-04-28', '2026-04-28');
    expect(adminLogs).toHaveLength(1);
    expect(adminLogs[0].habitId).toBe(adminHabit.id);
    expect(adminLogs[0].userId).toBe(adminId);

    const bLogs = await listLogsForRange(otherId, '2026-04-28', '2026-04-28');
    expect(bLogs).toHaveLength(1);
    expect(bLogs[0].habitId).toBe(bHabit.id);
    expect(bLogs[0].userId).toBe(otherId);
  });
});
