// @vitest-environment node
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  dateToGoogleDue,
  googleDueToDate,
  googleTaskToTodoFields,
  isTodoEligibleForGoogleTasks,
  resolveTargetTaskListId,
  todoToGoogleTaskBody,
  type GoogleTaskResource,
  type GoogleTaskWriteBody,
} from '@/lib/googleTasks';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { schema } from '@/lib/server/db/client';
import { GoogleSyncCoordinator } from '@/lib/server/googleCalendar/autoSync';
import { GoogleApiError, type GoogleCalendarApiClient } from '@/lib/server/googleCalendar/client';
import type { GoogleOAuthConfig } from '@/lib/server/googleCalendar/config';
import { encryptSecret } from '@/lib/server/googleCalendar/crypto';
import { GoogleTasksSyncService } from '@/lib/server/googleCalendar/tasksSyncService';
import { UserBackupRepository } from '@/lib/server/backup/repository';
import { validateImport } from '@/lib/server/importValidation';
import { UserRepositories } from '@/lib/server/repos';
import type { GoogleCalendarInfo, GoogleTaskListInfo } from '@/lib/types';

let connection: DatabaseConnection;
let prevSessionSecret: string | undefined;
const fixedNow = new Date('2026-11-23T09:00:00.000Z');
const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef';

const oauthConfig: GoogleOAuthConfig = {
  configured: true,
  clientId: 'cid',
  clientSecret: 'csec',
  redirectUri: 'http://localhost:3000/api/integrations/google/callback',
};

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

function createMockTasksApi(): GoogleCalendarApiClient {
  return {
    refreshAccessToken: vi.fn(async () => ({
      accessToken: 'refreshed-access',
      expiresInSec: 3600,
    })),
    listCalendars: vi.fn(async (): Promise<GoogleCalendarInfo[]> => [
      { id: 'primary-cal', summary: '내 일정', backgroundColor: '#2563eb', primary: true, accessRole: 'owner' },
    ]),
    listEvents: vi.fn(async () => []),
    createEvent: vi.fn(async () => ({ id: 'ev-1', updated: '2026-11-23T09:00:00.000Z' })),
    updateEvent: vi.fn(async (_t: string, _c: string, id: string) => ({ id, updated: '2026-11-23T09:00:00.000Z' })),
    deleteEvent: vi.fn(async () => undefined),
    listTaskLists: vi.fn(async (): Promise<GoogleTaskListInfo[]> => [
      { id: 'list-default', title: '내 할 일', isDefault: true },
      { id: 'list-dev', title: '개발 프로젝트', isDefault: false },
    ]),
    listTasks: vi.fn(async (): Promise<GoogleTaskResource[]> => []),
    createTask: vi.fn(async (_tok: string, _listId: string, body: GoogleTaskWriteBody) => ({
      id: `gt-${body.title}`,
      title: body.title,
      updated: '2026-11-23T09:05:00.000Z',
    })),
    updateTask: vi.fn(async (_tok: string, _listId: string, taskId: string, body: GoogleTaskWriteBody) => ({
      id: taskId,
      title: body.title,
      updated: '2026-11-23T09:10:00.000Z',
    })),
    deleteTask: vi.fn(async () => undefined),
  } as unknown as GoogleCalendarApiClient;
}

describe('google tasks mapping & sync service', () => {
  it('maps between Binder Todo and Google Task resources cleanly', () => {
    expect(googleDueToDate('2026-11-23T00:00:00.000Z')).toBe('2026-11-23');
    expect(googleDueToDate('invalid-date')).toBeNull();
    expect(googleDueToDate(null)).toBeNull();
    expect(dateToGoogleDue('2026-11-23')).toBe('2026-11-23T00:00:00.000Z');

    expect(isTodoEligibleForGoogleTasks({ scope: 'inbox', status: 'pending' })).toBe(true);
    expect(isTodoEligibleForGoogleTasks({ scope: 'day', status: 'done' })).toBe(true);
    expect(isTodoEligibleForGoogleTasks({ scope: 'day', status: 'cancelled' })).toBe(false);
    expect(isTodoEligibleForGoogleTasks({ scope: 'week', status: 'pending' })).toBe(false);
    expect(isTodoEligibleForGoogleTasks({ scope: 'year', status: 'pending' })).toBe(false);

    expect(
      resolveTargetTaskListId(
        { projectId: 'proj-1' },
        {
          tasksProjectMap: { 'list-dev': 'proj-1' },
          tasksDefaultListId: 'list-default',
          tasksSelectedListIds: ['list-default', 'list-dev'],
        },
      ),
    ).toBe('list-dev');
    expect(
      resolveTargetTaskListId(
        { projectId: 'proj-unmapped' },
        {
          tasksProjectMap: { 'list-dev': 'proj-1' },
          tasksDefaultListId: 'list-default',
          tasksSelectedListIds: ['list-default', 'list-dev'],
        },
      ),
    ).toBe('list-default');

    expect(
      todoToGoogleTaskBody({
        title: 'API 점검',
        note: '배포 전 체크',
        status: 'done',
        scope: 'day',
        scopeKey: '2026-11-23',
      }),
    ).toEqual({
      title: 'API 점검',
      notes: '배포 전 체크',
      status: 'completed',
      due: '2026-11-23T00:00:00.000Z',
    });

    expect(
      googleTaskToTodoFields(
        {
          id: 'gt-1',
          title: '장보기',
          notes: '  우유 사기 ',
          status: 'needsAction',
          due: '2026-11-24T00:00:00.000Z',
          updated: '2026-11-23T08:00:00.000Z',
        },
        { status: 'postponed', projectId: null },
        'proj-1',
      ),
    ).toEqual({
      title: '장보기',
      note: '우유 사기',
      status: 'postponed',
      scope: 'day',
      scopeKey: '2026-11-24',
      projectId: 'proj-1',
      googleTaskUpdatedAt: '2026-11-23T08:00:00.000Z',
    });

    expect(
      googleTaskToTodoFields({
        id: 'gt-2',
        title: '아이디어 메모',
        status: 'needsAction',
      }),
    ).toMatchObject({
      scope: 'inbox',
      scopeKey: 'inbox',
      projectId: null,
      status: 'pending',
    });
  });

  it('syncs bi-directionally with project mapping, conflict resolution, single delete count, and user isolation', async () => {
    const db = connection.get();
    const reposA = new UserRepositories(db, 'user-a');
    const reposB = new UserRepositories(db, 'user-b');
    const api = createMockTasksApi();

    const goal = await reposA.goals.create({ title: '서비스 고도화', level: 'oneThing', order: 0 });
    const project = await reposA.projects.create({
      title: '백엔드',
      status: 'active',
      order: 0,
      goalId: goal.id,
    });

    reposA.googleCalendar.upsert({
      googleEmail: 'alice@gmail.com',
      accessTokenEnc: encryptSecret('valid-access'),
      refreshTokenEnc: encryptSecret('valid-refresh'),
      tokenExpiresAt: '2026-11-23T12:00:00.000Z',
      calendarMeta: [
        { id: 'primary-cal', summary: '내 일정', backgroundColor: '#2563eb', primary: true, accessRole: 'owner' },
      ],
      selectedCalendarIds: ['primary-cal'],
      pushCalendarId: 'primary-cal',
      tasksListMeta: [
        { id: 'list-default', title: '내 할 일', isDefault: true },
        { id: 'list-dev', title: '개발 프로젝트', isDefault: false },
      ],
      tasksSelectedListIds: ['list-default', 'list-dev'],
      tasksDefaultListId: 'list-default',
    });
    reposA.googleCalendar.updateSettings({
      tasksProjectMap: { 'list-dev': project.id },
    });
    reposA.googleCalendar.recordTasksSyncStatus({
      tasksLastSyncedAt: '2026-11-23T08:00:00.000Z',
      tasksLastSyncError: null,
    });

    // Existing synced todos for conflict, remote delete (tombstone), and absence sweep
    const localNewer = reposA.todos.upsertFromGoogleTask({
      googleTaskListId: 'list-default',
      googleTaskId: 'gt-conflict-local',
      title: '로컬이 더 최신 제목',
      note: null,
      status: 'pending',
      scope: 'inbox',
      scopeKey: 'inbox',
      projectId: null,
      googleTaskUpdatedAt: '2026-11-23T07:00:00.000Z',
    }).todo;
    db.update(schema.todos)
      .set({ updatedAt: '2026-11-23T08:30:00.000Z' })
      .where(eq(schema.todos.id, localNewer.id))
      .run();

    const remoteNewer = reposA.todos.upsertFromGoogleTask({
      googleTaskListId: 'list-default',
      googleTaskId: 'gt-conflict-remote',
      title: '예전 제목',
      note: null,
      status: 'pending',
      scope: 'inbox',
      scopeKey: 'inbox',
      projectId: null,
      googleTaskUpdatedAt: '2026-11-23T07:00:00.000Z',
    }).todo;
    db.update(schema.todos)
      .set({ updatedAt: '2026-11-23T07:30:00.000Z' })
      .where(eq(schema.todos.id, remoteNewer.id))
      .run();

    const deletedTombstone = reposA.todos.upsertFromGoogleTask({
      googleTaskListId: 'list-default',
      googleTaskId: 'gt-tombstone',
      title: '삭제 표시된 할 일',
      note: null,
      status: 'pending',
      scope: 'inbox',
      scopeKey: 'inbox',
      projectId: null,
      googleTaskUpdatedAt: '2026-11-23T07:00:00.000Z',
    }).todo;

    const missingRemote = reposA.todos.upsertFromGoogleTask({
      googleTaskListId: 'list-default',
      googleTaskId: 'gt-missing',
      title: '원격에서 사라진 할 일',
      note: null,
      status: 'pending',
      scope: 'inbox',
      scopeKey: 'inbox',
      projectId: null,
      googleTaskUpdatedAt: '2026-11-23T07:00:00.000Z',
    }).todo;

    // Unpushed Binder todos: 1 day todo -> should push; 1 weekly goal -> stays local
    const binderDay = await reposA.todos.create({
      title: '바인더 오늘 할 일',
      scope: 'day',
      scopeKey: '2026-11-23',
      status: 'pending',
      order: 0,
      projectId: project.id,
    });
    const binderWeek = await reposA.todos.create({
      title: '이번 주 큰 목표',
      scope: 'week',
      scopeKey: '2026-W48',
      status: 'pending',
      order: 0,
    });

    vi.mocked(api.listTasks).mockImplementation(async (_tok, listId) => {
      if (listId === 'list-default') {
        return [
          {
            id: 'gt-conflict-local',
            title: '구글 옛날 수정',
            status: 'needsAction',
            updated: '2026-11-23T08:10:00.000Z',
          },
          {
            id: 'gt-conflict-remote',
            title: '구글이 더 최신 수정',
            status: 'completed',
            due: '2026-11-24T00:00:00.000Z',
            updated: '2026-11-23T08:45:00.000Z',
          },
          {
            id: 'gt-tombstone',
            deleted: true,
          },
          {
            id: 'gt-old-done',
            title: '두 달 전 완료',
            status: 'completed',
            completed: '2026-09-01T00:00:00.000Z',
            updated: '2026-09-01T00:00:00.000Z',
          },
        ];
      }
      if (listId === 'list-dev') {
        return [
          {
            id: 'gt-proj-new',
            title: '배포 파이프라인 점검',
            status: 'needsAction',
            updated: '2026-11-23T08:50:00.000Z',
          },
        ];
      }
      return [];
    });

    const service = new GoogleTasksSyncService(reposA, api, oauthConfig, () => fixedNow);
    const result = await service.syncNow();

    expect(result).toMatchObject({
      pulledCreated: 1, // gt-proj-new only (gt-old-done skipped by 30d cutoff)
      pulledUpdated: 1, // gt-conflict-remote
      pulledDeleted: 2, // gt-tombstone (counted ONCE!) + gt-missing
      pushedCreated: 1, // binderDay only (binderWeek skipped)
      pushedUpdated: 1, // gt-conflict-local
      listsSynced: 2,
    });

    expect(reposA.todos.getById(deletedTombstone.id)).toBeNull();
    expect(reposA.todos.getById(missingRemote.id)).toBeNull();

    const updatedRemoteTodo = reposA.todos.getById(remoteNewer.id)!;
    expect(updatedRemoteTodo.title).toBe('구글이 더 최신 수정');
    expect(updatedRemoteTodo.status).toBe('done');
    expect(updatedRemoteTodo.scope).toBe('day');
    expect(updatedRemoteTodo.scopeKey).toBe('2026-11-24');

    const pulledProjectTodo = (
      await reposA.todos.list({ scope: 'inbox', scopeKey: 'inbox' })
    ).find(t => t.googleTaskId === 'gt-proj-new')!;
    expect(pulledProjectTodo.projectId).toBe(project.id);
    expect(pulledProjectTodo.parentGoalId).toBe(goal.id);

    // Real-time push updated: move to mapped project list vs clear when moved to week
    const pushedDay = reposA.todos.getById(binderDay.id)!;
    expect(pushedDay.googleTaskListId).toBe('list-dev');
    expect(pushedDay.googleTaskId).toBe('gt-바인더 오늘 할 일');
    expect(api.updateTask).toHaveBeenCalledTimes(1);

    // Moving binderDay off project -> list changes to list-default (creates new task & deletes old)
    const unlinkedProjectTodo = (await reposA.todos.update(pushedDay.id, { projectId: null }))!;
    const movedTodo = await service.pushUpdatedTodo(unlinkedProjectTodo);
    expect(movedTodo.googleTaskListId).toBe('list-default');
    expect(api.deleteTask).toHaveBeenCalledWith('valid-access', 'list-dev', 'gt-바인더 오늘 할 일');

    // Moving todo out of eligible scope (week) deletes remote task and clears link
    const demotedToWeek = (await reposA.todos.update(movedTodo.id, { scope: 'week', scopeKey: '2026-W48' }))!;
    const cleared = await service.pushUpdatedTodo(demotedToWeek);
    expect(cleared.googleTaskId).toBeNull();
    expect(cleared.googleTaskListId).toBeNull();

    // Weekly todo stays untouched
    expect(reposA.todos.getById(binderWeek.id)?.googleTaskId).toBeNull();

    // User B remains isolated
    expect(reposB.googleCalendar.get()).toBeNull();
    expect(await reposB.todos.list()).toHaveLength(0);
  });

  it('isolates Google Tasks 403 error from Calendar sync inside GoogleSyncCoordinator', async () => {
    const db = connection.get();
    const repos = new UserRepositories(db, 'user-iso');
    repos.googleCalendar.upsert({
      googleEmail: 'iso@gmail.com',
      accessTokenEnc: encryptSecret('valid-access'),
      refreshTokenEnc: encryptSecret('valid-refresh'),
      tokenExpiresAt: '2026-11-23T12:00:00.000Z',
      calendarMeta: [
        { id: 'primary-cal', summary: '내 일정', backgroundColor: '#2563eb', primary: true, accessRole: 'owner' },
      ],
      selectedCalendarIds: ['primary-cal'],
      pushCalendarId: 'primary-cal',
    });

    const api = createMockTasksApi();
    vi.mocked(api.listTaskLists).mockRejectedValueOnce(new GoogleApiError('Insufficient Permission', 403));

    const coordinator = new GoogleSyncCoordinator();
    const outcome = await coordinator.syncUserIfDue('user-iso', {
      force: true,
      database: db,
      apiClient: api,
      config: oauthConfig,
      now: () => fixedNow,
    });

    expect(outcome.skipped).toBe(false);
    if (!outcome.skipped) {
      expect(outcome.calendarsSynced).toBe(1);
      expect(outcome.tasks?.error).toContain('계정 다시 연결');
    }
    const updated = repos.googleCalendar.get()!;
    expect(updated.lastSyncError).toBeNull();
    expect(updated.tasksLastSyncError).toContain('계정 다시 연결');
  });

  it('validates exported googleTask* fields during validateImport', () => {
    const lookup = new UserBackupRepository(connection.get(), 'user-a');
    const parsed = validateImport(
      {
        mode: 'merge',
        data: {
          todos: [
            {
              id: 't-import-1',
              userId: 'old-user',
              title: '가져온 할 일',
              scope: 'inbox',
              scopeKey: 'inbox',
              status: 'pending',
              order: 0,
              googleTaskListId: 'gl-1',
              googleTaskId: 'gt-1',
              googleTaskUpdatedAt: '2026-11-23T08:00:00.000Z',
              createdAt: '2026-11-23T00:00:00.000Z',
              updatedAt: '2026-11-23T00:00:00.000Z',
            },
          ],
        },
      },
      'user-a',
      lookup,
    );
    expect(parsed.data.todos).toHaveLength(1);
    expect(() =>
      validateImport(
        {
          mode: 'merge',
          data: {
            todos: [
              {
                id: 't-import-bad',
                userId: 'old-user',
                title: '잘못된 시각',
                scope: 'inbox',
                scopeKey: 'inbox',
                status: 'pending',
                order: 0,
                googleTaskUpdatedAt: 'not-a-timestamp',
                createdAt: '2026-11-23T00:00:00.000Z',
                updatedAt: '2026-11-23T00:00:00.000Z',
              },
            ],
          },
        },
        'user-a',
        lookup,
      ),
    ).toThrow(/Invalid googleTaskUpdatedAt/);
  });
});
