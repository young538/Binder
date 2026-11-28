'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeftRight,
  BookOpen,
  FileText,
  FolderArchive,
  Library,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { getWikiIndex, getWikiPage } from '@/lib/repo/wiki';
import {
  WIKI_CATEGORY_LABEL,
  type WikiCategory,
  type WikiIndexResponse,
  type WikiRawFile,
} from '@/lib/wiki';
import { WikiMarkdown } from './WikiMarkdown';
import { WikiRawCaptureDialog } from './WikiRawCaptureDialog';

const CATEGORY_ORDER: WikiCategory[] = ['life', 'topics', 'sources', 'synthesis', 'meta'];

const EMPTY_INDEX: WikiIndexResponse = {
  initialized: false,
  pages: [],
  rawFiles: [],
  stats: {
    totalPages: 0,
    rawInboxCount: 0,
    rawLifeOsCount: 0,
    brokenLinkCount: 0,
    orphanCount: 0,
    lastUpdated: null,
  },
  recentLogs: [],
};

export function WikiPage({ initialPage }: { initialPage?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const queryPage = sp.get('page');
  const [pickedPath, setPickedPath] = useState<string | null>(initialPage ?? null);
  const [filterText, setFilterText] = useState('');
  const [captureOpen, setCaptureOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const {
    value: index,
    loading: indexLoading,
    error: indexError,
    refresh: refreshIndex,
  } = useAsyncResource('wiki:index', getWikiIndex, EMPTY_INDEX, ['wiki']);

  const defaultPath = useMemo(() => {
    const idxDoc = index.pages.find(p => p.path === 'index.md');
    if (idxDoc) return idxDoc.path;
    const firstWiki = index.pages.find(p => p.category !== 'meta');
    if (firstWiki) return firstWiki.path;
    if (index.pages[0]) return index.pages[0].path;
    const firstPreviewRaw = index.rawFiles.find(f => f.previewable);
    return firstPreviewRaw?.path ?? null;
  }, [index.pages, index.rawFiles]);

  const activePath = pickedPath ?? queryPage ?? defaultPath;

  const {
    value: detail,
    loading: detailLoading,
    error: detailError,
  } = useAsyncResource(
    activePath ? `wiki:page:${activePath}` : 'wiki:page:empty',
    () => (activePath ? getWikiPage(activePath) : Promise.resolve(null)),
    null,
    ['wiki'],
  );

  const navigateToPage = (nextPath: string) => {
    setPickedPath(nextPath);
    setMobileMenuOpen(false);
    router.replace(`/wiki?page=${encodeURIComponent(nextPath)}`, { scroll: false });
  };

  const handleRawSaved = (saved: WikiRawFile) => {
    setNotice(
      `Raw 수집함에 저장했어요 (${saved.name}). 에이전트에게 "위키에 반영해줘"라고 요청하면 컴파일됩니다.`,
    );
    void refreshIndex(true);
    if (saved.previewable) {
      navigateToPage(saved.path);
    }
  };

  const groupedPages = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const map = new Map<WikiCategory, typeof index.pages>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);

    for (const p of index.pages) {
      if (q) {
        const matched =
          p.title.toLowerCase().includes(q) ||
          p.path.toLowerCase().includes(q) ||
          p.summary.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q));
        if (!matched) continue;
      }
      map.get(p.category)?.push(p);
    }
    return map;
  }, [filterText, index]);

  const filteredRawFiles = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return index.rawFiles.filter(
      f => !q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q),
    );
  }, [filterText, index.rawFiles]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 pb-24 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            LLM Wiki · Karpathy Second Brain
          </div>
          <h1 className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            지식 위키
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            원본(Raw)을 에이전트가 주제별 마크다운으로 지속 컴파일·상호 링크해 복리로 쌓아가는 개인 지식베이스입니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 lg:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <BookOpen size={14} />
            목록 ({index.stats.totalPages})
          </button>
          <button
            type="button"
            onClick={() => setCaptureOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus size={14} /> Raw 넣기
          </button>
        </div>
      </header>

      <section aria-label="위키 상태 요약" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">컴파일된 문서</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {index.stats.totalPages}개
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Raw 수집함</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {index.stats.rawInboxCount}건
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Life OS 스냅샷</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {index.stats.rawLifeOsCount}개
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">링크 건전성</div>
          <div className="mt-1 text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
            끊김 {index.stats.brokenLinkCount} · 고아 {index.stats.orphanCount}
          </div>
        </div>
      </section>

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}

      {Boolean(indexError) && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          위키 목록을 불러오지 못했습니다.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside
          aria-label="위키 문서 목록"
          className={`${
            mobileMenuOpen ? 'block' : 'hidden lg:block'
          } min-w-0 space-y-4 rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm lg:sticky lg:top-16 lg:self-start dark:border-zinc-800 dark:bg-zinc-900`}
        >
          <label className="relative block">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="search"
              aria-label="위키 문서 필터"
              placeholder="제목·태그·경로 검색"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-2.5 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          {CATEGORY_ORDER.map(category => {
            const list = groupedPages.get(category) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={category} className="space-y-1">
                <div className="px-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  {WIKI_CATEGORY_LABEL[category]} ({list.length})
                </div>
                <ul className="space-y-0.5">
                  {list.map(page => {
                    const isActive = activePath === page.path;
                    return (
                      <li key={page.path}>
                        <button
                          type="button"
                          onClick={() => navigateToPage(page.path)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                            isActive
                              ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                              : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <span className="min-w-0 truncate">{page.title}</span>
                          {page.backlinkCount > 0 && (
                            <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
                              {page.backlinkCount}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {filteredRawFiles.length > 0 && (
            <div className="space-y-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <div className="flex items-center gap-1 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                <FolderArchive size={11} />
                Raw 원본 ({filteredRawFiles.length})
              </div>
              <ul className="max-h-56 space-y-0.5 overflow-y-auto">
                {filteredRawFiles.map(raw => {
                  const isActive = activePath === raw.path;
                  return (
                    <li key={raw.path}>
                      {raw.previewable ? (
                        <button
                          type="button"
                          onClick={() => navigateToPage(raw.path)}
                          className={`flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                            isActive
                              ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                              : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <FileText size={12} className="shrink-0" />
                          <span className="min-w-0 truncate">{raw.name}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-400">
                          <FileText size={12} className="shrink-0" />
                          <span className="min-w-0 truncate">{raw.name}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>

        <article className="min-w-0 space-y-4">
          {!index.initialized && !indexLoading ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <Library size={28} className="mx-auto text-blue-600 dark:text-blue-400" />
              <h2 className="mt-3 font-serif text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                아직 컴파일된 위키 문서가 없습니다
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                상단 <strong>+ Raw 넣기</strong>로 기사·메모·PDF를 넣어두거나, Antigravity 에이전트에게 라이프 OS 스냅샷을 컴파일해 달라고 요청해 보세요.
              </p>
              <button
                type="button"
                onClick={() => setCaptureOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Plus size={14} /> 첫 Raw 메모 추가하기
              </button>
            </div>
          ) : detailLoading && !detail ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-xs text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              위키 문서를 불러오는 중…
            </div>
          ) : detailError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              선택한 문서를 열 수 없습니다. ({activePath})
            </div>
          ) : detail ? (
            <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="space-y-2 border-b border-zinc-100 pb-4 dark:border-zinc-800">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    {detail.isRaw ? 'Raw 원본 (읽기 전용)' : WIKI_CATEGORY_LABEL[detail.category]}
                  </span>
                  <span className="truncate font-mono">{detail.path}</span>
                  {detail.updated && <span>· 갱신 {detail.updated}</span>}
                </div>

                <h2 className="font-serif text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {detail.title}
                </h2>

                {detail.summary && (
                  <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {detail.summary}
                  </p>
                )}

                {detail.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {detail.tags.map(tag => (
                      <span
                        key={tag}
                        className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <WikiMarkdown
                markdown={detail.body}
                outgoingLinks={detail.outgoingLinks}
                onNavigateWiki={navigateToPage}
              />

              {detail.backlinks.length > 0 && (
                <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                    <ArrowLeftRight size={13} className="text-blue-600 dark:text-blue-400" />
                    이 문서를 참조하는 위키 페이지 ({detail.backlinks.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.backlinks.map(bl => (
                      <button
                        key={bl.path}
                        type="button"
                        onClick={() => navigateToPage(bl.path)}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                      >
                        {bl.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {detail.sources.length > 0 && (
                <div className="border-t border-zinc-100 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <span className="font-semibold">출처 근거:</span>{' '}
                  {detail.sources.join(' · ')}
                </div>
              )}
            </div>
          ) : null}

          {index.recentLogs.length > 0 && (
            <section
              aria-label="최근 위키 컴파일 로그"
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                <Sparkles size={13} className="text-blue-600 dark:text-blue-400" />
                최근 위키 활동 로그
              </div>
              <ul className="space-y-1.5 text-xs">
                {index.recentLogs.slice(0, 5).map((entry, idx) => (
                  <li key={`${entry.heading}-${idx}`} className="flex flex-wrap items-baseline gap-2 text-zinc-600 dark:text-zinc-400">
                    {entry.date && (
                      <span className="font-mono text-[11px] text-zinc-400">{entry.date}</span>
                    )}
                    {entry.kind && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {entry.kind}
                      </span>
                    )}
                    <span className="min-w-0 break-words">{entry.summary}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </div>

      {captureOpen && (
        <WikiRawCaptureDialog
          onClose={() => setCaptureOpen(false)}
          onSaved={handleRawSaved}
        />
      )}
    </div>
  );
}
