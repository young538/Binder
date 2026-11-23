'use client';
import Link from 'next/link';
import { endOfMonth, parseISO } from 'date-fns';
import {
  formatFinanceAmount,
  prevMonthKey,
  summarizeMonthFinance,
  type FinanceMonthlySummary,
} from '@/lib/finance';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { useBinder } from '@/store';
import { useRetrospectiveEditor } from '@/lib/autosave/editors';
import { listByYear as listBooksByYear } from '@/lib/repo/books';
import { listDailyCheckinsInRange } from '@/lib/repo/dailyCheckins';
import { listFinanceBudgets, listFinanceTransactions } from '@/lib/repo/finance';
import { listLogsForRange } from '@/lib/repo/habitLogs';
import { listHabits } from '@/lib/repo/habits';
import { getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { listByScope, listDayTodosInRange } from '@/lib/repo/todos';
import { toIsoDate } from '@/lib/utils/date';
import { computeHabitStatsForRange } from '@/lib/utils/habitSchedule';
import { AutosaveStatus } from '@/components/common/AutosaveStatus';
import { PlanActualComparison } from './PlanActualComparison';
import { RetroCoachCard } from './RetroCoachCard';
import { RetroPeriodHeader } from './RetroPeriodHeader';
import { RetroTemplate } from './RetroTemplate';

export function MonthlyRetroPage({ yyyymm }: { yyyymm: string }) {
  const { categories, projects } = useBinder();
  const editor = useRetrospectiveEditor('monthly', yyyymm);
  const year = yyyymm.slice(0, 4);

  const prevYyyymm = prevMonthKey(yyyymm);
  const { value } = useAsyncResource(
    `retro:monthly:${yyyymm}`,
    async () => {
      const startObj = parseISO(`${yyyymm}-01`);
      const endObj = endOfMonth(startObj);
      const start = toIsoDate(startObj);
      const end = toIsoDate(endObj);
      const [blocks, dayTodos, monthTodos, habits, logs, books, checkins, financeTxRange, financeBudgets] = await Promise.all([
        getTimeBlocksInRange(start, end),
        listDayTodosInRange(start, end),
        listByScope('month', yyyymm),
        listHabits(),
        listLogsForRange(start, end),
        listBooksByYear(year),
        listDailyCheckinsInRange(start, end),
        listFinanceTransactions({ startDate: `${prevYyyymm}-01`, endDate: end }),
        listFinanceBudgets(yyyymm),
      ]);
      const financeSummary: FinanceMonthlySummary | null = summarizeMonthFinance(
        financeTxRange.filter(t => t.date.startsWith(yyyymm)),
        financeBudgets,
        financeTxRange.filter(t => t.date.startsWith(prevYyyymm)),
        yyyymm,
        toIsoDate(new Date()),
      );
      return {
        blocks,
        todos: [...monthTodos, ...dayTodos],
        habitStats: computeHabitStatsForRange(habits, logs, startObj, endObj),
        finishedBooks: books.filter(b => b.finishedAt?.slice(0, 7) === yyyymm),
        checkins,
        financeSummary: financeSummary as FinanceMonthlySummary | null,
      };
    },
    {
      blocks: [],
      todos: [],
      habitStats: { total: 0, logs: 0, expected: 0, percent: 0 },
      finishedBooks: [],
      checkins: [],
      financeSummary: null as FinanceMonthlySummary | null,
    },
    ['timeBlocks', 'todos', 'habits', 'habitLogs', 'books', 'dailyCheckins', 'financeTransactions', 'financeBudgets'],
  );

  const actualMin = value.blocks
    .filter(b => (b.kind ?? 'plan') === 'actual')
    .reduce((sum, b) => sum + (b.endMin - b.startMin), 0);
  const doneTodos = value.todos.filter(t => t.status === 'done').length;
  const completedProjects = projects.filter(
    p => p.status === 'done' && p.completedAt?.slice(0, 7) === yyyymm,
  );

  const sleepVals = value.checkins.map(c => c.sleepHours).filter((v): v is number => v != null);
  const energyVals = value.checkins.map(c => c.energy).filter((v): v is 1 | 2 | 3 | 4 | 5 => v != null);
  const avgSleep = sleepVals.length > 0 ? (sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length).toFixed(1) : '-';
  const avgEnergy = energyVals.length > 0 ? (energyVals.reduce((a, b) => a + b, 0) / energyVals.length).toFixed(1) : '-';

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <RetroPeriodHeader mode="monthly" period={yyyymm} />

      <section className="mb-6 space-y-3" aria-label="월간 실행 요약">
        <PlanActualComparison blocks={value.blocks} categories={categories} />

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-xs text-zinc-500">실제 기록 시간</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {(actualMin / 60).toFixed(1)}h
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-xs text-zinc-500">할 일 · 습관</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {doneTodos}/{value.todos.length}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">습관 {value.habitStats.percent}%</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-xs text-zinc-500">완료 프로젝트 · 완독</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {completedProjects.length}개 · {value.finishedBooks.length}권
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-xs text-zinc-500">평균 수면 · 에너지</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {avgSleep}h · {avgEnergy}
            </div>
          </div>
        </div>

        {value.financeSummary && (value.financeSummary.totalExpense > 0 || value.financeSummary.totalIncome > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center gap-3 text-zinc-700 dark:text-zinc-300">
              <strong className="text-zinc-900 dark:text-zinc-100">월간 가계부</strong>
              <span>지출 {formatFinanceAmount(value.financeSummary.totalExpense)}</span>
              <span>수입 {formatFinanceAmount(value.financeSummary.totalIncome)}</span>
              {value.financeSummary.budgetPercent !== null && (
                <span>예산 {value.financeSummary.budgetPercent}%</span>
              )}
              {value.financeSummary.topCategories.length > 0 && (
                <span className="text-zinc-500 dark:text-zinc-400">
                  상위: {value.financeSummary.topCategories.map(c => `${c.category}(${formatFinanceAmount(c.amount)})`).join(', ')}
                </span>
              )}
            </div>
            <Link href={`/finance?month=${yyyymm}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
              가계부 보기
            </Link>
          </div>
        )}
      </section>

      <RetroCoachCard
        key={`monthly:${yyyymm}`}
        mode="monthly"
        period={yyyymm}
        currentTemplate={editor.value.template}
        editorLoaded={editor.loaded}
        onApplyDraft={editor.patch}
      />

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {editor.loaded && (
          <RetroTemplate
            value={editor.value}
            onChange={editor.patch}
            beforeCreate={editor.flush}
            source={{ type: 'monthly', dateOrWeek: yyyymm }}
          />
        )}
        <AutosaveStatus {...editor} />
      </div>
    </div>
  );
}
