'use client';

import { RetroTemplate } from '@/components/retro/RetroTemplate';
import { AutosaveStatus } from '@/components/common/AutosaveStatus';
import { useRetrospectiveEditor } from '@/lib/autosave/editors';
import { NotebookPen } from 'lucide-react';

export function DailyRecord({ date }: { date: string }) {
  const editor = useRetrospectiveEditor('daily', date);
  return (
    <section aria-label="하루 기록" className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm dark:border-blue-900 dark:bg-zinc-900">
      <div className="flex items-start gap-3 border-b border-blue-100 bg-blue-50/60 p-5 dark:border-blue-900/60 dark:bg-blue-950/20">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
          <NotebookPen size={20} />
        </div>
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">하루 기록</h2>
          <p className="mt-1 text-[13px] leading-6 text-zinc-600 dark:text-zinc-300">오늘의 경험과 생각을 돌아보고, 내일 할 일을 남겨 보세요.</p>
        </div>
      </div>
      <div className="p-5">
        {editor.loaded && <RetroTemplate value={editor.value} onChange={editor.patch} layout="wide" />}
        <AutosaveStatus {...editor} />
      </div>
    </section>
  );
}
