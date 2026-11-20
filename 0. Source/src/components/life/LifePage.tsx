'use client';
import { useState } from 'react';
import { CalendarDays, Users } from 'lucide-react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { isContactDue } from '@/lib/lifeEvents';
import { listLifeEvents } from '@/lib/repo/lifeEvents';
import { listPeople } from '@/lib/repo/people';
import { toIsoDate } from '@/lib/utils/date';
import { LifeEventsSection } from './LifeEventsSection';
import { PeopleSection } from './PeopleSection';

export function LifePage({
  initialTab = 'events',
  initialPersonId,
}: {
  initialTab?: 'events' | 'people';
  initialPersonId?: string;
}) {
  const [tab, setTab] = useState<'events' | 'people'>(initialTab);
  const today = toIsoDate(new Date());

  const { value, loading, error, refresh } = useAsyncResource(
    'life:hub',
    async () => {
      const [events, people] = await Promise.all([listLifeEvents(), listPeople()]);
      return { events, people };
    },
    { events: [], people: [] },
    ['lifeEvents', 'people'],
  );

  const duePeopleCount = value.people.filter(p => isContactDue(p, today).due).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-24 md:p-6">
      <header className="space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
          Events & Relationships
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">일정 · 기념일 · 소중한 사람</h1>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="생활 허브 탭">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'events'}
          onClick={() => setTab('events')}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            tab === 'events'
              ? 'bg-blue-600 text-white'
              : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
          }`}
        >
          <CalendarDays size={14} /> 일정 · D-Day ({value.events.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'people'}
          onClick={() => setTab('people')}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            tab === 'people'
              ? 'bg-blue-600 text-white'
              : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
          }`}
        >
          <Users size={14} /> 소중한 사람 ({value.people.length})
          {duePeopleCount > 0 && (
            <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${tab === 'people' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>
              안부 {duePeopleCount}
            </span>
          )}
        </button>
      </div>

      {loading && value.events.length === 0 && value.people.length === 0 && (
        <p className="text-sm text-zinc-500">불러오는 중…</p>
      )}
      {!!error && (
        <button type="button" onClick={() => void refresh()} className="text-sm text-red-600 hover:underline">
          데이터를 불러오지 못했어요. 다시 시도
        </button>
      )}

      {tab === 'events' ? (
        <LifeEventsSection events={value.events} people={value.people} today={today} />
      ) : (
        <PeopleSection people={value.people} today={today} initialPersonId={initialPersonId} />
      )}
    </div>
  );
}
