import type { Person } from '../types';
import { notifyMutation } from './events';
import { http } from './http';

type NewPerson = Omit<Person, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export const listPeople = (): Promise<Person[]> => http.get<Person[]>('/api/people');

export const createPerson = async (data: NewPerson): Promise<Person> => {
  const row = await http.post<Person>('/api/people', data);
  notifyMutation('people');
  return row;
};

export const updatePerson = async (id: string, patch: Partial<NewPerson>): Promise<Person> => {
  const row = await http.patch<Person>(`/api/people/${encodeURIComponent(id)}`, patch);
  notifyMutation('people');
  return row;
};

export const deletePerson = async (id: string): Promise<void> => {
  await http.del(`/api/people/${encodeURIComponent(id)}`);
  notifyMutation('people', 'lifeEvents');
};
