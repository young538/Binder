import 'server-only';
import { eq } from 'drizzle-orm';
import type { GoogleCalendarConnectionSummary, GoogleCalendarInfo } from '@/lib/types';
import type { BinderDatabase } from '../db/connection';
import { googleCalendarConnections } from '../db/schema';

export interface GoogleCalendarConnectionRow {
  userId: string;
  googleEmail: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  tokenExpiresAt: string;
  selectedCalendarIds: string[];
  pushCalendarId: string;
  calendarMeta: GoogleCalendarInfo[];
  syncEnabled: boolean;
  autoPushEvents: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toGoogleConnectionSummary(
  row: GoogleCalendarConnectionRow,
): GoogleCalendarConnectionSummary {
  return {
    googleEmail: row.googleEmail,
    selectedCalendarIds: row.selectedCalendarIds,
    pushCalendarId: row.pushCalendarId,
    calendarMeta: row.calendarMeta,
    syncEnabled: row.syncEnabled,
    autoPushEvents: row.autoPushEvents,
    lastSyncedAt: row.lastSyncedAt,
    lastSyncError: row.lastSyncError,
  };
}

/** User-scoped storage for encrypted Google OAuth credentials and sync preferences. */
export class GoogleCalendarConnectionRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get(): GoogleCalendarConnectionRow | null {
    const row = this.database
      .select()
      .from(googleCalendarConnections)
      .where(eq(googleCalendarConnections.userId, this.userId))
      .get();
    return (row as GoogleCalendarConnectionRow | undefined) ?? null;
  }

  getSummary(): GoogleCalendarConnectionSummary | null {
    const row = this.get();
    return row ? toGoogleConnectionSummary(row) : null;
  }

  upsert(input: {
    googleEmail: string;
    accessTokenEnc: string;
    refreshTokenEnc: string;
    tokenExpiresAt: string;
    calendarMeta: GoogleCalendarInfo[];
    selectedCalendarIds?: string[];
    pushCalendarId?: string;
  }): GoogleCalendarConnectionRow {
    const existing = this.get();
    const timestamp = this.now().toISOString();
    const availableIds = new Set(input.calendarMeta.map(c => c.id));
    const primaryCal = input.calendarMeta.find(c => c.primary) ?? input.calendarMeta[0];
    const writableCal =
      input.calendarMeta.find(
        c => c.primary && (c.accessRole === 'owner' || c.accessRole === 'writer'),
      ) ??
      input.calendarMeta.find(c => c.accessRole === 'owner' || c.accessRole === 'writer') ??
      primaryCal;

    const retainedSelected = existing?.selectedCalendarIds.filter(id => availableIds.has(id)) ?? [];
    const selectedCalendarIds =
      input.selectedCalendarIds ??
      (retainedSelected.length > 0
        ? retainedSelected
        : primaryCal
          ? [primaryCal.id]
          : []);

    const retainedPush =
      existing && availableIds.has(existing.pushCalendarId) ? existing.pushCalendarId : undefined;
    const pushCalendarId =
      input.pushCalendarId ?? retainedPush ?? writableCal?.id ?? 'primary';

    if (existing) {
      return this.database
        .update(googleCalendarConnections)
        .set({
          googleEmail: input.googleEmail,
          accessTokenEnc: input.accessTokenEnc,
          refreshTokenEnc: input.refreshTokenEnc,
          tokenExpiresAt: input.tokenExpiresAt,
          selectedCalendarIds,
          pushCalendarId,
          calendarMeta: input.calendarMeta,
          syncEnabled: true,
          lastSyncError: null,
          updatedAt: timestamp,
        })
        .where(eq(googleCalendarConnections.userId, this.userId))
        .returning()
        .get() as GoogleCalendarConnectionRow;
    }

    const created: GoogleCalendarConnectionRow = {
      userId: this.userId,
      googleEmail: input.googleEmail,
      accessTokenEnc: input.accessTokenEnc,
      refreshTokenEnc: input.refreshTokenEnc,
      tokenExpiresAt: input.tokenExpiresAt,
      selectedCalendarIds,
      pushCalendarId,
      calendarMeta: input.calendarMeta,
      syncEnabled: true,
      autoPushEvents: true,
      lastSyncedAt: null,
      lastSyncError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.insert(googleCalendarConnections).values(created).run();
    return created;
  }

  updateTokens(input: {
    accessTokenEnc: string;
    tokenExpiresAt: string;
    refreshTokenEnc?: string;
  }): GoogleCalendarConnectionRow | null {
    const existing = this.get();
    if (!existing) return null;
    const timestamp = this.now().toISOString();
    return this.database
      .update(googleCalendarConnections)
      .set({
        accessTokenEnc: input.accessTokenEnc,
        tokenExpiresAt: input.tokenExpiresAt,
        ...(input.refreshTokenEnc ? { refreshTokenEnc: input.refreshTokenEnc } : {}),
        updatedAt: timestamp,
      })
      .where(eq(googleCalendarConnections.userId, this.userId))
      .returning()
      .get() as GoogleCalendarConnectionRow;
  }

  updateSettings(patch: {
    selectedCalendarIds?: string[];
    pushCalendarId?: string;
    syncEnabled?: boolean;
    autoPushEvents?: boolean;
  }): GoogleCalendarConnectionRow | null {
    const existing = this.get();
    if (!existing) return null;
    const timestamp = this.now().toISOString();
    return this.database
      .update(googleCalendarConnections)
      .set({
        ...(patch.selectedCalendarIds !== undefined
          ? { selectedCalendarIds: patch.selectedCalendarIds }
          : {}),
        ...(patch.pushCalendarId !== undefined ? { pushCalendarId: patch.pushCalendarId } : {}),
        ...(patch.syncEnabled !== undefined ? { syncEnabled: patch.syncEnabled } : {}),
        ...(patch.autoPushEvents !== undefined ? { autoPushEvents: patch.autoPushEvents } : {}),
        updatedAt: timestamp,
      })
      .where(eq(googleCalendarConnections.userId, this.userId))
      .returning()
      .get() as GoogleCalendarConnectionRow;
  }

  updateCalendarMeta(calendarMeta: GoogleCalendarInfo[]): void {
    this.database
      .update(googleCalendarConnections)
      .set({
        calendarMeta,
        updatedAt: this.now().toISOString(),
      })
      .where(eq(googleCalendarConnections.userId, this.userId))
      .run();
  }

  recordSyncStatus(status: { lastSyncedAt?: string; lastSyncError: string | null }): void {
    this.database
      .update(googleCalendarConnections)
      .set({
        ...(status.lastSyncedAt !== undefined ? { lastSyncedAt: status.lastSyncedAt } : {}),
        lastSyncError: status.lastSyncError,
        updatedAt: this.now().toISOString(),
      })
      .where(eq(googleCalendarConnections.userId, this.userId))
      .run();
  }

  delete(): void {
    this.database
      .delete(googleCalendarConnections)
      .where(eq(googleCalendarConnections.userId, this.userId))
      .run();
  }
}
