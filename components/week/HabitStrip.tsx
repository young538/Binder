'use client';
import { useEffect, useState } from 'react';
import { Habit, Weekday } from '@/lib/types';
import { listHabits } from '@/lib/repo/habits';
import { useBinder } from '@/store';
import { tint } from '@/lib/utils/color';

interface Props {
  dates: Date[];
}

const getDow = (d: Date): Weekday => d.getDay() as Weekday;

// perWeek / perMonth habits have no fixed day, so show on every day — user
// checks whenever the habit is performed.
const matchesHabit = (habit: Habit, dow: Weekday): boolean => {
  const s = habit.schedule;
  if (!s || s.kind === 'daily' || s.kind === 'perWeek' || s.kind === 'perMonth') return true;
  return s.days.includes(dow);
};

export const HabitStrip = ({ dates }: Props) => {
  const { categories } = useBinder();
  const [habits, setHabits] = useState<Habit[]>([]);

  useEffect(() => {
    listHabits().then(setHabits);
  }, []);

  if (habits.length === 0) return null;

  const catColor = (id?: string) =>
    id ? categories.find((c) => c.id === id)?.color : null;

  return (
    <div
      className="grid border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40"
      style={{ gridTemplateColumns: `60px repeat(7, minmax(120px, 1fr))` }}
    >
      <div className="text-[10px] text-zinc-400 text-right pr-2 pt-2 border-r border-zinc-100 dark:border-zinc-900">
        습관
      </div>
      {dates.map((d, i) => {
        const dow = getDow(d);
        const dayHabits = habits.filter((h) => matchesHabit(h, dow));
        return (
          <div
            key={i}
            className="border-r border-zinc-100 dark:border-zinc-900 last:border-r-0 p-1.5 space-y-1"
          >
            {dayHabits.length === 0 ? (
              <div className="text-[10px] text-zinc-300 dark:text-zinc-700 italic text-center py-1">
                —
              </div>
            ) : (
              dayHabits.map((h) => {
                const color = catColor(h.categoryId) ?? h.color;
                return (
                  <div
                    key={h.id}
                    className="text-[11px] px-1.5 py-0.5 rounded flex items-center gap-1 border"
                    style={{
                      background: tint.soft(color),
                      borderColor: color,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <span className="truncate text-zinc-700 dark:text-zinc-300">
                      {h.name}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
};
