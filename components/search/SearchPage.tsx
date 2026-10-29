'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { http } from '@/lib/repo/http';
import { SEARCH_KINDS, SEARCH_PAGE_SIZE, type SearchKind, type SearchResults } from '@/lib/search/types';

const empty: SearchResults = { items: [], offset: 0, hasMore: false };
export function SearchPage({ query, kind }: { query: string; kind: SearchKind | '' }) {
  const router = useRouter();
  const [draft, setDraft] = useState(query);
  const [filter, setFilter] = useState<string>(kind);
  const [offset, setOffset] = useState(0);
  const params = new URLSearchParams({ q: query, type: kind, offset: String(offset) });
  const { value, loading, error, refresh } = useAsyncResource(`search:${params}`, () => query ? http.get<SearchResults>(`/api/search?${params}`) : Promise.resolve(empty), empty, ['*']);
  return <section className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
    <h1 className="text-xl font-semibold">전체 검색</h1>
    <p className="text-sm text-zinc-500">내 할 일, 목표, 습관, 독서, 노트, 회고, 시간표와 카테고리를 검색합니다.</p>
    <form className="flex flex-wrap gap-2" role="search" onSubmit={event => {
      event.preventDefault();
      router.push(`/search?${new URLSearchParams({ q: draft.trim(), type: filter })}`);
      setOffset(0);
    }}>
      <input autoFocus aria-label="검색어" placeholder="검색어 입력" required maxLength={100} value={draft} onChange={event => setDraft(event.target.value)} className="border rounded-lg px-3 py-2 bg-transparent min-w-0 flex-1" />
      <select aria-label="검색 범위" value={filter} onChange={event => setFilter(event.target.value)} className="border rounded-lg px-2 py-2 bg-white dark:bg-zinc-900">
        <option value="">전체</option>
        {Object.entries(SEARCH_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <button className="rounded-lg bg-blue-600 text-white px-4 py-2" type="submit">검색</button>
    </form>
    <div aria-live="polite" aria-busy={loading}>
      {!query ? <p className="text-sm text-zinc-500">검색어를 입력해 주세요.</p> : loading ? <p>검색 중…</p> : error ? <div role="alert">검색하지 못했어요. <button onClick={() => void refresh(true)} className="underline">다시 시도</button></div> : <>
        {!value.items.length && <p className="text-sm text-zinc-500">검색 결과가 없습니다.</p>}
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {value.items.map(item => <li key={`${item.kind}:${item.id}`} className="py-4">
            <div className="text-xs text-zinc-500 mb-1">{SEARCH_KINDS[item.kind]} {item.period && `· ${item.period}`}</div>
            <Link href={item.href} className="font-medium text-blue-600 dark:text-blue-400 break-words">{item.title}</Link>
            {item.excerpt && <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-words mt-1">{item.excerpt}</p>}
          </li>)}
        </ul>
      </>}
    </div>
    {query && <div className="flex items-center justify-between text-sm">
      <button className="border rounded px-3 py-1 disabled:opacity-40" disabled={!offset || loading} onClick={() => setOffset(Math.max(0, offset - SEARCH_PAGE_SIZE))}>이전</button>
      <span>{Math.floor(offset / SEARCH_PAGE_SIZE) + 1}페이지</span>
      <button className="border rounded px-3 py-1 disabled:opacity-40" disabled={!value.hasMore || loading || offset >= 10000} onClick={() => setOffset(offset + SEARCH_PAGE_SIZE)}>다음</button>
    </div>}
  </section>;
}
