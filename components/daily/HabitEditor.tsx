'use client';
import { Reorder } from 'motion/react';
import { Plus } from 'lucide-react';
import { useBinder } from '@/store';
import { HabitRow } from './HabitRow';
import { useHabitEditor } from './useHabitEditor';

export const HabitEditor = () => {
  const { goals, categories } = useBinder();
  const { habits, annualGoals, handlers, add, handleReorder, orderStatus, retryOrder } = useHabitEditor();

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-50">습관</h2>
          <p className="text-xs text-zinc-500">
            왼쪽 손잡이를 잡아 드래그하면 순서가 바뀌어요.
          </p>
        </div>
        <button
          onClick={add}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus size={14} /> 추가
        </button>
      </div>
      {orderStatus === 'error' && <p role="alert" className="text-sm text-red-600">
        순서를 저장하지 못했어요. <button onClick={retryOrder} className="underline">다시 시도</button>
      </p>}
      {habits.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-400 py-2">습관이 없어요. 추가해보세요.</p>
      ) : (
        <Reorder.Group
          axis="y"
          values={habits}
          onReorder={handleReorder}
          as="ul"
          className="mt-3 space-y-2.5"
        >
          {habits.map((h) => (
            <HabitRow
              key={h.id}
              h={h}
              annualGoals={annualGoals}
              goals={goals}
              categories={categories}
              handlers={handlers}
            />
          ))}
        </Reorder.Group>
      )}
    </section>
  );
};
