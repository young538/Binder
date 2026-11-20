'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toIsoDate } from '@/lib/utils/date';

export default function DailyIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/daily/${toIsoDate(new Date())}`);
  }, [router]);
  return <p role="status" className="p-5 text-sm text-zinc-500">오늘의 일일 화면을 여는 중…</p>;
}
