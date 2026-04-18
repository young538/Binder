import { db, markDirty } from './db';
import { Goal, Todo, FocusNote, AnnualGoal, Habit, HabitLog } from './types';

type LegacyTodo = Todo & { date?: string };

export interface ImportData {
  version: number;
  generatedAt: string;
  goals: Goal[];
  focusNotes: FocusNote[];
  todos: LegacyTodo[];
  annualGoals?: AnnualGoal[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
}

export interface ImportResult {
  goals: number;
  focusNotes: number;
  todos: number;
  annualGoals: number;
  habits: number;
  habitLogs: number;
}

const normalizeTodo = (raw: LegacyTodo): Todo => {
  if (raw.scope) {
    // Already new shape — strip legacy date if present
    const { date: _legacy, ...rest } = raw;
    void _legacy;
    return rest as Todo;
  }
  const { date, ...rest } = raw;
  return {
    ...(rest as Omit<Todo, 'scope' | 'scopeKey'>),
    scope: 'day',
    scopeKey: date ?? '2026-01-01',
  };
};

export const importData = async (
  data: ImportData,
  mode: 'merge' | 'replace'
): Promise<ImportResult> => {
  if (mode === 'replace') {
    await db.goals.clear();
    await db.focusNotes.clear();
    await db.todos.clear();
    await db.annualGoals.clear();
    await db.habits.clear();
    await db.habitLogs.clear();
  }

  const todos = (data.todos ?? []).map(normalizeTodo);

  if (data.goals?.length) await db.goals.bulkPut(data.goals);
  if (data.focusNotes?.length) await db.focusNotes.bulkPut(data.focusNotes);
  if (todos.length) await db.todos.bulkPut(todos);
  if (data.annualGoals?.length) await db.annualGoals.bulkPut(data.annualGoals);
  if (data.habits?.length) await db.habits.bulkPut(data.habits);
  if (data.habitLogs?.length) await db.habitLogs.bulkPut(data.habitLogs);

  await markDirty();

  return {
    goals: data.goals?.length ?? 0,
    focusNotes: data.focusNotes?.length ?? 0,
    todos: todos.length,
    annualGoals: data.annualGoals?.length ?? 0,
    habits: data.habits?.length ?? 0,
    habitLogs: data.habitLogs?.length ?? 0,
  };
};

export const validateImportData = (raw: unknown): string | null => {
  if (!raw || typeof raw !== 'object') return 'JSON 형식이 올바르지 않아요';
  const d = raw as Partial<ImportData>;
  if (!Array.isArray(d.goals)) return 'goals 배열 없음';
  if (!Array.isArray(d.focusNotes)) return 'focusNotes 배열 없음';
  if (!Array.isArray(d.todos)) return 'todos 배열 없음';
  if (d.todos.length > 0) {
    const t = d.todos[0] as LegacyTodo;
    if (!t.id) return 'todo 형식이 올바르지 않아요';
    const hasNewShape = typeof t.scope === 'string' && typeof t.scopeKey === 'string';
    const hasLegacyShape = typeof t.date === 'string';
    if (!hasNewShape && !hasLegacyShape) return 'todo 형식이 올바르지 않아요';
  }
  return null;
};

export const fetchBuiltinSeed = async (): Promise<ImportData> => {
  const res = await fetch('/data/seed-2026.json');
  if (!res.ok) throw new Error('시드 파일을 불러올 수 없어요');
  return res.json();
};
