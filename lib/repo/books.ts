import { Book } from '../types';
import { http } from './http';
import { notifyMutation } from './events';

export const listByYear = (year: string): Promise<Book[]> =>
  http.get<Book[]>(`/api/books?year=${encodeURIComponent(year)}`);

export const createBook = async (
  data: Omit<Book, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Book> => {
  const row = await http.post<Book>('/api/books', data);
  notifyMutation();
  return row;
};

export const updateBook = async (
  id: string,
  patch: Partial<Omit<Book, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  await http.patch<Book>(`/api/books/${id}`, patch);
  notifyMutation();
};

export const deleteBook = async (id: string): Promise<void> => {
  await http.del(`/api/books/${id}`);
  notifyMutation();
};
