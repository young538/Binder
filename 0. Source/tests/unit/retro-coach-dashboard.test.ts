// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { buildRetroCoachSummary } from '@/lib/retroCoach';
import { closeDb, getDb, schema } from '@/lib/server/db/client';
import { UserRepositories } from '@/lib/server/repos';

const dbPath = path.join(process.cwd(), 'tmp-test', `retro-dashboard-${process.pid}.sqlite`);
const INITIAL_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A';

describe('buildRetroCoachSummary', () => {
  it('computes plan-actual variance, sleep correlation, milestones, drafts, and prompt text', () => {
    const summary = buildRetroCoachSummary({
      mode: 'weekly',
      period: '2026-W47',
      startDate: '2026-11-16',
      endDate: '2026-11-22',
      categories: [
        { id: 'c1', userId: 'u1', name: '주원씽', color: '#2563eb', order: 0 },
        { id: 'c2', userId: 'u1', name: '개인', color: '#10b981', order: 1 },
      ],
      blocks: [
        {
          id: 'b1',
          userId: 'u1',
          date: '2026-11-16',
          startMin: 540,
          endMin: 720,
          text: '딥워크',
          kind: 'plan',
          categoryId: 'c1',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'b2',
          userId: 'u1',
          date: '2026-11-16',
          startMin: 540,
          endMin: 720,
          text: '딥워크',
          kind: 'actual',
          categoryId: 'c1',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'b3',
          userId: 'u1',
          date: '2026-11-17',
          startMin: 600,
          endMin: 720,
          text: '운동 계획',
          kind: 'plan',
          categoryId: 'c2',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'b4',
          userId: 'u1',
          date: '2026-11-17',
          startMin: 600,
          endMin: 630,
          text: '짧은 스트레칭',
          kind: 'actual',
          categoryId: 'c2',
          createdAt: '',
          updatedAt: '',
        },
      ],
      todos: [
        {
          id: 't1',
          userId: 'u1',
          title: '핵심 완수',
          scope: 'day',
          scopeKey: '2026-11-16',
          status: 'done',
          order: 0,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 't2',
          userId: 'u1',
          title: '남은 작업',
          scope: 'day',
          scopeKey: '2026-11-17',
          status: 'pending',
          order: 1,
          createdAt: '',
          updatedAt: '',
        },
      ],
      checkins: [
        {
          id: 'ck1',
          userId: 'u1',
          date: '2026-11-16',
          sleepHours: 7.5,
          energy: 4,
          stress: 2,
          mood: '좋음',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'ck2',
          userId: 'u1',
          date: '2026-11-17',
          sleepHours: 5.5,
          energy: 2,
          stress: 4,
          mood: '피곤',
          createdAt: '',
          updatedAt: '',
        },
      ],
      habitPercent: 80,
      completedProjects: [
        {
          id: 'p1',
          userId: 'u1',
          title: '바인더 v2 출시',
          status: 'done',
          order: 0,
          completedAt: '2026-11-18T10:00:00.000Z',
          createdAt: '',
          updatedAt: '',
        },
      ],
      finishedBooks: [
        {
          id: 'bk1',
          userId: 'u1',
          year: '2026',
          order: 0,
          title: '원씽',
          finishedAt: '2026-11-19',
          createdAt: '',
          updatedAt: '',
        },
      ],
    });

    expect(summary.provider).toBe('local');
    expect(summary.metrics.planMin).toBe(300);
    expect(summary.metrics.actualMin).toBe(210);
    expect(summary.metrics.executionRate).toBe(70);
    expect(summary.metrics.todoDone).toBe(1);
    expect(summary.metrics.todoTotal).toBe(2);
    expect(summary.insights.some(line => line.includes('수면 7시간 이상'))).toBe(true);
    expect(summary.insights.some(line => line.includes('개인'))).toBe(true);
    expect(summary.draft.good).toContain('바인더 v2 출시');
    expect(summary.draft.good).toContain('원씽');
    expect(summary.draft.bad).toContain('개인');
    expect(summary.draft.nextStep).toContain('개인');
    expect(summary.promptText).toContain('2026-W47');
  });

  it('handles sparse/empty input safely without NaN', () => {
    const empty = buildRetroCoachSummary({
      mode: 'monthly',
      period: '2026-11',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      categories: [],
      blocks: [],
      todos: [],
      completedProjects: [],
      finishedBooks: [],
      checkins: [],
      habitPercent: 0,
      subscriptions: [],
    });

    expect(empty.metrics.executionRate).toBeNull();
    expect(empty.insights.length).toBeGreaterThanOrEqual(2);
    expect(empty.draft.good.length).toBeGreaterThan(0);
    expect(empty.draft.bad.length).toBeGreaterThan(0);
    expect(empty.draft.nextStep.length).toBeGreaterThan(0);
  });
});

describe('DashboardRepository snapshot & multi-user isolation', () => {
  beforeEach(() => {
    process.env.DB_PATH = dbPath;
    process.env.APP_USERNAME = 'userA';
    process.env.APP_PASSWORD_HASH = INITIAL_HASH;
    process.env.SESSION_SECRET = 'a'.repeat(64);
    getDb();
  });

  afterEach(() => {
    closeDb();
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(`${dbPath}${suffix}`, { force: true });
    }
  });

  it('aggregates events, subscriptions, metrics, projects, and isolates by user', async () => {
    const db = getDb();
    const userA = db.select().from(schema.users).where(eq(schema.users.username, 'userA')).get()!;
    const userBId = ulid();
    const now = new Date().toISOString();
    db.insert(schema.users)
      .values({
        id: userBId,
        username: 'userB',
        passwordHash: INITIAL_HASH,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const reposA = new UserRepositories(db, userA.id);
    const reposB = new UserRepositories(db, userBId);

    const today = '2026-11-21';

    reposA.lifeEvents.create({
      title: 'A 구글 일정',
      date: today,
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
      googleCalendarId: 'primary',
      googleEventId: 'g-ev-1',
      googleUpdatedAt: now,
      note: null,
    });
    reposB.lifeEvents.create({
      title: 'B 비밀 일정',
      date: today,
      endDate: null,
      kind: 'event',
      allDay: true,
      startMin: null,
      endMin: null,
      color: null,
      personId: null,
      projectId: null,
      goalId: null,
      externalUid: null,
      googleCalendarId: null,
      googleEventId: null,
      googleUpdatedAt: null,
      note: null,
    });

    reposA.subscriptions.create({
      name: 'ChatGPT Plus',
      amount: 29000,
      currency: 'KRW',
      billingCycle: 'monthly',
      billingDay: 24,
      nextBillingDate: '2026-11-24',
      status: 'active',
      category: 'AI·생산성',
      paymentMethod: null,
      autoRenew: true,
      url: null,
      note: null,
      order: 0,
    });

    const metricA = reposA.metrics.create({
      name: '체중',
      unit: 'kg',
      direction: 'down',
      targetValue: 70,
      goalId: null,
      color: '#2563eb',
      order: 0,
    });
    reposA.metrics.upsertEntry({ metricId: metricA.id, date: '2026-11-15', value: 75, note: null });
    reposA.metrics.upsertEntry({ metricId: metricA.id, date: '2026-11-20', value: 74.2, note: null });

    await reposA.projects.create({
      title: '다음 행동 없는 프로젝트',
      status: 'active',
      order: 0,
      goalId: null,
      categoryId: null,
      deadline: '2026-11-25',
      outcome: null,
      note: null,
    });

    const snapA = reposA.dashboard.snapshot(today);
    expect(snapA.todayEvents).toHaveLength(1);
    expect(snapA.todayEvents[0].title).toBe('A 구글 일정');
    expect(snapA.todayEvents[0].isGoogle).toBe(true);
    expect(snapA.subscriptionSummary.activeCount).toBe(1);
    expect(snapA.attention.upcomingBillsCount).toBe(1);
    expect(snapA.attention.projectsWithoutNextAction).toBe(1);
    expect(snapA.metrics[0].summary.delta).toBe(-0.8);

    const snapB = reposB.dashboard.snapshot(today);
    expect(snapB.todayEvents).toHaveLength(1);
    expect(snapB.todayEvents[0].title).toBe('B 비밀 일정');
    expect(snapB.subscriptionSummary.activeCount).toBe(0);
    expect(snapB.metrics).toHaveLength(0);
    expect(snapB.activeProjects).toHaveLength(0);
  });
});
