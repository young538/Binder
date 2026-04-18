import { redirect } from 'next/navigation';
import { toIsoWeek } from '@/lib/utils/date';

export default function RootPage() {
  const week = toIsoWeek(new Date());
  redirect(`/week/${week}`);
}
