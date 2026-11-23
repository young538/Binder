import type { MetricSummary } from './metrics';
import type { SubscriptionSummary } from './subscriptions';
import type {
  DailyCheckin,
  LifeEventKind,
  LifeMetric,
  LifeMetricEntry,
  Project,
  Todo,
} from './types';

export interface DashboardTodayEvent {
  id: string;
  title: string;
  kind: LifeEventKind;
  allDay: boolean;
  startMin: number | null;
  endMin: number | null;
  color: string | null;
  isGoogle: boolean;
}

export interface DashboardUpcomingItem {
  id: string;
  title: string;
  kind: LifeEventKind | 'birthday' | 'subscription';
  date: string;
  daysLeft: number;
  label: string;
  isGoogle: boolean;
}

export interface DashboardProjectItem {
  project: Project;
  totalTodos: number;
  doneTodos: number;
  activeTodos: number;
  progressPercent: number;
  actualMinutes: number;
  needsNextAction: boolean;
}

export interface DashboardMetricItem {
  metric: LifeMetric;
  entries: LifeMetricEntry[];
  summary: MetricSummary;
}

export interface DashboardSnapshot {
  date: string;
  isoWeek: string;
  yyyymm: string;
  highlight: string;
  todayCheckin: DailyCheckin | null;
  todayTodos: {
    done: number;
    pending: number;
    total: number;
    items: Todo[];
  };
  todayTime: {
    planMin: number;
    actualMin: number;
  };
  weeklyHabitPercent: number;
  todayEvents: DashboardTodayEvent[];
  upcomingItems: DashboardUpcomingItem[];
  activeProjects: DashboardProjectItem[];
  subscriptionSummary: SubscriptionSummary;
  metrics: DashboardMetricItem[];
  attention: {
    overdueTodosCount: number;
    projectsWithoutNextAction: number;
    duePeopleCount: number;
    dueDecisionsCount: number;
    upcomingBillsCount: number;
  };
  googleCalendar: {
    connected: boolean;
    googleEmail: string | null;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
  };
}
