import 'server-only';
import { addDays, parseISO } from 'date-fns';
import { and, asc, between, eq, inArray, isNotNull, lte, or } from 'drizzle-orm';
import type {
  DashboardMetricItem,
  DashboardProjectItem,
  DashboardSnapshot,
  DashboardTodayEvent,
  DashboardUpcomingItem,
} from '@/lib/dashboard';
import { monthEndDate, prevMonthKey, summarizeMonthFinance } from '@/lib/finance';
import { annualOccurrenceForYear, describeEventDday, isContactDue, nextAnnualOccurrence } from '@/lib/lifeEvents';
import { sortMetricEntries, summarizeMetric } from '@/lib/metrics';
import { buildProjectOverview } from '@/lib/projects';
import { describeBillingDday, formatCurrency, summarizeSubscriptions } from '@/lib/subscriptions';
import type {
  BinderNote,
  DailyCheckin,
  FinanceBudget,
  FinanceTransaction,
  Habit,
  HabitLog,
  LifeEvent,
  LifeMetric,
  LifeMetricEntry,
  Person,
  Project,
  Subscription,
  TimeBlock,
  Todo,
} from '@/lib/types';
import { toIsoDate, toIsoWeek, weekDates } from '@/lib/utils/date';
import { computeHabitStatsForRange } from '@/lib/utils/habitSchedule';
import type { BinderDatabase } from '../db/connection';
import {
  binderNotes,
  dailyCheckins,
  financeBudgets,
  financeTransactions,
  focusNotes,
  googleCalendarConnections,
  habitLogs,
  habits,
  lifeEvents,
  metricEntries,
  metrics,
  people,
  projects,
  subscriptions,
  timeBlocks,
  todos,
} from '../db/schema';

const ACTIVE_TODO_STATUSES = ['pending', 'postponed'] as const;

/** User-scoped Life OS control-room snapshot aggregator. */
export class DashboardRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
  ) {}

  snapshot(date: string): DashboardSnapshot {
    const baseDate = parseISO(date);
    const isoWeek = toIsoWeek(baseDate);
    const yyyymm = date.slice(0, 7);
    const weekDays = weekDates(isoWeek);
    const weekStart = toIsoDate(weekDays[0]);
    const weekEnd = toIsoDate(weekDays[6]);
    const overdueStart = toIsoDate(addDays(baseDate, -7));
    const overdueEnd = toIsoDate(addDays(baseDate, -1));
    const yearNum = Number(date.slice(0, 4));

    return this.database.transaction(tx => {
      const highlightRow = tx
        .select({ text: focusNotes.text })
        .from(focusNotes)
        .where(
          and(
            eq(focusNotes.userId, this.userId),
            eq(focusNotes.scope, 'highlight'),
            eq(focusNotes.scopeKey, date),
          ),
        )
        .get();

      const checkinRow = tx
        .select()
        .from(dailyCheckins)
        .where(and(eq(dailyCheckins.userId, this.userId), eq(dailyCheckins.date, date)))
        .get() as DailyCheckin | undefined;

      const todayTodoRows = tx
        .select()
        .from(todos)
        .where(and(eq(todos.userId, this.userId), eq(todos.scope, 'day'), eq(todos.scopeKey, date)))
        .orderBy(asc(todos.order), asc(todos.id))
        .all() as Todo[];

      const overdueTodoRows = tx
        .select({ id: todos.id })
        .from(todos)
        .where(
          and(
            eq(todos.userId, this.userId),
            eq(todos.scope, 'day'),
            between(todos.scopeKey, overdueStart, overdueEnd),
            inArray(todos.status, [...ACTIVE_TODO_STATUSES]),
          ),
        )
        .all();

      const todayBlocks = tx
        .select()
        .from(timeBlocks)
        .where(and(eq(timeBlocks.userId, this.userId), eq(timeBlocks.date, date)))
        .all() as TimeBlock[];

      let planMin = 0;
      let actualMin = 0;
      for (const block of todayBlocks) {
        const dur = Math.max(0, block.endMin - block.startMin);
        if (block.kind === 'plan') planMin += dur;
        else if (block.kind === 'actual') actualMin += dur;
      }

      const habitRows = tx
        .select()
        .from(habits)
        .where(eq(habits.userId, this.userId))
        .orderBy(asc(habits.order), asc(habits.id))
        .all() as Habit[];

      const weekHabitLogs = tx
        .select()
        .from(habitLogs)
        .where(and(eq(habitLogs.userId, this.userId), between(habitLogs.date, weekStart, weekEnd)))
        .all() as HabitLog[];

      const weeklyHabitPercent = computeHabitStatsForRange(
        habitRows,
        weekHabitLogs,
        weekDays[0],
        weekDays[6],
      ).percent;

      const eventRows = tx
        .select()
        .from(lifeEvents)
        .where(eq(lifeEvents.userId, this.userId))
        .orderBy(asc(lifeEvents.date), asc(lifeEvents.startMin), asc(lifeEvents.id))
        .all() as LifeEvent[];

      const peopleRows = tx
        .select()
        .from(people)
        .where(eq(people.userId, this.userId))
        .orderBy(asc(people.order), asc(people.id))
        .all() as Person[];

      const subscriptionRows = tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, this.userId))
        .orderBy(asc(subscriptions.order), asc(subscriptions.name), asc(subscriptions.id))
        .all() as Subscription[];

      const todayEvents: DashboardTodayEvent[] = [];
      const upcomingItems: DashboardUpcomingItem[] = [];

      for (const ev of eventRows) {
        const isToday =
          ev.kind === 'anniversary'
            ? annualOccurrenceForYear(ev.date.slice(5, 10), yearNum) === date
            : ev.date <= date && (ev.endDate && ev.endDate >= ev.date ? ev.endDate : ev.date) >= date;

        if (isToday) {
          todayEvents.push({
            id: ev.id,
            title: ev.title,
            kind: ev.kind,
            allDay: Boolean(ev.allDay),
            startMin: ev.startMin ?? null,
            endMin: ev.endMin ?? null,
            color: ev.color ?? null,
            isGoogle: Boolean(ev.googleEventId),
          });
        }

        const dday = describeEventDday(ev, date);
        if (dday.daysLeft >= 0 && dday.daysLeft <= 7) {
          upcomingItems.push({
            id: ev.id,
            title: ev.title,
            kind: ev.kind,
            date: dday.targetDate,
            daysLeft: dday.daysLeft,
            label: dday.label,
            isGoogle: Boolean(ev.googleEventId),
          });
        }
      }

      todayEvents.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        const startDiff = (a.startMin ?? 0) - (b.startMin ?? 0);
        if (startDiff !== 0) return startDiff;
        return a.title.localeCompare(b.title);
      });

      let duePeopleCount = 0;
      for (const person of peopleRows) {
        if (isContactDue(person, date).due) {
          duePeopleCount++;
        }
        if (person.birthday) {
          const next = nextAnnualOccurrence(person.birthday.slice(5, 10), date);
          if (next.daysLeft >= 0 && next.daysLeft <= 7) {
            upcomingItems.push({
              id: `bday:${person.id}`,
              title: `${person.name} 생일`,
              kind: 'birthday',
              date: next.date,
              daysLeft: next.daysLeft,
              label: next.daysLeft === 0 ? '오늘' : `D-${next.daysLeft}`,
              isGoogle: false,
            });
          }
        }
      }

      for (const sub of subscriptionRows) {
        if (sub.status !== 'active' || !sub.nextBillingDate) continue;
        const billing = describeBillingDday(sub.nextBillingDate, date);
        if (billing.daysLeft >= 0 && billing.daysLeft <= 7) {
          upcomingItems.push({
            id: `sub:${sub.id}`,
            title: `💳 ${sub.name} (${formatCurrency(sub.amount, sub.currency)})`,
            kind: 'subscription',
            date: sub.nextBillingDate,
            daysLeft: billing.daysLeft,
            label: billing.label,
            isGoogle: false,
          });
        }
      }

      upcomingItems.sort(
        (a, b) => a.daysLeft - b.daysLeft || a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
      );

      const subscriptionSummary = summarizeSubscriptions(subscriptionRows, date);

      const activeProjectRows = tx
        .select()
        .from(projects)
        .where(and(eq(projects.userId, this.userId), eq(projects.status, 'active')))
        .orderBy(asc(projects.order), asc(projects.createdAt), asc(projects.id))
        .all() as Project[];

      const activeIds = activeProjectRows.map(p => p.id);
      const linkedTodos = activeIds.length
        ? (tx
            .select()
            .from(todos)
            .where(and(eq(todos.userId, this.userId), inArray(todos.projectId, activeIds)))
            .all() as Todo[])
        : [];
      const linkedTodoIds = linkedTodos.map(t => t.id);

      const projectActualBlocks = activeIds.length
        ? (tx
            .select()
            .from(timeBlocks)
            .where(
              and(
                eq(timeBlocks.userId, this.userId),
                eq(timeBlocks.kind, 'actual'),
                linkedTodoIds.length > 0
                  ? or(inArray(timeBlocks.projectId, activeIds), inArray(timeBlocks.todoId, linkedTodoIds))
                  : inArray(timeBlocks.projectId, activeIds),
              ),
            )
            .all() as TimeBlock[])
        : [];

      const projectOverview = buildProjectOverview(activeProjectRows, linkedTodos, projectActualBlocks);
      const activeProjects: DashboardProjectItem[] = projectOverview.map(item => ({
        project: item.project,
        totalTodos: item.totalTodos,
        doneTodos: item.doneTodos,
        activeTodos: item.activeTodos,
        progressPercent: item.totalTodos > 0 ? Math.round((item.doneTodos / item.totalTodos) * 100) : 0,
        actualMinutes: item.actualMinutes,
        needsNextAction: item.needsNextAction,
      }));

      const dueDecisionRows = tx
        .select()
        .from(binderNotes)
        .where(
          and(
            eq(binderNotes.userId, this.userId),
            eq(binderNotes.kind, 'decision'),
            isNotNull(binderNotes.reviewDate),
            lte(binderNotes.reviewDate, date),
          ),
        )
        .all() as BinderNote[];
      const dueDecisionsCount = dueDecisionRows.filter(
        note => !note.decisionOutcome || !note.decisionOutcome.trim(),
      ).length;

      const metricRows = tx
        .select()
        .from(metrics)
        .where(eq(metrics.userId, this.userId))
        .orderBy(asc(metrics.order), asc(metrics.createdAt), asc(metrics.id))
        .all() as LifeMetric[];

      const limitedMetrics = metricRows.slice(0, 6);
      const metricIds = limitedMetrics.map(m => m.id);
      const metricEntryRows = metricIds.length
        ? (tx
            .select()
            .from(metricEntries)
            .where(and(eq(metricEntries.userId, this.userId), inArray(metricEntries.metricId, metricIds)))
            .orderBy(asc(metricEntries.date), asc(metricEntries.id))
            .all() as LifeMetricEntry[])
        : [];

      const entriesByMetric = new Map<string, LifeMetricEntry[]>();
      for (const entry of metricEntryRows) {
        const list = entriesByMetric.get(entry.metricId);
        if (list) list.push(entry);
        else entriesByMetric.set(entry.metricId, [entry]);
      }

      const dashboardMetrics: DashboardMetricItem[] = limitedMetrics.map(metric => {
        const sortedEntries = sortMetricEntries(entriesByMetric.get(metric.id) ?? []);
        return {
          metric,
          entries: sortedEntries,
          summary: summarizeMetric(metric, sortedEntries),
        };
      });

      const googleConn = tx
        .select({
          googleEmail: googleCalendarConnections.googleEmail,
          syncEnabled: googleCalendarConnections.syncEnabled,
          lastSyncedAt: googleCalendarConnections.lastSyncedAt,
          lastSyncError: googleCalendarConnections.lastSyncError,
        })
        .from(googleCalendarConnections)
        .where(eq(googleCalendarConnections.userId, this.userId))
        .get();

      const prevYyyymm = prevMonthKey(yyyymm);
      const financeTxRows = tx
        .select()
        .from(financeTransactions)
        .where(
          and(
            eq(financeTransactions.userId, this.userId),
            between(financeTransactions.date, `${prevYyyymm}-01`, monthEndDate(yyyymm)),
          ),
        )
        .all() as FinanceTransaction[];

      const financeBudgetRows = tx
        .select()
        .from(financeBudgets)
        .where(
          and(
            eq(financeBudgets.userId, this.userId),
            or(eq(financeBudgets.yyyymm, 'default'), eq(financeBudgets.yyyymm, yyyymm)),
          ),
        )
        .all() as FinanceBudget[];

      const monthFinance = summarizeMonthFinance(
        financeTxRows.filter(t => t.date.startsWith(yyyymm)),
        financeBudgetRows,
        financeTxRows.filter(t => t.date.startsWith(prevYyyymm)),
        yyyymm,
        date,
      );

      const countableTodayTodos = todayTodoRows.filter(t => t.status !== 'cancelled');
      const doneTodayCount = countableTodayTodos.filter(t => t.status === 'done').length;
      const pendingTodayCount = countableTodayTodos.filter(
        t => t.status === 'pending' || t.status === 'postponed',
      ).length;

      return {
        date,
        isoWeek,
        yyyymm,
        highlight: highlightRow?.text ?? '',
        todayCheckin: checkinRow ?? null,
        todayTodos: {
          done: doneTodayCount,
          pending: pendingTodayCount,
          total: countableTodayTodos.length,
          items: countableTodayTodos.slice(0, 10),
        },
        todayTime: {
          planMin,
          actualMin,
        },
        weeklyHabitPercent,
        todayEvents,
        upcomingItems: upcomingItems.slice(0, 12),
        activeProjects: activeProjects.slice(0, 6),
        subscriptionSummary,
        monthFinance,
        metrics: dashboardMetrics,
        attention: {
          overdueTodosCount: overdueTodoRows.length,
          projectsWithoutNextAction: activeProjects.filter(p => p.needsNextAction).length,
          duePeopleCount,
          dueDecisionsCount,
          upcomingBillsCount: subscriptionSummary.upcomingWithin7Days.length,
        },
        googleCalendar: {
          connected: Boolean(googleConn),
          googleEmail: googleConn?.googleEmail ?? null,
          lastSyncedAt: googleConn?.lastSyncedAt ?? null,
          lastSyncError: googleConn?.lastSyncError ?? null,
        },
      };
    });
  }
}
