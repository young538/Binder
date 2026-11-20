import { TodoStatus } from '@/lib/types';

export const statusRowClass = (status: TodoStatus): string => {
  switch (status) {
    case 'done':
      return 'line-through text-zinc-500';
    case 'cancelled':
      return 'line-through text-zinc-400 opacity-60';
    case 'postponed':
      return 'text-amber-700 dark:text-amber-400';
    case 'delegated':
      return 'text-blue-700 dark:text-blue-400';
    default:
      return '';
  }
};

export const isCompleted = (status: TodoStatus): boolean =>
  status === 'done' || status === 'cancelled' || status === 'delegated';
