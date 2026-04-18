'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Retrospective } from '@/lib/types';
import { getRetrospective, upsertRetrospective } from '@/lib/repo/retrospectives';
import { RetroTemplate } from '@/components/retro/RetroTemplate';

interface Props {
  date: string;
  onClose: () => void;
}

export const DailyRetroSheet = ({ date, onClose }: Props) => {
  const [value, setValue] = useState<Partial<Retrospective>>({ template: {} });
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<Partial<Retrospective>>({ template: {} });

  useEffect(() => {
    getRetrospective('daily', date).then((r) => {
      const v = r ?? { template: {} };
      setValue(v);
      latest.current = v;
    });
  }, [date]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patch = (p: Partial<Retrospective>) => {
    const merged: Partial<Retrospective> = {
      ...latest.current,
      ...p,
      template: { ...latest.current.template, ...(p.template ?? {}) },
    };
    latest.current = merged;
    setValue(merged);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      upsertRetrospective('daily', date, {
        rating: merged.rating,
        template: merged.template,
        freeText: merged.freeText,
      });
    }, 1000);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end lg:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-zinc-900/25 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-zinc-900 w-full lg:max-w-lg rounded-t-3xl lg:rounded-2xl p-6 max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-xs text-zinc-500">일일 회고</div>
            <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-50">📝 {date}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>
        <RetroTemplate value={value} onChange={patch} />
      </div>
    </div>
  );
};
