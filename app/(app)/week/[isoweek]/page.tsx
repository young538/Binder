import { WeekGrid } from '@/components/week/WeekGrid';
import { DayListView } from '@/components/week/DayListView';

export default async function WeekPage({ params }: { params: Promise<{ isoweek: string }> }) {
  const { isoweek } = await params;
  return (
    <>
      <WeekGrid isoweek={isoweek} />
      <DayListView isoweek={isoweek} />
    </>
  );
}
