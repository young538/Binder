'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { parseISO } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  EyeOff,
  FileSpreadsheet,
  Mail,
  Pencil,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  TOTAL_BUDGET_CATEGORY,
  formatFinanceAmount,
  formatFinanceTransactionAmount,
  getFinanceTransactionKindLabel,
  monthEndDate,
  nextMonthKey,
  prevMonthKey,
  resolveEffectiveBudgets,
  summarizeMonthFinance,
  type FinanceImportCommitResult,
} from '@/lib/finance';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import {
  deleteFinanceBudget,
  deleteFinanceTransaction,
  getFinanceAutomationStatus,
  listFinanceBudgets,
  listFinanceTransactions,
  syncSubscriptionsToFinance,
  updateFinanceTransaction,
  upsertFinanceBudget,
} from '@/lib/repo/finance';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  type FinanceTransaction,
  type FinanceTransactionKind,
} from '@/lib/types';
import { toIsoDate } from '@/lib/utils/date';
import { FinanceAutomationDialog } from './FinanceAutomationDialog';
import { FinanceImportDialog } from './FinanceImportDialog';
import { FinanceTransactionDialog } from './FinanceTransactionDialog';

const SOURCE_BADGE: Record<FinanceTransaction['source'], string | null> = {
  manual: null,
  banksalad: '뱅크샐러드',
  csv: 'CSV',
  subscription: '구독 자동',
  shortcut: '단축어',
};

const KIND_BADGE_CLASS: Record<FinanceTransactionKind, string> = {
  expense: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900',
  income: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
  transfer: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
};

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

function currentSeoulMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function FinancePage() {
  const sp = useSearchParams();
  const todayIso = toIsoDate(new Date());
  const defaultMonth = currentSeoulMonth();
  const paramMonth = sp.get('month');
  const initialMonth =
    paramMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(paramMonth) ? paramMonth : defaultMonth;

  const [month, setMonth] = useState(initialMonth);
  const [activeTab, setActiveTab] = useState<'transactions' | 'budgets'>('transactions');
  const [searchQuery, setSearchQuery] = useState(() => sp.get('q') ?? '');
  const [kindFilter, setKindFilter] = useState<'all' | FinanceTransactionKind>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinanceTransaction | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [automationDialogOpen, setAutomationDialogOpen] = useState(false);

  const [syncingSubs, setSyncingSubs] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const prevMonth = prevMonthKey(month);

  const { value: rangeTransactions, refresh: refreshTx } = useAsyncResource(
    `finance:tx:${month}`,
    () => listFinanceTransactions({ startDate: `${prevMonth}-01`, endDate: monthEndDate(month) }),
    [],
    ['financeTransactions'],
  );

  const { value: budgets, refresh: refreshBudgets } = useAsyncResource(
    `finance:budgets:${month}`,
    () => listFinanceBudgets(month),
    [],
    ['financeBudgets'],
  );

  const { value: automationStatus, refresh: refreshAutomation } = useAsyncResource(
    'finance:automation',
    getFinanceAutomationStatus,
    null,
    ['financeAutomation'],
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshTx();
        void refreshBudgets();
        void refreshAutomation();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refreshAutomation, refreshBudgets, refreshTx]);

  const monthTransactions = useMemo(
    () => rangeTransactions.filter(t => t.date.startsWith(month)),
    [month, rangeTransactions],
  );

  const prevTransactions = useMemo(
    () => rangeTransactions.filter(t => t.date.startsWith(prevMonth)),
    [prevMonth, rangeTransactions],
  );

  const summary = useMemo(
    () => summarizeMonthFinance(monthTransactions, budgets, prevTransactions, month, todayIso),
    [budgets, month, monthTransactions, prevTransactions, todayIso],
  );

  const effectiveBudgets = useMemo(
    () => resolveEffectiveBudgets(budgets, month),
    [budgets, month],
  );

  const [totalBudgetDraft, setTotalBudgetDraft] = useState<string>('');
  const [totalBudgetScope, setTotalBudgetScope] = useState<'default' | 'month'>('default');
  const [newCatBudgetName, setNewCatBudgetName] = useState<string>(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [newCatBudgetAmount, setNewCatBudgetAmount] = useState<string>('');
  const [budgetBusy, setBudgetBusy] = useState(false);

  const availableCategories = useMemo(() => {
    const set = new Set<string>(monthTransactions.map(t => t.category));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [monthTransactions]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return monthTransactions.filter(t => {
      if (kindFilter !== 'all' && t.kind !== kindFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        t.merchant.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.subCategory ?? '').toLowerCase().includes(q) ||
        (t.paymentMethod ?? '').toLowerCase().includes(q) ||
        (t.note ?? '').toLowerCase().includes(q)
      );
    });
  }, [categoryFilter, kindFilter, monthTransactions, searchQuery]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, { rows: FinanceTransaction[]; dayExpense: number }>();
    for (const tx of filteredTransactions) {
      const current = groups.get(tx.date) ?? { rows: [], dayExpense: 0 };
      current.rows.push(tx);
      if (!tx.excluded && tx.kind === 'expense' && tx.currency === 'KRW') {
        current.dayExpense += tx.amount;
      }
      groups.set(tx.date, current);
    }
    return [...groups.entries()].map(([date, info]) => {
      const d = parseISO(date);
      const label = `${date} (${WEEKDAY_KO[d.getDay()]})`;
      return { date, label, ...info };
    });
  }, [filteredTransactions]);

  const defaultTxDate = month === defaultMonth ? todayIso : `${month}-01`;

  const handleToggleExcluded = async (tx: FinanceTransaction) => {
    await updateFinanceTransaction(tx.id, { excluded: !tx.excluded });
    void refreshTx(true);
  };

  const handleDeleteTx = async (tx: FinanceTransaction) => {
    if (!confirm(`'${tx.merchant}' 거래를 삭제할까요?`)) return;
    await deleteFinanceTransaction(tx.id);
    void refreshTx(true);
  };

  const handleSyncSubscriptions = async () => {
    if (syncingSubs) return;
    setSyncingSubs(true);
    setNotice(null);
    try {
      const res = await syncSubscriptionsToFinance(month);
      await refreshTx(true);
      setNotice({
        kind: 'success',
        text:
          res.created > 0
            ? `${month} 활성 구독 고정비 ${res.created}건을 지출 내역에 반영했어요.`
            : `이미 이번 달 활성 구독 내역이 모두 반영되어 있습니다(건너뜀 ${res.skipped}건).`,
      });
    } catch (err) {
      setNotice({
        kind: 'error',
        text: err instanceof Error ? err.message : '구독 고정비 반영에 실패했습니다.',
      });
    } finally {
      setSyncingSubs(false);
    }
  };

  const handleImportCommitted = (result: FinanceImportCommitResult) => {
    setNotice({
      kind: 'success',
      text: `가져오기 완료: 신규 ${result.inserted}건 등록 · 중복 ${result.duplicates}건 건너뜀`,
    });
    void refreshTx(true);
  };

  const saveTotalBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (budgetBusy) return;
    const raw = totalBudgetDraft.trim();
    const fallbackVal = summary.totalBudget !== null ? String(summary.totalBudget) : '';
    const amount = Number((raw || fallbackVal).replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount < 0) return;

    setBudgetBusy(true);
    setNotice(null);
    try {
      await upsertFinanceBudget({
        yyyymm: totalBudgetScope === 'default' ? 'default' : month,
        category: TOTAL_BUDGET_CATEGORY,
        amount,
      });
      setTotalBudgetDraft('');
      await refreshBudgets(true);
      setNotice({ kind: 'success', text: '월 총 예산을 저장했어요.' });
    } finally {
      setBudgetBusy(false);
    }
  };

  const saveCategoryBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (budgetBusy || !newCatBudgetName.trim()) return;
    const amount = Number(newCatBudgetAmount.replace(/,/g, '').trim());
    if (!Number.isFinite(amount) || amount < 0) return;

    setBudgetBusy(true);
    try {
      await upsertFinanceBudget({
        yyyymm: totalBudgetScope === 'default' ? 'default' : month,
        category: newCatBudgetName.trim(),
        amount,
      });
      setNewCatBudgetAmount('');
      await refreshBudgets(true);
      setNotice({ kind: 'success', text: `${newCatBudgetName.trim()} 예산을 저장했어요.` });
    } finally {
      setBudgetBusy(false);
    }
  };

  const removeBudgetRow = async (id: string) => {
    await deleteFinanceBudget(id);
    await refreshBudgets(true);
  };

  const maxDailySpend = useMemo(
    () => Math.max(1, ...summary.byDay.map(d => Math.max(0, d.amount))),
    [summary.byDay],
  );

  const [yearNum, monthNum] = month.split('-');

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 pb-24 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">가계부</h1>
            <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                aria-label="이전 달"
                onClick={() => setMonth(prevMonthKey(month))}
                className="p-1.5 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                {yearNum}년 {Number(monthNum)}월
              </span>
              <button
                type="button"
                aria-label="다음 달"
                onClick={() => setMonth(nextMonthKey(month))}
                className="p-1.5 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            {month !== defaultMonth && (
              <button
                type="button"
                onClick={() => setMonth(defaultMonth)}
                className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                이번 달
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            뱅크샐러드 통합 엑셀·CSV 가져오기, 월 예산 관리, 구독 고정비 연동을 한곳에서 관리합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={syncingSubs}
            onClick={() => void handleSyncSubscriptions()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <RefreshCw size={13} className={syncingSubs ? 'animate-spin' : ''} />
            구독 고정비 반영
          </button>
          <button
            type="button"
            onClick={() => setImportDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/70"
          >
            <FileSpreadsheet size={14} />
            뱅크샐러드 엑셀 가져오기
          </button>
          <button
            type="button"
            onClick={() => setAutomationDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Mail size={13} />
            Gmail 자동 연동
            {automationStatus?.configured && (
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  automationStatus.lastImportStatus === 'error'
                    ? 'bg-red-500'
                    : automationStatus.enabled
                      ? 'bg-emerald-500'
                      : 'bg-amber-400'
                }`}
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingTx(null);
              setTxDialogOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={14} />
            거래 추가
          </button>
        </div>
      </header>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
            notice.kind === 'error'
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}
        >
          {notice.text}
        </p>
      )}

      {automationStatus?.lastImportStatus === 'error' && automationStatus.lastImportError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <span className="min-w-0 break-words">
            <strong>최근 Gmail 자동 반영 오류</strong>
            {automationStatus.lastImportFileName ? ` (${automationStatus.lastImportFileName})` : ''}:{' '}
            {automationStatus.lastImportError}
          </span>
          <button
            type="button"
            onClick={() => setAutomationDialogOpen(true)}
            className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-200"
          >
            연동 설정 확인
          </button>
        </div>
      )}

      <section aria-label="이번 달 재무 요약" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">총 지출</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatFinanceAmount(summary.totalExpense)}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            전월 대비{' '}
            <span className={summary.expenseDiff > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
              {summary.expenseDiff >= 0 ? '+' : '-'}
              {formatFinanceAmount(Math.abs(summary.expenseDiff))}
            </span>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">총 수입</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatFinanceAmount(summary.totalIncome)}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {summary.transferInTotal > 0 || summary.transferOutTotal > 0
              ? `이체 입금 +${formatFinanceAmount(summary.transferInTotal)} · 출금 -${formatFinanceAmount(summary.transferOutTotal)} (제외)`
              : '이체 ₩0 제외됨'}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">순저축 (수입 − 지출)</div>
          <div
            className={`mt-1 text-2xl font-bold tabular-nums ${
              summary.netSavings >= 0
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {summary.netSavings < 0 ? '-' : ''}
            {formatFinanceAmount(Math.abs(summary.netSavings))}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            합계 제외 {summary.excludedCount}건
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">월 예산 사용률</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {summary.budgetPercent !== null ? `${summary.budgetPercent}%` : '미설정'}
            </span>
            {summary.totalBudget !== null && (
              <span className="truncate text-xs text-zinc-500">
                / {formatFinanceAmount(summary.totalBudget)}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {summary.remainingBudget !== null
              ? summary.dailyAllowance !== null
                ? `남은 일평균 ${formatFinanceAmount(summary.dailyAllowance)}`
                : `잔여 ${formatFinanceAmount(summary.remainingBudget)}`
              : '예산 탭에서 한도를 정해보세요'}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <div className="flex gap-1.5" role="tablist" aria-label="가계부 보기">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'transactions'}
            onClick={() => setActiveTab('transactions')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              activeTab === 'transactions'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            <Wallet size={14} /> 거래 내역 ({filteredTransactions.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'budgets'}
            onClick={() => setActiveTab('budgets')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              activeTab === 'budgets'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            <PieChart size={14} /> 예산 · 분석
          </button>
        </div>

        <Link
          href="/subscriptions"
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          <CreditCard size={13} /> 구독 · 월정액 관리
        </Link>
      </div>

      {activeTab === 'transactions' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[180px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                aria-label="거래 내역 검색"
                placeholder="가맹점·카테고리·결제수단·메모 검색"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-8 pr-3 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <select
              aria-label="거래 구분 필터"
              value={kindFilter}
              onChange={e => setKindFilter(e.target.value as 'all' | FinanceTransactionKind)}
              className="rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="all">모든 구분</option>
              <option value="expense">지출</option>
              <option value="income">수입</option>
              <option value="transfer">이체</option>
            </select>
            <select
              aria-label="카테고리 필터"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="all">모든 분류</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {groupedByDate.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              {month}에 기록된 거래 내역이 없습니다. <strong>+ 거래 추가</strong>나{' '}
              <strong>뱅크샐러드 엑셀 가져오기</strong>로 내역을 채워보세요.
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByDate.map(group => (
                <div
                  key={group.date}
                  className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-4 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950/60">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">{group.label}</span>
                    <span className="font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                      지출 {formatFinanceAmount(group.dayExpense)}
                    </span>
                  </div>
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {group.rows.map(tx => {
                      const srcBadge = SOURCE_BADGE[tx.source];
                      const kindBadgeCls =
                        tx.kind === 'transfer' && tx.amount >= 0
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900'
                          : KIND_BADGE_CLASS[tx.kind];
                      const amountColorCls =
                        tx.kind === 'expense'
                          ? tx.amount < 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-zinc-900 dark:text-zinc-100'
                          : tx.kind === 'income'
                            ? tx.amount < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                            : tx.amount > 0
                              ? 'text-blue-700 dark:text-blue-400'
                              : 'text-zinc-500 dark:text-zinc-400';

                      return (
                        <li
                          key={tx.id}
                          className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs ${
                            tx.excluded ? 'opacity-55' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${kindBadgeCls}`}>
                                {getFinanceTransactionKindLabel(tx)}
                              </span>
                              {tx.kind === 'expense' && tx.amount < 0 && (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                  취소/환불
                                </span>
                              )}
                              {tx.kind === 'income' && tx.amount < 0 && (
                                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                  취소
                                </span>
                              )}
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                {tx.category}
                                {tx.subCategory ? ` · ${tx.subCategory}` : ''}
                              </span>
                              <span className={`truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100 ${tx.excluded ? 'line-through' : ''}`}>
                                {tx.merchant}
                              </span>
                              {srcBadge && (
                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                  {srcBadge}
                                </span>
                              )}
                              {tx.excluded && (
                                <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                                  합계 제외됨
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                              {tx.time && <span>{tx.time}</span>}
                              {tx.paymentMethod && <span>{tx.paymentMethod}</span>}
                              {tx.note && <span className="truncate">· {tx.note}</span>}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className={`mr-1 text-sm font-bold tabular-nums ${amountColorCls}`}>
                              {formatFinanceTransactionAmount(tx)}
                            </span>
                            <button
                              type="button"
                              title={tx.excluded ? '합계에 다시 포함' : '이번 달 합계에서 제외'}
                              aria-label={`${tx.merchant} 합계 제외 전환`}
                              aria-pressed={tx.excluded}
                              onClick={() => void handleToggleExcluded(tx)}
                              className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                                tx.excluded
                                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                  : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <EyeOff size={12} className="inline mr-0.5" />
                              {tx.excluded ? '제외됨' : '제외'}
                            </button>
                            <button
                              type="button"
                              aria-label={`${tx.merchant} 수정`}
                              onClick={() => {
                                setEditingTx(tx);
                                setTxDialogOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              aria-label={`${tx.merchant} 삭제`}
                              onClick={() => void handleDeleteTx(tx)}
                              className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              월 예산 설정
            </h2>

            <form onSubmit={e => void saveTotalBudget(e)} className="space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">적용 기준</span>
                <select
                  aria-label="예산 적용 기준"
                  value={totalBudgetScope}
                  onChange={e => setTotalBudgetScope(e.target.value as 'default' | 'month')}
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="default">매월 기본 예산으로 저장</option>
                  <option value="month">{month} 한 달만 예외 저장</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min="0"
                  aria-label="월 총 예산"
                  placeholder={summary.totalBudget !== null ? String(summary.totalBudget) : '예: 1500000'}
                  value={totalBudgetDraft}
                  disabled={budgetBusy}
                  onChange={e => setTotalBudgetDraft(e.target.value)}
                  className="min-w-[140px] flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={budgetBusy}
                  className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  총 예산 저장
                </button>
              </div>
            </form>

            <form onSubmit={e => void saveCategoryBudget(e)} className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                카테고리별 예산 추가·수정
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  list="finance-budget-cat-list"
                  aria-label="예산 카테고리 이름"
                  value={newCatBudgetName}
                  onChange={e => setNewCatBudgetName(e.target.value)}
                  className="min-w-[120px] flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                />
                <datalist id="finance-budget-cat-list">
                  {DEFAULT_EXPENSE_CATEGORIES.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <input
                  type="number"
                  min="0"
                  aria-label="카테고리 예산 금액"
                  placeholder="금액 (원)"
                  value={newCatBudgetAmount}
                  onChange={e => setNewCatBudgetAmount(e.target.value)}
                  className="w-32 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="submit"
                  disabled={budgetBusy}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  저장
                </button>
              </div>
            </form>

            {budgets.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">저장된 예산 규칙</div>
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-xs dark:divide-zinc-800 dark:border-zinc-800">
                  {budgets.map(b => (
                    <li key={b.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {b.category === TOTAL_BUDGET_CATEGORY ? '월 총 예산' : b.category}
                        </span>
                        <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {b.yyyymm === 'default' ? '매월 기본' : b.yyyymm}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{formatFinanceAmount(b.amount)}</span>
                        <button
                          type="button"
                          aria-label={`${b.category} 예산 삭제`}
                          onClick={() => void removeBudgetRow(b.id)}
                          className="text-zinc-400 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  카테고리별 지출 · 예산 현황
                </h2>
                {effectiveBudgets.totalBudget !== null && (
                  <span className="text-xs text-zinc-500">
                    총 예산 {formatFinanceAmount(effectiveBudgets.totalBudget)}
                  </span>
                )}
              </div>

              {summary.byCategory.length === 0 ? (
                <p className="text-xs text-zinc-500">이번 달 지출 내역이나 설정된 카테고리 예산이 없습니다.</p>
              ) : (
                <ul className="space-y-3">
                  {summary.byCategory.map(cat => {
                    const ratio = cat.budgetPercent ?? cat.percent;
                    const barColor =
                      cat.budgetPercent !== null
                        ? cat.budgetPercent > 100
                          ? 'bg-rose-500'
                          : cat.budgetPercent >= 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        : 'bg-blue-500';
                    return (
                      <li key={cat.category} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {cat.category}
                            <span className="ml-1.5 text-[11px] text-zinc-400">({cat.count}건)</span>
                          </span>
                          <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                            <strong>{formatFinanceAmount(cat.amount)}</strong>
                            {cat.budget !== null
                              ? ` / ${formatFinanceAmount(cat.budget)} (${cat.budgetPercent}%)`
                              : ` (${cat.percent}%)`}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${Math.min(100, Math.max(cat.amount > 0 ? 3 : 0, ratio))}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-2.5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  일별 지출 추이
                </h2>
                <span className="text-[11px] text-zinc-500">1일 ~ {summary.byDay.length}일</span>
              </div>
              <div
                aria-label={`${month} 일별 지출 그래프`}
                className="flex h-28 items-end gap-0.5 rounded-xl bg-zinc-50 px-2 py-2 dark:bg-zinc-950"
              >
                {summary.byDay.map(d => {
                  const pct = d.amount > 0 ? Math.max(6, Math.round((d.amount / maxDailySpend) * 100)) : 0;
                  return (
                    <div
                      key={d.date}
                      title={`${d.date}: ${formatFinanceAmount(d.amount)}`}
                      className="flex h-full flex-1 flex-col justify-end"
                    >
                      <div
                        className={`w-full rounded-t ${
                          d.amount > 0 ? 'bg-blue-500 dark:bg-blue-400' : 'bg-zinc-200/70 dark:bg-zinc-800'
                        }`}
                        style={{ height: d.amount > 0 ? `${pct}%` : '2px' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {txDialogOpen && (
        <FinanceTransactionDialog
          initial={editingTx}
          defaultDate={defaultTxDate}
          onClose={() => setTxDialogOpen(false)}
          onSaved={() => void refreshTx(true)}
        />
      )}

      {importDialogOpen && (
        <FinanceImportDialog
          onClose={() => setImportDialogOpen(false)}
          onCommitted={handleImportCommitted}
        />
      )}

      {automationDialogOpen && (
        <FinanceAutomationDialog
          status={automationStatus}
          onClose={() => setAutomationDialogOpen(false)}
          onChanged={() => void refreshAutomation(true)}
        />
      )}
    </div>
  );
}
