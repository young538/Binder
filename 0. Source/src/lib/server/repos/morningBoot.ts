import 'server-only';
import { and, asc, between, eq, inArray, isNotNull, lte, max } from 'drizzle-orm';
import { addDays, parseISO } from 'date-fns';
import { describeEventDday, isContactDue, nextAnnualOccurrence } from '@/lib/lifeEvents';
import type {
  MorningBootApplyInput,
  MorningBootApplyResult,
  MorningBootDuePerson,
  MorningBootProjectItem,
  MorningBootSnapshot,
  MorningBootUpcomingEvent,
} from '@/lib/morningBoot';
import { sortProjectTodos } from '@/lib/projects';
import type { BinderNote, LifeEvent, Person, Project, Todo } from '@/lib/types';
import { toIsoDate, toIsoWeek } from '@/lib/utils/date';
import type { BinderDatabase } from '../db/connection';
import { binderNotes, focusNotes, lifeEvents, people, projects, todos } from '../db/schema';

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

      const upcomingEvents: MorningBootUpcomingEvent[] = [];
      for (const ev of eventRows) {
        const dday = describeEventDday(ev, date);
        if (dday.daysLeft >= 0 && dday.daysLeft <= 3) {
          upcomingEvents.push({
            id: ev.id,
            title: ev.title,
            date: dday.targetDate,
            kind: ev.kind,
            daysLeft: dday.daysLeft,
            ...(ev.personId ? { personId: ev.personId } : {}),
          });
        }
      }
      for (const person of peopleRows) {
        if (!person.birthday) continue;
        const next = nextAnnualOccurrence(person.birthday.slice(5, 10), date);
        if (next.daysLeft >= 0 && next.daysLeft <= 3) {
          upcomingEvents.push({
            id: `bday:${person.id}`,
            title: `${person.name} 생일`,
            date: next.date,
            kind: 'birthday',
            daysLeft: next.daysLeft,
            personId: person.id,
          });
        }
      }
      upcomingEvents.sort((a, b) => a.daysLeft - b.daysLeft || a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

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
    const toToday = [...new Set(input.moveToTodayIds ?? [])];
    const toInbox = [...new Set(input.moveToInboxIds ?? [])];

    return this.database.transaction(tx => {
      const timestamp = this.now().toISOString();
      let movedToToday = 0;
      let movedToInbox = 0;

      if (toToday.length > 0) {
        const rows = (
          tx
            .select()
            .from(todos)
            .where(
              and(
                eq(todos.userId, this.userId),
                inArray(todos.id, toToday),
                inArray(todos.status, [...ACTIVE_STATUSES]),
              ),
            )
            .orderBy(asc(todos.scopeKey), asc(todos.order), asc(todos.id))
            .all() as Todo[]
        ).filter(row => !(row.scope === 'day' && row.scopeKey === input.targetDate));

        if (rows.length > 0) {
          const lastToday =
            tx
              .select({ order: max(todos.order) })
              .from(todos)
              .where(
                and(eq(todos.userId, this.userId), eq(todos.scope, 'day'), eq(todos.scopeKey, input.targetDate)),
              )
              .get()?.order ?? -1;

          rows.forEach((row, index) => {
            tx.update(todos)
              .set({
                scope: 'day',
                scopeKey: input.targetDate,
                order: lastToday + index + 1,
                updatedAt: timestamp,
              })
              .where(and(eq(todos.userId, this.userId), eq(todos.id, row.id)))
              .run();
          });
          movedToToday = rows.length;
        }
      }

      if (toInbox.length > 0) {
        const rows = (
          tx
            .select()
            .from(todos)
            .where(
              and(
                eq(todos.userId, this.userId),
                inArray(todos.id, toInbox),
                inArray(todos.status, [...ACTIVE_STATUSES]),
              ),
            )
            .orderBy(asc(todos.scopeKey), asc(todos.order), asc(todos.id))
            .all() as Todo[]
        ).filter(row => !(row.scope === 'inbox' && row.scopeKey === 'inbox'));

        if (rows.length > 0) {
          const lastInbox =
            tx
              .select({ order: max(todos.order) })
              .from(todos)
              .where(and(eq(todos.userId, this.userId), eq(todos.scope, 'inbox'), eq(todos.scopeKey, 'inbox')))
              .get()?.order ?? -1;

          rows.forEach((row, index) => {
            tx.update(todos)
              .set({
                scope: 'inbox',
                scopeKey: 'inbox',
                // Inbox TODOs cannot have repeat rules; clear when deferring back to inbox.
                repeatRule: null,
                order: lastInbox + index + 1,
                updatedAt: timestamp,
              })
              .where(and(eq(todos.userId, this.userId), eq(todos.id, row.id)))
              .run();
          });
          movedToInbox = rows.length;
        }
      }

      return { movedToToday, movedToInbox };
    }, { behavior: 'immediate' });
  }
}
