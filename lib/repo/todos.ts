import { db, markDirty } from '../db';
import { Todo } from '../types';
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

export const listByDate = async (date: string): Promise<Todo[]> => {
  const items = await db.todos.where('date').equals(date).toArray();
  return items.sort((a, b) => a.order - b.order);
};

export const listByDateRange = async (startDate: string, endDate: string): Promise<Todo[]> => {
  const items = await db.todos.where('date').between(startDate, endDate, true, true).toArray();
  return items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.order - b.order;
  });
};

export const listByParentGoal = async (parentGoalId: string): Promise<Todo[]> =>
  db.todos.where('parentGoalId').equals(parentGoalId).toArray();

// TEMPORARY stubs for v1.1 components not yet updated (Task C will replace them)
export const listByPeriod = async (_period?: string, _periodKey?: string): Promise<Todo[]> => []; // v1.1 compat
export const existsForPeriod = async (_period?: string, _periodKey?: string, _parentGoalId?: string): Promise<boolean> => false; // v1.1 compat
