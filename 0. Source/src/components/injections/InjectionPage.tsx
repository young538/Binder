'use client';
import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { drugs, mg, usedByPen, type InjectionJournal } from '@/lib/injections';
import { getInjectionJournal } from '@/lib/repo/injections';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { InjectionChart } from './InjectionChart';
import { InjectionEditor, type Editor } from './InjectionEditor';

const empty: InjectionJournal = { pens: [], entries: [] };
const outline = 'rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-600';
export function InjectionPage() {
  const journal = useAsyncResource('injection-journal', getInjectionJournal, empty, ['injectionPens', 'injectionEntries']);
  const { pens, entries } = journal.value;
  const [editor, setEditor] = useState<Editor | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const open = (next: Editor) => {
    setEditor(next);
    requestAnimationFrame(() => anchor.current?.scrollIntoView({ block: 'center' }));
  };
  const used = usedByPen(entries);
  const byId = new Map(pens.map(p => [p.id, p]));
  return <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 text-zinc-900 dark:text-zinc-100 sm:px-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold">주사 기록</h1><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">펜별 잔량과 실제 투여 이력을 확인하세요.</p></div>
      {!editor && <button className={outline} onClick={() => open({ kind: 'pens' })}>펜 등록</button>}
    </header>
    <div ref={anchor}>{editor && <InjectionEditor key={editor.kind + (editor.row?.id ?? 'new')} editor={editor} pens={pens} refresh={journal.refresh} onClose={() => setEditor(null)} />}</div>
    {journal.loading && <p role="status">기록을 불러오는 중…</p>}
    {!!journal.error && <button className={outline} onClick={() => void journal.refresh(true)}>기록을 불러오지 못했어요. 다시 시도</button>}
    {!journal.loading && !journal.error && <>
      <section aria-label="내 펜" className="space-y-2">
        <h2 className="font-semibold">내 펜</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {pens.map(p => {
            const remaining = p.capacityMcg - (used.get(p.id) ?? 0);
            return <article key={p.id} aria-label={p.name} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-2"><div><p className="text-xs text-teal-700 dark:text-teal-400">{drugs[p.drug].name}{p.closed && ' · 사용 종료'}</p>
                <h3 className="break-words font-semibold">{p.name}</h3></div>
                <button disabled={!!editor} aria-label={p.name + ' 수정'} className="text-sm underline" onClick={() => open({ kind: 'pens', row: p })}>수정</button></div>
              <p className="my-2 text-sm">기록상 잔량 <strong>{mg(remaining)} mg</strong> / 총 {mg(p.capacityMcg)} mg</p>
              {!p.closed && remaining > 0 && <button disabled={!!editor} className={outline} onClick={() => open({ kind: 'entries', penId: p.id })}>투여 기록 추가</button>}
            </article>;
          })}
        </div>
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{pens.length ? '잔량은 표시 총량에서 기록한 투여량을 뺀 값입니다. 펜에 보이는 여분, 폐기량 또는 실제로 투여 가능한 양과 다를 수 있어요.' : '펜을 먼저 등록한 뒤, 실제 주사한 시각과 투여량을 회차별로 입력하세요.'}</p>
      </section>
      <InjectionChart journal={journal.value} />
      {new Set(pens.map(p => p.drug)).size > 1 && <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        두 약을 같은 기간에 사용 중이라면 다음 투여 전에 처방 의료진에게 확인하세요. 위고비와 다른 GLP-1 계열 약의 병용은 권장되지 않습니다.{' '}
        <a href={drugs.semaglutide.source} className="underline" target="_blank" rel="noreferrer">위고비 제품정보</a>
      </p>}
      <section className="space-y-2"><h2 className="font-semibold">투여 이력</h2>
        {entries.length ? <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">{entries.map(e => {
          const p = byId.get(e.penId)!;
          return <li key={e.id} className="flex items-center justify-between gap-2 py-3 text-sm">
            <div><time dateTime={e.takenAt}>{format(new Date(e.takenAt), 'yyyy.MM.dd HH:mm')}</time>
              <p className="break-words text-zinc-600 dark:text-zinc-400">{drugs[p.drug].name} · {p.name} · {mg(e.amountMcg)} mg</p></div>
            <button disabled={!!editor} className="shrink-0 underline" onClick={() => open({ kind: 'entries', row: e })}>기록 수정</button>
          </li>;
        })}</ul> : <p className="text-sm text-zinc-500">아직 기록한 주사가 없어요.</p>}
      </section>
    </>}
  </div>;
}
