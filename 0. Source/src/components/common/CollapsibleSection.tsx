'use client';

import { useId, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useBinder } from '@/store';
import { useStoredBoolean } from '@/lib/hooks/useStoredBoolean';

interface Props {
  title: string;
  storageKey: string;
  children: ReactNode;
}

/** A per-user, keyboard-accessible disclosure section for secondary content. */
export function CollapsibleSection({ title, storageKey, children }: Props) {
  const userId = useBinder((state) => state.me?.userId);
  const panelId = useId();
  const key = `binder:collapse:${userId ?? 'anonymous'}:${storageKey}`;
  const [open, toggle] = useStoredBoolean(key);

  return (
    <section className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <h2>
        <button
          type="button"
          className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-semibold text-zinc-800 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-zinc-50 dark:hover:bg-zinc-900"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${open ? '접기' : '펼치기'} ${title}`}
          onClick={toggle}
        >
          <span>{title}</span>
          {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
      </h2>
      {open && <div id={panelId}>{children}</div>}
    </section>
  );
}
