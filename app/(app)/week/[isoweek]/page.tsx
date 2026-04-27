import { WeekGrid } from '@/components/week/WeekGrid';
import { DayListView } from '@/components/week/DayListView';
import { WeeklyHabitCalendar } from '@/components/week/WeeklyHabitCalendar';

export default async function WeekPage({ params }: { params: Promise<{ isoweek: string }> }) {
  const { isoweek } = await params;
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 min-h-full">
      <WeekGrid isoweek={isoweek} />
      <DayListView isoweek={isoweek} />
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <WeeklyHabitCalendar isoweek={isoweek} />
      </div>
    </div>
  );
}
