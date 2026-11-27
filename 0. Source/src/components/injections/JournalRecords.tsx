'use client';
import { format } from 'date-fns';
import { ChevronRight, History, PackageOpen, Pencil, Plus, Syringe } from 'lucide-react';
import { drugs, mg, usedByPen, type InjectionJournal } from '@/lib/injections';
import { wegovyDosesPerPen, wegovyPens } from '@/lib/wegovy-pens';
import { WegovyPenGuide } from './WegovyPenGuide';
import type { Editor } from './InjectionEditor';
import styles from './journal.module.css';

interface Props {
  journal: InjectionJournal;
  isExample: boolean;
  open: (editor: Editor) => void;
}

export function PenInventory({ journal, isExample, open }: Props) {
  const used = usedByPen(journal.entries);
  return <section aria-label={isExample ? '예시 펜' : '내 펜'} className={styles.panel}>
    <h2><PackageOpen size={19} />{isExample ? '예시 펜' : '내 펜'}</h2>
    {journal.pens.map(p => {
      const remaining = p.capacityMcg - (used.get(p.id) ?? 0);
      const matchingPen = p.drug === 'semaglutide' && wegovyPens.find(pen => pen.capacityMcg === p.capacityMcg);
      return <article key={p.id} aria-label={p.name} className={styles.pen} data-drug={p.drug}>
        <div className={styles.penTop}><div><span className={styles.drug}>{drugs[p.drug].name}{p.closed && ' · 사용 종료'}</span><h3>{p.name}</h3></div>
          {!isExample && <button className={styles.iconButton} aria-label={p.name + ' 수정'} onClick={() => open({ kind: 'pens', row: p })}><Pencil size={16} /></button>}
        </div>
        <p>{isExample ? '추정 잔량' : '기록상 잔량'} <strong>{mg(remaining)} mg</strong><span> / 총 {mg(p.capacityMcg)} mg</span></p>
        {matchingPen && <p className={styles.penSpec}>같은 총량의 국내 위고비 규격 · {mg(matchingPen.doseMcg)} mg × {wegovyDosesPerPen}회분</p>}
        <progress aria-label={p.name + ' 잔량'} max={p.capacityMcg} value={remaining} />
        {!isExample && !p.closed && remaining > 0 && <button className={styles.secondary} onClick={() => open({ kind: 'entries', penId: p.id })}><Plus size={15} />투여 기록 추가</button>}
      </article>;
    })}
    {!journal.pens.length && <div className={styles.blank}><Syringe size={24} /><strong>등록한 펜이 없어요.</strong><span>상단의 펜 등록에서 첫 펜을 추가하세요.</span></div>}
    {!!journal.pens.length && <p className={styles.note}>표시 총량에서 기록한 양을 뺀 잔량입니다. 여분과 폐기량은 반영되지 않습니다.</p>}
    {(!journal.pens.length || journal.pens.some(p => p.drug === 'semaglutide')) && <WegovyPenGuide />}
  </section>;
}

export function InjectionHistory({ journal, isExample, open }: Props) {
  const byId = new Map(journal.pens.map(p => [p.id, p]));
  const spent = usedByPen(journal.entries);
  return <section className={styles.panel}>
    <h2><History size={19} />투여 이력</h2>
    {journal.entries.length ? <ol className={styles.history}>{journal.entries.map(e => {
      const p = byId.get(e.penId)!;
      const cumulative = spent.get(p.id)!;
      spent.set(p.id, cumulative - e.amountMcg);
      return <li key={e.id} data-drug={p.drug}>
        <time dateTime={e.takenAt}><b>{format(new Date(e.takenAt), 'yyyy.MM.dd')}</b><small>{format(new Date(e.takenAt), 'HH:mm')}</small></time>
        <div><span className={styles.drug}>{drugs[p.drug].name}</span><small>{p.name}</small></div>
        <div className={styles.dose}><b>{mg(e.amountMcg)} mg</b><small>{isExample ? '추정 잔량' : '투여 후 잔량'} {mg(p.capacityMcg - cumulative)} mg</small></div>
        {!isExample && <button className={styles.iconButton} aria-label={format(new Date(e.takenAt), 'yyyy.MM.dd HH:mm') + ' · ' + mg(e.amountMcg) + ' mg 투여 기록 수정'} onClick={() => open({ kind: 'entries', row: e })}><ChevronRight size={18} /></button>}
      </li>;
    })}</ol> : <p className={styles.blank}>아직 기록한 주사가 없어요.</p>}
  </section>;
}
