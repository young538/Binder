import { db, markDirty } from '../db';
import { Todo, TodoPeriod } from '../types';
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

export const toggleDone = async (id: string): Promise<void> => {
  const t = await db.todos.get(id);
  if (!t) return;
  await updateTodo(id, { done: !t.done });
};

export const listByPeriod = async (period: TodoPeriod, periodKey: string): Promise<Todo[]> => {
  const items = await db.todos.where({ period, periodKey }).toArray();
  return items.sort((a, b) => a.order - b.order);
};

export const listByParentGoal = async (parentGoalId: string): Promise<Todo[]> =>
  db.todos.where('parentGoalId').equals(parentGoalId).toArray();

export const existsForPeriod = async (
  period: TodoPeriod,
  periodKey: string,
  parentGoalId: string
): Promise<boolean> => {
  const items = await db.todos.where({ period, periodKey, parentGoalId }).toArray();
  return items.length > 0;
};
