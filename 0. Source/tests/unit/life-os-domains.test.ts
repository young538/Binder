// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { buildCalendarMarkers } from '@/lib/calendarMarkers';
import { parseIcsEvents } from '@/lib/ics';
import { describeEventDday, isContactDue } from '@/lib/lifeEvents';
import { summarizeMetric } from '@/lib/metrics';
import {
  advanceBillingDate,
  describeBillingDday,
  expandSubscriptionBillingDates,
  formatCurrency,
  summarizeSubscriptions,
  toMonthlyAmount,
  toYearlyAmount,
} from '@/lib/subscriptions';
import { nextRetroTarget, retroHref } from '@/lib/todos/planning';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { UserRepositories } from '@/lib/server/repos';
import { BackupService } from '@/lib/server/backup/service';
import { validateFields, validateRelationships } from '@/lib/validation/mutations';

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

describe('life OS phase 1-4 domains', () => {
  it('confirms identical-looking plans separately across editor, daily and evening operations', async () => {
    const a = repos();
    const category = await a.categories.create({ name: 'Work', color: '#abcdef', order: 0 });
    const plan = { date: '2026-11-20', startMin: 600, endMin: 660, text: 'Review',
      kind: 'plan' as const, categoryId: category.id };
    const one = await a.timeBlocks.create(plan);
    const two = await a.timeBlocks.create(plan);
    const actual = { ...plan, kind: 'actual' as const, sourcePlanId: one.id, endMin: 630, text: 'Edited' };
    const saved = await a.timeBlocks.create(actual);
    expect((await a.timeBlocks.create(actual)).id).toBe(saved.id);
    await expect(a.timeBlocks.create({ ...actual, text: 'New draft' })).rejects.toMatchObject({ status: 409 });
    expect(a.eveningShutdown.snapshot(plan.date).unconfirmedPlans.map(p => p.id)).toEqual([two.id]);
    expect(a.eveningShutdown.apply({ date: plan.date, confirmBlockIds: [two.id] }).confirmedBlocks).toBe(1);
    expect(a.timeBlocks.confirmPlansAsActual(plan.date)).toEqual({ created: 0 });
    await expect(repos('other').timeBlocks.create(actual)).rejects.toThrow();
    await a.timeBlocks.delete(one.id);
    expect((await a.timeBlocks.listInRange(plan.date, plan.date)).find(row => row.id === saved.id))
      .toMatchObject({ sourcePlanId: null, text: 'Edited', endMin: 630 });
  });

  it('bounds dashboard history and uses the original baseline for downward progress', () => {
    const a = repos();
    const metric = a.metrics.create({ name: 'Weight', unit: 'kg', color: '#112233', direction: 'down', order: 0, targetValue: 50 });
    for (let i = 0; i < 25; i++) {
      a.metrics.upsertEntry({ metricId: metric.id, date: '2026-11-' + String(i + 1).padStart(2, '0'), value: 100 - i });
    }
    const item = a.dashboard.snapshot('2026-11-25').metrics[0];
    expect(item.entries).toHaveLength(20);
    expect(item.entries[0].value).toBe(95);
    expect(item.summary).toMatchObject({ progressPercent: 48, delta: -1, latest: { value: 76 } });
  });

  it('confirms plans as actuals idempotently and executes atomic evening shutdown', async () => {
    const a = repos('a');
    const b = repos('b');
    const cat = await a.categories.create({ name: '딥워크', color: '#2563eb', order: 0 });
    const proj = await a.projects.create({ title: '출시', status: 'active', order: 0 });

    const plan1 = await a.timeBlocks.create({
      date: '2026-11-20',
      startMin: 540,
      endMin: 630,
      text: '핵심 코딩',
      kind: 'plan',
      categoryId: cat.id,
      projectId: proj.id,
    });
    const plan2 = await a.timeBlocks.create({
      date: '2026-11-20',
      startMin: 660,
      endMin: 720,
      text: '리뷰',
      kind: 'plan',
      categoryId: cat.id,
    });

    const catB = await b.categories.create({ name: '타인', color: '#dc2626', order: 0 });
    const foreignPlan = await b.timeBlocks.create({
      date: '2026-11-20',
      startMin: 540,
      endMin: 600,
      text: '타인 블록',
      kind: 'plan',
      categoryId: catB.id,
    });

    const firstConfirm = a.timeBlocks.confirmPlansAsActual('2026-11-20', [plan1.id, foreignPlan.id]);
    expect(firstConfirm).toEqual({ created: 1 });
    expect(a.timeBlocks.confirmPlansAsActual('2026-11-20', [plan1.id])).toEqual({ created: 0 });

    const overview = a.projects.overview();
    expect(overview.projects[0].actualMinutes).toBe(90);

    const tRoll = await a.todos.create({
      title: '내일로 미룰 일',
      scope: 'day',
      scopeKey: '2026-11-20',
      status: 'pending',
      order: 0,
    });
    const tInbox = await a.todos.create({
      title: '수집함으로 보낼 일',
      scope: 'day',
      scopeKey: '2026-11-20',
      status: 'postponed',
      order: 1,
      repeatRule: { unit: 'day', interval: 1, basis: 'scheduled' },
    });

    const snap = a.eveningShutdown.snapshot('2026-11-20');
    expect(snap.unconfirmedPlans.map(p => p.id)).toEqual([plan2.id]);
    expect(snap.openTodayTodos).toHaveLength(2);
    expect(snap.actualMinutes).toBe(90);

    const applied = a.eveningShutdown.apply({
      date: '2026-11-20',
      confirmBlockIds: [plan2.id],
      rolloverTodoIds: [tRoll.id],
      inboxTodoIds: [tInbox.id],
    });
    expect(applied).toEqual({ confirmedBlocks: 1, rolledOverTodos: 1, movedToInbox: 1 });

    const tomorrow = await a.todos.list({ scope: 'day', scopeKey: '2026-11-21' });
    expect(tomorrow.map(t => t.id)).toEqual([tRoll.id]);
    const inbox = await a.todos.list({ scope: 'inbox', scopeKey: 'inbox' });
    expect(inbox[0]).toMatchObject({ id: tInbox.id, repeatRule: null });
    expect(await b.timeBlocks.listInRange('2026-11-20', '2026-11-20')).toHaveLength(1);
  });

  it('supports monthly/yearly retrospectives, daily checkins, and state metrics', async () => {
    const a = repos('a');
    const b = repos('b');

    await a.retrospectives.upsert('monthly', '2026-11', { rating: 5, template: { good: '완주' } });
    await a.retrospectives.upsert('yearly', '2026', { freeText: '한 해 정리' });
    expect((await a.retrospectives.get('monthly', '2026-11'))?.rating).toBe(5);
    expect((await a.retrospectives.get('yearly', '2026'))?.freeText).toBe('한 해 정리');
    expect(nextRetroTarget({ type: 'monthly', dateOrWeek: '2026-12' })).toEqual({ scope: 'month', scopeKey: '2027-01' });
    expect(nextRetroTarget({ type: 'yearly', dateOrWeek: '2026' })).toEqual({ scope: 'year', scopeKey: '2027' });
    expect(retroHref({ type: 'monthly', dateOrWeek: '2026-11' })).toBe('/retrospective/month/2026-11');
    expect(retroHref({ type: 'yearly', dateOrWeek: '2026' })).toBe('/retrospective/year/2026');

    const c1 = a.dailyCheckins.upsert({ date: '2026-11-20', sleepHours: 7.5, energy: 4 });
    const c2 = a.dailyCheckins.upsert({ date: '2026-11-20', mood: '상쾌' });
    expect(c2.id).toBe(c1.id);
    expect(c2.sleepHours).toBe(7.5);
    expect(c2.energy).toBe(4);
    expect(c2.mood).toBe('상쾌');
    expect(b.dailyCheckins.getByDate('2026-11-20')).toBeNull();

    const m = a.metrics.create({
      name: '체중',
      unit: 'kg',
      direction: 'down',
      targetValue: 70,
      color: '#2563eb',
      order: 0,
    });
    a.metrics.upsertEntry({ metricId: m.id, date: '2026-11-01', value: 78 });
    a.metrics.upsertEntry({ metricId: m.id, date: '2026-11-20', value: 74 });
    const withEntries = a.metrics.listWithEntries();
    expect(withEntries).toHaveLength(1);
    const summary = summarizeMetric(withEntries[0].metric, withEntries[0].entries);
    expect(summary.delta).toBe(-4);
    expect(summary.progressPercent).toBe(50);

    a.metrics.delete(m.id);
    expect(a.metrics.listWithEntries()).toEqual([]);
  });

  it('keeps inclusive ranges, open bounds and recurring anniversaries across calendar views', () => {
    const a = repos();
    const event = { kind: 'event' as const, allDay: true };
    a.lifeEvents.create({ ...event, title: 'leap', date: '2020-02-29', kind: 'anniversary' });
    a.lifeEvents.create({ ...event, title: 'old', date: '2025-02-24' });
    a.lifeEvents.create({ ...event, title: 'ongoing', date: '2025-02-25', endDate: '2025-02-28' });
    a.lifeEvents.create({ ...event, title: 'legacy end', date: '2025-02-28', endDate: '2025-02-26' });
    a.lifeEvents.create({ ...event, title: 'later', date: '2025-03-07' });
    repos('b').lifeEvents.create({ ...event, title: 'other user', date: '2025-02-28' });

    const date = '2025-02-28';
    expect(a.lifeEvents.list({ startDate: date, endDate: date }).map(e => e.title))
      .toEqual(['leap', 'ongoing', 'legacy end']);
    expect(a.lifeEvents.list({ startDate: date }).map(e => e.title))
      .toEqual(['leap', 'ongoing', 'legacy end', 'later']);
    expect(a.lifeEvents.list({ endDate: '2025-02-25' }).map(e => e.title)).toEqual(['leap', 'old', 'ongoing']);
    expect(a.lifeEvents.list().map(e => e.title)).toEqual(['leap', 'old', 'ongoing', 'legacy end', 'later']);
    const dashboard = a.dashboard.snapshot(date);
    expect(dashboard.todayEvents.map(e => e.title).sort()).toEqual(['leap', 'legacy end', 'ongoing']);
    expect(dashboard.upcomingItems.map(e => e.title).sort()).toEqual(['later', 'leap', 'legacy end', 'ongoing']);
    expect(a.morningBoot.snapshot(date).upcomingEvents.map(e => e.title).sort()).toEqual(['leap', 'legacy end', 'ongoing']);
  });

  it('agrees on pending decisions for legacy whitespace, future reviews and other accounts', () => {
    const a = repos();
    const note = { kind: 'decision' as const, title: 'Review', pinned: false, body: '', reviewDate: '2026-11-20' };
    const empty = a.notes.create({ ...note, decisionOutcome: '\t\n\u00a0\u3000' });
    a.notes.create({ ...note, decisionOutcome: ' 결과 ' });
    a.notes.create({ ...note, reviewDate: '2026-11-21' });
    repos('b').notes.create(note);
    expect(a.notes.listDueDecisions(note.reviewDate).map(row => row.id)).toEqual([empty.id]);
    expect(a.morningBoot.snapshot(note.reviewDate).dueDecisions.map(row => row.id)).toEqual([empty.id]);
    expect(a.dashboard.snapshot(note.reviewDate).attention.dueDecisionsCount).toBe(1);
  });

  it('tracks notes, due decisions, people, .ics idempotent imports, calendar markers, and morning boot context', async () => {
    const a = repos('a');
    const proj = await a.projects.create({ title: '이사 준비', status: 'active', deadline: '2026-11-22', order: 0 });
    const dueDec = a.notes.create({
      kind: 'decision',
      title: '계약 결정',
      body: '조건 비교',
      pinned: true,
      reviewDate: '2026-11-20',
      projectId: proj.id,
    });
    a.notes.create({
      kind: 'decision',
      title: '이미 복기한 결정',
      body: '내용',
      pinned: false,
      reviewDate: '2026-11-18',
      decisionOutcome: '성공',
    });
    expect(a.notes.listDueDecisions('2026-11-20').map(n => n.id)).toEqual([dueDec.id]);

    const person = a.people.create({
      name: '어머니',
      relationship: '가족',
      cadenceDays: 7,
      lastContactAt: '2026-11-10',
      birthday: '1965-11-22',
      order: 0,
    });
    expect(isContactDue(person, '2026-11-20')).toEqual({ due: true, daysSince: 10, overdueDays: 3 });

    const sampleIcs = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:evt-1',
      'SUMMARY:건강검진\\, 공복 유지',
      'DESCRIPTION:오전 내원\\n신분증 지참',
      'DTSTART;VALUE=DATE:20261121',
      'DTEND;VALUE=DATE:20261122',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:evt-2',
      'SUMMARY:팀 미팅',
      'DTSTART:20261120T010000Z',
      'DTEND:20261120T023000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const parsed = parseIcsEvents(sampleIcs);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ externalUid: 'evt-1', title: '건강검진, 공복 유지', date: '2026-11-21', endDate: null, allDay: true });
    expect(parsed[1]).toMatchObject({ externalUid: 'evt-2', date: '2026-11-20', allDay: false, startMin: 600, endMin: 690 });

    expect(a.lifeEvents.importIcsEvents(parsed)).toEqual({ imported: 2, updated: 0, total: 2 });
    expect(a.lifeEvents.importIcsEvents(parsed)).toEqual({ imported: 0, updated: 2, total: 2 });
    expect(a.lifeEvents.list()).toHaveLength(2);

    const anniv = a.lifeEvents.create({ title: '창립일', date: '2020-11-21', kind: 'anniversary', allDay: true, personId: person.id, projectId: proj.id });
    expect(describeEventDday(anniv, '2026-11-20')).toMatchObject({ targetDate: '2026-11-21', daysLeft: 1, label: 'D-1' });

    const markers = buildCalendarMarkers('2026-11-20', '2026-11-23', {
      projects: [proj],
      lifeEvents: a.lifeEvents.list(),
      people: [person],
    });
    expect(markers.get('2026-11-22')?.some(m => m.kind === 'project')).toBe(true);
    expect(markers.get('2026-11-22')?.some(m => m.kind === 'birthday')).toBe(true);

    const boot = a.morningBoot.snapshot('2026-11-20');
    expect(boot.duePeople.map(p => p.id)).toEqual([person.id]);
    expect(boot.dueDecisions.map(d => d.id)).toEqual([dueDec.id]);
    expect(boot.upcomingEvents.some(e => e.title === '어머니 생일' && e.daysLeft === 2)).toBe(true);
    expect(boot.upcomingEvents.some(e => e.title === '창립일' && e.daysLeft === 1)).toBe(true);

    await a.projects.delete(proj.id);
    expect(a.notes.list()[0].projectId).toBeNull();
    expect(a.lifeEvents.list().find(e => e.id === anniv.id)?.projectId).toBeNull();

    a.people.delete(person.id);
    expect(a.lifeEvents.list().find(e => e.id === anniv.id)?.personId).toBeNull();
  });

  it('validates new mutations and remains compatible with v12 backups', () => {
    expect(() => validateRelationships('eveningShutdownApply', { date: '2026-11-20' })).toThrow();
    expect(() => validateRelationships('lifeEvents', { title: '회의', date: '2026-11-20', kind: 'event', allDay: false })).toThrow();
    expect(() => validateFields('retrospectives', { type: 'monthly', dateOrWeek: '2026-11' })).not.toThrow();
    expect(() => validateRelationships('retrospectives', { type: 'monthly', dateOrWeek: '2026-13' })).toThrow();
    expect(() => validateRelationships('icsImport', {})).toThrow();

    const backups = new BackupService(() => connection.get(), () => fixedNow);
    backups.importFor('legacy-v12', {
      mode: 'replace',
      data: {
        version: 12,
        projects: [{ id: 'p1', title: 'v12 프로젝트', status: 'active', order: 0, createdAt: fixedNow.toISOString(), updatedAt: fixedNow.toISOString() }],
      },
    });
    const out = backups.exportFor('legacy-v12');
    expect(out.version).toBe(18);
    expect(out.projects).toHaveLength(1);
    expect(out.notes).toEqual([]);
    expect(out.metrics).toEqual([]);
    expect(out.subscriptions).toEqual([]);
    expect(out.financeTransactions).toEqual([]);
    expect(out.financeBudgets).toEqual([]);
  });

  it('calculates recurring subscriptions, advances billing dates, isolates users, and surfaces 3-day morning boot alerts', () => {
    expect(toMonthlyAmount(120000, 'yearly')).toBe(10000);
    expect(toMonthlyAmount(90000, 'quarterly')).toBe(30000);
    expect(Math.round(toMonthlyAmount(1000, 'weekly'))).toBe(4333);
    expect(toYearlyAmount(29000, 'monthly')).toBe(348000);
    expect(formatCurrency(29000, 'KRW')).toBe('₩29,000');
    expect(formatCurrency(20, 'USD')).toBe('$20');
    expect(formatCurrency(19.99, 'USD')).toBe('$19.99');

    expect(describeBillingDday('2026-11-23', '2026-11-20')).toMatchObject({ daysLeft: 3, isOverdue: false });
    expect(describeBillingDday('2026-11-19', '2026-11-20')).toMatchObject({ daysLeft: -1, isOverdue: true });

    expect(advanceBillingDate('2026-01-31', 'monthly', 31)).toBe('2026-02-28');
    expect(advanceBillingDate('2026-02-28', 'monthly', 31)).toBe('2026-03-31');
    expect(advanceBillingDate('2024-01-31', 'monthly', 31)).toBe('2024-02-29');
    expect(advanceBillingDate('2026-11-20', 'weekly', null)).toBe('2026-11-27');
    expect(advanceBillingDate('2026-11-20', 'quarterly', 20)).toBe('2027-02-20');
    expect(advanceBillingDate('2026-11-20', 'yearly', 20)).toBe('2027-11-20');

    const a = repos('a');
    const b = repos('b');

    const soon = a.subscriptions.create({
      name: 'ChatGPT Plus',
      amount: 20,
      currency: 'USD',
      billingCycle: 'monthly',
      status: 'active',
      billingDay: 22,
      nextBillingDate: '2026-11-22',
      category: 'AI/생산성',
      paymentMethod: '신한카드',
      autoRenew: true,
      url: 'https://chatgpt.com',
      note: '팀 공유 전 개인용',
      order: 0,
    });
    const annual = a.subscriptions.create({
      name: 'Notion 연간',
      amount: 120000,
      currency: 'KRW',
      billingCycle: 'yearly',
      status: 'active',
      billingDay: 20,
      nextBillingDate: '2026-11-25',
      category: 'AI/생산성',
      paymentMethod: null,
      autoRenew: true,
      url: null,
      note: null,
      order: 1,
    });
    const paused = a.subscriptions.create({
      name: 'Netflix',
      amount: 17000,
      currency: 'KRW',
      billingCycle: 'monthly',
      status: 'paused',
      billingDay: 21,
      nextBillingDate: '2026-11-21',
      category: '영상/OTT',
      paymentMethod: null,
      autoRenew: false,
      url: null,
      note: null,
      order: 2,
    });
    b.subscriptions.create({
      name: '타인 구독',
      amount: 9900,
      currency: 'KRW',
      billingCycle: 'monthly',
      status: 'active',
      billingDay: 21,
      nextBillingDate: '2026-11-21',
      category: null,
      paymentMethod: null,
      autoRenew: true,
      url: null,
      note: null,
      order: 0,
    });

    expect(a.subscriptions.list()).toHaveLength(3);
    expect(b.subscriptions.list()).toHaveLength(1);

    expect(expandSubscriptionBillingDates(soon, '2026-11-01', '2026-12-31')).toEqual(['2026-11-22', '2026-12-22']);
    expect(expandSubscriptionBillingDates(paused, '2026-11-01', '2026-12-31')).toEqual([]);

    const summary = summarizeSubscriptions(a.subscriptions.list(), '2026-11-20');
    expect(summary.activeCount).toBe(2);
    expect(summary.pausedCount).toBe(1);
    expect(summary.monthlyByCurrency).toEqual([
      { currency: 'KRW', amount: 10000 },
      { currency: 'USD', amount: 20 },
    ]);
    expect(summary.yearlyByCurrency).toEqual([
      { currency: 'KRW', amount: 120000 },
      { currency: 'USD', amount: 240 },
    ]);
    expect(summary.upcomingWithin7Days.map(s => s.subscription.id)).toEqual([soon.id, annual.id]);

    const boot = a.morningBoot.snapshot('2026-11-20');
    expect(boot.upcomingEvents.some(e => e.kind === 'subscription' && e.subscriptionId === soon.id && e.daysLeft === 2)).toBe(true);
    expect(boot.upcomingEvents.some(e => e.subscriptionId === annual.id)).toBe(false);
    expect(boot.upcomingEvents.some(e => e.subscriptionId === paused.id)).toBe(false);

    const markers = buildCalendarMarkers('2026-11-20', '2026-12-25', {
      subscriptions: a.subscriptions.list(),
    });
    expect(markers.get('2026-11-22')?.some(m => m.kind === 'subscription' && m.label.includes('ChatGPT Plus'))).toBe(true);
    expect(markers.get('2026-12-22')?.some(m => m.kind === 'subscription')).toBe(true);

    const updated = a.subscriptions.update(soon.id, { nextBillingDate: '2026-12-22', amount: 22 });
    expect(updated?.nextBillingDate).toBe('2026-12-22');
    expect(updated?.amount).toBe(22);

    a.subscriptions.delete(paused.id);
    expect(a.subscriptions.list()).toHaveLength(2);
  });
});
