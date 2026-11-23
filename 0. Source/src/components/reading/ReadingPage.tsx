'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, ExternalLink } from 'lucide-react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { normalizeBookTitle, type ReadingSummary, type UnlinkedReadingGroup } from '@/lib/reading';
import { getReadingSummary, linkDailyReadings } from '@/lib/repo/insights';
import { Book } from '@/lib/types';
import { listAllBooks, listByYear, createBook, updateBook, deleteBook } from '@/lib/repo/books';
import { BookHistoryPanel } from './BookHistoryPanel';

const EMPTY_SUMMARY: ReadingSummary = { byBookId: {}, unlinkedGroups: [] };

export const ReadingPage = ({ initialYear }: { initialYear?: string }) => {
  const [year, setYear] = useState(() => initialYear ?? String(new Date().getFullYear()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [linkSelection, setLinkSelection] = useState<Record<string, string>>({});
  const [linkingKey, setLinkingKey] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const { value: books, refresh: reload } = useAsyncResource(year, () => listByYear(year), [], ['books']);
  const { value: allBooks, refresh: reloadAllBooks } = useAsyncResource('reading:allBooks', listAllBooks, [], ['books']);
  const { value: summary, refresh: reloadSummary } = useAsyncResource('reading:summary', getReadingSummary, EMPTY_SUMMARY, ['books', 'retrospectives']);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void reload();
        void reloadAllBooks();
        void reloadSummary();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [reload, reloadAllBooks, reloadSummary]);

  const add = async () => {
    const next = await createBook({
      year,
      order: books.length + 1,
      title: '',
    });
    await Promise.all([reload(), reloadAllBooks()]);
    setEditingId(next.id);
  };

  const update = async (id: string, patch: Partial<Omit<Book, 'id'>>) => {
    await updateBook(id, patch);
    await Promise.all([reload(), reloadAllBooks(), reloadSummary()]);
  };

  const remove = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await deleteBook(id);
    await Promise.all([reload(), reloadAllBooks(), reloadSummary()]);
  };

  const resolveSelectedBookId = (group: UnlinkedReadingGroup): string => {
    const explicit = linkSelection[group.normalizedTitle];
    if (explicit && allBooks.some(b => b.id === explicit)) return explicit;
    const matched = allBooks.find(b => normalizeBookTitle(b.title) === group.normalizedTitle);
    return matched?.id ?? allBooks[0]?.id ?? '';
  };

  const registerAndLinkGroup = async (group: UnlinkedReadingGroup) => {
    if (linkingKey) return;
    setLinkingKey(`create:${group.normalizedTitle}`);
    setLinkNotice(null);
    setLinkError(null);
    try {
      const targetYear = group.lastReadDate.slice(0, 4);
      const maxOrder = allBooks
        .filter(b => b.year === targetYear)
        .reduce((max, b) => Math.max(max, b.order), 0);
      const created = await createBook({
        year: targetYear,
        order: maxOrder + 1,
        title: group.title,
      });
      const result = await linkDailyReadings(created.id, { dates: group.dates });
      if (year !== targetYear) setYear(targetYear);
      await Promise.all([reload(), reloadAllBooks(), reloadSummary()]);
      setLinkNotice(`"${created.title}"을(를) ${targetYear}년 독서 리스트에 등록하고 ${result.linkedCount}일치 기록을 연결했어요.`);
    } catch {
      setLinkError('일일 독서 기록을 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLinkingKey(null);
    }
  };

  const linkGroupToExisting = async (group: UnlinkedReadingGroup, bookId: string) => {
    if (linkingKey || !bookId) return;
    setLinkingKey(`link:${group.normalizedTitle}`);
    setLinkNotice(null);
    setLinkError(null);
    try {
      const chosenBook = allBooks.find(b => b.id === bookId);
      const result = await linkDailyReadings(bookId, { dates: group.dates });
      if (chosenBook && year !== chosenBook.year) setYear(chosenBook.year);
      await Promise.all([reload(), reloadAllBooks(), reloadSummary()]);
      setLinkNotice(`"${chosenBook?.title || group.title}"에 ${result.linkedCount}일치 기록을 연결했어요.`);
    } catch {
      setLinkError('기존 책에 기록을 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLinkingKey(null);
    }
  };

  const prevYear = () => setYear(String(Number(year) - 1));
  const nextYear = () => setYear(String(Number(year) + 1));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <header className="flex items-center gap-3">
        <button
          onClick={prevYear}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-2xl font-bold flex-1 text-center text-zinc-800 dark:text-zinc-50">
          {year} 독서 리스트
        </h1>
        <button
          onClick={nextYear}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600"
        >
          <ChevronRight size={18} />
        </button>
      </header>
      {historyId && <BookHistoryPanel key={historyId} bookId={historyId} onClose={() => setHistoryId(null)} />}

      {linkNotice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {linkNotice}
        </div>
      )}
      {linkError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {linkError}
        </div>
      )}

      {summary.unlinkedGroups.length > 0 && (
        <section
          aria-label="연결되지 않은 일일 독서 기록"
          className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20"
        >
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              연결되지 않은 일일 독서 기록 ({summary.unlinkedGroups.length}종)
            </h2>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              오늘의 독서에서 제목을 직접 입력해 남긴 기록입니다. 독서 리스트에 등록하거나 기존 책에 묶으면 누적 쪽수와 기록이 합산됩니다.
            </p>
          </div>
          <div className="space-y-2.5">
            {summary.unlinkedGroups.map(group => {
              const chosenId = resolveSelectedBookId(group);
              return (
                <div
                  key={group.normalizedTitle}
                  className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-white p-3 dark:border-amber-900/50 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {group.title}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      누적 {group.totalPages}쪽 · {group.readingDays}일 · 최근 {group.lastReadDate}
                      {group.rawTitles.length > 1 ? ` · 표기 변형 ${group.rawTitles.length}종` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={linkingKey !== null}
                      onClick={() => void registerAndLinkGroup(group)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {linkingKey === `create:${group.normalizedTitle}` ? '등록 중…' : '독서 리스트에 등록 & 연결'}
                    </button>
                    {allBooks.length > 0 && (
                      <>
                        <select
                          aria-label={`${group.title} 연결할 책 선택`}
                          value={chosenId}
                          disabled={linkingKey !== null}
                          onChange={e =>
                            setLinkSelection(prev => ({
                              ...prev,
                              [group.normalizedTitle]: e.target.value,
                            }))
                          }
                          className="max-w-[200px] rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                        >
                          {allBooks.map(b => (
                            <option key={b.id} value={b.id}>
                              [{b.year}] {b.title || '(제목 없음)'}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={linkingKey !== null || !chosenId}
                          onClick={() => void linkGroupToExisting(group, chosenId)}
                          className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          {linkingKey === `link:${group.normalizedTitle}` ? '연결 중…' : '기존 책에 연결'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            총{' '}
            <span className="font-semibold text-zinc-800 dark:text-zinc-50">
              {books.length}
            </span>
            권 · 완독{' '}
            <span className="font-semibold text-emerald-600">
              {books.filter(b => b.finishedAt).length}
            </span>
            권
          </div>
          <button
            onClick={add}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus size={12} /> 책 추가
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ minWidth: '900px' }}>
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 text-xs">
                <th className="p-2 w-10 border-r border-zinc-200 dark:border-zinc-800">No.</th>
                <th className="p-2 text-left w-24 border-r border-zinc-200 dark:border-zinc-800">
                  카테고리
                </th>
                <th className="p-2 text-left min-w-[200px] border-r border-zinc-200 dark:border-zinc-800">
                  도서 제목
                </th>
                <th className="p-2 text-left min-w-[200px] border-r border-zinc-200 dark:border-zinc-800">
                  1 Thing
                </th>
                <th className="p-2 text-left min-w-[180px] border-r border-zinc-200 dark:border-zinc-800">
                  3 Keywords
                </th>
                <th className="p-2 w-32 border-r border-zinc-200 dark:border-zinc-800">완독일</th>
                <th className="p-2 w-28 border-r border-zinc-200 dark:border-zinc-800">서평</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {books.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm text-zinc-400">
                    아직 등록한 책이 없어요. 위 &quot;+ 책 추가&quot;를 눌러보세요.
                  </td>
                </tr>
              ) : (
                books.map(b => {
                  const stats = summary.byBookId[b.id];
                  return (
                  <tr
                    key={b.id}
                    className="border-t border-zinc-100 dark:border-zinc-800 group hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20"
                  >
                    <td className="p-1 text-center text-zinc-500 tabular-nums border-r border-zinc-100 dark:border-zinc-900">
                      {b.order}
                    </td>
                    <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                      <input
                        type="text"
                        defaultValue={b.category ?? ''}
                        onBlur={e =>
                          update(b.id, { category: e.target.value.trim() || null })
                        }
                        placeholder="-"
                        className="w-full bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30 px-1 rounded text-center text-xs text-zinc-600 dark:text-zinc-400"
                      />
                    </td>
                    <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                      <input
                        type="text"
                        defaultValue={b.title}
                        autoFocus={editingId === b.id}
                        onBlur={e => update(b.id, { title: e.target.value.trim() })}
                        placeholder="도서 제목"
                        className="w-full bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30 px-1 rounded font-medium text-zinc-800 dark:text-zinc-50"
                      />
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <button onClick={() => setHistoryId(b.id)} aria-label={`${b.title || '제목 없음'} 독서 기록 보기`} className="px-1 py-1.5 text-xs text-blue-600 hover:underline">독서 기록 보기</button>
                        {stats && stats.readingDays > 0 && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            누적 {stats.totalPages}쪽 · {stats.readingDays}일
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                      <input
                        type="text"
                        defaultValue={b.oneThing ?? ''}
                        onBlur={e =>
                          update(b.id, { oneThing: e.target.value.trim() || null })
                        }
                        placeholder="한 문장"
                        className="w-full bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30 px-1 rounded text-zinc-700 dark:text-zinc-300"
                      />
                    </td>
                    <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                      <input
                        type="text"
                        defaultValue={b.keywords ?? ''}
                        onBlur={e =>
                          update(b.id, { keywords: e.target.value.trim() || null })
                        }
                        placeholder="키워드1, 키워드2, 키워드3"
                        className="w-full bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30 px-1 rounded text-xs text-zinc-600 dark:text-zinc-400"
                      />
                    </td>
                    <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                      <input
                        type="date"
                        defaultValue={b.finishedAt ?? ''}
                        onBlur={e => update(b.id, { finishedAt: e.target.value || null })}
                        className="w-full bg-transparent outline-none text-xs text-center"
                      />
                    </td>
                    <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                      <div className="flex items-center gap-1">
                        <input
                          type="url"
                          defaultValue={b.reviewUrl ?? ''}
                          onBlur={e =>
                            update(b.id, { reviewUrl: e.target.value.trim() || null })
                          }
                          placeholder="URL"
                          className="flex-1 bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30 px-1 rounded text-[10px]"
                        />
                        {b.reviewUrl && (
                          <a
                            href={b.reviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-0.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded shrink-0"
                            title="서평 열기"
                          >
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-1 text-center">
                      <button
                        onClick={() => remove(b.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-red-600 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
