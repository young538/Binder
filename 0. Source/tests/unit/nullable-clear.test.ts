import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import argon2 from 'argon2';

const TMP_DB = path.join(process.cwd(), 'tmp-test', `nullable-${Date.now()}.sqlite`);

beforeEach(async () => {
  process.env.DB_PATH = TMP_DB;
  process.env.APP_USERNAME = 'admin';
  process.env.APP_PASSWORD_HASH = await argon2.hash('nullable-clear-test-password');
  process.env.SESSION_SECRET = 'a'.repeat(64);
  vi.resetModules();
});
afterEach(async () => {
  const { closeDb } = await import('@/lib/server/db/client');
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) {
    const f = `${TMP_DB}${suffix}`;
    if (fs.existsSync(f)) fs.rmSync(f);
  }
});

describe('nullable clear: null 해제 vs undefined 변경없음', () => {
  it('habit categoryId: null → 해제, undefined → 유지', async () => {
    const { getDb, schema } = await import('@/lib/server/db/client');
    const { eq } = await import('drizzle-orm');
    const { createHabit, updateHabit } = await import('@/lib/server/repos/habits');

    const admin = getDb().select().from(schema.users).get() as { id: string };
    const habit = await createHabit(admin.id, {
      name: '운동',
      color: '#ddd9c4',
      order: 0,
      schedule: { kind: 'daily' },
      categoryId: 'cat-1',
    });
    const read = () =>
      getDb().select().from(schema.habits).where(eq(schema.habits.id, habit.id)).get() as {
        categoryId: string | null;
      };

    // undefined 는 변경 없음 (JSON round-trip 에서 키 증발과 동일)
    const dropped = JSON.parse(JSON.stringify({ categoryId: undefined }));
    expect(dropped).toEqual({});
    await updateHabit(admin.id, habit.id, dropped);
    expect(read().categoryId).toBe('cat-1');

    // null 은 명시적 해제 → DB null
    const cleared = JSON.parse(JSON.stringify({ categoryId: null }));
    expect(cleared).toEqual({ categoryId: null });
    await updateHabit(admin.id, habit.id, cleared);
    expect(read().categoryId).toBeNull();
  });

  it('todo categoryId/parentGoalId: null → 해제', async () => {
    const { getDb, schema } = await import('@/lib/server/db/client');
    const { eq } = await import('drizzle-orm');
    const { createTodo, updateTodo } = await import('@/lib/server/repos/todos');

    const admin = getDb().select().from(schema.users).get() as { id: string };
    const todo = await createTodo(admin.id, {
      title: '할 일',
      scope: 'day',
      scopeKey: '2026-09-05',
      status: 'pending',
      order: 0,
      categoryId: 'cat-1',
      parentGoalId: 'goal-1',
    });
    const read = () =>
      getDb().select().from(schema.todos).where(eq(schema.todos.id, todo.id)).get() as {
        categoryId: string | null;
        parentGoalId: string | null;
      };

    await updateTodo(admin.id, todo.id, JSON.parse(JSON.stringify({ categoryId: null })));
    expect(read().categoryId).toBeNull();
    expect(read().parentGoalId).toBe('goal-1');

    await updateTodo(admin.id, todo.id, JSON.parse(JSON.stringify({ parentGoalId: null })));
    expect(read().parentGoalId).toBeNull();
  });

  it('값 변경은 그대로 동작 (회귀)', async () => {
    const { getDb, schema } = await import('@/lib/server/db/client');
    const { eq } = await import('drizzle-orm');
    const { createHabit, updateHabit } = await import('@/lib/server/repos/habits');

    const admin = getDb().select().from(schema.users).get() as { id: string };
    const habit = await createHabit(admin.id, {
      name: '운동',
      color: '#ddd9c4',
      order: 0,
      schedule: { kind: 'daily' },
    });
    await updateHabit(admin.id, habit.id, { categoryId: 'cat-2', name: '수영' });
    const row = getDb()
      .select()
      .from(schema.habits)
      .where(eq(schema.habits.id, habit.id))
      .get() as { categoryId: string | null; name: string };
    expect(row.categoryId).toBe('cat-2');
    expect(row.name).toBe('수영');
  });
});
