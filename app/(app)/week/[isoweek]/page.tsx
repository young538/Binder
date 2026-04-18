import { WeekGrid } from '@/components/week/WeekGrid';
import { DayListView } from '@/components/week/DayListView';

export default async function WeekPage({ params }: { params: Promise<{ isoweek: string }> }) {
  const { isoweek } = await params;
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 min-h-full">
      <WeekGrid isoweek={isoweek} />
      <DayListView isoweek={isoweek} />
    </div>
  );
}
