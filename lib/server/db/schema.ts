import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Goals (mandalart: oneThing / mandalartCore / mandalartSub)
export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey(),
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
  })
);

// Categories
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  order: integer('order').notNull(),
});

// Todos
export const todos = sqliteTable(
  'todos',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    scope: text('scope').notNull(), // 'day' | 'week' | 'month' | 'year'
    scopeKey: text('scope_key').notNull(),
    status: text('status').notNull(), // 'pending' | 'done' | 'postponed' | 'delegated' | 'cancelled'
    order: integer('order').notNull(),
    parentGoalId: text('parent_goal_id'),
    priority: integer('priority'),
    categoryId: text('category_id'),
    note: text('note'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  t => ({
    scopeIdx: index('todos_scope_idx').on(t.scope, t.scopeKey),
    parentIdx: index('todos_parent_idx').on(t.parentGoalId),
  })
);

// FocusNotes
export const focusNotes = sqliteTable(
  'focus_notes',
  {
    id: text('id').primaryKey(),
    scope: text('scope').notNull(), // 'year' | 'month' | 'week'
    scopeKey: text('scope_key').notNull(),
    text: text('text').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  t => ({
    scopeIdx: index('focus_notes_scope_idx').on(t.scope, t.scopeKey),
  })
);

// AnnualGoals — monthlyTargets/monthlyActuals stored as JSON
export const annualGoals = sqliteTable(
  'annual_goals',
  {
    id: text('id').primaryKey(),
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
    parentGoalId: text('parent_goal_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  t => ({
    yearIdx: index('annual_goals_year_idx').on(t.year),
    parentIdx: index('annual_goals_parent_idx').on(t.parentGoalId),
  })
);

// Habits — schedule stored as JSON (tagged union)
export const habits = sqliteTable(
  'habits',
  {
    id: text('id').primaryKey(),
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
  })
);

// HabitLogs
export const habitLogs = sqliteTable(
  'habit_logs',
  {
    id: text('id').primaryKey(),
    habitId: text('habit_id').notNull(),
    date: text('date').notNull(), // YYYY-MM-DD
    createdAt: text('created_at').notNull(),
  },
  t => ({
    habitIdx: index('habit_logs_habit_idx').on(t.habitId),
    dateIdx: index('habit_logs_date_idx').on(t.date),
    habitDateIdx: index('habit_logs_habit_date_idx').on(t.habitId, t.date),
  })
);

// Books
export const books = sqliteTable(
  'books',
  {
    id: text('id').primaryKey(),
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
  })
);

// Retrospectives — template stored as JSON
export const retrospectives = sqliteTable(
  'retrospectives',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(), // 'daily' | 'weekly'
    dateOrWeek: text('date_or_week').notNull(),
    rating: integer('rating'),
    template: text('template', { mode: 'json' })
      .$type<{ good?: string; bad?: string; nextStep?: string }>()
      .notNull(),
    freeText: text('free_text'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  t => ({
    typeDateIdx: index('retrospectives_type_date_idx').on(t.type, t.dateOrWeek),
  })
);

// TimeBlocks
export const timeBlocks = sqliteTable(
  'time_blocks',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    startMin: integer('start_min').notNull(),
    endMin: integer('end_min').notNull(),
    text: text('text').notNull(),
    kind: text('kind').notNull().default('plan'), // 'plan' | 'actual'
    categoryId: text('category_id').notNull(),
    goalId: text('goal_id'),
    todoId: text('todo_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  t => ({
    dateIdx: index('time_blocks_date_idx').on(t.date),
    goalIdx: index('time_blocks_goal_idx').on(t.goalId),
    kindIdx: index('time_blocks_kind_idx').on(t.kind),
  })
);

// Settings (singleton row, key='main')
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(), // always 'main'
  firstDayOfWeek: text('first_day_of_week').notNull(), // 'mon' | 'sun'
  gridMinutes: integer('grid_minutes').notNull(), // 30 | 60
  dayStartHour: integer('day_start_hour').notNull(),
  dayEndHour: integer('day_end_hour').notNull(),
  theme: text('theme').notNull(), // 'light' | 'dark'
});
