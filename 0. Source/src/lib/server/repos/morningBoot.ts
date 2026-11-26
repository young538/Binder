import 'server-only';
import { and, asc, between, eq, inArray, isNotNull, lte } from 'drizzle-orm';
import { addDays, parseISO } from 'date-fns';
import { isContactDue } from '@/lib/lifeEvents';
import type {
  MorningBootApplyInput,
  MorningBootApplyResult,
  MorningBootDuePerson,
  MorningBootProjectItem,
  MorningBootSnapshot,
  MorningBootUpcomingEvent,
} from '@/lib/morningBoot';
import { sortProjectTodos } from '@/lib/projects';
import { upcomingItemsFor } from '@/lib/upcomingItems';
import type { BinderNote, LifeEvent, Person, Project, Subscription, Todo } from '@/lib/types';
import { toIsoDate, toIsoWeek } from '@/lib/utils/date';
import { moveActiveTodos } from '../todos/move';
import type { BinderDatabase } from '../db/connection';
import { binderNotes, focusNotes, lifeEvents, people, projects, subscriptions, todos } from '../db/schema';

const ACTIVE_STATUSES = ['pending', 'postponed'] as const;

/** Aggregates today's Morning Boot context and performs atomic batch scheduling moves. */
export class MorningBootRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  snapshot(date: string): MorningBootSnapshot {
    const baseDate = parseISO(date);
    const overdueStart = toIsoDate(addDays(baseDate, -7));
    const overdueEnd = toIsoDate(addDays(baseDate, -1));
    const isoWeek = toIsoWeek(baseDate);

    return this.database.transaction(tx => {
      const overdueTodos = tx
        .select()
        .from(todos)
        .where(
          and(
            eq(todos.userId, this.userId),
            eq(todos.scope, 'day'),
            between(todos.scopeKey, overdueStart, overdueEnd),
            inArray(todos.status, [...ACTIVE_STATUSES]),
          ),
        )
        .orderBy(asc(todos.scopeKey), asc(todos.order), asc(todos.id))
        .all() as Todo[];

      const todayTodos = tx
        .select()
        .from(todos)
        .where(and(eq(todos.userId, this.userId), eq(todos.scope, 'day'), eq(todos.scopeKey, date)))
        .orderBy(asc(todos.order), asc(todos.id))
        .all() as Todo[];

      const weekTodos = tx
        .select()
        .from(todos)
        .where(
          and(
            eq(todos.userId, this.userId),
            eq(todos.scope, 'week'),
            eq(todos.scopeKey, isoWeek),
            inArray(todos.status, [...ACTIVE_STATUSES]),
          ),
        )
        .orderBy(asc(todos.order), asc(todos.id))
        .all() as Todo[];

      const inboxTodos = tx
        .select()
        .from(todos)
        .where(
          and(
            eq(todos.userId, this.userId),
            eq(todos.scope, 'inbox'),
            eq(todos.scopeKey, 'inbox'),
            inArray(todos.status, [...ACTIVE_STATUSES]),
          ),
        )
        .orderBy(asc(todos.order), asc(todos.id))
        .all() as Todo[];

      const activeProjectRows = tx
        .select()
        .from(projects)
        .where(and(eq(projects.userId, this.userId), eq(projects.status, 'active')))
        .orderBy(asc(projects.order), asc(projects.createdAt), asc(projects.id))
        .all() as Project[];

      const activeProjectIds = activeProjectRows.map(item => item.id);
      const projectTodos = activeProjectIds.length
        ? (tx
            .select()
            .from(todos)
            .where(and(eq(todos.userId, this.userId), inArray(todos.projectId, activeProjectIds)))
            .all() as Todo[])
        : [];

      const activeProjects: MorningBootProjectItem[] = activeProjectRows.map(project => {
        const linked = projectTodos.filter(item => item.projectId === project.id);
        const activeAll = linked.filter(item => item.status === 'pending' || item.status === 'postponed');
        const candidateTodos = sortProjectTodos(
          activeAll.filter(item => !(item.scope === 'day' && item.scopeKey === date)),
        );
        const todayCount = linked.filter(
          item => item.scope === 'day' && item.scopeKey === date && item.status !== 'cancelled',
        ).length;
        return {
          project,
          candidateTodos,
          todayCount,
          needsNextAction: activeAll.length === 0,
        };
      });

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

      const eventRows = tx
        .select()
        .from(lifeEvents)
        .where(eq(lifeEvents.userId, this.userId))
        .orderBy(asc(lifeEvents.date), asc(lifeEvents.id))
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
        .where(and(eq(subscriptions.userId, this.userId), eq(subscriptions.status, 'active')))
        .orderBy(asc(subscriptions.order), asc(subscriptions.id))
        .all() as Subscription[];

      const upcomingEvents: MorningBootUpcomingEvent[] = upcomingItemsFor(
        date, 3, eventRows, peopleRows, subscriptionRows, (name, price) => `💳 ${name} 결제 (${price})`,
      ).map(({ id, title, kind, date, daysLeft, personId, subscriptionId }) => ({
        id, title, kind, date, daysLeft, personId, subscriptionId,
      }));

      const duePeople: MorningBootDuePerson[] = [];
      for (const person of peopleRows) {
        const status = isContactDue(person, date);
        if (status.due) {
          duePeople.push({
            id: person.id,
            name: person.name,
            relationship: person.relationship ?? null,
            daysSince: status.daysSince,
            overdueDays: status.overdueDays,
          });
        }
      }
      duePeople.sort((a, b) => b.overdueDays - a.overdueDays || a.name.localeCompare(b.name));

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
        .orderBy(asc(binderNotes.reviewDate), asc(binderNotes.id))
        .all() as BinderNote[];
      const dueDecisions = dueDecisionRows.filter(note => !note.decisionOutcome || !note.decisionOutcome.trim());

      return {
        date,
        isoWeek,
        overdueTodos,
        todayTodos,
        weekTodos,
        inboxTodos,
        activeProjects,
        highlight: highlightRow?.text ?? '',
        upcomingEvents,
        duePeople,
        dueDecisions,
      };
    });
  }

  apply(input: MorningBootApplyInput): MorningBootApplyResult {
    return this.database.transaction(tx => {
      const timestamp = this.now().toISOString();
      const movedToToday = moveActiveTodos(tx, this.userId, {
        ids: input.moveToTodayIds, destination: { day: input.targetDate }, orderByScopeKey: true,
      }, timestamp);
      const movedToInbox = moveActiveTodos(tx, this.userId, {
        ids: input.moveToInboxIds, destination: 'inbox', orderByScopeKey: true,
      }, timestamp);
      return { movedToToday, movedToInbox };
    }, { behavior: 'immediate' });
  }
}
