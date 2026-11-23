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
        const rawEvents = await this.apiClient.listEvents(
          accessToken,
          calendarId,
          window.timeMin,
          window.timeMax,
        );
        const mapped: MappedGoogleEvent[] = [];
        for (const item of rawEvents) {
          const converted = googleEventToLifeEventInput(
            calendarId,
            meta?.backgroundColor ?? null,
            item,
          );
          if (converted) mapped.push(converted);
        }
        const diff = this.repos.lifeEvents.reconcileGoogleCalendarWindow(
          calendarId,
          window.startDate,
          window.endDate,
          mapped,
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

    const calMeta = conn.calendarMeta.find(c => c.id === event.googleCalendarId);
    if (calMeta && calMeta.accessRole !== 'owner' && calMeta.accessRole !== 'writer') {
      return event;
    }

    try {
      const accessToken = await this.ensureAccessToken(conn);
      const result = await this.apiClient.updateEvent(
        accessToken,
        event.googleCalendarId,
        event.googleEventId,
        lifeEventToGoogleEventBody(event),
      );
      const updated = this.repos.lifeEvents.setGoogleLink(event.id, {
        googleCalendarId: event.googleCalendarId,
        googleEventId: result.id,
        googleUpdatedAt: result.updated,
      });
      this.repos.googleCalendar.recordSyncStatus({ lastSyncError: null });
      return updated ?? event;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google 일정 수정 동기화 실패';
      this.repos.googleCalendar.recordSyncStatus({ lastSyncError: message });
      return event;
    }
  }

  async pushDeletedEvent(event: LifeEvent): Promise<void> {
    if (!event.googleEventId || !event.googleCalendarId) return;
    const conn = this.repos.googleCalendar.get();
    if (!conn || !conn.syncEnabled) return;

    const calMeta = conn.calendarMeta.find(c => c.id === event.googleCalendarId);
    if (calMeta && calMeta.accessRole !== 'owner' && calMeta.accessRole !== 'writer') {
      return;
    }

    try {
      const accessToken = await this.ensureAccessToken(conn);
      await this.apiClient.deleteEvent(accessToken, event.googleCalendarId, event.googleEventId);
      this.repos.googleCalendar.recordSyncStatus({ lastSyncError: null });
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
