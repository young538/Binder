import { Category } from '../types';
import { http } from './http';
import { notifyMutation } from './events';

export const listCategories = (): Promise<Category[]> =>
  http.get<Category[]>('/api/categories');

export const createCategory = async (
  data: Omit<Category, 'id' | 'userId'>
): Promise<Category> => {
  const row = await http.post<Category>('/api/categories', data);
  notifyMutation('categories');
  return row;
};

export const updateCategory = async (
  id: string,
  patch: Partial<Omit<Category, 'id' | 'userId'>>
): Promise<void> => {
  await http.patch<Category>(`/api/categories/${id}`, patch);
  notifyMutation('categories');
};

export const deleteCategory = async (id: string, replacementId?: string): Promise<void> => {
  const query = replacementId ? `?replacementId=${encodeURIComponent(replacementId)}` : '';
  await http.del(`/api/categories/${encodeURIComponent(id)}${query}`);
  for (const resource of ['categories', 'habits', 'projects', 'todos', 'timeBlocks', 'weeklyTemplates'] as const) {
    notifyMutation(resource);
  }
};
