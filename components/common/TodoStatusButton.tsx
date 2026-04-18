'use client';
import { useEffect, useRef, useState } from 'react';
import { TodoStatus, STATUS_ICON, STATUS_LABEL } from '@/lib/types';

interface Props {
  status: TodoStatus;
  onChange: (next: TodoStatus) => void;
  size?: 'sm' | 'md';
}

const STATUS_ORDER: TodoStatus[] = ['pending', 'done', 'postponed', 'delegated', 'cancelled'];

export const TodoStatusButton = ({ status, onChange, size = 'md' }: Props) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const btnSize = size === 'sm' ? 'w-5 h-5 text-[11px]' : 'w-6 h-6 text-sm';

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 120;
    const menuHeight = 200;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    // Position below the button by default, flip up if not enough space
    let top = rect.bottom + 4;
    let left = rect.left;
    if (top + menuHeight > viewportHeight) top = rect.top - menuHeight - 4;
    if (left + menuWidth > viewportWidth - 8) left = viewportWidth - menuWidth - 8;
    if (left < 8) left = 8;
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        title={STATUS_LABEL[status]}
        className={`${btnSize} inline-flex items-center justify-center rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 hover:border-blue-400 transition leading-none shrink-0`}
      >
        <span className="leading-none">{STATUS_ICON[status]}</span>
      </button>
      {open && pos && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[101] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 min-w-[110px]"
            style={{ top: pos.top, left: pos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(s);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left
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
    </>
  );
};
