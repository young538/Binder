// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { UserRepositories } from '@/lib/server/repos';
import { MorningBootRepository } from '@/lib/server/repos/morningBoot';
import { BackupService } from '@/lib/server/backup/service';
import { validateFields, validateRelationships } from '@/lib/validation/mutations';

let connection: DatabaseConnection;
const fixedNow = new Date('2026-11-20T00:30:00.000Z');

beforeEach(() => {
  connection = new DatabaseConnection({
    filename: () => ':memory:',
    migrationsFolder: path.resolve('drizzle'),
  });
});

afterEach(() => connection.close());

const repos = (userId = 'a') => new UserRepositories(connection.get(), userId);
const bootRepo = (userId = 'a') => new MorningBootRepository(connection.get(), userId, () => fixedNow);

describe('morning boot routine', () => {
  it('collects only past 7 days active overdue TODOs, projects, week/inbox candidates and isolated highlight', async () => {
    const repoA = repos('a');
    const repoB = repos('b');

    const overduePending = await repoA.todos.create({
      title: '어제 할 일',
      scope: 'day',
      scopeKey: '2026-11-19',
      status: 'pending',
      order: 0,
    });
    const overdueOldBoundary = await repoA.todos.create({
      title: '7일 전 할 일',
      scope: 'day',
      scopeKey: '2026-11-13',
      status: 'postponed',
      order: 0,
    });
    await repoA.todos.create({
      title: '8일 전 할 일',
      scope: 'day',
      scopeKey: '2026-11-12',
      status: 'pending',
      order: 0,
    });
    await repoA.todos.create({
      title: '완료된 어제 할 일',
      scope: 'day',
      scopeKey: '2026-11-19',
      status: 'done',
      order: 1,
    });
    await repoA.todos.create({
      title: '내일 할 일',
      scope: 'day',
      scopeKey: '2026-11-21',
      status: 'pending',
      order: 0,
    });
    const todayTodo = await repoA.todos.create({
      title: '오늘 할 일',
      scope: 'day',
      scopeKey: '2026-11-20',
      status: 'pending',
      order: 0,
    });
    const weekTodo = await repoA.todos.create({
      title: '이번 주 할 일',
      scope: 'week',
      scopeKey: '2026-W47',
      status: 'pending',
      order: 0,
    });
    const inboxTodo = await repoA.todos.create({
      title: '수집함 할 일',
      scope: 'inbox',
      scopeKey: 'inbox',
      status: 'pending',
      order: 0,
    });

    const activeProject = await repoA.projects.create({
      title: '진행 중 프로젝트',
      status: 'active',
      order: 0,
    });
    const emptyActiveProject = await repoA.projects.create({
      title: '빈 진행 프로젝트',
      status: 'active',
      order: 1,
    });
    await repoA.projects.create({
      title: '보류 프로젝트',
      status: 'onHold',
      order: 2,
    });

    const projCandidate = await repoA.todos.create({
      title: '프로젝트 후보',
      scope: 'inbox',
      scopeKey: 'inbox',
      status: 'pending',
      order: 1,
      projectId: activeProject.id,
    });
    await repoA.todos.create({
      title: '프로젝트 오늘 할 일',
      scope: 'day',
      scopeKey: '2026-11-20',
      status: 'pending',
      order: 1,
      projectId: activeProject.id,
    });

    // Legacy day memo must remain completely separate from highlight.
    await repoA.focusNotes.upsert('day', '2026-11-20', '레거시 메모');
    await repoA.focusNotes.upsert('highlight', '2026-11-20', '오늘의 핵심 한 문장');

    // Account B data must not leak into A's snapshot.
    await repoB.todos.create({
      title: '타인 밀린 할 일',
      scope: 'day',
      scopeKey: '2026-11-19',
      status: 'pending',
      order: 0,
    });
    await repoB.focusNotes.upsert('highlight', '2026-11-20', '타인 초점');

    const snap = bootRepo('a').snapshot('2026-11-20');
    expect(snap.isoWeek).toBe('2026-W47');
    expect(snap.overdueTodos.map(t => t.id)).toEqual([overdueOldBoundary.id, overduePending.id]);
    expect(snap.todayTodos.map(t => t.id)).toContain(todayTodo.id);
    expect(snap.weekTodos.map(t => t.id)).toEqual([weekTodo.id]);
    expect(snap.inboxTodos.map(t => t.id)).toEqual([inboxTodo.id, projCandidate.id]);
    expect(snap.highlight).toBe('오늘의 핵심 한 문장');
    expect((await repoA.focusNotes.get('day', '2026-11-20'))?.text).toBe('레거시 메모');

    expect(snap.activeProjects).toHaveLength(2);
    expect(snap.activeProjects[0]).toMatchObject({
      project: { id: activeProject.id },
      todayCount: 1,
      needsNextAction: false,
    });
    expect(snap.activeProjects[0].candidateTodos.map(t => t.id)).toEqual([projCandidate.id]);
    expect(snap.activeProjects[1]).toMatchObject({
      project: { id: emptyActiveProject.id },
      todayCount: 0,
      needsNextAction: true,
    });
  });

  it('atomically moves selected TODOs to today or inbox, clearing repeat rules and ignoring foreign/done items', async () => {
    const repoA = repos('a');
    const repoB = repos('b');

    const existingToday = await repoA.todos.create({
      title: '기존 오늘',
      scope: 'day',
      scopeKey: '2026-11-20',
      status: 'pending',
      order: 2,
    });
    const overdueToToday = await repoA.todos.create({
      title: '밀린 일',
      scope: 'day',
      scopeKey: '2026-11-19',
      status: 'pending',
      order: 0,
    });
    const inboxToToday = await repoA.todos.create({
      title: '수집함 일',
      scope: 'inbox',
      scopeKey: 'inbox',
      status: 'postponed',
      order: 0,
    });
    const repeatToInbox = await repoA.todos.create({
      title: '반복 있던 밀린 일',
      scope: 'day',
      scopeKey: '2026-11-18',
      status: 'pending',
      order: 0,
      repeatRule: { unit: 'week', interval: 1, basis: 'scheduled' },
    });
    const doneTodo = await repoA.todos.create({
      title: '이미 완료',
      scope: 'day',
      scopeKey: '2026-11-19',
      status: 'done',
      order: 1,
    });
    const foreignTodo = await repoB.todos.create({
      title: '타인 일',
      scope: 'day',
      scopeKey: '2026-11-19',
      status: 'pending',
      order: 0,
    });

    const result = bootRepo('a').apply({
      targetDate: '2026-11-20',
      moveToTodayIds: [existingToday.id, overdueToToday.id, inboxToToday.id, doneTodo.id, foreignTodo.id],
      moveToInboxIds: [repeatToInbox.id, foreignTodo.id],
    });

    expect(result).toEqual({ movedToToday: 2, movedToInbox: 1 });

    const todayList = await repoA.todos.list({ scope: 'day', scopeKey: '2026-11-20' });
    expect(todayList.map(t => [t.id, t.order])).toEqual([
      [existingToday.id, 2],
      [overdueToToday.id, 3],
      [inboxToToday.id, 4],
    ]);

    const inboxList = await repoA.todos.list({ scope: 'inbox', scopeKey: 'inbox' });
    expect(inboxList).toHaveLength(1);
    expect(inboxList[0]).toMatchObject({
      id: repeatToInbox.id,
      scope: 'inbox',
      scopeKey: 'inbox',
      repeatRule: null,
    });

    const foreignRow = (await repoB.todos.list({ scope: 'day', scopeKey: '2026-11-19' }))[0];
    expect(foreignRow.id).toBe(foreignTodo.id);
  });

  it('validates morningBootApply, highlight focusNotes, and round-trips highlight in BackupService', async () => {
    expect(() => validateRelationships('morningBootApply', { targetDate: '2026-11-20' })).toThrow();
    expect(() =>
      validateRelationships('morningBootApply', {
        targetDate: '2026-11-20',
        moveToTodayIds: ['a'],
        moveToInboxIds: ['a'],
      }),
    ).toThrow();
    expect(() => validateFields('morningBootApply', { targetDate: 'not-a-date', moveToTodayIds: ['a'] })).toThrow();

    expect(() =>
      validateRelationships('focusNotes', { scope: 'highlight', scopeKey: '2026-11-20', text: '초점' }),
    ).not.toThrow();
    expect(() =>
      validateRelationships('focusNotes', { scope: 'highlight', scopeKey: 'highlight:2026-11-20', text: '초점' }),
    ).toThrow();

    await repos('a').focusNotes.upsert('highlight', '2026-11-20', '백업될 초점');
    const backups = new BackupService(() => connection.get(), () => fixedNow);
    const exported = backups.exportFor('a');
    expect(exported.focusNotes).toHaveLength(1);
    expect(exported.focusNotes[0]).toMatchObject({ scope: 'highlight', scopeKey: '2026-11-20', text: '백업될 초점' });

    backups.importFor('b', {
      mode: 'replace',
      data: {
        ...exported,
        focusNotes: [{ ...exported.focusNotes[0], id: 'b-highlight' }],
      },
    });
    expect((await repos('b').focusNotes.get('highlight', '2026-11-20'))?.text).toBe('백업될 초점');
  });
});
