import type { AnnualGoal, Book, Category, FocusNote, Goal, Habit, HabitLog, Retrospective, Settings, TimeBlock, Todo } from '@/lib/types';

type Writable<T> = Omit<T, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
export interface MutationPayloads {
  todos: Writable<Todo>;
  timeBlocks: Writable<TimeBlock>;
  goals: Writable<Goal>;
  categories: Writable<Category>;
  habits: Writable<Habit>;
  habitLogs: Writable<HabitLog>;
  annualGoals: Writable<AnnualGoal>;
  annualGoalCreate: { year: string; order?: number; ensureSeven?: boolean };
  books: Writable<Book>;
  focusNotes: Writable<FocusNote>;
  retrospectives: Pick<Retrospective, 'type' | 'dateOrWeek'> & Partial<Pick<Retrospective, 'rating' | 'template' | 'freeText'>>;
  settings: Settings;
  login: { username: string; password: string };
}
export type MutationKind = keyof MutationPayloads;
type Check = (value: unknown) => boolean;
type Rules = { fields: Record<string, Check>; required: string[] };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const str: Check = value => typeof value === 'string';
const identifier: Check = value => typeof value === 'string' && value.trim().length > 0;
const number: Check = value => typeof value === 'number' && Number.isFinite(value);
const integer = (min: number, max = Number.MAX_SAFE_INTEGER): Check => value => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const nullable = (check: Check): Check => value => value === null || check(value);
const oneOf = (...values: unknown[]): Check => value => values.includes(value);
const year: Check = value => typeof value === 'string' && /^[1-9]\d{3}$/.test(value);
export const isDate: Check = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !year(value.slice(0, 4))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const month: Check = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && year(value.slice(0, 4));
const week: Check = value => {
  if (typeof value !== 'string' || !/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(value) || !year(value.slice(0, 4))) return false;
  const y = Number(value.slice(0, 4));
  const firstDay = new Date(`${y}-01-01T00:00:00Z`).getUTCDay();
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return !value.endsWith('53') || firstDay === 4 || (firstDay === 3 && leap);
};
const color: Check = value => typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value);
const url: Check = value => {
  if (value === '') return true;
  if (typeof value !== 'string') return false;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};
const monthly: Check = value => Array.isArray(value) && value.length === 12 && value.every(nullable(number));
const schedule: Check = value => {
  if (!object(value)) return false;
  if (value.kind === 'daily') return Object.keys(value).length === 1;
  if (value.kind === 'weekdays') return Object.keys(value).length === 2 && Array.isArray(value.days) && value.days.length > 0 && value.days.every(integer(0, 6)) && new Set(value.days).size === value.days.length;
  return Object.keys(value).length === 2 && (value.kind === 'perWeek' || value.kind === 'perMonth') && integer(1, 99)(value.count);
};
const template: Check = value => object(value) && Object.entries(value).every(([key, entry]) => ['good', 'bad', 'nextStep', 'reading'].includes(key) && str(entry));
const optionalText = nullable(str);
const optionalId = nullable(identifier);
const rules: Record<MutationKind, Rules> = {
  todos: { fields: { title: str, scope: oneOf('day', 'week', 'month', 'year'), scopeKey: identifier, status: oneOf('pending', 'done', 'postponed', 'delegated', 'cancelled'), order: integer(0), parentGoalId: optionalId, priority: nullable(oneOf(1, 2, 3)), categoryId: optionalId, note: optionalText }, required: ['title', 'scope', 'scopeKey', 'status', 'order'] },
  timeBlocks: { fields: { date: isDate, startMin: integer(0, 1439), endMin: integer(1, 1440), text: str, kind: oneOf('plan', 'actual'), categoryId: identifier, goalId: optionalId, todoId: optionalId }, required: ['date', 'startMin', 'endMin', 'text', 'kind', 'categoryId'] },
  goals: { fields: { title: str, parentId: optionalId, level: oneOf('oneThing', 'mandalartCore', 'mandalartSub'), color: nullable(color), order: integer(0) }, required: ['title', 'level', 'order'] },
  categories: { fields: { name: str, color, order: integer(0) }, required: ['name', 'color', 'order'] },
  habits: { fields: { name: str, color, order: integer(0), schedule, categoryId: optionalId, note: optionalText, parentGoalId: optionalId, annualGoalId: optionalId }, required: ['name', 'color', 'order'] },
  habitLogs: { fields: { habitId: identifier, date: isDate }, required: ['habitId', 'date'] },
  annualGoals: { fields: { year, order: integer(0), title: str, deadline: nullable(isDate), action: optionalText, metric: optionalText, target: nullable(number), monthlyTargets: monthly, monthlyActuals: monthly, parentGoalId: optionalId }, required: ['year', 'order', 'title', 'monthlyTargets', 'monthlyActuals'] },
  annualGoalCreate: { fields: { year, order: integer(0), ensureSeven: oneOf(true, false) }, required: ['year'] },
  books: { fields: { year, order: integer(0), title: str, category: optionalText, oneThing: optionalText, keywords: optionalText, reviewUrl: nullable(url), startedAt: nullable(isDate), finishedAt: nullable(isDate) }, required: ['year', 'order', 'title'] },
  focusNotes: { fields: { scope: oneOf('day', 'week', 'month', 'year', 'board'), scopeKey: identifier, text: str }, required: ['scope', 'scopeKey', 'text'] },
  retrospectives: { fields: { type: oneOf('daily', 'weekly'), dateOrWeek: identifier, rating: oneOf(1, 2, 3, 4, 5), template, freeText: str }, required: ['type', 'dateOrWeek'] },
  settings: { fields: { firstDayOfWeek: oneOf('mon', 'sun'), gridMinutes: oneOf(30, 60), dayStartHour: integer(0, 23), dayEndHour: integer(1, 24), theme: oneOf('light', 'dark') }, required: ['firstDayOfWeek', 'gridMinutes', 'dayStartHour', 'dayEndHour', 'theme'] },
  login: { fields: { username: identifier, password: identifier }, required: ['username', 'password'] },
};

export class ValidationError extends Error {}
const invalid = (message: string): never => { throw new ValidationError(message); };

/** Validate only explicit client fields; null remains an intentional clear. */
export function validateFields(kind: MutationKind, value: unknown, patch = false): Record<string, unknown> {
  if (!object(value)) return invalid('JSON body must be an object');
  if (patch && Object.keys(value).length === 0) invalid('Patch must contain at least one field');
  const rule = rules[kind];
  for (const [key, entry] of Object.entries(value)) {
    if (!Object.hasOwn(rule.fields, key)) invalid(`Unknown or immutable field: ${key}`);
    if (!rule.fields[key](entry)) invalid(`Invalid field: ${key}`);
  }
  if (!patch) for (const key of rule.required) if (!Object.hasOwn(value, key)) invalid(`Required field: ${key}`);
  if (kind === 'annualGoalCreate' && value.ensureSeven !== true && value.order === undefined) invalid('Required field: order');
  return value;
}

export function validateRelationships(kind: MutationKind, value: Record<string, unknown>) {
  if (kind === 'timeBlocks' && typeof value.startMin === 'number' && typeof value.endMin === 'number' && value.startMin >= value.endMin) invalid('startMin must precede endMin');
  if (kind === 'settings' && typeof value.dayStartHour === 'number' && typeof value.dayEndHour === 'number' && value.dayStartHour >= value.dayEndHour) invalid('dayStartHour must precede dayEndHour');
  if ((kind === 'todos' || kind === 'focusNotes') && typeof value.scope === 'string' && typeof value.scopeKey === 'string') {
    const key = kind === 'focusNotes' && value.scope !== 'day' && value.scope !== 'board' ? value.scopeKey.replace(new RegExp(`^${value.scope}:`), '') : value.scopeKey;
    const checks: Record<string, Check> = { day: isDate, week, month, year, board: identifier };
    if (!checks[value.scope]?.(key)) invalid('scopeKey does not match scope');
  }
  if (kind === 'retrospectives' && !(value.type === 'daily' ? isDate : week)(value.dateOrWeek)) invalid('Invalid dateOrWeek');
}

export const referenceFields: Partial<Record<MutationKind, Record<string, 'goals' | 'categories' | 'todos' | 'annualGoals' | 'habits'>>> = {
  goals: { parentId: 'goals' }, todos: { parentGoalId: 'goals', categoryId: 'categories' },
  timeBlocks: { goalId: 'goals', todoId: 'todos', categoryId: 'categories' },
  habits: { categoryId: 'categories', parentGoalId: 'goals', annualGoalId: 'annualGoals' },
  annualGoals: { parentGoalId: 'goals' }, habitLogs: { habitId: 'habits' },
};
