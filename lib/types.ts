export type GoalLevel = 'oneThing' | 'mandalartCore' | 'mandalartSub';

export interface Goal {
  id: string;
  userId: string;
  title: string;
  parentId?: string | null;
  level: GoalLevel;
  color?: string | null;
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

// 연결 해제(null)를 PATCH 로 보낼 수 있도록, 해제 가능한 FK/옵션 필드는
// `| null` 을 허용한다. undefined = 변경 없음, null = 연결 해제, 값 = 연결.
export interface Todo {
  id: string;
  userId: string;
  title: string;
  scope: TodoScope;
  scopeKey: string;
  status: TodoStatus;
  order: number;
  parentGoalId?: string | null;
  priority?: TodoPriority | null;
  categoryId?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FocusScope = 'year' | 'month' | 'week' | 'day' | 'board';

export interface FocusNote {
  id: string;
  userId: string;
  scope: FocusScope;
  scopeKey: string;
  text: string;
  updatedAt: string;
}

export type TimeBlockKind = 'plan' | 'actual';

export interface TimeBlock {
  id: string;
  userId: string;
  date: string;
  startMin: number;
  endMin: number;
  text: string;
  kind: TimeBlockKind;
  categoryId: string;
  goalId?: string | null;
  todoId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string;
  order: number;
}

export type RetroRating = 1 | 2 | 3 | 4 | 5;

export interface Retrospective {
  id: string;
  userId: string;
  type: 'daily' | 'weekly';
  dateOrWeek: string;
  rating?: RetroRating;
  template: {
    good?: string;
    bad?: string;
    nextStep?: string;
    reading?: string;
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
  userId: string;
  year: string;
  order: number;
  title: string;
  deadline?: string | null;
  action?: string | null;
  metric?: string | null;
  target?: number | null;
  monthlyTargets: (number | null)[];
  monthlyActuals: (number | null)[];
  parentGoalId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type HabitSchedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: Weekday[] }
  | { kind: 'perWeek'; count: number }
  | { kind: 'perMonth'; count: number };

export const defaultSchedule = (): HabitSchedule => ({ kind: 'daily' });

export interface Habit {
  id: string;
  userId: string;
  name: string;
  color: string;
  order: number;
  schedule?: HabitSchedule;
  categoryId?: string | null;
  note?: string | null;
  parentGoalId?: string | null;
  annualGoalId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLog {
  id: string;
  userId: string;
  habitId: string;
  date: string;
  createdAt: string;
}

export interface Book {
  id: string;
  userId: string;
  year: string;
  order: number;
  category?: string | null;
  title: string;
  oneThing?: string | null;
  keywords?: string | null;
  reviewUrl?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
