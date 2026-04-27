import 'server-only';
import { and, asc, between, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { todos } from '../db/schema';
import { Todo, TodoScope, TodoStatus } from '@/lib/types';
import { newId } from '@/lib/utils/id';

export const listTodos = async (filters?: {
  scope?: TodoScope;
  scopeKey?: string;
  parentGoalId?: string;
}): Promise<Todo[]> => {
  const db = getDb();
  const conds = [];
  if (filters?.scope) conds.push(eq(todos.scope, filters.scope));
  if (filters?.scopeKey) conds.push(eq(todos.scopeKey, filters.scopeKey));
  if (filters?.parentGoalId) conds.push(eq(todos.parentGoalId, filters.parentGoalId));
  const where = conds.length ? and(...conds) : undefined;
  const q = db.select().from(todos).orderBy(asc(todos.order));
  const rows = where ? await q.where(where).all() : await q.all();
  return rows as Todo[];
};

export const listDayTodosInRange = async (startDate: string, endDate: string): Promise<Todo[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(todos)
    .where(and(eq(todos.scope, 'day'), between(todos.scopeKey, startDate, endDate)))
    .orderBy(asc(todos.scopeKey), asc(todos.order))
    .all();
  return rows as Todo[];
};

export const createTodo = async (
  data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Todo> => {
  const db = getDb();
  const now = new Date().toISOString();
  const row: Todo = { ...data, id: newId(), createdAt: now, updatedAt: now };
  await db.insert(todos).values(row).run();
  return row;
};

export const updateTodo = async (
  id: string,
  patch: Partial<Omit<Todo, 'id' | 'createdAt'>>
): Promise<Todo | null> => {
  const db = getDb();
  await db
    .update(todos)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(todos.id, id))
    .run();
  const row = await db.select().from(todos).where(eq(todos.id, id)).get();
  return (row as Todo | undefined) ?? null;
};

export const deleteTodo = async (id: string): Promise<void> => {
  const db = getDb();
  await db.delete(todos).where(eq(todos.id, id)).run();
};

export const setTodoStatus = async (id: string, status: TodoStatus): Promise<Todo | null> => {
  return updateTodo(id, { status });
};

export const toggleTodoDone = async (id: string): Promise<Todo | null> => {
  const db = getDb();
  const existing = await db.select().from(todos).where(eq(todos.id, id)).get();
  if (!existing) return null;
  const nextStatus: TodoStatus = (existing as Todo).status === 'done' ? 'pending' : 'done';
  return updateTodo(id, { status: nextStatus });
};
