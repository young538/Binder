import { Todo, TodoScope, TodoStatus } from '../types';
import { http } from './http';
import { notifyMutation } from './events';

export const createTodo = async (
  data: Omit<Todo, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Todo> => {
  const row = await http.post<Todo>('/api/todos', data);
  notifyMutation();
  return row;
};

export const updateTodo = async (
  id: string,
  patch: Partial<Omit<Todo, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  await http.patch<Todo>(`/api/todos/${id}`, patch);
  notifyMutation();
};

export const deleteTodo = async (id: string): Promise<void> => {
  await http.del(`/api/todos/${id}`);
  notifyMutation();
};

export const setStatus = async (id: string, status: TodoStatus): Promise<void> => {
  await updateTodo(id, { status });
};

export const toggleDone = async (id: string): Promise<void> => {
  await http.post(`/api/todos/${id}/toggle-done`);
  notifyMutation();
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
