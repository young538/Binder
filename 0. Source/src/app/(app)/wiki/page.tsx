import { Suspense } from 'react';
import { WikiPage } from '@/components/wiki/WikiPage';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = typeof params.page === 'string' ? params.page : undefined;
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-6 text-sm text-zinc-500">지식 위키를 불러오는 중…</div>}>
      <WikiPage initialPage={page} />
    </Suspense>
  );
}
