import { WeekGrid } from '@/components/week/WeekGrid';

export default async function WeekPage({ params }: { params: Promise<{ isoweek: string }> }) {
  const { isoweek } = await params;
  return <WeekGrid isoweek={isoweek} />;
}
