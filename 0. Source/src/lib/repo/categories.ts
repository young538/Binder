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

export const deleteCategory = async (id: string): Promise<void> => {
  await http.del(`/api/categories/${id}`);
  notifyMutation('categories');
};
