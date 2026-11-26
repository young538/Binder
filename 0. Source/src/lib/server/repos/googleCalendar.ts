import 'server-only';
import { eq } from 'drizzle-orm';
import type {
  GoogleCalendarConnectionSummary,
  GoogleCalendarInfo,
  GoogleTaskListInfo,
} from '@/lib/types';
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
  eventSyncRevision: number;
  taskDeletionRevision: number;
  autoPushEvents: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  tasksSyncEnabled: boolean;
  tasksAutoPush: boolean;
  tasksSelectedListIds: string[];
  tasksDefaultListId: string | null;
  tasksListMeta: GoogleTaskListInfo[];
  tasksProjectMap: Record<string, string>;
  tasksLastSyncedAt: string | null;
  tasksLastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toGoogleConnectionSummary(
  row: GoogleCalendarConnectionRow,
): GoogleCalendarConnectionSummary {
  return {
    googleEmail: row.googleEmail,
    selectedCalendarIds: row.selectedCalendarIds ?? [],
    pushCalendarId: row.pushCalendarId,
    calendarMeta: row.calendarMeta ?? [],
    syncEnabled: row.syncEnabled ?? true,
    autoPushEvents: row.autoPushEvents ?? true,
    lastSyncedAt: row.lastSyncedAt ?? null,
    lastSyncError: row.lastSyncError ?? null,
    tasksSyncEnabled: row.tasksSyncEnabled ?? true,
    tasksAutoPush: row.tasksAutoPush ?? true,
    tasksSelectedListIds: row.tasksSelectedListIds ?? [],
    tasksDefaultListId: row.tasksDefaultListId ?? null,
    tasksListMeta: row.tasksListMeta ?? [],
    tasksProjectMap: row.tasksProjectMap ?? {},
    tasksLastSyncedAt: row.tasksLastSyncedAt ?? null,
    tasksLastSyncError: row.tasksLastSyncError ?? null,
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
    tasksListMeta?: GoogleTaskListInfo[];
    tasksSelectedListIds?: string[];
    tasksDefaultListId?: string;
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

    const tasksListMeta = input.tasksListMeta ?? existing?.tasksListMeta ?? [];
    const availableTaskListIds = new Set(tasksListMeta.map(l => l.id));
    const defaultTaskList = tasksListMeta.find(l => l.isDefault) ?? tasksListMeta[0] ?? null;
    const retainedTaskSelected =
      existing?.tasksSelectedListIds?.filter(id => availableTaskListIds.has(id)) ?? [];
    const tasksSelectedListIds =
      input.tasksSelectedListIds ??
      (retainedTaskSelected.length > 0
        ? retainedTaskSelected
        : defaultTaskList
          ? [defaultTaskList.id]
          : []);
    const retainedDefaultTaskList =
      existing?.tasksDefaultListId && availableTaskListIds.has(existing.tasksDefaultListId)
        ? existing.tasksDefaultListId
        : null;
    const tasksDefaultListId =
      input.tasksDefaultListId ?? retainedDefaultTaskList ?? defaultTaskList?.id ?? null;

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
          tasksListMeta,
          tasksSelectedListIds,
          tasksDefaultListId,
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
      eventSyncRevision: 0,
      taskDeletionRevision: 0,
      autoPushEvents: true,
      lastSyncedAt: null,
      lastSyncError: null,
      tasksSyncEnabled: true,
      tasksAutoPush: true,
      tasksSelectedListIds,
      tasksDefaultListId,
      tasksListMeta,
      tasksProjectMap: {},
      tasksLastSyncedAt: null,
      tasksLastSyncError: null,
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
    tasksSyncEnabled?: boolean;
    tasksAutoPush?: boolean;
    tasksSelectedListIds?: string[];
    tasksDefaultListId?: string | null;
    tasksProjectMap?: Record<string, string | null>;
  }): GoogleCalendarConnectionRow | null {
    const existing = this.get();
    if (!existing) return null;
    const timestamp = this.now().toISOString();

    let nextProjectMap: Record<string, string> | undefined;
    if (patch.tasksProjectMap !== undefined) {
      nextProjectMap = {};
      for (const [listId, projectId] of Object.entries(patch.tasksProjectMap)) {
        if (typeof projectId === 'string' && projectId.trim()) {
          nextProjectMap[listId] = projectId;
        }
      }
    }

    return this.database
      .update(googleCalendarConnections)
      .set({
        ...(patch.selectedCalendarIds !== undefined
          ? { selectedCalendarIds: patch.selectedCalendarIds }
          : {}),
        ...(patch.pushCalendarId !== undefined ? { pushCalendarId: patch.pushCalendarId } : {}),
        ...(patch.syncEnabled !== undefined ? { syncEnabled: patch.syncEnabled } : {}),
        ...(patch.autoPushEvents !== undefined ? { autoPushEvents: patch.autoPushEvents } : {}),
        ...(patch.tasksSyncEnabled !== undefined ? { tasksSyncEnabled: patch.tasksSyncEnabled } : {}),
        ...(patch.tasksAutoPush !== undefined ? { tasksAutoPush: patch.tasksAutoPush } : {}),
        ...(patch.tasksSelectedListIds !== undefined
          ? { tasksSelectedListIds: patch.tasksSelectedListIds }
          : {}),
        ...(patch.tasksDefaultListId !== undefined
          ? { tasksDefaultListId: patch.tasksDefaultListId }
          : {}),
        ...(nextProjectMap !== undefined ? { tasksProjectMap: nextProjectMap } : {}),
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

  updateTaskListMeta(tasksListMeta: GoogleTaskListInfo[]): void {
    const existing = this.get();
    if (!existing) return;
    const available = new Set(tasksListMeta.map(l => l.id));
    const defaultList = tasksListMeta.find(l => l.isDefault) ?? tasksListMeta[0] ?? null;

    const currentSelected = (existing.tasksSelectedListIds ?? []).filter(id => available.has(id));
    const nextSelected =
      currentSelected.length > 0 ? currentSelected : defaultList ? [defaultList.id] : [];

    const nextDefaultId =
      existing.tasksDefaultListId && available.has(existing.tasksDefaultListId)
        ? existing.tasksDefaultListId
        : (defaultList?.id ?? null);

    this.database
      .update(googleCalendarConnections)
      .set({
        tasksListMeta,
        tasksSelectedListIds: nextSelected,
        tasksDefaultListId: nextDefaultId,
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

  recordTasksSyncStatus(status: {
    tasksLastSyncedAt?: string;
    tasksLastSyncError: string | null;
  }): void {
    this.database
      .update(googleCalendarConnections)
      .set({
        ...(status.tasksLastSyncedAt !== undefined
          ? { tasksLastSyncedAt: status.tasksLastSyncedAt }
          : {}),
        tasksLastSyncError: status.tasksLastSyncError,
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
