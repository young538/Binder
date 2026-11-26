'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useBinder } from '@/store';
import { createCategory, updateCategory, deleteCategory } from '@/lib/repo/categories';
import { Category } from '@/lib/types';

export const CategoryEditor = () => {
  const { categories, reload } = useBinder();

  const [removing, setRemoving] = useState<string | null>(null);
  const [replacement, setReplacement] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    await createCategory({ name: '새 카테고리', color: '#cccccc', order: categories.length });
    await reload();
  };

  const update = async (id: string, patch: Partial<Omit<Category, 'id'>>) => {
    await updateCategory(id, patch);
    await reload();
  };

  const remove = async () => {
    if (!removing || busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteCategory(removing, replacement || undefined);
      await reload();
      setRemoving(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '카테고리를 삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
      <h2 className="text-base font-semibold mb-4 text-zinc-800 dark:text-zinc-50">카테고리</h2>
      <ul className="space-y-2">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <input
              type="color"
              defaultValue={c.color}
              onBlur={(e) => {
                if (e.target.value !== c.color) update(c.id, { color: e.target.value });
              }}
              className="w-9 h-9 rounded-md border border-zinc-200 dark:border-zinc-700 cursor-pointer"
            />
            <input
              type="text"
              defaultValue={c.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.name) update(c.id, { name: v });
              }}
              className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => { setRemoving(c.id); setReplacement(''); setError(''); }}
              disabled={busy}
              aria-label="삭제"
              className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
      {removing && (
        <div className="mt-3 space-y-2 rounded-lg border border-zinc-200 p-3 text-sm">
          <p>‘{categories.find(c => c.id === removing)?.name}’ 카테고리를 삭제할까요?</p>
          <label className="flex flex-wrap items-center gap-2">
            연결된 기록을 옮길 카테고리
            <select value={replacement} disabled={busy} onChange={e => setReplacement(e.target.value)}>
              <option value="">연결 해제</option>
              {categories.filter(c => c.id !== removing).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {error && <p role="alert" className="text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button disabled={busy} onClick={remove} className="text-red-600">삭제 확인</button>
            <button disabled={busy} onClick={() => setRemoving(null)}>취소</button>
          </div>
        </div>
      )}
      <button
        onClick={add}
        className="mt-4 flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        <Plus size={14} /> 카테고리 추가
      </button>
    </section>
  );
};
