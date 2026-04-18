'use client';
import { Plus, Trash2 } from 'lucide-react';
import { useBinder } from '@/store';
import { createCategory, updateCategory, deleteCategory } from '@/lib/repo/categories';
import { Category } from '@/lib/types';

export const CategoryEditor = () => {
  const { categories, reload } = useBinder();

  const add = async () => {
    await createCategory({ name: '새 카테고리', color: '#cccccc', order: categories.length });
    await reload();
  };

  const update = async (id: string, patch: Partial<Omit<Category, 'id'>>) => {
    await updateCategory(id, patch);
    await reload();
  };

  const remove = async (id: string) => {
    if (!confirm('삭제할까요? (연결된 기록은 "기타"로 이동 — v2 예정)')) return;
    await deleteCategory(id);
    await reload();
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
      <h2 className="text-base font-semibold mb-4 text-zinc-800 dark:text-zinc-50">카테고리</h2>
      <ul className="space-y-2">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <input
              type="color"
              value={c.color}
              onChange={(e) => update(c.id, { color: e.target.value })}
              className="w-9 h-9 rounded-md border border-zinc-200 dark:border-zinc-700 cursor-pointer"
            />
            <input
              type="text"
              value={c.name}
              onChange={(e) => update(c.id, { name: e.target.value })}
              className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => remove(c.id)}
              aria-label="삭제"
              className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={add}
        className="mt-4 flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        <Plus size={14} /> 카테고리 추가
      </button>
    </section>
  );
};
