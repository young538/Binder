import { WeeklyRetroPage } from '@/components/retro/WeeklyRetroPage';

export default async function Page({ params }: { params: Promise<{ isoweek: string }> }) {
  const { isoweek } = await params;
  return <WeeklyRetroPage isoweek={isoweek} />;
}
