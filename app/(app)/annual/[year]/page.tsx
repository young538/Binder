import { AnnualPage } from '@/components/annual/AnnualPage';

export default async function Page({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return <AnnualPage year={year} />;
}
