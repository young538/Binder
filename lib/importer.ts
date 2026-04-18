import { db, markDirty } from './db';
import { Goal, Todo, FocusNote } from './types';

export interface ImportData {
  version: number;
  generatedAt: string;
  goals: Goal[];
  focusNotes: FocusNote[];
  todos: Todo[];
}

export interface ImportResult {
  goals: number;
  focusNotes: number;
  todos: number;
}

export const importData = async (
  data: ImportData,
  mode: 'merge' | 'replace'
): Promise<ImportResult> => {
  if (mode === 'replace') {
    await db.goals.clear();
    await db.focusNotes.clear();
    await db.todos.clear();
  }

  if (data.goals?.length) await db.goals.bulkPut(data.goals);
  if (data.focusNotes?.length) await db.focusNotes.bulkPut(data.focusNotes);
  if (data.todos?.length) await db.todos.bulkPut(data.todos);

  await markDirty();

  return {
    goals: data.goals?.length ?? 0,
    focusNotes: data.focusNotes?.length ?? 0,
    todos: data.todos?.length ?? 0,
  };
};

export const validateImportData = (raw: unknown): string | null => {
  if (!raw || typeof raw !== 'object') return 'JSON 형식이 올바르지 않아요';
  const d = raw as Partial<ImportData>;
  if (!Array.isArray(d.goals)) return 'goals 배열 없음';
  if (!Array.isArray(d.focusNotes)) return 'focusNotes 배열 없음';
  if (!Array.isArray(d.todos)) return 'todos 배열 없음';
  if (d.todos.length > 0) {
    const t = d.todos[0];
    if (!t.id || !t.date || typeof t.date !== 'string') return 'todo 형식이 올바르지 않아요';
  }
  return null;
};

export const fetchBuiltinSeed = async (): Promise<ImportData> => {
  const res = await fetch('/data/seed-2026.json');
  if (!res.ok) throw new Error('시드 파일을 불러올 수 없어요');
  return res.json();
};
