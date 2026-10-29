'use client';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { useBinder } from '@/store';
import { weekDates, toIsoDate } from '@/lib/utils/date';
import { getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { useRetrospectiveEditor } from '@/lib/autosave/editors';
import { AutosaveStatus } from '@/components/common/AutosaveStatus';
import { computeHabitStatsForRange } from '@/lib/utils/habitSchedule';
import { listDayTodosInRange } from '@/lib/repo/todos';
import { listHabits } from '@/lib/repo/habits';
import { listLogsForRange } from '@/lib/repo/habitLogs';
import { WeeklySummary } from './WeeklySummary';
import { RetroTemplate } from './RetroTemplate';

export const WeeklyRetroPage = ({ isoweek }: { isoweek: string }) => {
  const { categories, goals } = useBinder();
  const editor = useRetrospectiveEditor('weekly', isoweek);

  const { value: { blocks, todos, habitStats } } = useAsyncResource(isoweek, async () => {
    const dates = weekDates(isoweek);
    const start = toIsoDate(dates[0]);
    const end = toIsoDate(dates[6]);
    const [blocks, todos, habits, logs] = await Promise.all([
      getTimeBlocksInRange(start, end), listDayTodosInRange(start, end), listHabits(), listLogsForRange(start, end),
    ]);
    return { blocks, todos, habitStats: computeHabitStatsForRange(habits, logs, dates[0], dates[6]) };
  }, { blocks: [], todos: [], habitStats: { total: 0, logs: 0, expected: 0, percent: 0 } },
  ['timeBlocks', 'todos', 'habits', 'habitLogs']);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">주간 회고</div>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-50">📝 {isoweek}</h1>
      </div>
      <WeeklySummary
        isoweek={isoweek}
        blocks={blocks}
        todos={todos}
        categories={categories}
        goals={goals}
        habitStats={habitStats}
      />
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-5">
        {editor.loaded && <RetroTemplate value={editor.value} onChange={editor.patch} />}
        <AutosaveStatus {...editor} />
      </div>
    </div>
  );
};
