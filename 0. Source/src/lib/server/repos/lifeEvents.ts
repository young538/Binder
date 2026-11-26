import 'server-only';
import { and, asc, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { MappedGoogleEvent } from '@/lib/googleCalendar';
import type { ParsedIcsEvent } from '@/lib/ics';
import type { LifeEvent } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import type { BinderDatabase } from '../db/connection';
import { stripUndefined } from '../db/patch';
import { googleCalendarConnections, googleEventDeletions, googleEventUpdates, lifeEvents } from '../db/schema';

export type GoogleEventDeletion = Omit<typeof googleEventDeletions.$inferSelect, 'userId'>;
type CalendarReadVersion = { googleEmail: string; eventSyncRevision: number };

type NewLifeEvent = Omit<LifeEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
type LifeEventPatch = Partial<NewLifeEvent>;

/** User-scoped life events, D-Days, anniversaries, and idempotent .ics imports. */
export class LifeEventRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(filters?: { startDate?: string; endDate?: string }): LifeEvent[] {
    const rows = this.database
      .select()
      .from(lifeEvents)
      .where(eq(lifeEvents.userId, this.userId))
      .orderBy(asc(lifeEvents.date), asc(lifeEvents.startMin), asc(lifeEvents.id))
      .all() as LifeEvent[];

    if (!filters?.startDate && !filters?.endDate) return rows;
    const start = filters.startDate ?? '0000-01-01';
    const end = filters.endDate ?? '9999-12-31';
    return rows.filter(row => {
      if (row.kind === 'anniversary') return true;
      const rowEnd = row.endDate && row.endDate >= row.date ? row.endDate : row.date;
      return row.date <= end && rowEnd >= start;
    });
  }

  getById(id: string): LifeEvent | null {
    const row = this.database
      .select()
      .from(lifeEvents)
      .where(and(eq(lifeEvents.userId, this.userId), eq(lifeEvents.id, id)))
      .get();
    return (row as LifeEvent | undefined) ?? null;
  }

  create(data: NewLifeEvent): LifeEvent {
    const timestamp = this.now().toISOString();
    const row: LifeEvent = {
      ...data,
      googleCalendarId: data.googleCalendarId ?? null,
      googleEventId: data.googleEventId ?? null,
      googleUpdatedAt: data.googleUpdatedAt ?? null,
      id: newId(),
      userId: this.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.insert(lifeEvents).values(row).run();
    return row;
  }

  update(id: string, patch: LifeEventPatch): LifeEvent | null {
    const predicate = and(eq(lifeEvents.userId, this.userId), eq(lifeEvents.id, id));
    return this.database.transaction(tx => {
      const event = tx.update(lifeEvents).set({ ...stripUndefined(patch), updatedAt: this.now().toISOString() })
        .where(predicate).returning().get() as LifeEvent | undefined;
      if (!event?.googleCalendarId || !event.googleEventId) return event ?? null;
      const connection = tx.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, this.userId)).get();
      if (!connection) return event;
      const calendar = connection.calendarMeta.find(c => c.id === event.googleCalendarId);
      if (calendar && calendar.accessRole !== 'owner' && calendar.accessRole !== 'writer') return event;

      const revision = newId();
      tx.insert(googleEventUpdates).values({ userId: this.userId, localId: id, googleEmail: connection.googleEmail, revision })
        .onConflictDoUpdate({ target: googleEventUpdates.localId, set: { revision, googleEmail: connection.googleEmail } }).run();
      tx.update(googleCalendarConnections).set({ eventSyncRevision: sql`event_deletion_revision + 1` })
        .where(eq(googleCalendarConnections.userId, this.userId)).run();
      return event;
    }, { behavior: 'immediate' });
  }

  delete(id: string): GoogleEventDeletion | null {
    return this.database.transaction(tx => {
      const event = tx.delete(lifeEvents)
        .where(and(eq(lifeEvents.userId, this.userId), eq(lifeEvents.id, id))).returning().get();
      if (!event?.googleEventId || !event.googleCalendarId) return null;
      const connection = tx.select({
        googleEmail: googleCalendarConnections.googleEmail, calendarMeta: googleCalendarConnections.calendarMeta,
      }).from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, this.userId)).get();
      if (!connection) return null;
      const calendar = connection.calendarMeta.find(entry => entry.id === event.googleCalendarId);
      if (calendar && calendar.accessRole !== 'owner' && calendar.accessRole !== 'writer') return null;

      const deletion = { googleEmail: connection.googleEmail, calendarId: event.googleCalendarId, eventId: event.googleEventId };
      tx.insert(googleEventDeletions).values({ userId: this.userId, ...deletion }).onConflictDoNothing().run();
      tx.update(googleCalendarConnections).set({ eventSyncRevision: sql`event_deletion_revision + 1` })
        .where(eq(googleCalendarConnections.userId, this.userId)).run();
      return deletion;
    }, { behavior: 'immediate' });
  }

  pendingGoogleDeletions(googleEmail: string): GoogleEventDeletion[] {
    return this.database.select().from(googleEventDeletions).where(and(
      eq(googleEventDeletions.userId, this.userId), eq(googleEventDeletions.googleEmail, googleEmail),
    )).all();
  }

  completeGoogleDeletion({ googleEmail, calendarId, eventId }: GoogleEventDeletion): void {
    this.database.transaction(tx => {
      const removed = tx.delete(googleEventDeletions).where(and(
        eq(googleEventDeletions.userId, this.userId), eq(googleEventDeletions.googleEmail, googleEmail),
        eq(googleEventDeletions.calendarId, calendarId), eq(googleEventDeletions.eventId, eventId),
      )).run();
      if (removed.changes) {
        tx.update(googleCalendarConnections).set({ eventSyncRevision: sql`event_deletion_revision + 1` })
          .where(and(eq(googleCalendarConnections.userId, this.userId), eq(googleCalendarConnections.googleEmail, googleEmail))).run();
      }
    }, { behavior: 'immediate' });
  }

  pendingGoogleUpdates(email: string) {
    return this.database.select({ id: lifeEvents.id, calendarId: lifeEvents.googleCalendarId, eventId: lifeEvents.googleEventId })
      .from(googleEventUpdates).innerJoin(lifeEvents, eq(lifeEvents.id, googleEventUpdates.localId))
      .where(and(eq(googleEventUpdates.userId, this.userId), eq(googleEventUpdates.googleEmail, email))).all();
  }

  claimGoogleUpdate(email: string, localId: string) {
    return this.database.transaction(tx => {
      const now = this.now();
      const lease = newId();
      // Recover an abandoned send after the HTTP client's 12-second timeout.
      const job = tx.update(googleEventUpdates).set({ lease, leaseExpiresAt: new Date(now.getTime() + 60_000).toISOString() })
        .where(and(eq(googleEventUpdates.userId, this.userId), eq(googleEventUpdates.googleEmail, email),
          eq(googleEventUpdates.localId, localId), sql`(lease IS NULL OR lease_expires_at <= ${now.toISOString()})`))
        .returning().get();
      if (!job) return null;
      const event = tx.select().from(lifeEvents).where(and(eq(lifeEvents.userId, this.userId), eq(lifeEvents.id, localId))).get() as LifeEvent;
      return { event, job };
    }, { behavior: 'immediate' });
  }

  finishGoogleUpdate(job: typeof googleEventUpdates.$inferSelect, result?: { updated: string | null }): void {
    this.database.transaction(tx => {
      const claim = and(eq(googleEventUpdates.userId, this.userId), eq(googleEventUpdates.localId, job.localId),
        eq(googleEventUpdates.googleEmail, job.googleEmail), eq(googleEventUpdates.lease, job.lease!));
      if (result && tx.delete(googleEventUpdates).where(and(claim, eq(googleEventUpdates.revision, job.revision))).run().changes) {
        tx.update(lifeEvents).set({ googleUpdatedAt: result.updated }).where(eq(lifeEvents.id, job.localId)).run();
        tx.update(googleCalendarConnections).set({ eventSyncRevision: sql`event_deletion_revision + 1` })
          .where(eq(googleCalendarConnections.userId, this.userId)).run();
      } else {
        // Newer edits retain their revision and are sent on the next attempt.
        tx.update(googleEventUpdates).set({ lease: null, leaseExpiresAt: null }).where(claim).run();
      }
    }, { behavior: 'immediate' });
  }

  importIcsEvents(parsed: ParsedIcsEvent[]): { imported: number; updated: number; total: number } {
    return this.database.transaction(tx => {
      const existingRows = tx
        .select()
        .from(lifeEvents)
        .where(and(eq(lifeEvents.userId, this.userId), isNotNull(lifeEvents.externalUid)))
        .all() as LifeEvent[];

      const byUid = new Map<string, LifeEvent>();
      for (const row of existingRows) {
        if (row.externalUid) byUid.set(row.externalUid, row);
      }

      const timestamp = this.now().toISOString();
      let imported = 0;
      let updated = 0;

      for (const item of parsed) {
        const existing = byUid.get(item.externalUid);
        if (existing) {
          const next = tx
            .update(lifeEvents)
            .set({
              title: item.title,
              date: item.date,
              endDate: item.endDate,
              allDay: item.allDay,
              startMin: item.startMin,
              endMin: item.endMin,
              note: item.note,
              updatedAt: timestamp,
            })
            .where(and(eq(lifeEvents.userId, this.userId), eq(lifeEvents.id, existing.id)))
            .returning()
            .get() as LifeEvent;
          byUid.set(item.externalUid, next);
          updated++;
        } else {
          const created: LifeEvent = {
            id: newId(),
            userId: this.userId,
            title: item.title,
            date: item.date,
            endDate: item.endDate,
            kind: 'event',
            allDay: item.allDay,
            startMin: item.startMin,
            endMin: item.endMin,
            color: null,
            personId: null,
            projectId: null,
            goalId: null,
            externalUid: item.externalUid,
            googleCalendarId: null,
            googleEventId: null,
            googleUpdatedAt: null,
            note: item.note,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          tx.insert(lifeEvents).values(created).run();
          byUid.set(item.externalUid, created);
          imported++;
        }
      }

      return { imported, updated, total: parsed.length };
    }, { behavior: 'immediate' });
  }

  setGoogleLink(
    id: string,
    link: { googleCalendarId: string; googleEventId: string; googleUpdatedAt: string | null },
  ): LifeEvent | null {
    const predicate = and(eq(lifeEvents.userId, this.userId), eq(lifeEvents.id, id));
    const existing = this.database.select().from(lifeEvents).where(predicate).get() as LifeEvent | undefined;
    if (!existing) return null;
    const timestamp = this.now().toISOString();
    return this.database
      .update(lifeEvents)
      .set({
        googleCalendarId: link.googleCalendarId,
        googleEventId: link.googleEventId,
        googleUpdatedAt: link.googleUpdatedAt,
        externalUid: `gcal:${link.googleCalendarId}:${link.googleEventId}`,
        updatedAt: timestamp,
      })
      .where(predicate)
      .returning()
      .get() as LifeEvent;
  }

  listUnpushedEvents(startDate: string): LifeEvent[] {
    return this.database
      .select()
      .from(lifeEvents)
      .where(
        and(
          eq(lifeEvents.userId, this.userId),
          eq(lifeEvents.kind, 'event'),
          isNull(lifeEvents.googleEventId),
          isNull(lifeEvents.externalUid),
          gte(lifeEvents.date, startDate),
        ),
      )
      .orderBy(asc(lifeEvents.date), asc(lifeEvents.id))
      .all() as LifeEvent[];
  }

  reconcileGoogleCalendarWindow(
    calendarId: string,
    startDate: string,
    endDate: string,
    mappedEvents: MappedGoogleEvent[],
    readVersion?: CalendarReadVersion,
    sentUpdates: ReadonlySet<string> = new Set(),
  ): { created: number; updated: number; deleted: number } | null {
    return this.database.transaction(tx => {
      const connection = tx.select({
        googleEmail: googleCalendarConnections.googleEmail,
        eventSyncRevision: googleCalendarConnections.eventSyncRevision,
      }).from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, this.userId)).get();
      // A delete may have been queued and acknowledged while listEvents was in flight.
      if (readVersion && (readVersion.googleEmail !== connection?.googleEmail ||
          readVersion.eventSyncRevision !== connection.eventSyncRevision)) return null;
      const pending = connection ? tx.select({ id: googleEventDeletions.eventId }).from(googleEventDeletions)
        .where(and(eq(googleEventDeletions.userId, this.userId), eq(googleEventDeletions.googleEmail, connection.googleEmail),
          eq(googleEventDeletions.calendarId, calendarId))).all() : [];
      const deletedIds = new Set(pending.map(row => row.id));
      const existingRows = tx
        .select()
        .from(lifeEvents)
        .where(
          and(
            eq(lifeEvents.userId, this.userId),
            eq(lifeEvents.googleCalendarId, calendarId),
            isNotNull(lifeEvents.googleEventId),
          ),
        )
        .all() as LifeEvent[];

      const byGoogleId = new Map<string, LifeEvent>();
      for (const row of existingRows) {
        if (row.googleEventId) byGoogleId.set(row.googleEventId, row);
      }

      const timestamp = this.now().toISOString();
      const protectedIds = new Set(sentUpdates);
      if (connection) {
        for (const update of this.pendingGoogleUpdates(connection.googleEmail)) {
          if (update.calendarId === calendarId && update.eventId) protectedIds.add(update.eventId);
        }
      }
      const seenGoogleIds = new Set(protectedIds);
      let created = 0;
      let updated = 0;

      for (const item of mappedEvents) {
        if (deletedIds.has(item.googleEventId) || protectedIds.has(item.googleEventId)) continue;
        seenGoogleIds.add(item.googleEventId);
        const existing = byGoogleId.get(item.googleEventId);
        if (existing) {
          const next = tx
            .update(lifeEvents)
            .set({
              title: item.title,
              date: item.date,
              endDate: item.endDate,
              allDay: item.allDay,
              startMin: item.startMin,
              endMin: item.endMin,
              color: item.color,
              note: item.note,
              externalUid: item.externalUid,
              googleUpdatedAt: item.googleUpdatedAt,
              updatedAt: timestamp,
            })
            .where(and(eq(lifeEvents.userId, this.userId), eq(lifeEvents.id, existing.id)))
            .returning()
            .get() as LifeEvent;
          byGoogleId.set(item.googleEventId, next);
          updated++;
        } else {
          const inserted: LifeEvent = {
            id: newId(),
            userId: this.userId,
            title: item.title,
            date: item.date,
            endDate: item.endDate,
            kind: 'event',
            allDay: item.allDay,
            startMin: item.startMin,
            endMin: item.endMin,
            color: item.color,
            personId: null,
            projectId: null,
            goalId: null,
            externalUid: item.externalUid,
            googleCalendarId: item.googleCalendarId,
            googleEventId: item.googleEventId,
            googleUpdatedAt: item.googleUpdatedAt,
            note: item.note,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          tx.insert(lifeEvents).values(inserted).run();
          byGoogleId.set(item.googleEventId, inserted);
          created++;
        }
      }

      const deleteIds = existingRows
        .filter(
          row =>
            row.googleEventId &&
            !seenGoogleIds.has(row.googleEventId) &&
            row.date >= startDate &&
            row.date <= endDate,
        )
        .map(row => row.id);

      let deleted = 0;
      if (deleteIds.length > 0) {
        const res = tx
          .delete(lifeEvents)
          .where(and(eq(lifeEvents.userId, this.userId), inArray(lifeEvents.id, deleteIds)))
          .run();
        deleted = res.changes;
      }

      return { created, updated, deleted };
    }, { behavior: 'immediate' });
  }

  deleteGoogleSyncedEvents(): number {
    const res = this.database
      .delete(lifeEvents)
      .where(and(eq(lifeEvents.userId, this.userId), isNotNull(lifeEvents.googleEventId)))
      .run();
    return res.changes;
  }
}
