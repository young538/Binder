'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { createBook, listAllBooks } from '@/lib/repo/books';
import { getReadingSummary, linkDailyReadings } from '@/lib/repo/insights';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { normalizeBookTitle, parseReadingEntry, type ReadingEntry, type ReadingSummary } from '@/lib/reading';
import { useRetrospectiveEditor } from '@/lib/autosave/editors';
import { AutosaveStatus } from '@/components/common/AutosaveStatus';
import { GrowingTextarea } from '@/components/common/GrowingTextarea';

interface Props {
  date: string;
}

const DAILY_PAGES = 10;
const EMPTY_SUMMARY: ReadingSummary = { byBookId: {}, unlinkedGroups: [] };

/**
 * 일일 페이지 고정 섹션: 오늘의 독서 (하루 10쪽 소량 기록용).
 * - 책: 모든 연도의 독서 리스트에서 선택, 없으면 직접 입력 및 독서 리스트 등록/연결
 * - 읽은 쪽수: 숫자 입력 (기본 10)
 * - 독서 노트: 기억할 문장과 생각을 긴 글로도 기록
 * 저장은 retrospectives(type='daily', dateOrWeek=date).template.reading 에
 * JSON 문자열 한 덩어리로 보관 — 스키마 변경·마이그레이션 불필요.
 */
export const DailyReading = ({ date }: Props) => {
  const editor = useRetrospectiveEditor('daily', date);
  const entry = parseReadingEntry(editor.value.template?.reading);
  const [modeOverride, setModeOverride] = useState<{ date: string; mode: 'select' | 'custom' } | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const { value: books, loading: booksLoading, error: booksError, refresh: reloadBooks } = useAsyncResource('dailyReading:books', listAllBooks, [], ['books']);
  const { value: summaryData, refresh: reloadSummary } = useAsyncResource('dailyReading:summary', getReadingSummary, EMPTY_SUMMARY, ['books', 'retrospectives']);

  const patch = (p: Partial<ReadingEntry>) => {
    editor.patch({ template: { reading: JSON.stringify({ ...entry, ...p }) } });
  };

  if (!editor.loaded) return <AutosaveStatus {...editor} />;
  if (booksLoading) return <p className="p-4 text-sm text-zinc-500">책 목록을 불러오는 중…</p>;

  const selectedBook = entry.bookId ? books.find((b) => b.id === entry.bookId) : undefined;
  const displayTitle = selectedBook?.title?.trim() || entry.bookTitle.trim();
  const hasUnlinkedTitle = !entry.bookId && entry.bookTitle.trim() !== '';
  const activeOverride = modeOverride?.date === date ? modeOverride.mode : null;
  const showCustomInput = books.length === 0 || activeOverride === 'custom' || (activeOverride !== 'select' && hasUnlinkedTitle);
  const normalizedTyped = normalizeBookTitle(entry.bookTitle);
  const matchingBook = normalizedTyped ? books.find((b) => normalizeBookTitle(b.title) === normalizedTyped) : undefined;
  const selectedStats = selectedBook ? summaryData.byBookId[selectedBook.id] : undefined;

  const hasRecord = displayTitle !== '' || entry.memo.trim() !== '';
  const summary = hasRecord
    ? `${displayTitle || '(제목 없음)'} · ${entry.pages}쪽`
    : '읽은 문장과 나의 생각을 남겨 보세요.';

  const handleRegisterOrLink = async () => {
    const title = entry.bookTitle.trim();
    if (!title || linking) return;
    setLinking(true);
    setLinkError(null);
    setLinkNotice(null);
    try {
      const reused = Boolean(matchingBook);
      const year = date.slice(0, 4);
      const targetBook =
        matchingBook ??
        (await createBook({
          year,
          order: books.filter((b) => b.year === year).reduce((max, b) => Math.max(max, b.order), 0) + 1,
          title,
        }));

      patch({ bookId: targetBook.id, bookTitle: targetBook.title });
      await editor.flush();
      const extra = await linkDailyReadings(targetBook.id, { matchTitle: title });
      await Promise.all([reloadBooks(), reloadSummary()]);
      setModeOverride({ date, mode: 'select' });

      if (reused) {
        setLinkNotice(
          extra.linkedCount > 0
            ? `"${targetBook.title}"에 연결하고 다른 날짜 ${extra.linkedCount}건도 함께 묶었어요.`
            : `"${targetBook.title}"에 연결했어요.`,
        );
      } else {
        setLinkNotice(
          extra.linkedCount > 0
            ? `독서 리스트(${targetBook.year})에 등록하고 다른 날짜 ${extra.linkedCount}건도 연결했어요.`
            : `독서 리스트(${targetBook.year})에 등록하고 연결했어요.`,
        );
      }
    } catch {
      setLinkError('독서 리스트와 연결하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setLinking(false);
    }
  };

  return (
    <section aria-label="오늘의 독서" className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm dark:border-emerald-900 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? '독서 기록 접기' : `독서 기록 펼치기: ${summary}`}
        className="flex w-full items-start gap-3 border-b border-emerald-100 bg-emerald-50/60 p-5 text-left dark:border-emerald-900/60 dark:bg-emerald-950/20"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
          <BookOpen size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">오늘의 독서</h2>
          <p className="mt-1 break-words text-[13px] leading-6 text-zinc-600 dark:text-zinc-300">{summary}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-zinc-400">
          {open ? (
            <>
              접기 <ChevronUp size={14} />
            </>
          ) : (
            <>
              펼치기 <ChevronDown size={14} />
            </>
          )}
        </span>
      </button>
      {open && (
        <div className="space-y-5 p-5">
          {!!booksError && <button onClick={() => void reloadBooks()} className="text-sm text-red-600">책 목록을 불러오지 못했어요. 다시 시도</button>}
          {!showCustomInput ? (
            <div>
              <label
                htmlFor={`daily-reading-book-${date}`}
                className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                책
              </label>
              <div className="flex gap-2">
                <select
                  id={`daily-reading-book-${date}`}
                  value={entry.bookId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    setLinkNotice(null);
                    setLinkError(null);
                    if (id === '__custom__') {
                      setModeOverride({ date, mode: 'custom' });
                      patch({ bookId: undefined, bookTitle: '' });
                      return;
                    }
                    const b = books.find((x) => x.id === id);
                    // e2e처럼 옵션을 직접 채운 경우 selectedOptions에서 제목 복원
                    const label =
                      b?.title ??
                      e.target.selectedOptions?.[0]?.textContent?.trim() ??
                      '';
                    setModeOverride({ date, mode: 'select' });
                    patch({ bookId: id || undefined, bookTitle: label });
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                >
                  <option value="">책 선택</option>
                  {entry.bookId && !books.some(book => book.id === entry.bookId) && <option value={entry.bookId}>{entry.bookTitle} (목록에서 삭제됨)</option>}
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title || '(제목 없음)'}
                    </option>
                  ))}
                  <option value="__custom__">직접 입력 / 새 책 등록…</option>
                </select>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                {selectedBook ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {selectedStats && selectedStats.readingDays > 0
                      ? `누적 ${selectedStats.totalPages}쪽 · ${selectedStats.readingDays}일`
                      : '독서 리스트와 연결됨'}
                  </span>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-500">책을 선택하면 독서 리스트에 누적 집계됩니다.</span>
                )}
                <Link
                  href={selectedBook ? `/reading?year=${selectedBook.year}` : '/reading'}
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  독서 리스트 보기
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor={`daily-reading-title-${date}`}
                className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                책 제목
              </label>
              <div className="flex gap-2">
                <input
                  id={`daily-reading-title-${date}`}
                  type="text"
                  value={entry.bookTitle}
                  onChange={(e) => {
                    setLinkNotice(null);
                    setLinkError(null);
                    patch({ bookTitle: e.target.value });
                  }}
                  placeholder="예: 데미안"
                  className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
                {books.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setModeOverride({ date, mode: 'select' })}
                    className="shrink-0 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    목록에서 선택
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={linking || !entry.bookTitle.trim()}
                  onClick={() => void handleRegisterOrLink()}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {linking
                    ? '연결 중…'
                    : matchingBook
                      ? `"${matchingBook.title}"에 연결`
                      : '독서 리스트에 등록 & 연결'}
                </button>
                <Link
                  href="/reading"
                  className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  독서 리스트 보기
                </Link>
              </div>
            </div>
          )}

          {linkNotice && (
            <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {linkNotice}
            </p>
          )}
          {linkError && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {linkError}
            </p>
          )}

          <div>
            <label
              htmlFor={`daily-reading-pages-${date}`}
              className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              읽은 쪽수
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={`daily-reading-pages-${date}`}
                type="number"
                min={0}
                max={9999}
                value={Number.isFinite(entry.pages) ? entry.pages : DAILY_PAGES}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  patch({ pages: Number.isFinite(n) ? Math.max(0, Math.min(9999, n)) : DAILY_PAGES });
                }}
                className="w-24 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm tabular-nums text-zinc-800 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
              <span className="text-xs text-zinc-500">쪽</span>
              {[DAILY_PAGES, 20, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => patch({ pages: n })}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    entry.pages === n
                      ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor={`daily-reading-memo-${date}`}
              className="mb-2 block text-sm font-semibold text-zinc-800 dark:text-zinc-100"
            >
              독서 노트
            </label>
            <GrowingTextarea
              id={`daily-reading-memo-${date}`}
              minHeight={320}
              value={entry.memo}
              onChange={(e) => patch({ memo: e.target.value })}
              placeholder={'기억하고 싶은 문장이나 페이지\n\n읽으며 든 생각, 내 삶에 적용할 한 가지'}
              rows={9}
              className="block min-h-[320px] w-full resize-none overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/20 px-4 py-4 text-base leading-8 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 dark:border-emerald-900 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>

          <AutosaveStatus {...editor} />
        </div>
      )}
    </section>
  );
};
