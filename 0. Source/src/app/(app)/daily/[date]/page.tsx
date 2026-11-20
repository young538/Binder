import { redirect } from 'next/navigation';
import { DailyPage } from '@/components/daily/DailyPage';

const isValidDateParam = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const [y, m, d] = value.split('-').map(Number);
  return (
    parsed.getFullYear() === y &&
    parsed.getMonth() === m - 1 &&
    parsed.getDate() === d
  );
};

export default async function Page({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidDateParam(date)) redirect('/daily');
  return <DailyPage date={date} />;
}
