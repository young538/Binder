import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { addDays, parseISO } from 'date-fns';
import type { EveningShutdownApplyInput, EveningShutdownApplyResult, EveningShutdownSnapshot } from '@/lib/eveningShutdown';
import type { DailyCheckin, Retrospective, TimeBlock, Todo } from '@/lib/types';
import { toIsoDate } from '@/lib/utils/date';
import { confirmPlans } from './timeBlocks';
import { unconfirmedPlansForDay } from '@/lib/time-grid/confirmation';
import { moveActiveTodos } from '../todos/move';
import type { BinderDatabase } from '../db/connection';
import { dailyCheckins, retrospectives, timeBlocks, todos } from '../db/schema';

/** Aggregates today's Evening Shutdown context and executes atomic closing actions. */
export class EveningShutdownRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  snapshot(date: string): EveningShutdownSnapshot {
    return this.database.transaction(tx => {
      const blocks = tx
        .select()
        .from(timeBlocks)
        .where(and(eq(timeBlocks.userId, this.userId), eq(timeBlocks.date, date)))
        .orderBy(asc(timeBlocks.startMin), asc(timeBlocks.endMin), asc(timeBlocks.id))
        .all() as TimeBlock[];

      const actualBlocks = blocks.filter(b => b.kind === 'actual');
      const unconfirmedPlans = unconfirmedPlansForDay(blocks);
      const actualMinutes = actualBlocks.reduce((sum, b) => sum + Math.max(0, b.endMin - b.startMin), 0);

      const todayTodos = tx
        .select()
        .from(todos)
        .where(and(eq(todos.userId, this.userId), eq(todos.scope, 'day'), eq(todos.scopeKey, date)))
        .orderBy(asc(todos.order), asc(todos.id))
        .all() as Todo[];

      const openTodayTodos = todayTodos.filter(t => t.status === 'pending' || t.status === 'postponed');
      const doneCount = todayTodos.filter(t => t.status === 'done').length;
      const totalCount = todayTodos.filter(t => t.status !== 'cancelled').length;

      const checkin = (tx
        .select()
        .from(dailyCheckins)
        .where(and(eq(dailyCheckins.userId, this.userId), eq(dailyCheckins.date, date)))
        .get() as DailyCheckin | undefined) ?? null;

      const retrospective = (tx
        .select()
        .from(retrospectives)
        .where(
          and(
            eq(retrospectives.userId, this.userId),
            eq(retrospectives.type, 'daily'),
            eq(retrospectives.dateOrWeek, date),
          ),
        )
        .get() as Retrospective | undefined) ?? null;

      return {
        date,
        unconfirmedPlans,
        actualMinutes,
        openTodayTodos,
        doneCount,
        totalCount,
        checkin,
        retrospective,
      };
    });
  }

  apply(input: EveningShutdownApplyInput): EveningShutdownApplyResult {
    const nextDate = toIsoDate(addDays(parseISO(input.date), 1));

    return this.database.transaction(tx => {
      const timestamp = this.now().toISOString();
      const confirmedBlocks = confirmPlans(tx, this.userId, input.date, input.confirmBlockIds ?? [], timestamp);
      const rolledOverTodos = moveActiveTodos(tx, this.userId, {
        ids: input.rolloverTodoIds, destination: { day: nextDate },
      }, timestamp);
      const movedToInbox = moveActiveTodos(tx, this.userId, {
        ids: input.inboxTodoIds, destination: 'inbox',
      }, timestamp);
      return { confirmedBlocks, rolledOverTodos, movedToInbox };
    }, { behavior: 'immediate' });
  }
}
