import { Todo, TodoScope, TodoStatus } from '../types';
import { http } from './http';
import { notifyMutation } from './events';
import { useNotifications } from '@/store/notifications';
import { useBinder } from '@/store';
import type { TodoDeleteResult, TodoRolloverResult } from '@/lib/todos/contracts';

export const createTodo = async (
  data: Omit<Todo, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  requestKey = crypto.randomUUID(),
): Promise<Todo> => {
  const row = await http.post<Todo>('/api/todos', data, { 'Idempotency-Key': requestKey });
  notifyMutation('todos');
  return row;
};

export const updateTodo = async (
  id: string,
  patch: Partial<Omit<Todo, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  await http.patch<Todo>(`/api/todos/${id}`, patch);
  notifyMutation('todos');
};

export const deleteTodo = async (id: string): Promise<void> => {
  const userId = useBinder.getState().me?.userId;
  const result = await http.del<TodoDeleteResult>(`/api/todos/${id}`);
  if (result.undo && userId) useNotifications.getState().add({
    userId, text: '할 일을 삭제했어요.', undo: result.undo, expiresAt: Date.parse(result.undo.expiresAt),
  });
  notifyMutation('todos');
};

export const restoreTodo = async (id: string): Promise<Todo> => {
  const row = await http.post<Todo>(`/api/todos/${id}/restore`);
  notifyMutation('todos');
  return row;
};

export const rolloverTodos = async (date: string, ids: string[]): Promise<TodoRolloverResult> => {
  const userId = useBinder.getState().me?.userId;
  const result = await http.post<TodoRolloverResult>('/api/todos/rollover', { date, ids });
  notifyMutation('todos');
  if (userId) useNotifications.getState().add({ userId, text: `${result.moved}개를 ${result.date}로 옮겼어요.`, expiresAt: Date.now() + 5000 });
  return result;
};

export const setStatus = async (id: string, status: TodoStatus): Promise<void> => {
  await updateTodo(id, { status });
};

export const toggleDone = async (id: string): Promise<void> => {
  await http.post(`/api/todos/${id}/toggle-done`);
  notifyMutation('todos');
};

export const listByScope = (scope: TodoScope, scopeKey: string): Promise<Todo[]> =>
  http.get<Todo[]>(
    `/api/todos?scope=${encodeURIComponent(scope)}&scopeKey=${encodeURIComponent(scopeKey)}`
  );

export const listDayTodosInRange = (startDate: string, endDate: string): Promise<Todo[]> =>
  http.get<Todo[]>(
    `/api/todos?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
  );

export const listByParentGoal = (parentGoalId: string): Promise<Todo[]> =>
  http.get<Todo[]>(`/api/todos?parentGoalId=${encodeURIComponent(parentGoalId)}`);
