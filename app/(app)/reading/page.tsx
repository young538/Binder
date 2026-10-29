import { ReadingPage } from '@/components/reading/ReadingPage';

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string | string[] }> }) {
  const { year } = await searchParams;
  const initialYear = typeof year === 'string' && /^[1-9]\d{3}$/.test(year) ? year : undefined;
  return <ReadingPage key={initialYear} initialYear={initialYear} />;
}
