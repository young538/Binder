// @vitest-environment node
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDefaultSyncWindow,
  googleEventToLifeEventInput,
  lifeEventToGoogleEventBody,
  type GoogleCalendarEventResource,
  type GoogleCalendarWriteBody,
} from '@/lib/googleCalendar';
import { DatabaseConnection } from '@/lib/server/db/connection';
import type { GoogleCalendarApiClient, TokenExchangeResult } from '@/lib/server/googleCalendar/client';
import type { GoogleOAuthConfig } from '@/lib/server/googleCalendar/config';
import {
  decryptSecret,
  encryptSecret,
  signOAuthState,
  verifyOAuthState,
} from '@/lib/server/googleCalendar/crypto';
import { GoogleCalendarSyncService } from '@/lib/server/googleCalendar/syncService';
import {
  GoogleSyncCoordinator,
  parseSyncIntervalMinutes,
} from '@/lib/server/googleCalendar/autoSync';
import { UserRepositories } from '@/lib/server/repos';
import type { GoogleCalendarInfo } from '@/lib/types';

let connection: DatabaseConnection;
let prevSessionSecret: string | undefined;
const fixedNow = new Date('2026-11-20T09:00:00.000Z');
const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef';

beforeEach(() => {
  prevSessionSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = testSecret;
  connection = new DatabaseConnection({
    filename: () => ':memory:',
    migrationsFolder: path.resolve('drizzle'),
  });
});

afterEach(() => {
  connection.close();
  if (prevSessionSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = prevSessionSecret;
});

function createMockApiClient(): GoogleCalendarApiClient {
  return {
    buildAuthUrl: vi.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth'),
    exchangeCode: vi.fn(async (): Promise<TokenExchangeResult> => ({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresInSec: 3600,
    })),
    refreshAccessToken: vi.fn(async (): Promise<TokenExchangeResult> => ({
      accessToken: 'refreshed-access',
      expiresInSec: 3600,
    })),
    getUserEmail: vi.fn(async () => 'user@gmail.com'),
    listCalendars: vi.fn(async (): Promise<GoogleCalendarInfo[]> => [
      { id: 'primary-cal', summary: '내 일정', backgroundColor: '#2563eb', primary: true, accessRole: 'owner' },
      { id: 'work-cal', summary: '회사', backgroundColor: '#16a34a', primary: false, accessRole: 'reader' },
    ]),
    listEvents: vi.fn(async (): Promise<GoogleCalendarEventResource[]> => []),
    createEvent: vi.fn(async (_tok: string, _calId: string, body: GoogleCalendarWriteBody) => ({
      id: `created-${body.summary}`,
      updated: '2026-11-20T09:05:00.000Z',
    })),
    updateEvent: vi.fn(async (_tok: string, _calId: string, eventId: string) => ({
      id: eventId,
      updated: '2026-11-20T09:10:00.000Z',
    })),
    deleteEvent: vi.fn(async () => undefined),
    listTaskLists: vi.fn(async () => []),
    listTasks: vi.fn(async () => []),
    createTask: vi.fn(async (_tok: string, _listId: string, body: { title: string }) => ({
      id: `task-${body.title}`,
      updated: '2026-11-20T09:05:00.000Z',
    })),
    updateTask: vi.fn(async (_tok: string, _listId: string, taskId: string) => ({
      id: taskId,
      updated: '2026-11-20T09:10:00.000Z',
    })),
    deleteTask: vi.fn(async () => undefined),
    revokeToken: vi.fn(async () => undefined),
  } as unknown as GoogleCalendarApiClient;
}

describe('google calendar integration', () => {
  it('encrypts/decrypts tokens with AES-256-GCM and verifies signed OAuth state', () => {
    const encrypted = encryptSecret('secret-refresh-token', testSecret);
    expect(encrypted.startsWith('v1.')).toBe(true);
    expect(decryptSecret(encrypted, testSecret)).toBe('secret-refresh-token');

    const tampered = `${encrypted.slice(0, -2)}aa`;
    expect(() => decryptSecret(tampered, testSecret)).toThrow();
    expect(() => decryptSecret(encrypted, 'wrong-secret-0123456789abcdef0123456789')).toThrow();

    const validState = signOAuthState(
      { state: 'nonce-1', userId: 'u-1', returnTo: '/settings', exp: Date.now() + 60_000 },
      testSecret,
    );
    expect(verifyOAuthState(validState, testSecret)).toMatchObject({
      state: 'nonce-1',
      userId: 'u-1',
      returnTo: '/settings',
    });

    const expiredState = signOAuthState(
      { state: 'nonce-2', userId: 'u-1', returnTo: '/settings', exp: Date.now() - 1000 },
      testSecret,
    );
    expect(verifyOAuthState(expiredState, testSecret)).toBeNull();
    expect(verifyOAuthState(`${validState}x`, testSecret)).toBeNull();
  });

  it('converts Google Calendar events to Binder LifeEvents and back across timezones and all-day boundaries', () => {
    const window = buildDefaultSyncWindow('2026-11-20');
    expect(window.startDate).toBe('2026-10-21');
    expect(window.endDate).toBe('2027-05-19');
    expect(window.timeMin).toBe('2026-10-21T00:00:00+09:00');

    const allDayMulti = googleEventToLifeEventInput('primary', '#2563eb', {
      id: 'ad-1',
      summary: '부산 출장',
      start: { date: '2026-11-21' },
      end: { date: '2026-11-24' },
      location: '부산역',
      description: '컨퍼런스 발표',
      updated: '2026-11-20T08:00:00Z',
    });
    expect(allDayMulti).toMatchObject({
      title: '부산 출장',
      date: '2026-11-21',
      endDate: '2026-11-23',
      allDay: true,
      startMin: null,
      endMin: null,
      color: '#2563eb',
      googleCalendarId: 'primary',
      googleEventId: 'ad-1',
      externalUid: 'gcal:primary:ad-1',
      note: '장소: 부산역\n\n컨퍼런스 발표',
    });

    const roundAllDay = lifeEventToGoogleEventBody(allDayMulti!);
    expect(roundAllDay.start).toEqual({ date: '2026-11-21' });
    expect(roundAllDay.end).toEqual({ date: '2026-11-24' });

    const timed = googleEventToLifeEventInput('primary', null, {
      id: 'tm-1',
      summary: '주간 싱크',
      start: { dateTime: '2026-11-20T01:00:00Z' }, // 10:00 KST
      end: { dateTime: '2026-11-20T02:30:00Z' },   // 11:30 KST
    });
    expect(timed).toMatchObject({
      title: '주간 싱크',
      date: '2026-11-20',
      endDate: null,
      allDay: false,
      startMin: 600,
      endMin: 690,
    });

    const roundTimed = lifeEventToGoogleEventBody(timed!);
    expect(roundTimed).toEqual({
      summary: '주간 싱크',
      description: undefined,
      start: { dateTime: '2026-11-20T10:00:00+09:00', timeZone: 'Asia/Seoul' },
      end: { dateTime: '2026-11-20T11:30:00+09:00', timeZone: 'Asia/Seoul' },
    });

    // Zero-minute milestone clamps to +30 minutes; 24:00 end exports as next-day 00:00+09:00
    const milestone = googleEventToLifeEventInput('primary', null, {
      id: 'ms-1',
      start: { dateTime: '2026-11-20T14:00:00+09:00' },
      end: { dateTime: '2026-11-20T14:00:00+09:00' },
    });
    expect(milestone).toMatchObject({ title: '(제목 없음)', startMin: 840, endMin: 870 });

    const untilMidnight = googleEventToLifeEventInput('primary', null, {
      id: 'mid-1',
      summary: '야간 작업',
      start: { dateTime: '2026-11-20T22:00:00+09:00' },
      end: { dateTime: '2026-11-21T00:00:00+09:00' },
    });
    expect(untilMidnight).toMatchObject({ date: '2026-11-20', endDate: null, startMin: 1320, endMin: 1440 });
    expect(lifeEventToGoogleEventBody(untilMidnight!).end).toEqual({
      dateTime: '2026-11-21T00:00:00+09:00',
      timeZone: 'Asia/Seoul',
    });

    expect(
      googleEventToLifeEventInput('primary', null, { id: 'c-1', status: 'cancelled', summary: '취소' }),
    ).toBeNull();
  });

  it('syncs bi-directionally with token refresh, window reconciliation, push hooks, and user isolation', async () => {
    const db = connection.get();
    const reposA = new UserRepositories(db, 'user-a');
    const reposB = new UserRepositories(db, 'user-b');
    const api = createMockApiClient();

    const calendars: GoogleCalendarInfo[] = [
      { id: 'primary-cal', summary: '내 일정', backgroundColor: '#2563eb', primary: true, accessRole: 'owner' },
    ];
    // Expiring in 30s -> forces refreshAccessToken during sync
    reposA.googleCalendar.upsert({
      googleEmail: 'alice@gmail.com',
      accessTokenEnc: encryptSecret('expired-token'),
      refreshTokenEnc: encryptSecret('alice-refresh'),
      tokenExpiresAt: new Date(fixedNow.getTime() + 30_000).toISOString(),
      calendarMeta: calendars,
      selectedCalendarIds: ['primary-cal'],
      pushCalendarId: 'primary-cal',
    });

    // Binder-native items: 1 regular event to auto-push, 1 anniversary (stays local), 1 past Google event (outside window -> retained)
    const binderEvent = reposA.lifeEvents.create({
      title: '바인더 회의',
      date: '2026-11-21',
      endDate: null,
      kind: 'event',
      allDay: false,
      startMin: 600,
      endMin: 660,
      color: null,
      personId: null,
      projectId: null,
      goalId: null,
      externalUid: null,
      note: '안건 준비',
    });
    const anniversary = reposA.lifeEvents.create({
      title: '창립 기념일',
      date: '2020-11-21',
      endDate: null,
      kind: 'anniversary',
      allDay: true,
      startMin: null,
      endMin: null,
      color: null,
      personId: null,
      projectId: null,
      goalId: null,
      externalUid: null,
      note: null,
    });
    reposA.lifeEvents.reconcileGoogleCalendarWindow('primary-cal', '2025-01-01', '2025-12-31', [
      {
        googleCalendarId: 'primary-cal',
        googleEventId: 'old-google-ev',
        googleUpdatedAt: null,
        externalUid: 'gcal:primary-cal:old-google-ev',
        title: '작년 일정',
        date: '2025-06-01',
        endDate: null,
        allDay: true,
        startMin: null,
        endMin: null,
        color: '#2563eb',
        note: null,
      },
      {
        googleCalendarId: 'primary-cal',
        googleEventId: 'to-be-deleted',
        googleUpdatedAt: null,
        externalUid: 'gcal:primary-cal:to-be-deleted',
        title: '삭제될 일정',
        date: '2026-11-25',
        endDate: null,
        allDay: true,
        startMin: null,
        endMin: null,
        color: '#2563eb',
        note: null,
      },
    ]);

    vi.mocked(api.listEvents).mockResolvedValueOnce([
      {
        id: 'rec_20261122T010000Z',
        summary: '스탠드업',
        start: { dateTime: '2026-11-22T10:00:00+09:00' },
        end: { dateTime: '2026-11-22T10:30:00+09:00' },
      },
      {
        id: 'rec_20261129T010000Z',
        summary: '스탠드업',
        start: { dateTime: '2026-11-29T10:00:00+09:00' },
        end: { dateTime: '2026-11-29T10:30:00+09:00' },
      },
    ]);

    const config: GoogleOAuthConfig = {
      configured: true,
      clientId: 'cid',
      clientSecret: 'csec',
      redirectUri: 'http://localhost:3000/api/integrations/google/callback',
    };
    const syncService = new GoogleCalendarSyncService(reposA, api, config, () => fixedNow);
    const result = await syncService.syncNow('2026-11-20');

    expect(api.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      pulledCreated: 2,
      pulledUpdated: 0,
      pulledDeleted: 1, // 'to-be-deleted' removed while 'old-google-ev' preserved
      pushedCreated: 1, // '바인더 회의' pushed, anniversary skipped
      calendarsSynced: 1,
    });

    const updatedConn = reposA.googleCalendar.get()!;
    expect(decryptSecret(updatedConn.accessTokenEnc)).toBe('refreshed-access');
    expect(updatedConn.lastSyncedAt).toBe(fixedNow.toISOString());
    expect(updatedConn.lastSyncError).toBeNull();

    const allEventsA = reposA.lifeEvents.list();
    expect(allEventsA.some(e => e.id === anniversary.id)).toBe(true);
    expect(allEventsA.some(e => e.googleEventId === 'old-google-ev')).toBe(true);
    expect(allEventsA.some(e => e.googleEventId === 'to-be-deleted')).toBe(false);
    expect(allEventsA.filter(e => e.title === '스탠드업')).toHaveLength(2);
    expect(reposA.lifeEvents.getById(binderEvent.id)?.googleEventId).toBe('created-바인더 회의');

    // User B stays completely isolated
    expect(reposB.googleCalendar.get()).toBeNull();
    expect(reposB.lifeEvents.list()).toHaveLength(0);

    // Real-time create -> update -> delete push hooks
    const localNew = reposA.lifeEvents.create({
      title: '치과',
      date: '2026-11-26',
      endDate: null,
      kind: 'event',
      allDay: false,
      startMin: 900,
      endMin: 960,
      color: null,
      personId: null,
      projectId: null,
      goalId: null,
      externalUid: null,
      note: null,
    });
    const pushedNew = await syncService.pushCreatedEvent(localNew);
    expect(pushedNew.googleEventId).toBe('created-치과');

    const edited = reposA.lifeEvents.update(pushedNew.id, { title: '치과 검진' })!;
    await syncService.pushUpdatedEvent(edited);
    expect(api.updateEvent).toHaveBeenCalledWith(
      'refreshed-access',
      'primary-cal',
      'created-치과',
      expect.objectContaining({ summary: '치과 검진' }),
    );

    // Google failure during update/delete records lastSyncError without throwing
    vi.mocked(api.deleteEvent).mockRejectedValueOnce(new Error('Google unavailable'));
    await expect(syncService.pushDeletedEvent(edited)).resolves.toBeUndefined();
    expect(reposA.googleCalendar.get()?.lastSyncError).toContain('Google unavailable');
  });
});

describe('GoogleSyncCoordinator auto-sync & coalescing', () => {
  const oauthConfig: GoogleOAuthConfig = {
    configured: true,
    clientId: 'cid',
    clientSecret: 'csec',
    redirectUri: 'https://example.com/callback',
  };

  const seedConnectedUser = (db: ReturnType<DatabaseConnection['get']>, userId: string, syncEnabled = true) => {
    const repos = new UserRepositories(db, userId);
    repos.googleCalendar.upsert({
      googleEmail: `${userId}@gmail.com`,
      accessTokenEnc: encryptSecret('valid-access'),
      refreshTokenEnc: encryptSecret('valid-refresh'),
      tokenExpiresAt: '2026-11-20T12:00:00.000Z',
      calendarMeta: [
        { id: 'primary-cal', summary: '내 일정', backgroundColor: '#2563eb', primary: true, accessRole: 'owner' },
      ],
      selectedCalendarIds: ['primary-cal'],
      pushCalendarId: 'primary-cal',
    });
    if (!syncEnabled) {
      repos.googleCalendar.updateSettings({ syncEnabled: false });
    }
    return repos;
  };

  it('coalesces concurrent syncs, skips recent/disabled syncs, backs off on error, and allows force sync', async () => {
    const db = connection.get();
    seedConnectedUser(db, 'user-auto-1', true);

    const coordinator = new GoogleSyncCoordinator();
    let currentMs = fixedNow.getTime();
    const now = () => new Date(currentMs);

    const api = createMockApiClient();
    let resolveEvents!: (rows: GoogleCalendarEventResource[]) => void;
    vi.mocked(api.listEvents).mockImplementationOnce(
      () => new Promise<GoogleCalendarEventResource[]>(resolve => { resolveEvents = resolve; }),
    );

    const p1 = coordinator.syncUserIfDue('user-auto-1', {
      force: false,
      database: db,
      apiClient: api,
      config: oauthConfig,
      minIntervalMs: 600_000,
      now,
    });
    const p2 = coordinator.syncUserIfDue('user-auto-1', {
      force: false,
      database: db,
      apiClient: api,
      config: oauthConfig,
      minIntervalMs: 600_000,
      now,
    });

    await new Promise(r => setTimeout(r, 15));
    expect(api.listEvents).toHaveBeenCalledTimes(1);
    resolveEvents([
      {
        id: 'ev-coalesced',
        summary: '자동 가져온 일정',
        start: { dateTime: '2026-11-20T03:00:00Z' },
        end: { dateTime: '2026-11-20T04:00:00Z' },
      },
    ]);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toMatchObject({ skipped: false, pulledCreated: 1 });
    expect(r2).toMatchObject({ skipped: false, pulledCreated: 1 });

    // Inside cooldown -> skipped as recent without API calls
    currentMs += 120_000;
    const recentSkip = await coordinator.syncUserIfDue('user-auto-1', {
      force: false,
      database: db,
      apiClient: api,
      config: oauthConfig,
      minIntervalMs: 600_000,
      now,
    });
    expect(recentSkip).toMatchObject({ skipped: true, reason: 'recent' });
    expect(api.listEvents).toHaveBeenCalledTimes(1);

    // Past cooldown + upstream failure -> returns reason:'error' and activates backoff
    currentMs += 600_000;
    vi.mocked(api.listEvents).mockRejectedValueOnce(new Error('Upstream timeout'));
    const failedOutcome = await coordinator.syncUserIfDue('user-auto-1', {
      force: false,
      database: db,
      apiClient: api,
      config: oauthConfig,
      minIntervalMs: 600_000,
      now,
    });
    expect(failedOutcome).toMatchObject({ skipped: true, reason: 'error' });

    const backoffSkip = await coordinator.syncUserIfDue('user-auto-1', {
      force: false,
      database: db,
      apiClient: api,
      config: oauthConfig,
      minIntervalMs: 600_000,
      now,
    });
    expect(backoffSkip).toMatchObject({ skipped: true, reason: 'recent' });

    // Force sync bypasses cooldown & backoff
    const forced = await coordinator.syncUserIfDue('user-auto-1', {
      force: true,
      database: db,
      apiClient: api,
      config: oauthConfig,
      now,
    });
    expect(forced).toMatchObject({ skipped: false });

    // Disabled user is skipped in auto mode
    const reposDisabled = seedConnectedUser(db, 'user-auto-disabled', false);
    expect(reposDisabled.googleCalendar.get()?.syncEnabled).toBe(false);
    const disabledSkip = await coordinator.syncUserIfDue('user-auto-disabled', {
      force: false,
      database: db,
      apiClient: api,
      config: oauthConfig,
      now,
    });
    expect(disabledSkip).toMatchObject({ skipped: true, reason: 'disabled' });
  });

  it('syncAllDueUsers processes only syncEnabled due users and parses interval env values safely', async () => {
    const db = connection.get();
    seedConnectedUser(db, 'user-due', true);
    const reposRecent = seedConnectedUser(db, 'user-recent', true);
    reposRecent.googleCalendar.recordSyncStatus({ lastSyncedAt: fixedNow.toISOString(), lastSyncError: null });
    seedConnectedUser(db, 'user-off', false);

    const coordinator = new GoogleSyncCoordinator();
    const api = createMockApiClient();

    const summary = await coordinator.syncAllDueUsers({
      database: db,
      apiClient: api,
      config: oauthConfig,
      minIntervalMs: 600_000,
      now: () => fixedNow,
    });
    expect(summary).toEqual({ checked: 2, synced: 1, skipped: 1, failed: 0 });
    expect(api.listEvents).toHaveBeenCalledTimes(1);

    expect(parseSyncIntervalMinutes(undefined)).toBe(15);
    expect(parseSyncIntervalMinutes('0')).toBe(0);
    expect(parseSyncIntervalMinutes('-5')).toBe(0);
    expect(parseSyncIntervalMinutes('30')).toBe(30);
    expect(parseSyncIntervalMinutes('9999')).toBe(1440);
  });
});
