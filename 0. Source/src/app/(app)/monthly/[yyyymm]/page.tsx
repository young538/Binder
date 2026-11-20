import { MonthlyPage } from '@/components/monthly/MonthlyPage';

export default async function Page({ params }: { params: Promise<{ yyyymm: string }> }) {
  const { yyyymm } = await params;
  return <MonthlyPage yyyymm={yyyymm} />;
}
