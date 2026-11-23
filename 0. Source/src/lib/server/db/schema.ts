import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
import { PENDING_ADMIN_USER_ID } from './constants';
import type { GoogleCalendarInfo, GoogleTaskListInfo, Todo, TodoRepeatRule, RetroSource, WeeklyTemplateBlock } from '@/lib/types';

// Users — auth identities. Seeded from APP_USERNAME/APP_PASSWORD_HASH on first boot.
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Goals (mandalart: oneThing / mandalartCore / mandalartSub)
export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default(PENDING_ADMIN_USER_ID),
    title: text('title').notNull(),
    parentId: text('parent_id'),
    level: text('level').notNull(), // 'oneThing' | 'mandalartCore' | 'mandalartSub'
    color: text('color'),
    order: integer('order').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  t => ({
    parentIdx: index('goals_parent_idx').on(t.parentId),
    levelIdx: index('goals_level_idx').on(t.level),
    userIdx: index('goals_user_idx').on(t.userId),
  })
);

// Categories
export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default(PENDING_ADMIN_USER_ID),
    name: text('name').notNull(),
    color: text('color').notNull(),
    order: integer('order').notNull(),
  },
  t => ({
    userIdx: index('categories_user_idx').on(t.userId),
  })
);

// Todos
export const todos = sqliteTable(
  'todos',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default(PENDING_ADMIN_USER_ID),
    title: text('title').notNull(),
    scope: text('scope').notNull(), // day | week | month | year | inbox
    scopeKey: text('scope_key').notNull(),
    status: text('status').notNull(), // 'pending' | 'done' | 'postponed' | 'delegated' | 'cancelled'
    order: integer('order').notNull(),
    parentGoalId: text('parent_goal_id'),
    projectId: text('project_id'),
    priority: integer('priority'),
    categoryId: text('category_id'),
    note: text('note'),
    repeatRule: text('repeat_rule', { mode: 'json' }).$type<TodoRepeatRule>(),
    sourceRetro: text('source_retro', { mode: 'json' }).$type<RetroSource>(),
    completedAt: text('completed_at'),
    repeatGenerated: integer('repeat_generated', { mode: 'boolean' }).notNull().default(false),
    googleTaskListId: text('google_task_list_id'),
    googleTaskId: text('google_task_id'),
    googleTaskUpdatedAt: text('google_task_updated_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  t => ({
    scopeIdx: index('todos_scope_idx').on(t.scope, t.scopeKey),
    parentIdx: index('todos_parent_idx').on(t.parentGoalId),
    projectIdx: index('todos_project_idx').on(t.projectId),
    userIdx: index('todos_user_idx').on(t.userId),
    googleTaskIdx: index('todos_user_google_task_idx').on(t.userId, t.googleTaskListId, t.googleTaskId),
  })
);

// Projects
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull(), // 'active' | 'planned' | 'onHold' | 'done'
  order: integer('order').notNull(),
  goalId: text('goal_id'),
  categoryId: text('category_id'),
  deadline: text('deadline'),
  outcome: text('outcome'),
  note: text('note'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => [
  index('projects_user_idx').on(t.userId),
  index('projects_goal_idx').on(t.goalId),
  index('projects_status_idx').on(t.userId, t.status),
]);

// Internal operation records: included in SQLite backups, not portable JSON exports.
export const weeklyTemplates = sqliteTable('weekly_templates', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  blocks: text('blocks', { mode: 'json' }).$type<WeeklyTemplateBlock[]>().notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => [index('weekly_templates_user_idx').on(t.userId)]);

export const todoCreateRequests = sqliteTable('todo_create_requests', {
  userId: text('user_id').notNull(),
  requestKey: text('request_key').notNull(),
  payloadHash: text('payload_hash').notNull(),
  response: text('response', { mode: 'json' }).$type<Todo>().notNull(),
  createdAt: text('created_at').notNull(),
}, t => [primaryKey({ columns: [t.userId, t.requestKey] })]);

export const todoTrash = sqliteTable('todo_trash', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  snapshot: text('snapshot', { mode: 'json' }).$type<Todo>().notNull(),
  expiresAt: text('expires_at').notNull(),
}, t => [index('todo_trash_user_idx').on(t.userId), index('todo_trash_expiry_idx').on(t.expiresAt)]);

// FocusNotes
export const focusNotes = sqliteTable(
  'focus_notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default(PENDING_ADMIN_USER_ID),
    scope: text('scope').notNull(), // 'year' | 'month' | 'week' | 'day' | 'board'
    scopeKey: text('scope_key').notNull(),
    text: text('text').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  t => ({
    scopeIdx: index('focus_notes_scope_idx').on(t.scope, t.scopeKey),
    userIdx: index('focus_notes_user_idx').on(t.userId),
  })
);

// AnnualGoals — monthlyTargets/monthlyActuals stored as JSON
export const annualGoals = sqliteTable(
  'annual_goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default(PENDING_ADMIN_USER_ID),
    year: text('year').notNull(),
    order: integer('order').notNull(),
    title: text('title').notNull(),
    deadline: text('deadline'),
    action: text('action'),
    metric: text('metric'),
    target: integer('target'),
    // JSON arrays of 12 entries (number | null)[]
    monthlyTargets: text('monthly_targets', { mode: 'json' })
      .$type<(number | null)[]>()
      .notNull(),
    monthlyActuals: text('monthly_actuals', { mode: 'json' })
      .$type<(number | null)[]>()
      .notNull(),
    // Signed manual offsets; displayed actuals are computed from current logs.
    monthlyActualAdjustments: text('monthly_actual_adjustments', { mode: 'json' })
      .$type<(number | null)[]>(),
    parentGoalId: text('parent_goal_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  t => ({
    yearIdx: index('annual_goals_year_idx').on(t.year),
    parentIdx: index('annual_goals_parent_idx').on(t.parentGoalId),
    userIdx: index('annual_goals_user_idx').on(t.userId),
  })
);

// Habits — schedule stored as JSON (tagged union)
export const habits = sqliteTable(
  'habits',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default(PENDING_ADMIN_USER_ID),
    name: text('name').notNull(),
    color: text('color').notNull(),
    order: integer('order').notNull(),
    // HabitSchedule tagged union
    schedule: text('schedule', { mode: 'json' }).$type<unknown>(),
    categoryId: text('category_id'),
    note: text('note'),
    parentGoalId: text('parent_goal_id'),
    annualGoalId: text('annual_goal_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  t => ({
    parentIdx: index('habits_parent_idx').on(t.parentGoalId),
    annualIdx: index('habits_annual_idx').on(t.annualGoalId),
    userIdx: index('habits_user_idx').on(t.userId),
  })
);

// HabitLogs
export const habitLogs = sqliteTable(
  'habit_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default(PENDING_ADMIN_USER_ID),
    habitId: text('habit_id').notNull(),
    date: text('date').notNull(), // YYYY-MM-DD
    createdAt: text('created_at').notNull(),
  },
  t => ({
    habitIdx: index('habit_logs_habit_idx').on(t.habitId),
    dateIdx: index('habit_logs_date_idx').on(t.date),
    habitDateIdx: index('habit_logs_habit_date_idx').on(t.habitId, t.date),
    userIdx: index('habit_logs_user_idx').on(t.userId),
  })
);

// Books
export const books = sqliteTable(
  'books',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default(PENDING_ADMIN_USER_ID),
    year: text('year').notNull(),
    order: integer('order').notNull(),
    category: text('category'),
    title: text('title').notNull(),
    oneThing: text('one_thing'),
    keywords: text('keywords'),
    reviewUrl: text('review_url'),
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  t => ({
    yearIdx: index('books_year_idx').on(t.year),
    userIdx: index('books_user_idx').on(t.userId),
  })
);

// Retrospectives — template stored as JSON
export const retrospectives = sqliteTable(
  'retrospectives',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default(PENDING_ADMIN_USER_ID),
    type: text('type').notNull(), // 'daily' | 'weekly' | 'monthly' | 'yearly'
    dateOrWeek: text('date_or_week').notNull(),
    rating: integer('rating'),
    template: text('template', { mode: 'json' })
      .$type<{ good?: string; bad?: string; nextStep?: string; reading?: string }>()
      .notNull(),
    freeText: text('free_text'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  t => ({
    typeDateIdx: index('retrospectives_type_date_idx').on(t.type, t.dateOrWeek),
    userIdx: index('retrospectives_user_idx').on(t.userId),
  })
);

// TimeBlocks
export const timeBlocks = sqliteTable(
  'time_blocks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default(PENDING_ADMIN_USER_ID),
    date: text('date').notNull(),
    startMin: integer('start_min').notNull(),
    endMin: integer('end_min').notNull(),
    text: text('text').notNull(),
    kind: text('kind').notNull().default('plan'), // 'plan' | 'actual'
    categoryId: text('category_id').notNull(),
    goalId: text('goal_id'),
    projectId: text('project_id'),
    todoId: text('todo_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  t => ({
    dateIdx: index('time_blocks_date_idx').on(t.date),
    goalIdx: index('time_blocks_goal_idx').on(t.goalId),
    projectIdx: index('time_blocks_project_idx').on(t.projectId),
    kindIdx: index('time_blocks_kind_idx').on(t.kind),
    userIdx: index('time_blocks_user_idx').on(t.userId),
  })
);

// Settings — one row per user (PK = user_id)
export const settings = sqliteTable('settings', {
  userId: text('user_id').primaryKey().notNull().default(PENDING_ADMIN_USER_ID),
  firstDayOfWeek: text('first_day_of_week').notNull(), // 'mon' | 'sun'
  gridMinutes: integer('grid_minutes').notNull(), // 30 | 60
  dayStartHour: integer('day_start_hour').notNull(),
  dayEndHour: integer('day_end_hour').notNull(),
  theme: text('theme').notNull(), // 'light' | 'dark'
});


// DailyCheckins — sleep, energy, stress, mood per user per day
export const dailyCheckins = sqliteTable('daily_checkins', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  date: text('date').notNull(),
  sleepHours: real('sleep_hours'),
  energy: integer('energy'),
  stress: integer('stress'),
  mood: text('mood'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => [
  uniqueIndex('daily_checkins_user_date_idx').on(t.userId, t.date),
  index('daily_checkins_user_idx').on(t.userId),
]);

// LifeMetrics & LifeMetricEntries — non-cumulative state metrics (weight, net worth, etc.)
export const metrics = sqliteTable('metrics', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  direction: text('direction').notNull(), // 'up' | 'down' | 'target'
  targetValue: real('target_value'),
  goalId: text('goal_id'),
  color: text('color').notNull(),
  order: integer('order').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => [
  index('metrics_user_idx').on(t.userId),
  index('metrics_goal_idx').on(t.goalId),
]);

export const metricEntries = sqliteTable('metric_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  metricId: text('metric_id').notNull(),
  date: text('date').notNull(),
  value: real('value').notNull(),
  note: text('note'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => [
  uniqueIndex('metric_entries_metric_date_idx').on(t.userId, t.metricId, t.date),
  index('metric_entries_user_idx').on(t.userId),
]);

// BinderNotes — permanent principles, decisions, insights, references
export const binderNotes = sqliteTable('binder_notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(), // 'principle' | 'decision' | 'insight' | 'reference'
  title: text('title').notNull(),
  body: text('body').notNull(),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  reviewDate: text('review_date'),
  decisionOutcome: text('decision_outcome'),
  goalId: text('goal_id'),
  projectId: text('project_id'),
  sourceRetro: text('source_retro', { mode: 'json' }).$type<RetroSource>(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => [
  index('binder_notes_user_idx').on(t.userId),
  index('binder_notes_user_kind_idx').on(t.userId, t.kind),
  index('binder_notes_goal_idx').on(t.goalId),
  index('binder_notes_project_idx').on(t.projectId),
]);

// People — personal CRM
export const people = sqliteTable('people', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  relationship: text('relationship'),
  cadenceDays: integer('cadence_days'),
  lastContactAt: text('last_contact_at'),
  birthday: text('birthday'),
  giftIdeas: text('gift_ideas'),
  note: text('note'),
  order: integer('order').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => [
  index('people_user_idx').on(t.userId),
]);

// LifeEvents — fixed appointments, D-Days, anniversaries, and imported .ics events
export const lifeEvents = sqliteTable('life_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  date: text('date').notNull(),
  endDate: text('end_date'),
  kind: text('kind').notNull(), // 'event' | 'dday' | 'anniversary'
  allDay: integer('all_day', { mode: 'boolean' }).notNull().default(true),
  startMin: integer('start_min'),
  endMin: integer('end_min'),
  color: text('color'),
  personId: text('person_id'),
  projectId: text('project_id'),
  goalId: text('goal_id'),
  externalUid: text('external_uid'),
  googleCalendarId: text('google_calendar_id'),
  googleEventId: text('google_event_id'),
  googleUpdatedAt: text('google_updated_at'),
  note: text('note'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => [
  index('life_events_user_date_idx').on(t.userId, t.date),
  index('life_events_person_idx').on(t.personId),
  index('life_events_user_uid_idx').on(t.userId, t.externalUid),
  index('life_events_user_google_idx').on(t.userId, t.googleCalendarId, t.googleEventId),
]);

// Subscriptions — recurring fixed expenses / memberships
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull(), // 'KRW' | 'USD' | 'JPY' | 'EUR'
  billingCycle: text('billing_cycle').notNull(), // 'monthly' | 'yearly' | 'weekly' | 'quarterly'
  billingDay: integer('billing_day'),
  nextBillingDate: text('next_billing_date'),
  status: text('status').notNull(), // 'active' | 'paused' | 'cancelled'
  category: text('category'),
  paymentMethod: text('payment_method'),
  autoRenew: integer('auto_renew', { mode: 'boolean' }).notNull().default(true),
  url: text('url'),
  note: text('note'),
  order: integer('order').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => [
  index('subscriptions_user_idx').on(t.userId),
  index('subscriptions_user_status_idx').on(t.userId, t.status),
]);

// GoogleCalendarConnections — per-user encrypted OAuth tokens and sync preferences (excluded from JSON backups)
export const googleCalendarConnections = sqliteTable('google_calendar_connections', {
  userId: text('user_id').primaryKey(),
  googleEmail: text('google_email').notNull(),
  accessTokenEnc: text('access_token_enc').notNull(),
  refreshTokenEnc: text('refresh_token_enc').notNull(),
  tokenExpiresAt: text('token_expires_at').notNull(),
  selectedCalendarIds: text('selected_calendar_ids', { mode: 'json' }).$type<string[]>().notNull(),
  pushCalendarId: text('push_calendar_id').notNull(),
  calendarMeta: text('calendar_meta', { mode: 'json' }).$type<GoogleCalendarInfo[]>().notNull(),
  syncEnabled: integer('sync_enabled', { mode: 'boolean' }).notNull().default(true),
  autoPushEvents: integer('auto_push_events', { mode: 'boolean' }).notNull().default(true),
  lastSyncedAt: text('last_synced_at'),
  lastSyncError: text('last_sync_error'),
  tasksSyncEnabled: integer('tasks_sync_enabled', { mode: 'boolean' }).notNull().default(true),
  tasksAutoPush: integer('tasks_auto_push', { mode: 'boolean' }).notNull().default(true),
  tasksSelectedListIds: text('tasks_selected_list_ids', { mode: 'json' }).$type<string[]>().notNull().default([]),
  tasksDefaultListId: text('tasks_default_list_id'),
  tasksListMeta: text('tasks_list_meta', { mode: 'json' }).$type<GoogleTaskListInfo[]>().notNull().default([]),
  tasksProjectMap: text('tasks_project_map', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
  tasksLastSyncedAt: text('tasks_last_synced_at'),
  tasksLastSyncError: text('tasks_last_sync_error'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
