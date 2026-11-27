import type {
  AnnualGoal,
  BinderNote,
  Book,
  Category,
  DailyCheckin,
  FinanceBudget,
  FinanceTransaction,
  FocusNote,
  Goal,
  Habit,
  HabitLog,
  LifeEvent,
  LifeMetric,
  LifeMetricEntry,
  Person,
  Project,
  Retrospective,
  RetroType,
  Settings,
  Subscription,
  TimeBlock,
  Todo,
  WeeklyTemplate,
} from '@/lib/types';

import type { PenInput, EntryInput } from '@/lib/injections';

type Writable<T> = Omit<T, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
export interface MutationPayloads {
  projects: Omit<Writable<Project>, 'completedAt'>;
  todos: Omit<Writable<Todo>, 'completedAt' | 'repeatGenerated' | 'googleTaskListId' | 'googleTaskId' | 'googleTaskUpdatedAt'>;
  weeklyTemplates: Writable<WeeklyTemplate>;
  weeklyTemplateCreate: { name: string; sourceWeek: string };
  weeklyTemplateApply: { week: string };
  todoRollover: { date: string; ids: string[] };
  morningBootApply: { targetDate: string; moveToTodayIds?: string[]; moveToInboxIds?: string[] };
  timeBlockConfirmActuals: { date: string; blockIds?: string[] };
  eveningShutdownApply: {
    date: string;
    confirmBlockIds?: string[];
    rolloverTodoIds?: string[];
    inboxTodoIds?: string[];
  };
  timeBlocks: Writable<TimeBlock>;
  goals: Writable<Goal>;
  categories: Writable<Category>;
  habits: Writable<Habit>;
  habitLogs: Writable<HabitLog>;
  annualGoals: Writable<AnnualGoal>;
  annualGoalCreate: { year: string; order?: number; ensureSeven?: boolean };
  books: Writable<Book>;
  bookLinkDaily: { dates?: string[]; matchTitle?: string };
  focusNotes: Writable<FocusNote>;
  retrospectives: Pick<Retrospective, 'type' | 'dateOrWeek'> & Partial<Pick<Retrospective, 'rating' | 'template' | 'freeText'>>;
  dailyCheckins: Writable<DailyCheckin>;
  metrics: Writable<LifeMetric>;
  injectionPens: PenInput;
  injectionEntries: EntryInput;
  metricEntries: Writable<LifeMetricEntry>;
  notes: Writable<BinderNote>;
  people: Writable<Person>;
  lifeEvents: Omit<Writable<LifeEvent>, 'googleCalendarId' | 'googleEventId' | 'googleUpdatedAt'>;
  subscriptions: Writable<Subscription>;
  financeTransactions: Omit<Writable<FinanceTransaction>, 'externalHash'>;
  financeBudgets: Writable<FinanceBudget>;
  icsImport: { icsText?: string | null; url?: string | null };
  googleCalendarSettings: {
    selectedCalendarIds?: string[];
    pushCalendarId?: string;
    syncEnabled?: boolean;
    autoPushEvents?: boolean;
    tasksSyncEnabled?: boolean;
    tasksAutoPush?: boolean;
    tasksSelectedListIds?: string[];
    tasksDefaultListId?: string | null;
    tasksProjectMap?: Record<string, string | null>;
  };
  settings: Settings;
  login: { username: string; password: string };
  changePassword: { currentPassword: string; newPassword: string };
  retroCoach: { mode: 'weekly' | 'monthly'; period: string; provider?: 'auto' | 'openai' | 'gemini' | 'local' };
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
export const isYear: Check = year;
export const isDate: Check = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !year(value.slice(0, 4))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const month: Check = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && year(value.slice(0, 4));
export const isMonth: Check = month;
export const isWeek: Check = value => {
  if (typeof value !== 'string' || !/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(value) || !year(value.slice(0, 4))) return false;
  const y = Number(value.slice(0, 4));
  const firstDay = new Date(`${y}-01-01T00:00:00Z`).getUTCDay();
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return !value.endsWith('53') || firstDay === 4 || (firstDay === 3 && leap);
};
const week = isWeek;
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
const repeatRule: Check = value => object(value) && Object.keys(value).length === 3
  && oneOf('day', 'week', 'month')(value.unit) && integer(1, 365)(value.interval)
  && oneOf('scheduled', 'completed')(value.basis);
const retroDateOrWeek = (type: unknown, dateOrWeek: unknown): boolean => {
  const checks: Record<RetroType, Check> = { daily: isDate, weekly: week, monthly: month, yearly: year };
  return typeof type === 'string' && Object.hasOwn(checks, type) && checks[type as RetroType](dateOrWeek);
};
const sourceRetro: Check = value => object(value) && Object.keys(value).length === 2
  && oneOf('daily', 'weekly', 'monthly', 'yearly')(value.type) && retroDateOrWeek(value.type, value.dateOrWeek);
const idList: Check = value => Array.isArray(value) && value.length <= 500 && value.every(identifier);
const calendarIdList: Check = value => Array.isArray(value) && value.length <= 50 && value.every(identifier);
const taskProjectMap: Check = value => object(value) && Object.entries(value).length <= 50 && Object.entries(value).every(([k, v]) => identifier(k) && (v === null || identifier(v)));
const ratingValue: Check = oneOf(1, 2, 3, 4, 5);
const sleepHoursValue: Check = value => number(value) && (value as number) >= 0 && (value as number) <= 24;
const nonNegativeNumber: Check = value => number(value) && (value as number) >= 0;
const nonZeroAmount: Check = value => number(value) && (value as number) !== 0 && Math.abs(value as number) <= 1e12;
const bool: Check = oneOf(true, false);
const templateBlocks: Check = value => Array.isArray(value) && value.length > 0 && value.length <= 500 && value.every(block =>
  object(block) && Object.keys(block).every(key => ['dayOffset', 'startMin', 'endMin', 'text', 'categoryId', 'goalId'].includes(key))
  && integer(0, 6)(block.dayOffset) && integer(0, 1439)(block.startMin) && integer(1, 1440)(block.endMin)
  && (block.startMin as number) < (block.endMin as number) && str(block.text) && identifier(block.categoryId)
  && (block.goalId === undefined || optionalId(block.goalId)));
const rules: Record<MutationKind, Rules> = {
  weeklyTemplates: { fields: { name: identifier, blocks: templateBlocks }, required: ['name', 'blocks'] },
  weeklyTemplateCreate: { fields: { name: identifier, sourceWeek: week }, required: ['name', 'sourceWeek'] },
  weeklyTemplateApply: { fields: { week }, required: ['week'] },
  todoRollover: { fields: { date: isDate, ids: value => Array.isArray(value) && value.length > 0 && value.length <= 500 && value.every(identifier) }, required: ['date', 'ids'] },
  morningBootApply: { fields: { targetDate: isDate, moveToTodayIds: idList, moveToInboxIds: idList }, required: ['targetDate'] },
  timeBlockConfirmActuals: { fields: { date: isDate, blockIds: idList }, required: ['date'] },
  eveningShutdownApply: { fields: { date: isDate, confirmBlockIds: idList, rolloverTodoIds: idList, inboxTodoIds: idList }, required: ['date'] },
  projects: { fields: { title: identifier, status: oneOf('active', 'planned', 'onHold', 'done'), order: integer(0), goalId: optionalId, categoryId: optionalId, deadline: nullable(isDate), outcome: optionalText, note: optionalText }, required: ['title', 'status', 'order'] },
  todos: { fields: { title: str, scope: oneOf('day', 'week', 'month', 'year', 'inbox'), scopeKey: identifier, status: oneOf('pending', 'done', 'postponed', 'delegated', 'cancelled'), order: integer(0), parentGoalId: optionalId, projectId: optionalId, priority: nullable(oneOf(1, 2, 3)), categoryId: optionalId, note: optionalText, repeatRule: nullable(repeatRule), sourceRetro: nullable(sourceRetro) }, required: ['title', 'scope', 'scopeKey', 'status', 'order'] },
  timeBlocks: { fields: { date: isDate, startMin: integer(0, 1439), endMin: integer(1, 1440), text: str, kind: oneOf('plan', 'actual'), categoryId: identifier, goalId: optionalId, projectId: optionalId, todoId: optionalId, sourcePlanId: optionalId }, required: ['date', 'startMin', 'endMin', 'text', 'kind', 'categoryId'] },
  goals: { fields: { title: str, parentId: optionalId, level: oneOf('oneThing', 'mandalartCore', 'mandalartSub'), color: nullable(color), order: integer(0) }, required: ['title', 'level', 'order'] },
  categories: { fields: { name: str, color, order: integer(0) }, required: ['name', 'color', 'order'] },
  habits: { fields: { name: str, color, order: integer(0), schedule, categoryId: optionalId, note: optionalText, parentGoalId: optionalId, annualGoalId: optionalId }, required: ['name', 'color', 'order'] },
  habitLogs: { fields: { habitId: identifier, date: isDate }, required: ['habitId', 'date'] },
  annualGoals: { fields: { year, order: integer(0), title: str, deadline: nullable(isDate), action: optionalText, metric: optionalText, target: nullable(number), monthlyTargets: monthly, monthlyActuals: monthly, parentGoalId: optionalId }, required: ['year', 'order', 'title', 'monthlyTargets', 'monthlyActuals'] },
  annualGoalCreate: { fields: { year, order: integer(0), ensureSeven: oneOf(true, false) }, required: ['year'] },
  books: { fields: { year, order: integer(0), title: str, category: optionalText, oneThing: optionalText, keywords: optionalText, reviewUrl: nullable(url), startedAt: nullable(isDate), finishedAt: nullable(isDate) }, required: ['year', 'order', 'title'] },
  focusNotes: { fields: { scope: oneOf('day', 'week', 'month', 'year', 'board', 'highlight'), scopeKey: identifier, text: str }, required: ['scope', 'scopeKey', 'text'] },
  retrospectives: { fields: { type: oneOf('daily', 'weekly', 'monthly', 'yearly'), dateOrWeek: identifier, rating: oneOf(1, 2, 3, 4, 5), template, freeText: str }, required: ['type', 'dateOrWeek'] },
  dailyCheckins: { fields: { date: isDate, sleepHours: nullable(sleepHoursValue), energy: nullable(ratingValue), stress: nullable(ratingValue), mood: optionalText }, required: ['date'] },
  metrics: { fields: { name: identifier, unit: str, direction: oneOf('up', 'down', 'target'), targetValue: nullable(number), goalId: optionalId, color, order: integer(0) }, required: ['name', 'unit', 'direction', 'color', 'order'] },
  injectionPens: { fields: {
    drug: oneOf('semaglutide', 'tirzepatide'), name: v => typeof v === 'string' && !!v.trim() && v.length <= 80,
    startingClicks: nullable(integer(0, 1000000)), capacityMcg: integer(1, 1000000), closed: v => typeof v === 'boolean',
  }, required: ['drug', 'name', 'capacityMcg', 'closed'] },
  injectionEntries: { fields: {
    penId: identifier, amountMcg: integer(1, 1000000), usedClicks: nullable(integer(0, 1000000)),
    takenAt: v => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v && Date.parse(v) <= Date.now(),
  }, required: ['penId', 'amountMcg', 'takenAt'] },
  metricEntries: { fields: { metricId: identifier, date: isDate, value: number, note: optionalText }, required: ['metricId', 'date', 'value'] },
  notes: { fields: { kind: oneOf('principle', 'decision', 'insight', 'reference'), title: identifier, body: str, pinned: bool, reviewDate: nullable(isDate), decisionOutcome: optionalText, goalId: optionalId, projectId: optionalId, sourceRetro: nullable(sourceRetro) }, required: ['kind', 'title', 'body', 'pinned'] },
  people: { fields: { name: identifier, relationship: optionalText, cadenceDays: nullable(integer(1, 365)), lastContactAt: nullable(isDate), birthday: nullable(isDate), giftIdeas: optionalText, note: optionalText, order: integer(0) }, required: ['name', 'order'] },
  lifeEvents: { fields: { title: identifier, date: isDate, endDate: nullable(isDate), kind: oneOf('event', 'dday', 'anniversary'), allDay: bool, startMin: nullable(integer(0, 1439)), endMin: nullable(integer(1, 1440)), color: nullable(color), personId: optionalId, projectId: optionalId, goalId: optionalId, externalUid: optionalText, note: optionalText }, required: ['title', 'date', 'kind', 'allDay'] },
  subscriptions: { fields: { name: identifier, amount: nonNegativeNumber, currency: oneOf('KRW', 'USD', 'JPY', 'EUR'), billingCycle: oneOf('monthly', 'yearly', 'weekly', 'quarterly'), billingDay: nullable(integer(1, 31)), nextBillingDate: nullable(isDate), status: oneOf('active', 'paused', 'cancelled'), category: optionalText, paymentMethod: optionalText, autoRenew: bool, url: nullable(url), note: optionalText, order: integer(0) }, required: ['name', 'amount', 'currency', 'billingCycle', 'status', 'autoRenew', 'order'] },
  financeTransactions: {
    fields: {
      date: isDate,
      time: nullable(value => typeof value === 'string' && /^\d{2}:\d{2}(?::\d{2})?$/.test(value)),
      kind: oneOf('expense', 'income', 'transfer'),
      amount: nonZeroAmount,
      currency: oneOf('KRW', 'USD', 'JPY', 'EUR'),
      category: identifier,
      subCategory: optionalText,
      merchant: identifier,
      paymentMethod: optionalText,
      note: optionalText,
      excluded: bool,
      source: oneOf('manual', 'banksalad', 'csv', 'subscription', 'shortcut'),
      subscriptionId: optionalId,
    },
    required: ['date', 'kind', 'amount', 'currency', 'category', 'merchant', 'excluded', 'source'],
  },
  financeBudgets: {
    fields: {
      yyyymm: value => value === 'default' || month(value),
      category: identifier,
      amount: nonNegativeNumber,
    },
    required: ['yyyymm', 'category', 'amount'],
  },
  icsImport: { fields: { icsText: optionalText, url: nullable(url) }, required: [] },
  googleCalendarSettings: {
    fields: {
      selectedCalendarIds: calendarIdList,
      pushCalendarId: identifier,
      syncEnabled: bool,
      autoPushEvents: bool,
      tasksSyncEnabled: bool,
      tasksAutoPush: bool,
      tasksSelectedListIds: calendarIdList,
      tasksDefaultListId: optionalId,
      tasksProjectMap: taskProjectMap,
    },
    required: [],
  },
  settings: { fields: { firstDayOfWeek: oneOf('mon', 'sun'), gridMinutes: oneOf(30, 60), dayStartHour: integer(0, 23), dayEndHour: integer(1, 24), theme: oneOf('light', 'dark'), financeCycleStartDay: integer(1, 31) }, required: ['firstDayOfWeek', 'gridMinutes', 'dayStartHour', 'dayEndHour', 'theme'] },
  login: { fields: { username: identifier, password: identifier }, required: ['username', 'password'] },
  changePassword: { fields: { currentPassword: identifier, newPassword: value => typeof value === 'string' && value.length >= 8 && value.length <= 128 }, required: ['currentPassword', 'newPassword'] },
  retroCoach: { fields: { mode: oneOf('weekly', 'monthly'), period: identifier, provider: oneOf('auto', 'openai', 'gemini', 'local') }, required: ['mode', 'period'] },
  bookLinkDaily: { fields: { dates: value => Array.isArray(value) && value.length <= 500 && value.every(isDate), matchTitle: identifier }, required: [] },
};

export class ValidationError extends Error {}
const invalid = (message: string): never => { throw new ValidationError(message); };

/** Validate only explicit client fields; null remains an intentional clear. */
export function validateFields(kind: MutationKind, value: unknown, patch = false): Record<string, unknown> {
  if (!object(value)) return invalid('JSON body must be an object');
  if (patch && Object.keys(value).length === 0) invalid('Patch must contain at least one field');
  if (kind === 'timeBlocks' && patch && Object.hasOwn(value, 'sourcePlanId')) invalid('Immutable field: sourcePlanId');
  const rule = rules[kind];
  for (const [key, entry] of Object.entries(value)) {
    if (!Object.hasOwn(rule.fields, key)) invalid(`Unknown or immutable field: ${key}`);
    if (!rule.fields[key](entry)) invalid(`Invalid field: ${key}`);
  }
  if (!patch && kind === 'timeBlocks' && value.sourcePlanId && value.kind !== 'actual') invalid('Only actuals can reference a plan');
  if (!patch) for (const key of rule.required) if (!Object.hasOwn(value, key)) invalid(`Required field: ${key}`);
  if (kind === 'annualGoalCreate' && value.ensureSeven !== true && value.order === undefined) invalid('Required field: order');
  return value;
}

export function validateRelationships(kind: MutationKind, value: Record<string, unknown>) {
  if (kind === 'timeBlocks' && typeof value.startMin === 'number' && typeof value.endMin === 'number' && value.startMin >= value.endMin) invalid('startMin must precede endMin');
  if (kind === 'settings' && typeof value.dayStartHour === 'number' && typeof value.dayEndHour === 'number' && value.dayStartHour >= value.dayEndHour) invalid('dayStartHour must precede dayEndHour');
  if ((kind === 'todos' || kind === 'focusNotes') && typeof value.scope === 'string' && typeof value.scopeKey === 'string') {
    const key = kind === 'focusNotes' && value.scope !== 'day' && value.scope !== 'highlight' && value.scope !== 'board' ? value.scopeKey.replace(new RegExp(`^${value.scope}:`), '') : value.scopeKey;
    const checks: Record<string, Check> = { day: isDate, highlight: isDate, week, month, year, board: identifier, inbox: oneOf('inbox') };
    if (!checks[value.scope]?.(key)) invalid('scopeKey does not match scope');
  }
  if (kind === 'morningBootApply') {
    const toToday = Array.isArray(value.moveToTodayIds) ? (value.moveToTodayIds as string[]) : [];
    const toInbox = Array.isArray(value.moveToInboxIds) ? (value.moveToInboxIds as string[]) : [];
    if (toToday.length === 0 && toInbox.length === 0) invalid('이동할 할 일을 선택해 주세요.');
    const todaySet = new Set(toToday);
    if (toInbox.some(id => todaySet.has(id))) invalid('같은 할 일을 동시에 다른 곳으로 이동할 수 없습니다.');
  }
  if (kind === 'eveningShutdownApply') {
    const confirmIds = Array.isArray(value.confirmBlockIds) ? (value.confirmBlockIds as string[]) : [];
    const rolloverIds = Array.isArray(value.rolloverTodoIds) ? (value.rolloverTodoIds as string[]) : [];
    const inboxIds = Array.isArray(value.inboxTodoIds) ? (value.inboxTodoIds as string[]) : [];
    if (confirmIds.length === 0 && rolloverIds.length === 0 && inboxIds.length === 0) invalid('처리할 항목을 선택해 주세요.');
    const rolloverSet = new Set(rolloverIds);
    if (inboxIds.some(id => rolloverSet.has(id))) invalid('같은 할 일을 동시에 다른 곳으로 이동할 수 없습니다.');
  }
  if (kind === 'lifeEvents') {
    if (typeof value.endDate === 'string' && typeof value.date === 'string' && value.endDate < value.date) {
      invalid('endDate must not precede date');
    }
    const hasStart = typeof value.startMin === 'number';
    const hasEnd = typeof value.endMin === 'number';
    if (hasStart !== hasEnd) invalid('startMin and endMin must be set together');
    if (hasStart && hasEnd && (value.startMin as number) >= (value.endMin as number)) invalid('startMin must precede endMin');
    if (value.allDay === false && (!hasStart || !hasEnd)) invalid('Timed events require startMin and endMin');
  }
  if (kind === 'icsImport') {
    const textOk = typeof value.icsText === 'string' && value.icsText.trim().length > 0;
    const urlOk = typeof value.url === 'string' && value.url.trim().length > 0;
    if (!textOk && !urlOk) invalid('icsText or url is required');
  }
  if (kind === 'retrospectives' && !retroDateOrWeek(value.type, value.dateOrWeek)) invalid('Invalid dateOrWeek');
  if (kind === 'todos' && value.repeatRule && value.scope !== 'day') invalid('반복 할 일은 날짜를 지정해 주세요.');
  if (kind === 'changePassword' && value.currentPassword === value.newPassword) invalid('새 비밀번호는 현재 비밀번호와 다르게 입력해 주세요.');
  if (kind === 'retroCoach') {
    if (value.mode === 'weekly' && !isWeek(value.period)) invalid('Invalid week');
    if (value.mode === 'monthly' && !isMonth(value.period)) invalid('Invalid month');
  }
}

export const referenceFields: Partial<Record<MutationKind, Record<string, 'goals' | 'categories' | 'projects' | 'todos' | 'annualGoals' | 'habits' | 'metrics' | 'people' | 'subscriptions' | 'injectionPens'>>> = {
  goals: { parentId: 'goals' },
  projects: { goalId: 'goals', categoryId: 'categories' },
  todos: { parentGoalId: 'goals', categoryId: 'categories', projectId: 'projects' },
  timeBlocks: { goalId: 'goals', projectId: 'projects', todoId: 'todos', categoryId: 'categories' },
  habits: { categoryId: 'categories', parentGoalId: 'goals', annualGoalId: 'annualGoals' },
  annualGoals: { parentGoalId: 'goals' },
  habitLogs: { habitId: 'habits' },
  metrics: { goalId: 'goals' },
  injectionEntries: { penId: 'injectionPens' },
  metricEntries: { metricId: 'metrics' },
  notes: { goalId: 'goals', projectId: 'projects' },
  lifeEvents: { personId: 'people', projectId: 'projects', goalId: 'goals' },
  financeTransactions: { subscriptionId: 'subscriptions' },
};
