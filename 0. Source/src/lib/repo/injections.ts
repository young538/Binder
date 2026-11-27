import type { InjectionJournal, PenInput, EntryInput } from '@/lib/injections';
import { http } from './http';
import { notifyMutation } from './events';

export const getInjectionJournal = () => http.get<InjectionJournal>('/api/injections');
const path = (kind: 'pens' | 'entries', id: string) => `/api/injections/${kind}/${encodeURIComponent(id)}`;

export async function saveInjection(kind: 'pens' | 'entries', id: string, input: PenInput | EntryInput, version?: string) {
  await http.put(path(kind, id), input, version ? { 'X-Record-Version': version } : undefined);
  notifyMutation(kind === 'pens' ? 'injectionPens' : 'injectionEntries');
}

export async function removeInjection(kind: 'pens' | 'entries', id: string, version: string) {
  await http.del(path(kind, id), { 'X-Record-Version': version });
  notifyMutation(kind === 'pens' ? 'injectionPens' : 'injectionEntries');
}
