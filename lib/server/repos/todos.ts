import 'server-only';
import { and, asc, between, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { todos } from '../db/schema';
import { Todo, TodoScope, TodoStatus } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import { stripUndefined } from '../db/patch';
import type { BinderDatabase } from '../db/connection';

/** User-scoped todos operations; accepts an isolated database for tests. */
export class TodoRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  async list(filters?: {
    scope?: TodoScope;
    scopeKey?: string;
    parentGoalId?: string;
  }): Promise<Todo[]> {
    const userId = this.userId;
    const db = this.database;
    const conds = [eq(todos.userId, userId)];
    if (filters?.scope) conds.push(eq(todos.scope, filters.scope));
    if (filters?.scopeKey) conds.push(eq(todos.scopeKey, filters.scopeKey));
    if (filters?.parentGoalId) conds.push(eq(todos.parentGoalId, filters.parentGoalId));
    const rows = await db
      .select()
      .from(todos)
      .where(and(...conds))
      .orderBy(asc(todos.order))
      .all();
    return rows as Todo[];
  }

  async listDaysInRange(startDate: string, endDate: string): Promise<Todo[]> {
    const userId = this.userId;
    const db = this.database;
    const rows = await db
      .select()
      .from(todos)
      .where(
        and(
          eq(todos.userId, userId),
          eq(todos.scope, 'day'),
          between(todos.scopeKey, startDate, endDate)
        )
      )
      .orderBy(asc(todos.scopeKey), asc(todos.order))
      .all();
    return rows as Todo[];
  }

  async create(data: Omit<Todo, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Todo> {
    const userId = this.userId;
    const db = this.database;
    const now = new Date().toISOString();
    const row: Todo = { ...data, id: newId(), userId, createdAt: now, updatedAt: now };
    await db.insert(todos).values(row).run();
    return row;
  }

  async update(id: string, patch: Partial<Omit<Todo, 'id' | 'userId' | 'createdAt'>>): Promise<Todo | null> {
    const userId = this.userId;
    const db = this.database;
    await db
      .update(todos)
      .set({ ...stripUndefined(patch), updatedAt: new Date().toISOString() })
      .where(and(eq(todos.userId, userId), eq(todos.id, id)))
      .run();
    const row = await db
      .select()
      .from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.id, id)))
      .get();
    return (row as Todo | undefined) ?? null;
  }

  async delete(id: string): Promise<void> {
    const userId = this.userId;
    const db = this.database;
    await db.delete(todos).where(and(eq(todos.userId, userId), eq(todos.id, id))).run();
  }

  async setStatus(id: string, status: TodoStatus): Promise<Todo | null> {
    return this.update(id, { status });
  }

  async toggleDone(id: string): Promise<Todo | null> {
    const userId = this.userId;
    const db = this.database;
    const existing = await db
      .select()
      .from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.id, id)))
      .get();
    if (!existing) return null;
    const nextStatus: TodoStatus = (existing as Todo).status === 'done' ? 'pending' : 'done';
    return this.update(id, { status: nextStatus });
  }
}

// Compatibility functions for existing callers. New services can inject the repository.
export const listTodos = async (userId: string, filters?: {
  scope?: TodoScope;
  scopeKey?: string;
  parentGoalId?: string;
}): Promise<Todo[]> =>
  new TodoRepository(getDb(), userId).list(filters);

export const listDayTodosInRange = async (userId: string, startDate: string, endDate: string): Promise<Todo[]> =>
  new TodoRepository(getDb(), userId).listDaysInRange(startDate, endDate);

export const createTodo = async (userId: string, data: Omit<Todo, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Todo> =>
  new TodoRepository(getDb(), userId).create(data);

export const updateTodo = async (userId: string, id: string, patch: Partial<Omit<Todo, 'id' | 'userId' | 'createdAt'>>): Promise<Todo | null> =>
  new TodoRepository(getDb(), userId).update(id, patch);

export const deleteTodo = async (userId: string, id: string): Promise<void> =>
  new TodoRepository(getDb(), userId).delete(id);

export const setTodoStatus = async (userId: string, id: string, status: TodoStatus): Promise<Todo | null> =>
  new TodoRepository(getDb(), userId).setStatus(id, status);

export const toggleTodoDone = async (userId: string, id: string): Promise<Todo | null> =>
  new TodoRepository(getDb(), userId).toggleDone(id);
