import type { BinderNote, NoteKind } from '../types';
import { notifyMutation } from './events';
import { http } from './http';

type NewNote = Omit<BinderNote, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export const listNotes = (filters?: {
  kind?: NoteKind;
  goalId?: string;
  projectId?: string;
}): Promise<BinderNote[]> => {
  const params = new URLSearchParams();
  if (filters?.kind) params.set('kind', filters.kind);
  if (filters?.goalId) params.set('goalId', filters.goalId);
  if (filters?.projectId) params.set('projectId', filters.projectId);
  const qs = params.toString();
  return http.get<BinderNote[]>(qs ? `/api/notes?${qs}` : '/api/notes');
};

export const listDueDecisions = (date: string): Promise<BinderNote[]> =>
  http.get<BinderNote[]>(`/api/notes?dueDecisionsDate=${encodeURIComponent(date)}`);

export const createNote = async (data: NewNote): Promise<BinderNote> => {
  const row = await http.post<BinderNote>('/api/notes', data);
  notifyMutation('notes');
  return row;
};

export const updateNote = async (id: string, patch: Partial<NewNote>): Promise<BinderNote> => {
  const row = await http.patch<BinderNote>(`/api/notes/${encodeURIComponent(id)}`, patch);
  notifyMutation('notes');
  return row;
};

export const deleteNote = async (id: string): Promise<void> => {
  await http.del(`/api/notes/${encodeURIComponent(id)}`);
  notifyMutation('notes');
};
