'use client';
import { useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarHeart,
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  FolderKanban,
  NotebookPen,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import type { DashboardSnapshot } from '@/lib/dashboard';
import { formatFinanceAmount } from '@/lib/finance';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { describeDeadline } from '@/lib/projects';
import { getDashboardSnapshot } from '@/lib/repo/dashboard';
import { toggleDone } from '@/lib/repo/todos';
import { describeBillingDday, formatCurrency } from '@/lib/subscriptions';
import { minutesToTimeStr, toIsoDate } from '@/lib/utils/date';
import { MetricSparkline } from '@/components/metrics/MetricSparkline';

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export function DashboardPage() {
  const [today] = useState(() => toIsoDate(new Date()));
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { value: data, loading, error, refresh } = useAsyncResource<DashboardSnapshot | null>(
    `dashboard:${today}`,
    () => getDashboardSnapshot(today),
    null,
    [
      'todos',
      'timeBlocks',
      'dailyCheckins',
      'focusNotes',
      'projects',
      'lifeEvents',
      'subscriptions',
      'metrics',
      'metricEntries',
      'habits',
      'habitLogs',
      'people',
      'notes',
      'googleCalendar',
    ],
  );

  const onToggleTodo = async (id: string) => {
    if (togglingId) return;
    setTogglingId(id);
    try {
      await toggleDone(id);
    } finally {
      setTogglingId(null);
    }
  };

  if (!data && loading) {
    return (
      <div className="mx-auto max-w-6xl p-4 pb-24 md:p-6">
        <p className="text-sm text-zinc-500">인생 OS 대시보드를 불러오는 중…</p>
      </div>
    );
  }

  if (!data && error) {
    return (
      <div className="mx-auto max-w-6xl p-4 pb-24 md:p-6">
        <button
          type="button"
          onClick={() => void refresh(true)}
          className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
        >
          대시보드를 불러오지 못했어요. 다시 시도
        </button>
      </div>
    );
  }

  if (!data) return null;

  const formattedDate = format(parseISO(data.date), 'yyyy년 M월 d일 (EEE)', { locale: ko });
  const todoPercent = data.todayTodos.total > 0
    ? Math.round((data.todayTodos.done / data.todayTodos.total) * 100)
    : 0;
  const hasAttention =
    data.attention.overdueTodosCount > 0 ||
    data.attention.projectsWithoutNextAction > 0 ||
    data.attention.duePeopleCount > 0 ||
    data.attention.dueDecisionsCount > 0 ||
    data.attention.upcomingBillsCount > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 pb-24 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            Life OS Control Room
          </div>
          <h1 className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            인생 OS 대시보드
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {formattedDate} · {data.isoWeek}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/daily/${data.date}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            오늘 일일 <ArrowRight size={14} />
          </Link>
          <Link
            href={`/week/${data.isoWeek}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Calendar size={14} /> 주간 시간표
          </Link>
          <Link
            href={`/retrospective/week/${data.isoWeek}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <NotebookPen size={14} /> 주간 회고
          </Link>
          <Link
            href="/settings#google-calendar"
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
              data.googleCalendar.lastSyncError
                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'
                : data.googleCalendar.connected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
            }`}
          >
            <RefreshCw size={13} />
            {data.googleCalendar.connected
              ? `Google 연동${data.googleCalendar.lastSyncError ? ' (확인 필요)' : ''}`
              : 'Google 연동 안 됨'}
          </Link>
        </div>
      </header>

      {hasAttention && (
        <section
          aria-label="오늘 주의가 필요한 항목"
          className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20"
        >
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle size={14} />
            확인할 항목
          </div>
          <div className="flex flex-wrap gap-2">
            {data.attention.overdueTodosCount > 0 && (
              <Link
                href={`/daily/${data.date}`}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-zinc-900 dark:text-amber-200 dark:ring-amber-900/60"
              >
                이월 대기 할 일 {data.attention.overdueTodosCount}개
              </Link>
            )}
            {data.attention.projectsWithoutNextAction > 0 && (
              <Link
                href="/projects"
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-zinc-900 dark:text-amber-200 dark:ring-amber-900/60"
              >
                다음 행동 없는 프로젝트 {data.attention.projectsWithoutNextAction}개
              </Link>
            )}
            {data.attention.duePeopleCount > 0 && (
              <Link
                href="/life"
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-zinc-900 dark:text-amber-200 dark:ring-amber-900/60"
              >
                안부 연락 필요 {data.attention.duePeopleCount}명
              </Link>
            )}
            {data.attention.dueDecisionsCount > 0 && (
              <Link
                href="/notes"
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-zinc-900 dark:text-amber-200 dark:ring-amber-900/60"
              >
                복기 예정 의사결정 {data.attention.dueDecisionsCount}건
              </Link>
            )}
            {data.attention.upcomingBillsCount > 0 && (
              <Link
                href="/subscriptions"
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-zinc-900 dark:text-amber-200 dark:ring-amber-900/60"
              >
                7일 이내 구독 결제 {data.attention.upcomingBillsCount}건
              </Link>
            )}
          </div>
        </section>
      )}

      <section aria-label="대시보드 핵심 지표" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">오늘 할 일</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {data.todayTodos.done}/{data.todayTodos.total}
            </span>
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {todoPercent}%
            </span>
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            남은 항목 {data.todayTodos.pending}개
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">오늘 시간 실행</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatHours(data.todayTime.actualMin)}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            계획 {formatHours(data.todayTime.planMin)}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">주간 습관 · 오늘 컨디션</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {data.weeklyHabitPercent}%
          </div>
          <div className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
            수면 {data.todayCheckin?.sleepHours != null ? `${data.todayCheckin.sleepHours}h` : '미기록'}
            {' · '}
            에너지 {data.todayCheckin?.energy != null ? `${data.todayCheckin.energy}/5` : '미기록'}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">월 고정 구독</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {data.subscriptionSummary.monthlyByCurrency.length > 0
              ? data.subscriptionSummary.monthlyByCurrency
                  .map(item => formatCurrency(item.amount, item.currency))
                  .join(' · ')
              : '₩0'}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            활성 {data.subscriptionSummary.activeCount}개
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <CalendarHeart size={16} className="text-blue-600 dark:text-blue-400" />
              오늘 일정 · 다가오는 7일
            </h2>
            <Link href="/life" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
              전체 보기
            </Link>
          </div>

          {data.todayEvents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              오늘 등록된 일정이 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.todayEvents.map(ev => (
                <li
                  key={ev.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-zinc-800 dark:text-zinc-100">
                        {ev.title}
                      </span>
                      {ev.isGoogle && (
                        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          Google
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                    <Clock size={12} />
                    {ev.allDay || ev.startMin == null || ev.endMin == null
                      ? '종일'
                      : `${minutesToTimeStr(ev.startMin)}–${minutesToTimeStr(ev.endMin)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {data.upcomingItems.length > 0 && (
            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">7일 이내 주요 일정</div>
              <ul className="space-y-1.5">
                {data.upcomingItems.slice(0, 6).map(item => (
                  <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-zinc-700 dark:text-zinc-300">{item.title}</span>
                    <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">
                      {item.label} · {item.date.slice(5)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              오늘의 하이라이트 · 할 일
            </h2>
            <Link
              href={`/daily/${data.date}`}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              일일 트래커
            </Link>
          </div>

          <div className="rounded-xl bg-blue-50/70 px-3 py-2.5 text-xs leading-5 text-blue-950 dark:bg-blue-950/30 dark:text-blue-100">
            <span className="font-semibold">오늘의 한 줄 목표: </span>
            {data.highlight.trim() || '아직 설정되지 않았어요. 일일 페이지에서 오늘의 하이라이트를 정해 보세요.'}
          </div>

          {data.todayTodos.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              오늘 등록된 할 일이 없습니다.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.todayTodos.items.map(todo => {
                const done = todo.status === 'done';
                return (
                  <li key={todo.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <button
                      type="button"
                      aria-label={done ? `${todo.title} 완료 해제` : `${todo.title} 완료`}
                      disabled={togglingId === todo.id}
                      onClick={() => void onToggleTodo(todo.id)}
                      className="shrink-0 text-zinc-400 hover:text-blue-600 disabled:opacity-50"
                    >
                      {done ? (
                        <CheckCircle2 size={17} className="text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle size={17} />
                      )}
                    </button>
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${
                        done ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-800 dark:text-zinc-100'
                      }`}
                    >
                      {todo.title}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <FolderKanban size={16} className="text-blue-600 dark:text-blue-400" />
              진행 중 프로젝트
            </h2>
            <Link href="/projects" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
              전체 보기
            </Link>
          </div>

          {data.activeProjects.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              진행 중인 프로젝트가 없습니다.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.activeProjects.map(item => {
                const deadlineInfo = describeDeadline(item.project.deadline, data.date, item.project.status);
                return (
                  <li key={item.project.id} className="space-y-1.5 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                        {item.project.title}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {item.needsNextAction && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                            다음 행동 필요
                          </span>
                        )}
                        {deadlineInfo && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              deadlineInfo.overdue
                                ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                            }`}
                          >
                            {deadlineInfo.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                      <span>
                        완료 {item.doneTodos}/{item.totalTodos} ({item.progressPercent}%)
                      </span>
                      <span className="tabular-nums">투입 {formatHours(item.actualMinutes)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <CreditCard size={16} className="text-blue-600 dark:text-blue-400" />
              구독 · 다가오는 결제
            </h2>
            <Link href="/subscriptions" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
              구독 관리
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">월 환산 합계</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {data.subscriptionSummary.monthlyByCurrency.length > 0
                  ? data.subscriptionSummary.monthlyByCurrency
                      .map(c => formatCurrency(c.amount, c.currency))
                      .join(' · ')
                  : '₩0'}
              </div>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">연 환산 합계</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {data.subscriptionSummary.yearlyByCurrency.length > 0
                  ? data.subscriptionSummary.yearlyByCurrency
                      .map(c => formatCurrency(c.amount, c.currency))
                      .join(' · ')
                  : '₩0'}
              </div>
            </div>
          </div>

          {data.subscriptionSummary.upcomingWithin7Days.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              7일 이내 예정된 결제가 없습니다.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.subscriptionSummary.upcomingWithin7Days.map(item => {
                const dday = describeBillingDday(item.nextBillingDate, data.date);
                return (
                  <li
                    key={item.subscription.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-800 dark:text-zinc-100">
                        {item.subscription.name}
                      </div>
                      <div className="text-zinc-500 dark:text-zinc-400">
                        {formatCurrency(item.subscription.amount, item.subscription.currency)} · {item.nextBillingDate}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                      {dday.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            <Wallet size={16} className="text-emerald-600 dark:text-emerald-400" />
            이번 달 가계부 ({data.monthFinance.yyyymm}
            {data.monthFinance.cycleStartDay > 1
              ? ` · ${Number(data.monthFinance.startDate.slice(5, 7))}.${data.monthFinance.startDate.slice(8, 10)} ~ ${Number(data.monthFinance.endDate.slice(5, 7))}.${data.monthFinance.endDate.slice(8, 10)}`
              : ''})
          </h2>
          <Link href={`/finance?month=${data.monthFinance.yyyymm}`} className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
            가계부 열기
          </Link>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">총 지출</div>
            <div className="mt-0.5 text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatFinanceAmount(data.monthFinance.totalExpense)}
            </div>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">총 수입</div>
            <div className="mt-0.5 text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatFinanceAmount(data.monthFinance.totalIncome)}
            </div>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">월 예산</div>
            <div className="mt-0.5 text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {data.monthFinance.budgetPercent !== null
                ? `${data.monthFinance.budgetPercent}%`
                : '미설정'}
            </div>
            {data.monthFinance.dailyAllowance !== null && (
              <div className="text-[11px] text-zinc-500">
                일평균 {formatFinanceAmount(data.monthFinance.dailyAllowance)}
              </div>
            )}
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">상위 지출 분류</div>
            <div className="mt-0.5 truncate font-semibold text-zinc-800 dark:text-zinc-200">
              {data.monthFinance.topCategories.length > 0
                ? data.monthFinance.topCategories
                    .map(c => `${c.category} ${formatFinanceAmount(c.amount)}`)
                    .join(' · ')
                : '기록 없음'}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            <Activity size={16} className="text-blue-600 dark:text-blue-400" />
            상태 지표 추세
          </h2>
          <Link href="/metrics" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
            지표 기록
          </Link>
        </div>

        {data.metrics.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            등록된 상태 지표가 없습니다. 체중, 순자산, 독서량 등 내 핵심 지표를 추가해 보세요.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.metrics.map(item => {
              const latestText = item.summary.latest
                ? `${item.summary.latest.value}${item.metric.unit ? ` ${item.metric.unit}` : ''}`
                : '기록 없음';
              const delta = item.summary.delta;
              return (
                <div
                  key={item.metric.id}
                  className="min-w-0 space-y-2 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                      {item.metric.name}
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                      {latestText}
                    </span>
                  </div>
                  <MetricSparkline
                    entries={item.entries}
                    color={item.metric.color}
                    targetValue={item.metric.targetValue}
                    label={item.metric.name}
                  />
                  {delta != null && (
                    <div className="text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
                      직전 대비 {delta > 0 ? `+${delta}` : delta}
                      {item.metric.unit ? ` ${item.metric.unit}` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
