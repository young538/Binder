'use client';

import { useBinder } from '@/store';
import { GoalCoverageBar } from './GoalCoverageBar';
import { WeeklyHabitCalendar } from './WeeklyHabitCalendar';
import { useWeeklyData } from './WeeklyDataProvider';
import { PlanActualComparison } from '@/components/retro/PlanActualComparison';

export function WeeklyReview({ isoweek }: { isoweek: string }) {
  const { blocks } = useWeeklyData();
  const { goals, categories } = useBinder();

  return (
    <section data-testid="weekly-review" className="space-y-0 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <WeeklyHabitCalendar isoweek={isoweek} embedded />
      <GoalCoverageBar blocks={blocks} goals={goals} categories={categories} embedded />
      <div className="p-4"><PlanActualComparison blocks={blocks} categories={categories} /></div>
    </section>
  );
}
