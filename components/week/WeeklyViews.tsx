'use client';

import { useEffect, useState } from 'react';
import { DayListView } from './DayListView';
import { WeekGrid } from './WeekGrid';
import { WeeklyTemplatesPanel } from './WeeklyTemplatesPanel';

interface Props {
  isoweek: string;
}

export function WeeklyViews({ isoweek }: Props) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  if (isDesktop === null) {
    return <div className="min-h-24" aria-busy="true" aria-label="주간 화면 불러오는 중" />;
  }

  return <>
    <WeeklyTemplatesPanel key={isoweek} isoweek={isoweek} />
    {isDesktop ? <WeekGrid isoweek={isoweek} /> : <DayListView isoweek={isoweek} />}
  </>;
}
