'use client';
import { useState } from 'react';
import { BookOpen, Files, Plus } from 'lucide-react';
import { drugs, type JournalOverview } from '@/lib/injections';
import { getInjectionJournal } from '@/lib/repo/injections';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { InjectionChart } from './InjectionChart';
import { InjectionEditor, type Editor } from './InjectionEditor';
import { InjectionHistory, PenInventory } from './JournalRecords';
import { JournalSummary } from './JournalSummary';
import styles from './journal.module.css';

const empty: JournalOverview = { pens: [], entries: [] };

export function InjectionPage() {
  const journal = useAsyncResource('injection-journal', getInjectionJournal, empty, ['injectionPens', 'injectionEntries']);
  const [mode, setMode] = useState<'live' | 'example' | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const { examples } = journal.value;
  const isExample = !!examples && (mode === 'example' || (mode === null && !journal.value.pens.length));
  const current = isExample ? examples : journal.value;
  const ready = !journal.loading && !journal.error;

  return <div className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.heroContent}>
        <h1>주사 기록</h1>
        <p>{isExample ? '엑셀 관리대장에서 가져온 펜과 투여 이력입니다. 용량은 시트 수식의 추정값입니다.' : '투여한 날짜와 용량을 기록하고, 펜에 얼마나 남았는지 확인하세요.'}</p>
        {ready && (isExample
          ? <button className={styles.primary} onClick={() => setMode('live')}><BookOpen size={16} />내 기록 열기</button>
          : <button className={styles.primary} onClick={() => setEditor({ kind: 'pens' })}><Plus size={17} />펜 등록</button>)}
      </div>
    </header>
    {examples && <div className={styles.modes} role="group" aria-label="기록 선택">
      <button aria-pressed={!isExample} onClick={() => setMode('live')}><BookOpen size={15} />내 기록</button>
      <button aria-pressed={isExample} onClick={() => setMode('example')}><Files size={15} />관리대장 예시</button>
    </div>}
    {journal.loading && <p role="status">기록을 불러오는 중…</p>}
    {!!journal.error && <button className={styles.secondary} onClick={() => void journal.refresh(true)}>기록을 불러오지 못했어요. 다시 시도</button>}
    {ready && <>
      <JournalSummary journal={current} isExample={isExample} />
      <div className={styles.panels}>
        <InjectionChart key={isExample ? 'example' : 'live'} journal={current} isExample={isExample} />
        <PenInventory journal={current} isExample={isExample} open={setEditor} />
      </div>
      <InjectionHistory journal={current} isExample={isExample} open={setEditor} />
      {!isExample && new Set(current.pens.map(p => p.drug)).size > 1 && <p className={styles.note}>
        두 약을 같은 기간에 사용 중이라면 다음 투여 전에 처방 의료진에게 확인하세요. 위고비와 다른 GLP-1 계열 약의 병용은 권장되지 않습니다.{' '}
        <a href={drugs.semaglutide.source} target="_blank" rel="noreferrer">위고비 제품정보</a>
      </p>}
    </>}
    {editor && !isExample && <InjectionEditor key={editor.kind + (editor.row?.id ?? 'new')} editor={editor} pens={journal.value.pens} refresh={journal.refresh} onClose={() => setEditor(null)} />}
  </div>;
}
