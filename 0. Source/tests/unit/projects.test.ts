// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { UserRepositories } from '@/lib/server/repos';
import { ProjectRepository } from '@/lib/server/repos/projects';
import { TodoActions } from '@/lib/server/todos/actions';
import { BackupService } from '@/lib/server/backup/service';
import { describeDeadline } from '@/lib/projects';
import { validateFields } from '@/lib/validation/mutations';
import * as schema from '@/lib/server/db/schema';

let connection: DatabaseConnection;
const fixedNow = new Date('2026-11-20T09:00:00.000Z');

beforeEach(() => {
  connection = new DatabaseConnection({
    filename: () => ':memory:',
    migrationsFolder: path.resolve('drizzle'),
  });
});

afterEach(() => connection.close());

const repos = (userId = 'a') => new UserRepositories(connection.get(), userId);
const projectRepo = (userId = 'a') => new ProjectRepository(connection.get(), userId, () => fixedNow);
const todoActions = (userId = 'a') => new TodoActions(connection.get(), userId, () => fixedNow);

describe('projects domain and execution links', () => {
  it('isolates CRUD per user and tracks completion timestamps across status changes', async () => {
    const pA = await projectRepo('a').create({
      title: '사이드 프로젝트 v1',
      status: 'active',
      order: 0,
      deadline: '2026-11-25',
      outcome: '첫 배포 완료',
    });
    await projectRepo('b').create({ title: '타인 프로젝트', status: 'active', order: 0 });

    expect(await projectRepo('a').list()).toHaveLength(1);
    expect(pA.completedAt).toBeNull();
    expect(await projectRepo('b').update(pA.id, { title: '탈취' })).toBeNull();

    const completed = await projectRepo('a').update(pA.id, { status: 'done' });
    expect(completed?.completedAt).toBe(fixedNow.toISOString());

    const reopened = await projectRepo('a').update(pA.id, { status: 'active' });
    expect(reopened?.completedAt).toBeNull();

    await projectRepo('b').delete(pA.id);
    expect(await projectRepo('a').list()).toHaveLength(1);
  });

  it('auto-inherits project goalId on TODO create/update while respecting explicit overrides and null clears', async () => {
    const goalMain = await repos('a').goals.create({ title: '커리어 성장', level: 'oneThing', order: 0 });
    const goalAlt = await repos('a').goals.create({ title: '건강 관리', level: 'mandalartCore', order: 1 });
    const project = await projectRepo('a').create({
      title: '포트폴리오 개편',
      status: 'active',
      order: 0,
      goalId: goalMain.id,
    });

    const inheritedOnCreate = todoActions('a').create({
      title: '이력서 정리',
      scope: 'day',
      scopeKey: '2026-11-20',
      status: 'pending',
      order: 0,
      projectId: project.id,
    });
    expect(inheritedOnCreate.parentGoalId).toBe(goalMain.id);

    const explicitOverride = todoActions('a').create({
      title: '별도 목표 할 일',
      scope: 'inbox',
      scopeKey: 'inbox',
      status: 'pending',
      order: 1,
      projectId: project.id,
      parentGoalId: goalAlt.id,
    });
    expect(explicitOverride.parentGoalId).toBe(goalAlt.id);

    const explicitNull = todoActions('a').create({
      title: '목표 없는 프로젝트 할 일',
      scope: 'inbox',
      scopeKey: 'inbox',
      status: 'pending',
      order: 2,
      projectId: project.id,
      parentGoalId: null,
    });
    expect(explicitNull.parentGoalId).toBeNull();

    const updated = todoActions('a').update(explicitNull.id, { projectId: null });
    const relinked = todoActions('a').update(updated!.id, { projectId: project.id });
    expect(relinked?.parentGoalId).toBe(goalMain.id);

    const manuallyCleared = todoActions('a').update(relinked!.id, { parentGoalId: null });
    expect(manuallyCleared?.parentGoalId).toBeNull();
    expect(manuallyCleared?.projectId).toBe(project.id);
  });

  it('computes overview metrics, needsNextAction warning, and actual-only minutes', async () => {
    const db = connection.get();
    db.insert(schema.categories).values({ id: 'cat', userId: 'a', name: '집중', color: '#123456', order: 0 }).run();
    const emptyActive = await projectRepo('a').create({ title: '방치 프로젝트', status: 'active', order: 0 });
    const planned = await projectRepo('a').create({ title: '예정 프로젝트', status: 'planned', order: 1 });
    const working = await projectRepo('a').create({ title: '진행 프로젝트', status: 'active', order: 2 });

    const doneTodo = todoActions('a').create({
      title: '완료 항목',
      scope: 'day',
      scopeKey: '2026-11-19',
      status: 'done',
      order: 0,
      projectId: working.id,
    });
    const nextTodo = todoActions('a').create({
      title: '다음 행동',
      scope: 'day',
      scopeKey: '2026-11-20',
      status: 'pending',
      order: 1,
      projectId: working.id,
    });
    todoActions('a').create({
      title: '취소 항목',
      scope: 'inbox',
      scopeKey: 'inbox',
      status: 'cancelled',
      order: 2,
      projectId: working.id,
    });

    const ts = fixedNow.toISOString();
    db.insert(schema.timeBlocks).values([
      { id: 'b1', userId: 'a', date: '2026-11-19', startMin: 540, endMin: 630, text: '실제 작업', kind: 'actual', categoryId: 'cat', todoId: doneTodo.id, createdAt: ts, updatedAt: ts },
      { id: 'b2', userId: 'a', date: '2026-11-20', startMin: 600, endMin: 720, text: '계획만', kind: 'plan', categoryId: 'cat', todoId: nextTodo.id, createdAt: ts, updatedAt: ts },
    ]).run();

    // A direct project link wins even if the TODO belongs to a different project.
    db.insert(schema.timeBlocks).values([
      { id: 'direct', userId: 'a', date: '2026-11-19', startMin: 540, endMin: 555, text: 'Direct', kind: 'actual', categoryId: 'cat', projectId: emptyActive.id, todoId: doneTodo.id, createdAt: ts, updatedAt: ts },
      { id: 'foreign', userId: 'b', date: '2026-11-19', startMin: 540, endMin: 600, text: 'Foreign', kind: 'actual', categoryId: 'cat', todoId: doneTodo.id, createdAt: ts, updatedAt: ts },
    ]).run();
    const dashboard = repos('a').dashboard.snapshot('2026-11-20');
    expect(dashboard.activeProjects.map(item => [item.project.id, item.actualMinutes]))
      .toEqual([[emptyActive.id, 15], [working.id, 90]]);
    const { projects } = projectRepo('a').overview();
    expect(projects.find(item => item.project.id === emptyActive.id)).toMatchObject({
      needsNextAction: true,
      totalTodos: 0,
      actualMinutes: 15,
    });
    expect(projects.find(item => item.project.id === planned.id)?.needsNextAction).toBe(false);
    expect(projects.find(item => item.project.id === working.id)).toMatchObject({
      needsNextAction: false,
      totalTodos: 2,
      doneTodos: 1,
      activeTodos: 1,
      actualMinutes: 90,
    });
  });

  it('unlinks TODOs on project delete and strips deleted projectId on repeat and undo restore', async () => {
    const goal = await repos('a').goals.create({ title: '목표', level: 'oneThing', order: 0 });
    const project = await projectRepo('a').create({ title: '임시 프로젝트', status: 'active', order: 0, goalId: goal.id });
    const keepTodo = todoActions('a').create({
      title: '남을 할 일',
      scope: 'day',
      scopeKey: '2026-11-20',
      status: 'pending',
      order: 0,
      projectId: project.id,
    });
    const trashed = todoActions('a').create({
      title: '삭제 취소 테스트',
      scope: 'inbox',
      scopeKey: 'inbox',
      status: 'pending',
      order: 1,
      projectId: project.id,
    });
    todoActions('a').remove(trashed.id);

    await projectRepo('a').delete(project.id);

    const remaining = (await repos('a').todos.list({ scope: 'day', scopeKey: '2026-11-20' }))[0];
    expect(remaining).toMatchObject({ id: keepTodo.id, projectId: null, parentGoalId: goal.id });

    const restored = todoActions('a').restore(trashed.id);
    expect(restored.projectId).toBeNull();
  });

  it('validates project mutations, deadline badges, and legacy v11 backup compatibility', () => {
    expect(() => validateFields('projects', { title: '   ', status: 'active', order: 0 })).toThrow();
    expect(() => validateFields('projects', { title: '정상', status: 'invalid', order: 0 })).toThrow();
    expect(() => validateFields('projects', { completedAt: fixedNow.toISOString() }, true)).toThrow();

    expect(describeDeadline('2026-11-20', '2026-11-20', 'active')).toMatchObject({ label: 'D-Day', urgent: true, overdue: false });
    expect(describeDeadline('2026-11-18', '2026-11-20', 'active')).toMatchObject({ label: '2일 지남', urgent: true, overdue: true });
    expect(describeDeadline('2026-11-18', '2026-11-20', 'done')).toMatchObject({ urgent: false, overdue: false });

    const backups = new BackupService(() => connection.get(), () => fixedNow);
    backups.importFor('legacy-user', {
      mode: 'replace',
      data: {
        version: 11,
        todos: [{
          id: 't1',
          title: 'v11 할 일',
          scope: 'inbox',
          scopeKey: 'inbox',
          status: 'pending',
          order: 0,
          createdAt: fixedNow.toISOString(),
          updatedAt: fixedNow.toISOString(),
        }],
      },
    });
    expect(backups.exportFor('legacy-user').projects).toEqual([]);
    expect(backups.exportFor('legacy-user').todos[0].projectId).toBeNull();
  });
});
