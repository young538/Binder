'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, ExternalLink } from 'lucide-react';
import { Book } from '@/lib/types';
import { listByYear, createBook, updateBook, deleteBook } from '@/lib/repo/books';

export const ReadingPage = () => {
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [books, setBooks] = useState<Book[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = () => listByYear(year).then(setBooks);
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const add = async () => {
    const next = await createBook({
      year,
      order: books.length + 1,
      title: '',
    });
    await reload();
    setEditingId(next.id);
  };

  const update = async (id: string, patch: Partial<Omit<Book, 'id'>>) => {
    await updateBook(id, patch);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await deleteBook(id);
    reload();
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
                books.map(b => (
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
                          update(b.id, { category: e.target.value.trim() || undefined })
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
                    </td>
                    <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                      <input
                        type="text"
                        defaultValue={b.oneThing ?? ''}
                        onBlur={e =>
                          update(b.id, { oneThing: e.target.value.trim() || undefined })
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
                          update(b.id, { keywords: e.target.value.trim() || undefined })
                        }
                        placeholder="키워드1, 키워드2, 키워드3"
                        className="w-full bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30 px-1 rounded text-xs text-zinc-600 dark:text-zinc-400"
                      />
                    </td>
                    <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                      <input
                        type="date"
                        defaultValue={b.finishedAt ?? ''}
                        onBlur={e => update(b.id, { finishedAt: e.target.value || undefined })}
                        className="w-full bg-transparent outline-none text-xs text-center"
                      />
                    </td>
                    <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                      <div className="flex items-center gap-1">
                        <input
                          type="url"
                          defaultValue={b.reviewUrl ?? ''}
                          onBlur={e =>
                            update(b.id, { reviewUrl: e.target.value.trim() || undefined })
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
