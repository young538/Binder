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

export type ProjectStatus = 'active' | 'planned' | 'onHold' | 'done';

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: '진행 중',
  planned: '예정',
  onHold: '보류',
  done: '완료',
};

export interface Project {
  id: string;
  userId: string;
  title: string;
  status: ProjectStatus;
  order: number;
  goalId?: string | null;
  categoryId?: string | null;
  deadline?: string | null;
  outcome?: string | null;
  note?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TodoPriority = 1 | 2 | 3;

export type TodoScope = 'day' | 'week' | 'month' | 'year' | 'inbox';

export interface TodoRepeatRule {
  unit: 'day' | 'week' | 'month';
  interval: number;
  basis: 'scheduled' | 'completed';
}

export type RetroType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RetroSource {
  type: RetroType;
  dateOrWeek: string;
}

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
  projectId?: string | null;
  priority?: TodoPriority | null;
  categoryId?: string | null;
  note?: string | null;
  repeatRule?: TodoRepeatRule | null;
  sourceRetro?: RetroSource | null;
  completedAt?: string | null;
  repeatGenerated?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FocusScope = 'year' | 'month' | 'week' | 'day' | 'board' | 'highlight';

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
  projectId?: string | null;
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

export interface WeeklyTemplateBlock {
  dayOffset: number;
  startMin: number;
  endMin: number;
  text: string;
  categoryId: string;
  goalId?: string | null;
}

export interface WeeklyTemplate {
  id: string;
  userId: string;
  name: string;
  blocks: WeeklyTemplateBlock[];
  createdAt: string;
  updatedAt: string;
}

export type RetroRating = 1 | 2 | 3 | 4 | 5;

export interface Retrospective {
  id: string;
  userId: string;
  type: RetroType;
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

export interface DailyCheckin {
  id: string;
  userId: string;
  date: string;
  sleepHours?: number | null;
  energy?: RetroRating | null;
  stress?: RetroRating | null;
  mood?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MetricDirection = 'up' | 'down' | 'target';

export const METRIC_DIRECTION_LABEL: Record<MetricDirection, string> = {
  up: '증가 목표',
  down: '감소 목표',
  target: '목표치 유지',
};

export interface LifeMetric {
  id: string;
  userId: string;
  name: string;
  unit: string;
  direction: MetricDirection;
  targetValue?: number | null;
  goalId?: string | null;
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface LifeMetricEntry {
  id: string;
  userId: string;
  metricId: string;
  date: string;
  value: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NoteKind = 'principle' | 'decision' | 'insight' | 'reference';

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  principle: '내 원칙',
  decision: '의사결정',
  insight: '인사이트',
  reference: '레퍼런스',
};

export interface BinderNote {
  id: string;
  userId: string;
  kind: NoteKind;
  title: string;
  body: string;
  pinned: boolean;
  reviewDate?: string | null;
  decisionOutcome?: string | null;
  goalId?: string | null;
  projectId?: string | null;
  sourceRetro?: RetroSource | null;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  userId: string;
  name: string;
  relationship?: string | null;
  cadenceDays?: number | null;
  lastContactAt?: string | null;
  birthday?: string | null;
  giftIdeas?: string | null;
  note?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type LifeEventKind = 'event' | 'dday' | 'anniversary';

export const LIFE_EVENT_KIND_LABEL: Record<LifeEventKind, string> = {
  event: '일정',
  dday: 'D-Day',
  anniversary: '기념일',
};

export interface LifeEvent {
  id: string;
  userId: string;
  title: string;
  date: string;
  endDate?: string | null;
  kind: LifeEventKind;
  allDay: boolean;
  startMin?: number | null;
  endMin?: number | null;
  color?: string | null;
  personId?: string | null;
  projectId?: string | null;
  goalId?: string | null;
  externalUid?: string | null;
  googleCalendarId?: string | null;
  googleEventId?: string | null;
  googleUpdatedAt?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BillingCycle = 'monthly' | 'yearly' | 'weekly' | 'quarterly';

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: '월간',
  yearly: '연간',
  quarterly: '분기',
  weekly: '주간',
};

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: '구독 중',
  paused: '일시정지',
  cancelled: '해지됨',
};

export type SubscriptionCurrency = 'KRW' | 'USD' | 'JPY' | 'EUR';

export const SUBSCRIPTION_CURRENCY_SYMBOL: Record<SubscriptionCurrency, string> = {
  KRW: '₩',
  USD: '$',
  JPY: '¥',
  EUR: '€',
};

export const SUBSCRIPTION_CATEGORY_PRESETS = [
  'AI·생산성',
  'OTT·콘텐츠',
  '클라우드·저장소',
  '멤버십·쇼핑',
  '음악',
  '운동·건강',
  '뉴스·독서',
  '기타',
] as const;

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: SubscriptionCurrency;
  billingCycle: BillingCycle;
  billingDay?: number | null;
  nextBillingDate?: string | null;
  status: SubscriptionStatus;
  category?: string | null;
  paymentMethod?: string | null;
  autoRenew: boolean;
  url?: string | null;
  note?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  backgroundColor: string | null;
  primary: boolean;
  accessRole: string;
}

export interface GoogleCalendarConnectionSummary {
  googleEmail: string;
  selectedCalendarIds: string[];
  pushCalendarId: string;
  calendarMeta: GoogleCalendarInfo[];
  syncEnabled: boolean;
  autoPushEvents: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

export interface GoogleCalendarStatus {
  configured: boolean;
  connected: boolean;
  redirectUri: string;
  connection: GoogleCalendarConnectionSummary | null;
}

export interface GoogleCalendarSyncResult {
  pulledCreated: number;
  pulledUpdated: number;
  pulledDeleted: number;
  pushedCreated: number;
  calendarsSynced: number;
  syncedAt: string;
}
