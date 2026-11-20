'use client';
import { Check } from 'lucide-react';
import type { Habit } from '@/lib/types';
import { habitScheduleLabel } from '@/lib/utils/habitSchedule';
import { tint } from '@/lib/utils/color';

export const HabitCheckRow = ({ habit, done, pending, color, onToggle }: {
  habit: Habit; done: boolean; pending: boolean; color: string; onToggle: (habit: Habit) => void;
}) => {
  return (
    <button
      type="button"
      onClick={() => onToggle(habit)}
      disabled={pending}
      aria-pressed={done}
      aria-label={`${habit.name} ${done ? '완료 취소' : '완료'}`}
      className="group flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-zinc-800/50"
      style={{ background: done ? tint.soft(color, 0.16) : undefined }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-transform group-active:scale-95"
        style={{
          background: done ? tint.strong(color) : 'transparent',
          borderColor: done ? color : 'var(--color-border)',
        }}
      >
        {done && <Check size={19} strokeWidth={3} className="text-zinc-900" />}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-medium text-zinc-800 dark:text-zinc-100 ${done ? 'line-through opacity-60' : ''
            }`}
        >
          {habit.name}
        </span>
        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
          {habit.note || habitScheduleLabel(habit.schedule)}
        </span>
      </span>
      <span className={`text-xs font-medium ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
        {pending ? '저장 중' : done ? '완료' : '대기'}
      </span>
    </button>
  );
};
