'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, StickyNote } from 'lucide-react';
import { useFocusEditor } from '@/lib/autosave/editors';
import { AutosaveStatus } from '@/components/common/AutosaveStatus';

interface Props {
  date: string;
}


/**
 * 일일 페이지 날짜별 간단 메모 (펼치기식).
 * focus_notes(scope='day', scopeKey=date)에 저장 — 스키마 변경·마이그레이션 불필요.
 */
export const DailyMemo = ({ date }: Props) => {
  const editor = useFocusEditor('day', date);
  const text = editor.value;
  const [open, setOpen] = useState(true);
  const onChange = editor.patch;

  if (!editor.loaded) return <AutosaveStatus {...editor} />;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? '메모 접기' : '메모 펼치기'}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
          <StickyNote size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">메모</h2>
          <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {text.trim() ? text.trim().split('\n')[0] : '떠오르는 생각을 짧게 남겨요'}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-zinc-400">
          {open ? (
            <>
              접기 <ChevronUp size={14} />
            </>
          ) : (
            <>
              펼치기 <ChevronDown size={14} />
            </>
          )}
        </span>
      </button>
      {open && (
        <div className="mt-3">
          <textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            placeholder="예: 오후에 은행 다녀오기, 아이디어…"
            rows={5}
            aria-label="일일 메모"
            className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-800 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
          <AutosaveStatus {...editor} />
        </div>
      )}
    </section>
  );
};
