import 'server-only';
import {
  buildDefaultSyncWindow,
  googleEventToLifeEventInput,
  lifeEventToGoogleEventBody,
  type MappedGoogleEvent,
} from '@/lib/googleCalendar';
import type { GoogleCalendarSyncResult, LifeEvent } from '@/lib/types';
import { toIsoDate } from '@/lib/utils/date';
import { UserRepositories } from '../repos';
import type { GoogleCalendarConnectionRow } from '../repos/googleCalendar';
import type { GoogleEventDeletion } from '../repos/lifeEvents';
import { GoogleCalendarApiClient } from './client';
import { getGoogleOAuthConfig, type GoogleOAuthConfig } from './config';
import { decryptSecret, encryptSecret } from './crypto';

const TOKEN_REFRESH_LEEWAY_MS = 120_000;

export class GoogleSyncNotConnectedError extends Error {
  constructor() {
    super('Google 캘린더 계정이 연결되어 있지 않습니다.');
    this.name = 'GoogleSyncNotConnectedError';
  }
}

export async function ensureGoogleAccessToken(
  repos: UserRepositories,
  apiClient: GoogleCalendarApiClient,
  config: GoogleOAuthConfig,
  conn: GoogleCalendarConnectionRow,
  now: () => Date = () => new Date(),
): Promise<string> {
  const expiresAtMs = Date.parse(conn.tokenExpiresAt);
  if (Number.isFinite(expiresAtMs) && expiresAtMs - now().getTime() > TOKEN_REFRESH_LEEWAY_MS) {
    return decryptSecret(conn.accessTokenEnc);
  }

  if (!config.configured) {
    throw new Error('Google OAuth 클라이언트 환경변수가 설정되지 않았습니다.');
  }

  const refreshToken = decryptSecret(conn.refreshTokenEnc);
  const refreshed = await apiClient.refreshAccessToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken,
  });
  const nextExpiresAt = new Date(now().getTime() + refreshed.expiresInSec * 1000).toISOString();
  repos.googleCalendar.updateTokens({
    accessTokenEnc: encryptSecret(refreshed.accessToken),
    tokenExpiresAt: nextExpiresAt,
    ...(refreshed.refreshToken ? { refreshTokenEnc: encryptSecret(refreshed.refreshToken) } : {}),
  });
  return refreshed.accessToken;
}

export class GoogleCalendarSyncService {
  constructor(
    private readonly repos: UserRepositories,
    private readonly apiClient: GoogleCalendarApiClient,
    private readonly config: GoogleOAuthConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async ensureAccessToken(conn: GoogleCalendarConnectionRow): Promise<string> {
    return ensureGoogleAccessToken(this.repos, this.apiClient, this.config, conn, this.now);
  }

  async syncNow(todayOverride?: string): Promise<GoogleCalendarSyncResult> {
    const conn = this.repos.googleCalendar.get();
    if (!conn) throw new GoogleSyncNotConnectedError();

    const today = todayOverride ?? toIsoDate(this.now());
    const window = buildDefaultSyncWindow(today);

    try {
      const accessToken = await this.ensureAccessToken(conn);
      // Retry independently of list permissions or errors on other calendars.
      const deletions = this.repos.lifeEvents.pendingGoogleDeletions(conn.googleEmail);
      let writeFailure: Error | undefined;
      for (const deletion of deletions) {
        try {
          await this.sendDeletion(accessToken, deletion);
        } catch (error) {
          writeFailure = error instanceof Error ? error : new Error('Google 일정 삭제 동기화 실패');
        }
      }

      const updates = this.repos.lifeEvents.pendingGoogleUpdates(conn.googleEmail);
      for (const update of updates) {
        try {
          await this.sendUpdate(accessToken, conn.googleEmail, update.id);
        } catch (error) {
          writeFailure = error instanceof Error ? error : new Error('Google 일정 수정 동기화 실패');
        }
      }
      const calendarMeta = await this.apiClient.listCalendars(accessToken);
      if (calendarMeta.length > 0) {
        this.repos.googleCalendar.updateCalendarMeta(calendarMeta);
      }

      const effectiveMeta = calendarMeta.length > 0 ? calendarMeta : conn.calendarMeta;
      const calMap = new Map(effectiveMeta.map(c => [c.id, c]));

      const targetCalendarIds =
        conn.selectedCalendarIds.length > 0
          ? conn.selectedCalendarIds
          : effectiveMeta.find(c => c.primary)?.id
            ? [effectiveMeta.find(c => c.primary)!.id]
            : ['primary'];

      let pulledCreated = 0;
      let pulledUpdated = 0;
      let pulledDeleted = 0;
      let calendarsSynced = 0;

      for (const calendarId of targetCalendarIds) {
        const meta = calMap.get(calendarId);
        const deletedIds = new Set(deletions.filter(item => item.calendarId === calendarId).map(item => item.eventId));
        const updatedIds = new Set(updates.flatMap(u => u.calendarId === calendarId && u.eventId ? [u.eventId] : []));
        const diff = await this.pullCalendar(
          accessToken, conn.googleEmail, calendarId, meta?.backgroundColor ?? null, window, deletedIds, updatedIds,
        );
        pulledCreated += diff.created;
        pulledUpdated += diff.updated;
        pulledDeleted += diff.deleted;
        calendarsSynced++;
      }

      let pushedCreated = 0;
      const pushCal = calMap.get(conn.pushCalendarId);
      const canPush =
        conn.autoPushEvents &&
        (!pushCal || pushCal.accessRole === 'owner' || pushCal.accessRole === 'writer');

      if (canPush && conn.pushCalendarId) {
        const unpushed = this.repos.lifeEvents.listUnpushedEvents(window.startDate);
        for (const ev of unpushed) {
          const created = await this.apiClient.createEvent(
            accessToken,
            conn.pushCalendarId,
            lifeEventToGoogleEventBody(ev),
          );
          this.repos.lifeEvents.setGoogleLink(ev.id, {
            googleCalendarId: conn.pushCalendarId,
            googleEventId: created.id,
            googleUpdatedAt: created.updated,
          });
          pushedCreated++;
        }
      }

      if (writeFailure) throw writeFailure;

      const syncedAt = this.now().toISOString();
      this.repos.googleCalendar.recordSyncStatus({ lastSyncedAt: syncedAt, lastSyncError: null });
      return {
        pulledCreated,
        pulledUpdated,
        pulledDeleted,
        pushedCreated,
        calendarsSynced,
        syncedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google 캘린더 동기화에 실패했습니다.';
      this.repos.googleCalendar.recordSyncStatus({ lastSyncError: message });
      throw error;
    }
  }

  async pushCreatedEvent(event: LifeEvent): Promise<LifeEvent> {
    if (event.kind !== 'event' || event.googleEventId || event.externalUid) return event;
    const conn = this.repos.googleCalendar.get();
    if (!conn || !conn.syncEnabled || !conn.autoPushEvents || !conn.pushCalendarId) {
      return event;
    }
    const pushMeta = conn.calendarMeta.find(c => c.id === conn.pushCalendarId);
    if (pushMeta && pushMeta.accessRole !== 'owner' && pushMeta.accessRole !== 'writer') {
      return event;
    }

    try {
      const accessToken = await this.ensureAccessToken(conn);
      const created = await this.apiClient.createEvent(
        accessToken,
        conn.pushCalendarId,
        lifeEventToGoogleEventBody(event),
      );
      const updated = this.repos.lifeEvents.setGoogleLink(event.id, {
        googleCalendarId: conn.pushCalendarId,
        googleEventId: created.id,
        googleUpdatedAt: created.updated,
      });
      this.repos.googleCalendar.recordSyncStatus({ lastSyncError: null });
      return updated ?? event;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google 일정 생성 동기화 실패';
      this.repos.googleCalendar.recordSyncStatus({ lastSyncError: message });
      return event;
    }
  }

  async pushUpdatedEvent(event: LifeEvent): Promise<LifeEvent> {
    const conn = this.repos.googleCalendar.get();
    if (!conn || !conn.syncEnabled) return event;

    if (!event.googleEventId || !event.googleCalendarId) {
      if (event.kind === 'event' && !event.externalUid && conn.autoPushEvents) {
        return this.pushCreatedEvent(event);
      }
      return event;
    }

    try {
      await this.sendUpdate(await this.ensureAccessToken(conn), conn.googleEmail, event.id);
      return this.repos.lifeEvents.getById(event.id) ?? event;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google 일정 수정 동기화 실패';
      this.repos.googleCalendar.recordSyncStatus({ lastSyncError: message });
      return event;
    }
  }

  private async sendUpdate(token: string, email: string, id: string): Promise<void> {
    const claim = this.repos.lifeEvents.claimGoogleUpdate(email, id);
    if (!claim) return;
    const { event, job } = claim;
    try {
      const result = await this.apiClient.updateEvent(token, event.googleCalendarId!, event.googleEventId!, lifeEventToGoogleEventBody(event));
      this.repos.lifeEvents.finishGoogleUpdate(job, result);
    } catch (error) {
      this.repos.lifeEvents.finishGoogleUpdate(job);
      throw error;
    }
  }

  private async pullCalendar(
    token: string, email: string, calendarId: string, color: string | null,
    window: ReturnType<typeof buildDefaultSyncWindow>, deletedIds: ReadonlySet<string>, updatedIds: ReadonlySet<string>,
  ) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const version = this.repos.googleCalendar.get();
      if (version?.googleEmail !== email) throw new GoogleSyncNotConnectedError();
      const events = await this.apiClient.listEvents(token, calendarId, window.timeMin, window.timeMax);
      const mapped: MappedGoogleEvent[] = [];
      for (const event of events) {
        if (event.id && deletedIds.has(event.id)) continue;
        const item = googleEventToLifeEventInput(calendarId, color, event);
        if (item) mapped.push(item);
      }
      const result = this.repos.lifeEvents.reconcileGoogleCalendarWindow(
        calendarId, window.startDate, window.endDate, mapped, version, updatedIds,
      );
      if (result) return result;
    }
    throw new Error('일정 변경이 진행 중입니다. 다음 동기화에서 다시 조회합니다.');
  }

  private async sendDeletion(token: string, deletion: GoogleEventDeletion): Promise<void> {
    await this.apiClient.deleteEvent(token, deletion.calendarId, deletion.eventId);
    this.repos.lifeEvents.completeGoogleDeletion(deletion);
  }

  async deleteEvent(id: string): Promise<void> {
    const deletion = this.repos.lifeEvents.delete(id);
    if (!deletion) return;
    const conn = this.repos.googleCalendar.get();
    if (!conn?.syncEnabled || conn.googleEmail !== deletion.googleEmail) return;
    try {
      await this.sendDeletion(await this.ensureAccessToken(conn), deletion);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google 일정 삭제 동기화 실패';
      this.repos.googleCalendar.recordSyncStatus({ lastSyncError: message });
    }
  }
}

export function createGoogleCalendarSyncService(
  repos: UserRepositories,
  req?: Request,
): GoogleCalendarSyncService {
  return new GoogleCalendarSyncService(
    repos,
    new GoogleCalendarApiClient(),
    getGoogleOAuthConfig(req),
  );
}
