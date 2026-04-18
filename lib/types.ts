export type GoalLevel = 'oneThing' | 'mandalartCore' | 'mandalartSub';

export interface Goal {
  id: string;
  title: string;
  parentId?: string;
  level: GoalLevel;
  color?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type TodoPriority = 1 | 2 | 3;

export type TodoScope = 'day' | 'week' | 'month' | 'year';

export type TodoStatus = 'pending' | 'done' | 'postponed' | 'delegated' | 'cancelled';

export const STATUS_LABEL: Record<TodoStatus, string> = {
  pending: '대기',
  done: '완료',
  postponed: '연기',
  delegated: '위임',
  cancelled: '취소',
};

export const STATUS_ICON: Record<TodoStatus, string> = {
  pending: '⬜',
  done: '✅',
  postponed: '⏳',
  delegated: '👥',
  cancelled: '❌',
};

export interface Todo {
  id: string;
  title: string;
  scope: TodoScope;
  scopeKey: string;
  status: TodoStatus;
  order: number;
  parentGoalId?: string;
  priority?: TodoPriority;
  categoryId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export type FocusScope = 'year' | 'month' | 'week';

export interface FocusNote {
  id: string;
  scope: FocusScope;
  scopeKey: string;
  text: string;
  updatedAt: string;
}

export interface TimeBlock {
  id: string;
  date: string;
  startMin: number;
  endMin: number;
  text: string;
  categoryId: string;
  goalId?: string;
  todoId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
}

export type RetroRating = 1 | 2 | 3 | 4 | 5;

export interface Retrospective {
  id: string;
  type: 'daily' | 'weekly';
  dateOrWeek: string;
  rating?: RetroRating;
  template: {
    good?: string;
    bad?: string;
    nextStep?: string;
  };
  freeText?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  firstDayOfWeek: 'mon' | 'sun';
  gridMinutes: 30 | 60;
  dayStartHour: number;
  dayEndHour: number;
  theme: 'light' | 'dark';
}

export interface AnnualGoal {
  id: string;
  year: string;
  order: number;
  title: string;
  deadline?: string;
  action?: string;
  metric?: string;
  target?: number;
  monthlyTargets: (number | null)[];
  monthlyActuals: (number | null)[];
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  name: string;
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  createdAt: string;
}

export interface Routine {
  id: string;
  name: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  categoryId?: string;
  note?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  year: string;
  order: number;
  category?: string;
  title: string;
  oneThing?: string;
  keywords?: string;
  reviewUrl?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BinderData {
  version: number;
  updatedAt: string;
  goals: Goal[];
  categories: Category[];
  timeBlocks: TimeBlock[];
  retrospectives: Retrospective[];
  settings: Settings;
}
