import 'server-only';
import { and, asc, between, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { todos } from '../db/schema';
import { Todo, TodoScope, TodoStatus } from '@/lib/types';
import { newId } from '@/lib/utils/id';

export const listTodos = async (
  userId: string,
  filters?: {
    scope?: TodoScope;
    scopeKey?: string;
    parentGoalId?: string;
  }
): Promise<Todo[]> => {
  const db = getDb();
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
};

export const listDayTodosInRange = async (
  userId: string,
  startDate: string,
  endDate: string
): Promise<Todo[]> => {
  const db = getDb();
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
};

export const createTodo = async (
  userId: string,
  data: Omit<Todo, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Todo> => {
  const db = getDb();
  const now = new Date().toISOString();
  const row: Todo = { ...data, id: newId(), userId, createdAt: now, updatedAt: now };
  await db.insert(todos).values(row).run();
  return row;
};

export const updateTodo = async (
  userId: string,
  id: string,
  patch: Partial<Omit<Todo, 'id' | 'userId' | 'createdAt'>>
): Promise<Todo | null> => {
  const db = getDb();
  await db
    .update(todos)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(todos.userId, userId), eq(todos.id, id)))
    .run();
  const row = await db
    .select()
    .from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.id, id)))
    .get();
  return (row as Todo | undefined) ?? null;
};

export const deleteTodo = async (userId: string, id: string): Promise<void> => {
  const db = getDb();
  await db.delete(todos).where(and(eq(todos.userId, userId), eq(todos.id, id))).run();
};

export const setTodoStatus = async (
  userId: string,
  id: string,
  status: TodoStatus
): Promise<Todo | null> => {
  return updateTodo(userId, id, { status });
};

export const toggleTodoDone = async (userId: string, id: string): Promise<Todo | null> => {
  const db = getDb();
  const existing = await db
    .select()
    .from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.id, id)))
    .get();
  if (!existing) return null;
  const nextStatus: TodoStatus = (existing as Todo).status === 'done' ? 'pending' : 'done';
  return updateTodo(userId, id, { status: nextStatus });
};
