import type { DailyCheckin, Retrospective, TimeBlock, Todo } from './types';

export interface EveningShutdownSnapshot {
  date: string;
  unconfirmedPlans: TimeBlock[];
  actualMinutes: number;
  openTodayTodos: Todo[];
  doneCount: number;
  totalCount: number;
  checkin: DailyCheckin | null;
  retrospective: Retrospective | null;
}

export interface EveningShutdownApplyInput {
  date: string;
  confirmBlockIds?: string[];
  rolloverTodoIds?: string[];
  inboxTodoIds?: string[];
}

export interface EveningShutdownApplyResult {
  confirmedBlocks: number;
  rolledOverTodos: number;
  movedToInbox: number;
}
