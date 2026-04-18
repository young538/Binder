'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Todo } from '@/lib/types';
import { listByPeriod } from '@/lib/repo/todos';

interface Props {
  isoweek: string;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  open: boolean;
  onClose: () => void;
}

export const TodoPicker = ({ isoweek, value, onChange, open, onClose }: Props) => {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    if (!open) return;
    listByPeriod('weekly', `week:${isoweek}`).then(setTodos);
  }, [isoweek, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            TODO 연결
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <X size={16} />
          </button>
        </div>
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => {
                onChange(undefined);
                onClose();
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                !value
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              (연결 없음)
            </button>
          </li>
          {todos.length === 0 && (
            <li className="text-xs text-zinc-400 py-2 px-3">이번 주 TODO가 없어요.</li>
          )}
          {todos.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => {
                  onChange(t.id);
                  onClose();
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  value === t.id
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {t.title}
                {t.done && <span className="ml-2 text-emerald-600 text-xs">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
