import { db, markDirty } from '../db';
import { Todo, TodoScope, TodoStatus } from '../types';
import { newId } from '../utils/id';

export const createTodo = async (
  data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Todo> => {
  const now = new Date().toISOString();
  const todo: Todo = { ...data, id: newId(), createdAt: now, updatedAt: now };
  await db.todos.put(todo);
  await markDirty();
  return todo;
};

export const updateTodo = async (
  id: string,
  patch: Partial<Omit<Todo, 'id' | 'createdAt'>>
): Promise<void> => {
  await db.todos.update(id, { ...patch, updatedAt: new Date().toISOString() });
  await markDirty();
};

export const deleteTodo = async (id: string): Promise<void> => {
  await db.todos.delete(id);
  await markDirty();
};

export const setStatus = async (id: string, status: TodoStatus): Promise<void> => {
  await updateTodo(id, { status });
};

export const toggleDone = async (id: string): Promise<void> => {
  const t = await db.todos.get(id);
  if (!t) return;
  await setStatus(id, t.status === 'done' ? 'pending' : 'done');
};

export const listByScope = async (scope: TodoScope, scopeKey: string): Promise<Todo[]> => {
  const items = await db.todos.where({ scope, scopeKey }).toArray();
  return items.sort((a, b) => a.order - b.order);
};

// Day todos within a date range (for weekly strip and weekly retro aggregation)
export const listDayTodosInRange = async (startDate: string, endDate: string): Promise<Todo[]> => {
  const items = await db.todos
    .where('scope').equals('day')
    .and(t => t.scopeKey >= startDate && t.scopeKey <= endDate)
    .toArray();
  return items.sort((a, b) => {
    if (a.scopeKey !== b.scopeKey) return a.scopeKey < b.scopeKey ? -1 : 1;
    return a.order - b.order;
  });
};

export const listByParentGoal = async (parentGoalId: string): Promise<Todo[]> =>
  db.todos.where('parentGoalId').equals(parentGoalId).toArray();
