'use client';
import { useEffect, useRef, useState } from 'react';
import { useBinder } from '@/store';
import { weekDates, toIsoDate } from '@/lib/utils/date';
import { getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { getRetrospective, upsertRetrospective } from '@/lib/repo/retrospectives';
import { Retrospective, TimeBlock } from '@/lib/types';
import { WeeklySummary } from './WeeklySummary';
import { RetroTemplate } from './RetroTemplate';

export const WeeklyRetroPage = ({ isoweek }: { isoweek: string }) => {
  const { categories, goals } = useBinder();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [value, setValue] = useState<Partial<Retrospective>>({ template: {} });
  const latest = useRef<Partial<Retrospective>>({ template: {} });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const dates = weekDates(isoweek);
    getTimeBlocksInRange(toIsoDate(dates[0]), toIsoDate(dates[6])).then(setBlocks);
    getRetrospective('weekly', isoweek).then((r) => {
      const v = r ?? { template: {} };
      setValue(v);
      latest.current = v;
    });
  }, [isoweek]);

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
      upsertRetrospective('weekly', isoweek, {
        rating: merged.rating,
        template: merged.template,
        freeText: merged.freeText,
      });
    }, 1000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📝 주간 회고 — {isoweek}</h1>
      <WeeklySummary isoweek={isoweek} blocks={blocks} categories={categories} goals={goals} />
      <RetroTemplate value={value} onChange={patch} />
    </div>
  );
};
