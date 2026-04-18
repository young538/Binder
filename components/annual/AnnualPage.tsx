'use client';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBinder } from '@/store';
import { Goal } from '@/lib/types';
import { FocusNoteEditor } from '@/components/common/FocusNoteEditor';
import { CoreSection } from './CoreSection';
import { yearKeyFromString } from '@/lib/utils/period';

interface Props { year: string; }

export const AnnualPage = ({ year }: Props) => {
  const { goals } = useBinder();

  const oneThing = goals.find(g => g.level === 'oneThing');
  const cores = goals.filter(g => g.level === 'mandalartCore' && g.parentId === oneThing?.id)
    .sort((a, b) => a.order - b.order);

  const currentMonth = new Date();
  const hasMandalart = cores.length > 0 || goals.some(g => g.level === 'mandalartCore');

  const prevYear = String(Number(year) - 1);
  const nextYear = String(Number(year) + 1);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <header className="flex items-center gap-3">
        <Link href={`/annual/${prevYear}`}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold flex-1 text-center text-zinc-900 dark:text-zinc-50">{year} 연간 계획</h1>
        <Link href={`/annual/${nextYear}`}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600">
          <ChevronRight size={18} />
        </Link>
      </header>

      <FocusNoteEditor
        scope="year"
        scopeKey={yearKeyFromString(year)}
        label="올해 한 문장"
        placeholder="예: 지속가능한 수익 구조를 만든다" />

      {!hasMandalart ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center">
          <div className="text-zinc-500 mb-3">먼저 만다라트에서 원씽과 코어 목표를 입력해주세요.</div>
          <Link href="/mandalart" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">
            만다라트로 가기
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {cores.map(core => {
            const subs: Goal[] = goals.filter(g => g.level === 'mandalartSub' && g.parentId === core.id);
            return <CoreSection key={core.id} core={core} subs={subs} currentMonth={currentMonth} />;
          })}
          {cores.length < 8 && (
            <div className="text-xs text-zinc-500 text-center py-2">
              만다라트 코어 {8 - cores.length}개가 아직 비어있어요. <Link href="/mandalart" className="text-blue-600">만다라트에서 채우기 →</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
