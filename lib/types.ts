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

export interface Todo {
  id: string;
  title: string;
  date: string;
  done: boolean;
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
  theme: 'light' | 'dark' | 'auto';
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
