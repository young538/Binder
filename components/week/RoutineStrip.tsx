'use client';
import { useEffect, useState } from 'react';
import { Routine } from '@/lib/types';
import { listAllRoutines } from '@/lib/repo/routines';
import { useBinder } from '@/store';

interface Props {
  dates: Date[];
}

// JS Date.getDay(): 0=Sun..6=Sat -> ISO Mon=0..Sun=6
const getDow = (d: Date): number => (d.getDay() + 6) % 7;

export const RoutineStrip = ({ dates }: Props) => {
  const { categories } = useBinder();
  const [routines, setRoutines] = useState<Routine[]>([]);

  useEffect(() => {
    listAllRoutines().then(setRoutines);
  }, []);

  if (routines.length === 0) return null;

  const catColor = (id?: string) =>
    id ? categories.find((c) => c.id === id)?.color : null;

  return (
    <div
      className="grid border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40"
      style={{ gridTemplateColumns: `60px repeat(7, minmax(120px, 1fr))` }}
    >
      <div className="text-[10px] text-zinc-400 text-right pr-2 pt-2 border-r border-zinc-100 dark:border-zinc-900">
        루틴
      </div>
      {dates.map((d, i) => {
        const dow = getDow(d);
        const dayRoutines = routines.filter((r) => r.dayOfWeek === dow);
        return (
          <div
            key={i}
            className="border-r border-zinc-100 dark:border-zinc-900 last:border-r-0 p-1.5 space-y-1"
          >
            {dayRoutines.length === 0 ? (
              <div className="text-[10px] text-zinc-300 dark:text-zinc-700 italic text-center py-1">
                —
              </div>
            ) : (
              dayRoutines.map((r) => {
                const color = catColor(r.categoryId);
                return (
                  <div
                    key={r.id}
                    className="text-[11px] px-1.5 py-0.5 rounded flex items-center gap-1 border"
                    style={{
                      background: color ? `${color}22` : 'transparent',
                      borderColor: color ?? 'var(--color-border)',
                    }}
                  >
                    {color && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: color }}
                      />
                    )}
                    <span className="truncate text-zinc-700 dark:text-zinc-300">
                      {r.name}
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
