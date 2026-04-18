'use client';
import { useEffect, useRef, useState } from 'react';
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
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white dark:bg-gray-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-lg p-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold">📝 {date} 일일 회고</h3>
          <button onClick={onClose} className="text-gray-500">
            닫기
          </button>
        </div>
        <RetroTemplate value={value} onChange={patch} />
      </div>
    </div>
  );
};
