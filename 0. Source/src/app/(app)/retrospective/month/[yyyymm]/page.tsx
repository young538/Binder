import { MonthlyRetroPage } from '@/components/retro/MonthlyRetroPage';

export default async function Page({ params }: { params: Promise<{ yyyymm: string }> }) {
  const { yyyymm } = await params;
  return <MonthlyRetroPage yyyymm={yyyymm} />;
}
