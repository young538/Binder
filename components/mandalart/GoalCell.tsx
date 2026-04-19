'use client';
import { Plus } from 'lucide-react';
import { Goal } from '@/lib/types';

interface Props {
  goal: Goal | null;
  isCenter: boolean;
  isCore: boolean;
  connectionCount?: number;
  onClick: () => void;
}

export const GoalCell = ({ goal, isCenter, isCore, connectionCount = 0, onClick }: Props) => {
  const base =
    'relative aspect-square p-1.5 text-[10px] sm:text-xs overflow-hidden transition cursor-pointer flex items-center justify-center text-center leading-tight rounded-md';
  const classes = isCenter
    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold shadow-md hover:shadow-lg'
    : isCore
      ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-semibold border border-blue-200 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-950/50 shadow-sm'
      : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800';

  return (
    <button onClick={onClick} className={`${base} ${classes}`}>
      {goal?.title ?? <Plus size={14} className="text-zinc-300 dark:text-zinc-600" />}
      {goal && connectionCount > 0 && (
        <div className="absolute bottom-0 right-0 text-[8px] bg-blue-500 text-white rounded-tl px-1 font-semibold leading-tight">
          {connectionCount}
        </div>
      )}
    </button>
  );
};
