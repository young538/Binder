import { YearlyRetroPage } from '@/components/retro/YearlyRetroPage';

export default async function Page({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return <YearlyRetroPage year={year} />;
}
