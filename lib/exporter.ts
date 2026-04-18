import { db } from './db';
import type {
  Goal,
  Category,
  TimeBlock,
  Retrospective,
  Todo,
  FocusNote,
  AnnualGoal,
  Habit,
  HabitLog,
  Routine,
  Book,
  Settings,
} from './types';

export interface ExportData {
  version: number;
  generatedAt: string;
  goals: Goal[];
  categories: Category[];
  timeBlocks: TimeBlock[];
  retrospectives: Retrospective[];
  todos: Todo[];
  focusNotes: FocusNote[];
  annualGoals: AnnualGoal[];
  habits: Habit[];
  habitLogs: HabitLog[];
  routines: Routine[];
  books: Book[];
  settings: Settings | null;
}

export const buildExport = async (): Promise<ExportData> => {
  const [
    goals,
    categories,
    timeBlocks,
    retrospectives,
    todos,
    focusNotes,
    annualGoals,
    habits,
    habitLogs,
    routines,
    books,
    settingsRow,
  ] = await Promise.all([
    db.goals.toArray(),
    db.categories.toArray(),
    db.timeBlocks.toArray(),
    db.retrospectives.toArray(),
    db.todos.toArray(),
    db.focusNotes.toArray(),
    db.annualGoals.toArray(),
    db.habits.toArray(),
    db.habitLogs.toArray(),
    db.routines.toArray(),
    db.books.toArray(),
    db.settings.get('main'),
  ]);

  let settings: Settings | null = null;
  if (settingsRow) {
    const { key: _key, ...rest } = settingsRow;
    void _key;
    settings = rest as Settings;
  }

  return {
    version: 8,
    generatedAt: new Date().toISOString(),
    goals,
    categories,
    timeBlocks,
    retrospectives,
    todos,
    focusNotes: focusNotes as unknown as FocusNote[],
    annualGoals,
    habits,
    habitLogs,
    routines,
    books,
    settings,
  };
};

export const downloadExportJson = async () => {
  const data = await buildExport();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `3p-binder-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
