'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Habit } from '@/lib/types';
import { listHabits, createHabit, updateHabit, deleteHabit } from '@/lib/repo/habits';
import { useBinder } from '@/store';

export const HabitEditor = () => {
  const { goals } = useBinder();
  const [habits, setHabits] = useState<Habit[]>([]);

  const reload = () => listHabits().then(setHabits);
  useEffect(() => {
    reload();
  }, []);

  const add = async () => {
    await createHabit({ name: '새 습관', color: '#d9ead3', order: habits.length });
    reload();
  };
  const update = async (id: string, patch: Partial<Omit<Habit, 'id'>>) => {
    await updateHabit(id, patch);
    reload();
  };
  const remove = async (id: string) => {
    if (!confirm('습관 삭제? 관련 체크 기록도 모두 삭제됩니다.')) return;
    await deleteHabit(id);
    reload();
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
      <h2 className="text-base font-semibold mb-3 text-zinc-800 dark:text-zinc-50">습관</h2>
      <ul className="space-y-2">
        {habits.length === 0 && (
          <li className="text-sm text-zinc-400 py-2">습관이 없어요. 추가해보세요.</li>
        )}
        {habits.map((h) => (
          <li key={h.id} className="flex items-center gap-2 flex-wrap">
            <input
              type="color"
              value={h.color}
              onChange={(e) => update(h.id, { color: e.target.value })}
              className="w-9 h-9 rounded-md border border-zinc-200 dark:border-zinc-700 cursor-pointer"
            />
            <input
              type="text"
              defaultValue={h.name}
              onBlur={(e) => update(h.id, { name: e.target.value.trim() || '습관' })}
              className="flex-1 min-w-[140px] border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={h.parentGoalId ?? ''}
              onChange={(e) => update(h.id, { parentGoalId: e.target.value || undefined })}
              className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 bg-white dark:bg-zinc-950 max-w-[160px]"
              title="상위 목표"
            >
              <option value="">(상위 목표 없음)</option>
              <optgroup label="원씽">
                {goals.filter((g) => g.level === 'oneThing').map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </optgroup>
              <optgroup label="코어">
                {goals.filter((g) => g.level === 'mandalartCore').map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </optgroup>
              <optgroup label="서브">
                {goals.filter((g) => g.level === 'mandalartSub').map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </optgroup>
            </select>
            <button
              onClick={() => remove(h.id)}
              aria-label="삭제"
              className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
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
        <Plus size={14} /> 습관 추가
      </button>
    </section>
  );
};
