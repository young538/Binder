'use client';
import { useState } from 'react';
import { TodoStatus, STATUS_ICON, STATUS_LABEL } from '@/lib/types';

interface Props {
  status: TodoStatus;
  onChange: (next: TodoStatus) => void;
  size?: 'sm' | 'md';
}

const STATUS_ORDER: TodoStatus[] = ['pending', 'done', 'postponed', 'delegated', 'cancelled'];

export const TodoStatusButton = ({ status, onChange, size = 'md' }: Props) => {
  const [open, setOpen] = useState(false);
  const btnSize = size === 'sm' ? 'w-5 h-5 text-[11px]' : 'w-6 h-6 text-sm';

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        title={STATUS_LABEL[status]}
        className={`${btnSize} inline-flex items-center justify-center rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 hover:border-blue-400 transition leading-none`}
      >
        <span className="leading-none">{STATUS_ICON[status]}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-[60] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[110px]">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(s);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition
                  ${
                    s === status
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-zinc-700 dark:text-zinc-300'
                  }`}
              >
                <span className="w-5 inline-block text-center">{STATUS_ICON[s]}</span>
                <span>{STATUS_LABEL[s]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
