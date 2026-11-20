import type { BinderNote, Project, Todo } from './types';

export interface MorningBootProjectItem {
  project: Project;
  candidateTodos: Todo[];
  todayCount: number;
  needsNextAction: boolean;
}

export interface MorningBootUpcomingEvent {
  id: string;
  title: string;
  date: string;
  kind: 'event' | 'dday' | 'anniversary' | 'birthday';
  daysLeft: number;
  personId?: string;
}

export interface MorningBootDuePerson {
  id: string;
  name: string;
  relationship?: string | null;
  daysSince: number | null;
  overdueDays: number;
}

export interface MorningBootSnapshot {
  date: string;
  isoWeek: string;
  overdueTodos: Todo[];
  todayTodos: Todo[];
  weekTodos: Todo[];
  inboxTodos: Todo[];
  activeProjects: MorningBootProjectItem[];
  highlight: string;
  upcomingEvents: MorningBootUpcomingEvent[];
  duePeople: MorningBootDuePerson[];
  dueDecisions: BinderNote[];
}

export interface MorningBootApplyInput {
  targetDate: string;
  moveToTodayIds?: string[];
  moveToInboxIds?: string[];
}

export interface MorningBootApplyResult {
  movedToToday: number;
  movedToInbox: number;
}
