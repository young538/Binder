'use client';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { drugs, mg, residualTrend, type Drug, type InjectionJournal } from '@/lib/injections';

export function InjectionChart({ journal }: { journal: InjectionJournal }) {
  const [selectedDrug, setDrug] = useState<Drug | null>(null);
  const latestPen = journal.pens.find(p => p.id === journal.entries[0]?.penId);
  const drug = selectedDrug ?? latestPen?.drug ?? journal.pens[0]?.drug ?? 'semaglutide';
  const [days, setDays] = useState(28);
  const [mode, setMode] = useState<'trend' | 'amount'>('trend');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const ids = new Set(journal.pens.filter(p => p.drug === drug).map(p => p.id));
  const entries = journal.entries.filter(e => ids.has(e.penId));
  // A just-saved injection can be newer than the last minute tick.
  const end = Math.max(now, entries.length ? Date.parse(entries[0].takenAt) : 0);
  const start = end - days * 86400000;
  const visible = entries.filter(e => Date.parse(e.takenAt) >= start);
  const trend = residualTrend(entries, drug, end, days);
  const peakDose = visible.reduce((max, e) => Math.max(max, e.amountMcg), 0);
  const x = (t: number) => 46 + 520 * (t - start) / (end - start);
  const y = (value: number) => 142 - 116 * value / 100;
  const show = mode === 'trend' ? entries.length > 0 : visible.length > 0;
  const description = mode === 'trend' ? '반감기 기반 상대 잔류 지수' : '회차별 실제 투여량 (mg)';
  return <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
    <h2 className="font-semibold">투여 그래프</h2>
    <div className="flex flex-wrap gap-2 text-sm">
      <select className="rounded border bg-transparent p-1" aria-label="그래프 약물" value={drug} onChange={e => setDrug(e.target.value as Drug)}>
        {Object.entries(drugs).map(([k, d]) => <option key={k} value={k}>{d.name}</option>)}
      </select>
      <select className="rounded border bg-transparent p-1" aria-label="그래프 종류" value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
        <option value="trend">상대 잔류 추이</option><option value="amount">실제 투여량</option>
      </select>
      <select className="rounded border bg-transparent p-1" aria-label="그래프 기간" value={days} onChange={e => setDays(Number(e.target.value))}>
        <option value="28">최근 4주</option><option value="84">최근 12주</option><option value="365">최근 1년</option>
      </select>
    </div>
    {show ? <>
      <p className="text-sm">{drugs[drug].name} · {description}</p>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
        <div className="flex flex-col items-end justify-between">
          {[100, 50, 0].map(v => <span key={v}>{mode === 'trend' ? v : mg(peakDose * v / 100)}</span>)}
        </div>
        <svg role="img" aria-label={drugs[drug].name + ' ' + description} viewBox="42 20 528 128" preserveAspectRatio="none" className="h-36 w-full text-teal-700 dark:text-teal-400">
        {[0, 50, 100].map(v => <line key={v} x1="46" x2="566" y1={y(v)} y2={y(v)} stroke="currentColor" opacity=".18" />)}
        {mode === 'trend' ? <polyline fill="none" stroke="currentColor" strokeWidth="2.5" points={trend.map(p => `${x(p.time)},${y(p.value)}`).join(' ')} /> :
          visible.map(e => <g key={e.id}><title>{format(new Date(e.takenAt), 'yyyy-MM-dd HH:mm')} · {mg(e.amountMcg)} mg</title>
            <line x1={x(Date.parse(e.takenAt))} x2={x(Date.parse(e.takenAt))} y1="142" y2={y(100 * e.amountMcg / peakDose)} stroke="currentColor" strokeWidth="2" />
            <circle cx={x(Date.parse(e.takenAt))} cy={y(100 * e.amountMcg / peakDose)} r="3" fill="currentColor" /></g>)}
        </svg>
        <div className="col-start-2 flex justify-between"><span>{format(start, 'yy.MM.dd')}</span><span>{format(end, 'yy.MM.dd')}</span></div>
      </div>
    </> : <p className="py-6 text-sm text-zinc-500">{drugs[drug].name}의 {mode === 'amount' ? '선택 기간 내 ' : ''}투여 기록이 없어요.</p>}
    {mode === 'trend' && <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
      {drugs[drug].ingredient}의 평균 반감기 약 {drugs[drug].halfLifeDays}일을 적용하고 해당 약의 기록상 최고 지수를 100으로 표시합니다.
      흡수 시간과 개인차를 반영하지 않아 실제 혈중농도나 약효를 알 수 없습니다. 투여 시점·용량 결정에는 사용할 수 없습니다.{' '}
      <a href={drugs[drug].source} target="_blank" rel="noreferrer" className="underline">공식 제품정보</a>
    </p>}
  </section>;
}
