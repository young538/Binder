'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays } from 'date-fns';
import { weekDates, toIsoDate, toIsoWeek } from '@/lib/utils/date';
import { weekKeyFromString } from '@/lib/utils/period';
import { FocusNoteEditor } from '@/components/common/FocusNoteEditor';
import { TodoListSection } from '@/components/common/TodoListSection';
import { TimeGrid } from '@/components/common/TimeGrid';
import { GoalSummaryStrip } from '@/components/monthly/GoalSummaryStrip';
import { WeeklyReview } from './WeeklyReview';
import { DayTodoStrip } from './DayTodoStrip';
import { useWeeklyData } from './WeeklyDataProvider';

interface Props {
  isoweek: string;
}

export const WeekGrid = ({ isoweek }: Props) => {
  const { blocks } = useWeeklyData();
  const dates = weekDates(isoweek);
  const prevWeek = toIsoWeek(addDays(dates[0], -7));
  const nextWeek = toIsoWeek(addDays(dates[0], 7));

  return (
    <div className="hidden md:block">
      <TimeGrid dates={dates} blocks={blocks} beforeGrid={(openFromTodo) => (
        <>
          <header className="flex items-center gap-3 px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <Link
              href={`/week/${prevWeek}`}
              className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
              aria-label="이전주"
            >
              <ChevronLeft size={18} />
            </Link>
            <h1 className="font-semibold flex-1 text-center text-zinc-800 dark:text-zinc-50">
              {isoweek}
            </h1>
            <Link
              href={`/week/${nextWeek}`}
              className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
              aria-label="다음주"
            >
              <ChevronRight size={18} />
            </Link>
          </header>

          <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <FocusNoteEditor
              scope="week"
              scopeKey={weekKeyFromString(isoweek)}
              label="이번 주 한 문장"
              placeholder="예: 릴스 제작 루틴 실행"
            />
          </div>

          <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <GoalSummaryStrip date={toIsoDate(dates[0])} />
          </div>

          <WeeklyReview isoweek={isoweek} />

          <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <TodoListSection scope="week" scopeKey={isoweek} title="이번 주 TODO" />
          </div>

          <DayTodoStrip
            dates={dates}
            onMakeBlock={openFromTodo}
          />
        </>
      )} />
    </div>
  );
};
