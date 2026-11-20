'use client';
import { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import {
  deleteSubscription,
  listSubscriptions,
  updateSubscription,
} from '@/lib/repo/subscriptions';
import {
  advanceBillingDate,
  describeBillingDday,
  formatCurrency,
  summarizeSubscriptions,
  toMonthlyAmount,
} from '@/lib/subscriptions';
import {
  BILLING_CYCLE_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  type Subscription,
  type SubscriptionStatus,
} from '@/lib/types';
import { toIsoDate } from '@/lib/utils/date';
import { fieldClass } from '@/components/common/Dialog';
import { SubscriptionEditorDialog } from './SubscriptionEditorDialog';

type StatusTab = 'all' | SubscriptionStatus;
type SortKey = 'nextBilling' | 'monthlyAmount' | 'name';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'active', label: '구독 중' },
  { key: 'paused', label: '일시정지' },
  { key: 'cancelled', label: '해지됨' },
  { key: 'all', label: '전체' },
];

export function SubscriptionsPage({ initialSubscriptionId }: { initialSubscriptionId?: string }) {
  const today = toIsoDate(new Date());
  const { value: items, loading, error, refresh } = useAsyncResource(
    'subscriptions:list',
    listSubscriptions,
    [],
    ['subscriptions'],
  );

  const [statusTab, setStatusTab] = useState<StatusTab>(() => (initialSubscriptionId ? 'all' : 'active'));
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('nextBilling');
  const [dialog, setDialog] = useState<{ open: boolean; editing?: Subscription }>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const summary = useMemo(() => summarizeSubscriptions(items, today), [items, today]);

  const categories = useMemo(
    () =>
      [...new Set(items.map(s => s.category?.trim()).filter((v): v is string => !!v))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );

  const filtered = useMemo(() => {
    const rows = items.filter(sub => {
      if (statusTab !== 'all' && sub.status !== statusTab) return false;
      if (categoryFilter && (sub.category ?? '') !== categoryFilter) return false;
      return true;
    });

    return [...rows].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'monthlyAmount') {
        const diff = toMonthlyAmount(b.amount, b.billingCycle) - toMonthlyAmount(a.amount, a.billingCycle);
        return diff || a.name.localeCompare(b.name);
      }
      const dateA = a.nextBillingDate ?? '9999-12-31';
      const dateB = b.nextBillingDate ?? '9999-12-31';
      return dateA.localeCompare(dateB) || a.name.localeCompare(b.name);
    });
  }, [items, statusTab, categoryFilter, sortBy]);

  const advanceDate = async (sub: Subscription) => {
    if (!sub.nextBillingDate || busyId) return;
    setBusyId(sub.id);
    setNotice('');
    try {
      const next = advanceBillingDate(sub.nextBillingDate, sub.billingCycle, sub.billingDay);
      await updateSubscription(sub.id, { nextBillingDate: next });
      setNotice(`${sub.name} 다음 결제일을 ${next}(으)로 갱신했어요.`);
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = async (sub: Subscription, status: SubscriptionStatus) => {
    if (busyId) return;
    setBusyId(sub.id);
    setNotice('');
    try {
      await updateSubscription(sub.id, { status });
      setNotice(`${sub.name} 상태를 '${SUBSCRIPTION_STATUS_LABEL[status]}'(으)로 변경했어요.`);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (sub: Subscription) => {
    if (!confirm(`'${sub.name}' 구독 기록을 삭제할까요?`)) return;
    await deleteSubscription(sub.id);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-24 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            Recurring Subscriptions
          </div>
          <h1 className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-zinc-50">구독 · 월정액 관리</h1>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            매월·매년 빠져나가는 정기결제와 멤버십 고정비를 한눈에 모으고 결제일을 놓치지 않게 관리하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ open: true })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus size={16} /> 새 구독
        </button>
      </header>

      <section aria-label="구독 요약 지표" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">월 환산 고정비</div>
          <div className="mt-1.5 space-y-0.5">
            {summary.monthlyByCurrency.length === 0 ? (
              <div className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">₩0</div>
            ) : (
              summary.monthlyByCurrency.map((row, idx) => (
                <div
                  key={row.currency}
                  className={
                    idx === 0
                      ? 'text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50'
                      : 'text-sm font-semibold tabular-nums text-zinc-600 dark:text-zinc-300'
                  }
                >
                  {formatCurrency(row.amount, row.currency)}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">연 환산 고정비</div>
          <div className="mt-1.5 space-y-0.5">
            {summary.yearlyByCurrency.length === 0 ? (
              <div className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">₩0</div>
            ) : (
              summary.yearlyByCurrency.map((row, idx) => (
                <div
                  key={row.currency}
                  className={
                    idx === 0
                      ? 'text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50'
                      : 'text-sm font-semibold tabular-nums text-zinc-600 dark:text-zinc-300'
                  }
                >
                  {formatCurrency(row.amount, row.currency)}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">활성 구독</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {summary.activeCount}개
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            일시정지 {summary.pausedCount} · 해지 {summary.cancelledCount}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <CalendarClock size={13} /> 7일 이내 결제
          </div>
          <div className="mt-1.5 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {summary.upcomingWithin7Days.length}건
          </div>
          <div className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {summary.upcomingWithin7Days.length > 0
              ? summary.upcomingWithin7Days
                  .slice(0, 2)
                  .map(u => `${u.subscription.name} (${u.daysLeft === 0 ? '오늘' : `D-${u.daysLeft}`})`)
                  .join(' · ')
              : '예정된 결제 없음'}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="구독 상태 필터">
          {STATUS_TABS.map(tab => {
            const count =
              tab.key === 'all'
                ? items.length
                : tab.key === 'active'
                  ? summary.activeCount
                  : tab.key === 'paused'
                    ? summary.pausedCount
                    : summary.cancelledCount;
            const active = statusTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusTab(tab.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <select
            aria-label="구독 분류 필터"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className={`sm:w-40 ${fieldClass}`}
          >
            <option value="">모든 분류</option>
            {categories.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label="구독 정렬"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className={`sm:w-40 ${fieldClass}`}
          >
            <option value="nextBilling">다음 결제일순</option>
            <option value="monthlyAmount">월 환산 금액순</option>
            <option value="name">이름순</option>
          </select>
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}

      {loading && items.length === 0 && <p className="text-sm text-zinc-500">구독 목록을 불러오는 중…</p>}
      {!!error && (
        <button type="button" onClick={() => void refresh()} className="text-sm text-red-600 hover:underline">
          구독 목록을 불러오지 못했어요. 다시 시도
        </button>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-5 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
            <CreditCard size={22} />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            등록된 구독이 없습니다
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            사용 중인 AI·OTT·클라우드 월정액이나 연간 멤버십을 첫 항목으로 기록해 보세요.
          </p>
          <button
            type="button"
            onClick={() => setDialog({ open: true })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} /> 첫 구독 등록
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map(sub => {
          const highlighted = initialSubscriptionId === sub.id;
          const dday = sub.nextBillingDate ? describeBillingDday(sub.nextBillingDate, today) : null;
          const monthlyEq = toMonthlyAmount(sub.amount, sub.billingCycle);
          return (
            <article
              key={sub.id}
              className={`min-w-0 rounded-2xl border bg-white p-4 shadow-sm dark:bg-zinc-900 sm:p-5 ${
                highlighted
                  ? 'border-blue-400 ring-2 ring-blue-500/20 dark:border-blue-600'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        sub.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : sub.status === 'paused'
                            ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {SUBSCRIPTION_STATUS_LABEL[sub.status]}
                    </span>
                    {sub.category && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {sub.category}
                      </span>
                    )}
                    <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                      {sub.autoRenew ? '자동 갱신' : '수동 갱신'}
                    </span>
                  </div>
                  <h2 className="break-words text-base font-bold text-zinc-900 dark:text-zinc-50">{sub.name}</h2>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`${sub.name} 편집`}
                    onClick={() => setDialog({ open: true, editing: sub })}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${sub.name} 삭제`}
                    onClick={() => void remove(sub)}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(sub.amount, sub.currency)}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    / {BILLING_CYCLE_LABEL[sub.billingCycle]}
                  </span>
                </div>
                {sub.billingCycle !== 'monthly' && (
                  <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    월 약 {formatCurrency(monthlyEq, sub.currency)}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                {sub.nextBillingDate && dday ? (
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <span>다음 결제 {sub.nextBillingDate}</span>
                    {sub.status === 'active' && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          dday.isOverdue || dday.daysLeft === 0
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : dday.daysLeft <= 7
                              ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        }`}
                      >
                        {dday.label}
                      </span>
                    )}
                  </span>
                ) : (
                  <span>결제일 미지정</span>
                )}
                {sub.billingDay != null && <span>매월 {sub.billingDay}일</span>}
                {sub.paymentMethod && <span>💳 {sub.paymentMethod}</span>}
                {sub.url && (
                  <a
                    href={sub.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-blue-600 hover:underline dark:text-blue-400"
                  >
                    관리 페이지 <ExternalLink size={11} />
                  </a>
                )}
              </div>

              {sub.note && (
                <p className="mt-2.5 whitespace-pre-wrap break-words text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                  {sub.note}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                {sub.status === 'active' && sub.nextBillingDate && (
                  <button
                    type="button"
                    disabled={busyId === sub.id}
                    onClick={() => void advanceDate(sub)}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-950/50 dark:text-blue-300"
                  >
                    <RefreshCw size={12} /> 다음 결제일로 갱신
                  </button>
                )}
                {sub.status === 'active' ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === sub.id}
                      onClick={() => void changeStatus(sub, 'paused')}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <PauseCircle size={12} /> 일시정지
                    </button>
                    <button
                      type="button"
                      disabled={busyId === sub.id}
                      onClick={() => void changeStatus(sub, 'cancelled')}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      <XCircle size={12} /> 해지
                    </button>
                  </>
                ) : sub.status === 'paused' ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === sub.id}
                      onClick={() => void changeStatus(sub, 'active')}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/50 dark:text-emerald-300"
                    >
                      <PlayCircle size={12} /> 다시 구독
                    </button>
                    <button
                      type="button"
                      disabled={busyId === sub.id}
                      onClick={() => void changeStatus(sub, 'cancelled')}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      <XCircle size={12} /> 해지
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === sub.id}
                    onClick={() => void changeStatus(sub, 'active')}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/50 dark:text-emerald-300"
                  >
                    <CheckCircle2 size={12} /> 다시 구독
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {dialog.open && (
        <SubscriptionEditorDialog
          key={dialog.editing?.id ?? 'new'}
          existing={dialog.editing}
          nextOrder={items.length}
          onClose={() => setDialog({ open: false })}
        />
      )}
    </div>
  );
}
