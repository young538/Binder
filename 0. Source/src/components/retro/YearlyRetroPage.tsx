'use client';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { useBinder } from '@/store';
import { useRetrospectiveEditor } from '@/lib/autosave/editors';
import { listByYear as listAnnualGoalsByYear } from '@/lib/repo/annualGoals';
import { listByYear as listBooksByYear } from '@/lib/repo/books';
import { listDailyCheckinsInRange } from '@/lib/repo/dailyCheckins';
import { getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { listDayTodosInRange } from '@/lib/repo/todos';
import { AutosaveStatus } from '@/components/common/AutosaveStatus';
import { RetroPeriodHeader } from './RetroPeriodHeader';
import { RetroTemplate } from './RetroTemplate';

export function YearlyRetroPage({ year }: { year: string }) {
  const { projects } = useBinder();
  const editor = useRetrospectiveEditor('yearly', year);

  const { value } = useAsyncResource(
    `retro:yearly:${year}`,
    async () => {
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      const [blocks, dayTodos, annualGoals, books, checkins] = await Promise.all([
        getTimeBlocksInRange(start, end),
        listDayTodosInRange(start, end),
        listAnnualGoalsByYear(year),
        listBooksByYear(year),
        listDailyCheckinsInRange(start, end),
      ]);
      return {
        blocks,
        dayTodos,
        annualGoals,
        finishedBooks: books.filter(b => b.finishedAt?.startsWith(year)),
        checkins,
      };
    },
    { blocks: [], dayTodos: [], annualGoals: [], finishedBooks: [], checkins: [] },
    ['timeBlocks', 'todos', 'annualGoals', 'books', 'dailyCheckins'],
  );

  const actualMin = value.blocks
    .filter(b => (b.kind ?? 'plan') === 'actual')
    .reduce((sum, b) => sum + (b.endMin - b.startMin), 0);
  const doneTodos = value.dayTodos.filter(t => t.status === 'done').length;
  const completedProjects = projects.filter(
    p => p.status === 'done' && p.completedAt?.startsWith(year),
  );
  const namedGoals = value.annualGoals.filter(g => g.title.trim().length > 0);
  const achievedGoals = namedGoals.filter(g => {
    if (!g.target || g.target <= 0) return false;
    const sum = g.monthlyActuals.reduce<number>((acc, v) => acc + (v ?? 0), 0);
    return sum >= g.target;
  });

  const sleepVals = value.checkins.map(c => c.sleepHours).filter((v): v is number => v != null);
  const energyVals = value.checkins.map(c => c.energy).filter((v): v is 1 | 2 | 3 | 4 | 5 => v != null);
  const avgSleep = sleepVals.length > 0 ? (sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length).toFixed(1) : '-';
  const avgEnergy = energyVals.length > 0 ? (energyVals.reduce((a, b) => a + b, 0) / energyVals.length).toFixed(1) : '-';

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <RetroPeriodHeader mode="yearly" period={year} />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4" aria-label="연간 실행 요약">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500">연간 실제 기록</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {(actualMin / 60).toFixed(1)}h
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">완료 할 일 {doneTodos}개</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500">연간 수치 목표</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {achievedGoals.length}/{namedGoals.length}
          </div>
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
      </section>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {editor.loaded && (
          <RetroTemplate
            value={editor.value}
            onChange={editor.patch}
            beforeCreate={editor.flush}
            source={{ type: 'yearly', dateOrWeek: year }}
          />
        )}
        <AutosaveStatus {...editor} />
      </div>
    </div>
  );
}
