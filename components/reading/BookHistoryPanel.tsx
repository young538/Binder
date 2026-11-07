'use client';
import Link from 'next/link';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { getBookHistory } from '@/lib/repo/insights';
import { Dialog } from '@/components/common/Dialog';

export function BookHistoryPanel({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const { value, loading, error, refresh } = useAsyncResource(`bookHistory:${bookId}`, () => getBookHistory(bookId), null, ['retrospectives', 'books']);
  return <Dialog title={value?.title || '책별 독서 기록'} onClose={onClose}>
    {loading && <p className="text-sm text-zinc-500">기록을 불러오는 중…</p>}
    {!!error && <button className="text-sm text-red-600" onClick={() => void refresh()}>기록을 불러오지 못했어요. 다시 시도</button>}
    {value && <>
      <p className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">누적 {value.totalPages}쪽 · 독서한 날 {value.readingDays}일</p>
      <p className="mb-4 text-xs leading-5 text-zinc-500">이 책을 선택해 남긴 모든 연도의 일일 기록입니다. 다시 읽은 쪽수도 포함하며 완독 여부는 직접 지정합니다.</p>
      {!value.entries.length && <p className="text-sm text-zinc-500">아직 연결된 기록이 없어요. 일일 화면의 오늘의 독서에서 이 책을 선택해 보세요.</p>}
      <ol className="space-y-4">{value.entries.map((entry, index) => <li key={`${entry.date}:${index}`} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
        <div className="mb-2 flex justify-between gap-3 text-sm"><Link className="text-blue-600 underline" href={`/daily/${entry.date}`}>{entry.date}</Link><span>{entry.pages}쪽</span></div>
        <p className="whitespace-pre-wrap break-words text-sm leading-7">{entry.memo || '독서 노트 없음'}</p>
      </li>)}</ol>
    </>}
  </Dialog>;
}
