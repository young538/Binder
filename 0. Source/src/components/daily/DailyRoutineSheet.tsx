'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { HabitEditor } from '@/components/daily/HabitEditor';

interface Props {
  onClose: () => void;
}

export const DailyRoutineSheet = ({ onClose }: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end lg:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-zinc-900/25 backdrop-blur-sm" />
      <div
        className="relative w-full lg:max-w-2xl rounded-t-3xl lg:rounded-2xl bg-zinc-50 shadow-2xl dark:bg-zinc-950 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-5 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div>
            <div className="text-xs text-zinc-500">루틴 관리</div>
            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-50">
              매일 반복할 일 관리
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4">
          <HabitEditor />
        </div>
      </div>
    </div>
  );
};
