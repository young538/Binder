'use client';
import { useBinder } from '@/store';
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/repo/categories';
import { Category } from '@/lib/types';

export const CategoryEditor = () => {
  const { categories, reload } = useBinder();

  const add = async () => {
    await createCategory({
      name: '새 카테고리',
      color: '#cccccc',
      order: categories.length,
    });
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
    <section>
      <h2 className="text-lg font-semibold mb-3">카테고리</h2>
      <ul className="space-y-2">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <input
              type="color"
              value={c.color}
              onChange={(e) => update(c.id, { color: e.target.value })}
              className="w-8 h-8 rounded border"
            />
            <input
              type="text"
              value={c.name}
              onChange={(e) => update(c.id, { name: e.target.value })}
              className="flex-1 border rounded px-2 py-1"
            />
            <button
              onClick={() => remove(c.id)}
              className="text-red-600 text-sm hover:underline"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={add}
        className="mt-3 px-3 py-1 border rounded hover:bg-gray-50"
      >
        + 추가
      </button>
    </section>
  );
};
