export interface GoalProgress {
  goalId: string;
  numeric?: { target: number; current: number; percent: number };
  habits?: {
    total: number;
    thisMonthLogs: number;
    expectedThisMonth: number;
    percent: number;
  };
  todos?: {
    total: number;
    done: number;
    postponed: number;
    delegated: number;
    cancelled: number;
    pending: number;
    percent: number;
  };
  timeInvested: { weekMin: number; monthMin: number; yearMin: number };
  overall: number;
}
