import { WeeklyDataProvider } from '@/components/week/WeeklyDataProvider';
import { WeeklyViews } from '@/components/week/WeeklyViews';

export default async function WeekPage({ params }: { params: Promise<{ isoweek: string }> }) {
  const { isoweek } = await params;
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 min-h-full">
      <WeeklyDataProvider key={isoweek} isoweek={isoweek}>
        <WeeklyViews isoweek={isoweek} />
      </WeeklyDataProvider>
    </div>
  );
}
