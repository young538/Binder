import 'server-only';
import { eq } from 'drizzle-orm';
import type { GoogleCalendarAutoSyncOutcome, GoogleCalendarSyncResult } from '@/lib/types';
import type { BinderDatabase } from '../db/connection';
import { getDb, schema } from '../db/client';
import { UserRepositories } from '../repos';
import { GoogleCalendarApiClient } from './client';
import { getGoogleOAuthConfig, type GoogleOAuthConfig } from './config';
import { GoogleCalendarSyncService, GoogleSyncNotConnectedError } from './syncService';
import { GoogleTasksSyncService } from './tasksSyncService';

export const DEFAULT_SERVER_SYNC_INTERVAL_MINUTES = 15;
export const DEFAULT_CLIENT_SYNC_COOLDOWN_MS = 10 * 60 * 1000;
export const INITIAL_SCHEDULER_DELAY_MS = 60 * 1000;

export type { GoogleCalendarAutoSyncOutcome };

export function parseSyncIntervalMinutes(raw?: string): number {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_SERVER_SYNC_INTERVAL_MINUTES;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return DEFAULT_SERVER_SYNC_INTERVAL_MINUTES;
  const intVal = Math.floor(parsed);
  if (intVal <= 0) return 0;
  return Math.min(1440, intVal);
}

export interface SyncUserOptions {
  force?: boolean;
  minIntervalMs?: number;
  database?: BinderDatabase;
  apiClient?: GoogleCalendarApiClient;
  config?: GoogleOAuthConfig;
  now?: () => Date;
  req?: Request;
}

/** Coordinates per-user Google Calendar syncs with in-flight coalescing and cooldown backoff. */
export class GoogleSyncCoordinator {
  private readonly inFlight = new Map<string, Promise<GoogleCalendarSyncResult>>();
  private readonly lastFailureAt = new Map<string, number>();

  private runCoalesced(
    userId: string,
    fn: () => Promise<GoogleCalendarSyncResult>,
  ): Promise<GoogleCalendarSyncResult> {
    const existing = this.inFlight.get(userId);
    if (existing) return existing;

    const promise = fn().finally(() => {
      this.inFlight.delete(userId);
    });
    this.inFlight.set(userId, promise);
    return promise;
  }

  async syncUserIfDue(
    userId: string,
    options?: SyncUserOptions,
  ): Promise<GoogleCalendarAutoSyncOutcome> {
    const force = options?.force ?? false;
    const now = options?.now ?? (() => new Date());
    const database = options?.database ?? getDb();
    const config = options?.config ?? getGoogleOAuthConfig(options?.req);
    const repos = new UserRepositories(database, userId);

    const conn = repos.googleCalendar.get();
    if (!conn) {
      if (force) throw new GoogleSyncNotConnectedError();
      return { skipped: true, reason: 'not_connected' };
    }

    const minIntervalMs = options?.minIntervalMs ?? DEFAULT_CLIENT_SYNC_COOLDOWN_MS;
    const nowMs = now().getTime();

    if (!force) {
      if (!conn.syncEnabled) {
        return { skipped: true, reason: 'disabled', lastSyncedAt: conn.lastSyncedAt };
      }
      if (!config.configured) {
        return { skipped: true, reason: 'not_configured', lastSyncedAt: conn.lastSyncedAt };
      }

      if (conn.lastSyncedAt) {
        const lastSyncedMs = Date.parse(conn.lastSyncedAt);
        if (Number.isFinite(lastSyncedMs) && nowMs - lastSyncedMs < minIntervalMs) {
          return { skipped: true, reason: 'recent', lastSyncedAt: conn.lastSyncedAt };
        }
      }

      const prevFailureMs = this.lastFailureAt.get(userId);
      if (prevFailureMs !== undefined && nowMs - prevFailureMs < minIntervalMs) {
        return { skipped: true, reason: 'recent', lastSyncedAt: conn.lastSyncedAt };
      }
    }

    const apiClient = options?.apiClient ?? new GoogleCalendarApiClient();
    const syncService = new GoogleCalendarSyncService(
      repos,
      apiClient,
      config,
      now,
    );

    try {
      const result = await this.runCoalesced(userId, async () => {
        let calendarResult: GoogleCalendarSyncResult;
        let tasksResult: GoogleCalendarSyncResult['tasks'] = null;
        try {
          calendarResult = await syncService.syncNow();
        } finally {
          // Task deletions must also run when a calendar-specific request fails.
          const latestConn = repos.googleCalendar.get();
          if (latestConn?.tasksSyncEnabled) {
            try {
              const tasksService = new GoogleTasksSyncService(repos, apiClient, config, now);
              tasksResult = await tasksService.syncNow();
            } catch (tasksErr) {
              const latestAfterErr = repos.googleCalendar.get();
              tasksResult = {
                pulledCreated: 0,
                pulledUpdated: 0,
                pulledDeleted: 0,
                pushedCreated: 0,
                pushedUpdated: 0,
                listsSynced: 0,
                syncedAt: now().toISOString(),
                error:
                  latestAfterErr?.tasksLastSyncError ??
                  (tasksErr instanceof Error
                    ? tasksErr.message
                    : 'Google Tasks 동기화에 실패했습니다.'),
              };
            }
          }
        }
        return { ...calendarResult, tasks: tasksResult };
      });
      this.lastFailureAt.delete(userId);
      return { skipped: false, ...result };
    } catch (err) {
      this.lastFailureAt.set(userId, now().getTime());
      if (force) throw err;
      console.warn('[google-sync] auto-sync skipped due to upstream error');
      return { skipped: true, reason: 'error', lastSyncedAt: conn.lastSyncedAt };
    }
  }

  async syncAllDueUsers(options?: {
    database?: BinderDatabase;
    apiClient?: GoogleCalendarApiClient;
    config?: GoogleOAuthConfig;
    minIntervalMs?: number;
    now?: () => Date;
  }): Promise<{ checked: number; synced: number; skipped: number; failed: number }> {
    const config = options?.config ?? getGoogleOAuthConfig();
    if (!config.configured) {
      return { checked: 0, synced: 0, skipped: 0, failed: 0 };
    }

    const database = options?.database ?? getDb();
    const enabledUsers = database
      .select({ userId: schema.googleCalendarConnections.userId })
      .from(schema.googleCalendarConnections)
      .where(eq(schema.googleCalendarConnections.syncEnabled, true))
      .all();

    let synced = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of enabledUsers) {
      const outcome = await this.syncUserIfDue(row.userId, {
        force: false,
        database,
        apiClient: options?.apiClient,
        config,
        minIntervalMs: options?.minIntervalMs,
        now: options?.now,
      });
      if (!outcome.skipped) {
        synced++;
      } else if (outcome.reason === 'error') {
        failed++;
      } else {
        skipped++;
      }
    }

    return {
      checked: enabledUsers.length,
      synced,
      skipped,
      failed,
    };
  }
}

const globalForGoogleSync = globalThis as unknown as {
  __binderGoogleSyncCoordinator?: GoogleSyncCoordinator;
  __binderGoogleSyncSchedulerStarted?: boolean;
};

export const googleSyncCoordinator =
  globalForGoogleSync.__binderGoogleSyncCoordinator ??
  (globalForGoogleSync.__binderGoogleSyncCoordinator = new GoogleSyncCoordinator());

export function startGoogleCalendarAutoSyncScheduler(): void {
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.VITEST) return;
  if (globalForGoogleSync.__binderGoogleSyncSchedulerStarted) return;

  const intervalMin = parseSyncIntervalMinutes(process.env.GOOGLE_SYNC_INTERVAL_MINUTES);
  if (intervalMin <= 0) return;

  if (!getGoogleOAuthConfig().configured) return;

  globalForGoogleSync.__binderGoogleSyncSchedulerStarted = true;
  const intervalMs = intervalMin * 60 * 1000;
  // Use slightly shorter window on scheduled ticks so fixed-cadence runs don't self-skip due to ms jitter.
  const minDueMs = Math.max(60_000, intervalMs - 30_000);

  const runTick = async () => {
    try {
      await googleSyncCoordinator.syncAllDueUsers({ minIntervalMs: minDueMs });
    } catch {
      console.warn('[google-sync] scheduled tick failed');
    }
  };

  const bootTimer = setTimeout(() => {
    void runTick();
  }, INITIAL_SCHEDULER_DELAY_MS);
  bootTimer.unref?.();

  const intervalTimer = setInterval(() => {
    void runTick();
  }, intervalMs);
  intervalTimer.unref?.();

  console.info(`[google-sync] background auto-sync scheduler started (interval: ${intervalMin}m)`);
}
