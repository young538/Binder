import { FocusNote, FocusScope } from '../types';
import { http } from './http';
import { notifyMutation } from './events';

export const getFocus = async (
  scope: FocusScope,
  scopeKey: string
): Promise<FocusNote | undefined> => {
  const row = await http.get<FocusNote | null>(
    `/api/focus-notes?scope=${encodeURIComponent(scope)}&scopeKey=${encodeURIComponent(scopeKey)}`
  );
  return row ?? undefined;
};

export const upsertFocus = async (
  scope: FocusScope,
  scopeKey: string,
  text: string
): Promise<FocusNote> => {
  const row = await http.put<FocusNote>('/api/focus-notes', { scope, scopeKey, text });
  notifyMutation();
  return row;
};
