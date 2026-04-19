'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Routine } from '@/lib/types';
import {
  listAllRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
} from '@/lib/repo/routines';
import { useBinder } from '@/store';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

export const RoutineEditor = () => {
  const { categories, goals } = useBinder();
  const [routines, setRoutines] = useState<Routine[]>([]);

  const reload = () => listAllRoutines().then(setRoutines);
  useEffect(() => {
    reload();
  }, []);

  const add = async (dayOfWeek: number) => {
    const dayRoutines = routines.filter((r) => r.dayOfWeek === dayOfWeek);
    await createRoutine({
      name: '새 루틴',
      dayOfWeek: dayOfWeek as Routine['dayOfWeek'],
      order: dayRoutines.length,
    });
    reload();
  };

  const update = async (id: string, patch: Partial<Omit<Routine, 'id'>>) => {
    await updateRoutine(id, patch);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await deleteRoutine(id);
    reload();
  };

  const byDay = DAYS.map((_, i) => ({
    day: i,
    label: DAYS[i],
    items: routines.filter((r) => r.dayOfWeek === i),
  }));

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
      <h2 className="text-base font-semibold mb-3 text-zinc-800 dark:text-zinc-50">
        주간루틴
      </h2>
      <p className="text-xs text-zinc-500 mb-4">
        매주 반복되는 할 일을 요일별로 등록하세요. 주간 뷰에 자동으로 표시됩니다.
      </p>
      <div className="space-y-3">
        {byDay.map(({ day, label, items }) => (
          <div
            key={day}
            className="border border-zinc-100 dark:border-zinc-800 rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                {label}요일
              </h3>
              <button
                onClick={() => add(day)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <Plus size={12} /> 추가
              </button>
            </div>
            {items.length === 0 ? (
              <div className="text-[11px] text-zinc-400">등록된 루틴 없음</div>
            ) : (
              <ul className="space-y-1.5">
                {items.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      defaultValue={r.name}
                      onBlur={(e) =>
                        update(r.id, { name: e.target.value.trim() || '루틴' })
                      }
                      className="flex-1 min-w-[120px] border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <select
                      value={r.categoryId ?? ''}
                      onChange={(e) =>
                        update(r.id, { categoryId: e.target.value || undefined })
                      }
                      className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-1 bg-white dark:bg-zinc-950"
                    >
                      <option value="">카테고리</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={r.parentGoalId ?? ''}
                      onChange={(e) =>
                        update(r.id, { parentGoalId: e.target.value || undefined })
                      }
                      className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-1 bg-white dark:bg-zinc-950 max-w-[140px]"
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
                      onClick={() => remove(r.id)}
                      className="p-1 text-zinc-400 hover:text-red-600 rounded"
                      aria-label="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
