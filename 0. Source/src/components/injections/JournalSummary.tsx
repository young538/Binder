'use client';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Layers, Scale, Syringe } from 'lucide-react';
import { drugs, mg, type InjectionJournal } from '@/lib/injections';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { listMetricsWithEntries } from '@/lib/repo/metrics';
import { sortMetricEntries } from '@/lib/metrics';
import styles from './journal.module.css';

function WeightSummary() {
  const resource = useAsyncResource('injection-journal-weight', listMetricsWithEntries, [], ['metrics', 'metricEntries']);
  const weights = resource.value.filter(({ metric }) => metric.unit.trim().toLowerCase() === 'kg' &&
    ['체중', '몸무게', 'weight', 'body weight'].includes(metric.name.trim().toLowerCase()));
  const latest = sortMetricEntries(weights.flatMap(row => row.entries)).at(-1);
  return <div><dt><Scale size={16} />최근 체중</dt>
    <dd>{latest ? <>{latest.value}<small> kg</small></> : '—'}</dd>
    <Link href="/metrics">{latest ? latest.date : resource.error ? '지표에서 확인' : '체중 지표 열기'} <ArrowUpRight size={12} /></Link>
  </div>;
}

export function JournalSummary({ journal, isExample }: { journal: InjectionJournal; isExample: boolean }) {
  const latest = journal.entries[0];
  const latestPen = journal.pens.find(p => p.id === latest?.penId);
  const first = journal.entries.at(-1);
  return <dl className={styles.summary}>
    <div><dt><Syringe size={16} />{isExample ? '최근 추정량' : '최근 투여량'}</dt>
      <dd>{latest ? <>{mg(latest.amountMcg)}<small> mg</small></> : '—'}</dd>
      <span>{latest && latestPen ? drugs[latestPen.drug].name + ' · ' + format(new Date(latest.takenAt), 'MM.dd') : '투여 기록 대기'}</span></div>
    <div><dt><Layers size={16} />누적 기록</dt><dd>{journal.entries.length}<small> 회</small></dd>
      <span>등록한 펜 {journal.pens.length}개</span></div>
    {isExample ? <div><dt><CalendarDays size={16} />기록 기간</dt><dd>{first && latest ? Math.round((Date.parse(latest.takenAt) - Date.parse(first.takenAt)) / 86400000) + 1 : 0}<small> 일</small></dd>
      <span>{first && latest ? format(new Date(first.takenAt), 'MM.dd') + ' – ' + format(new Date(latest.takenAt), 'MM.dd') : '—'}</span></div> : <WeightSummary />}
  </dl>;
}
