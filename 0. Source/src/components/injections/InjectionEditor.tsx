'use client';
import { useRef, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { drugs, mg, type Drug, type InjectionEntry, type InjectionPen } from '@/lib/injections';
import { removeInjection, saveInjection } from '@/lib/repo/injections';
import { Dialog } from '@/components/common/Dialog';
import { wegovyDosesPerPen, wegovyPens } from '@/lib/wegovy-pens';
import { ConditionFields, readCondition } from './InjectionCondition';
import { HttpError } from '@/lib/client/HttpClient';

export type Editor = { kind: 'pens'; row?: InjectionPen } | { kind: 'entries'; row?: InjectionEntry; penId?: string };
const field = 'mt-1 w-full min-w-0 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base dark:border-zinc-600';

export function InjectionEditor({ editor, pens, refresh, onClose }: { editor: Editor; pens: InjectionPen[]; refresh: () => Promise<void>; onClose: () => void }) {
  const pen = editor.kind === 'pens' ? editor.row : undefined;
  const entry = editor.kind === 'entries' ? editor.row : undefined;
  const [id] = useState(() => editor.row?.id ?? crypto.randomUUID());
  const [drug, setDrug] = useState<Drug>(pen?.drug ?? 'semaglutide');
  const [name, setName] = useState(pen?.name ?? '');
  const [closed, setClosed] = useState(pen?.closed ?? false);
  const [penId, setPenId] = useState(entry?.penId ?? (editor.kind === 'entries' ? editor.penId : '') ?? '');
  const [clicks, setClicks] = useState(String(pen?.startingClicks ?? entry?.usedClicks ?? ''));
  const initialAmount = pen?.capacityMcg ?? entry?.amountMcg;
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount / 1000) : '');
  const localTime = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm");
  const [time, setTime] = useState(() => localTime(entry ? new Date(entry.takenAt) : new Date()));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mutate = async (operation: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      await operation();
      onClose();
    } catch (cause) {
      if (cause instanceof HttpError && cause.status === 409) void refresh();
      setError(cause instanceof HttpError ? cause.message.replace(/^[^:]+: /, '') : '저장 요청을 처리하지 못했어요. 다시 시도해 주세요.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!/^(?:\d+|\d*\.\d{1,3})$/.test(amount) || Number(amount) <= 0) {
      setError('mg 단위로 소수점 셋째 자리까지 입력해 주세요.');
      return;
    }
    const recordedClicks = clicks === '' ? null : Number(clicks);
    if (recordedClicks !== null && (!Number.isSafeInteger(recordedClicks) || recordedClicks < 0 || recordedClicks > 1000000)) {
      setError('클릭 수는 0에서 1,000,000 사이 정수로 입력해 주세요.');
      return;
    }
    const mcg = Math.round(Number(amount) * 1000);
    if (editor.kind === 'pens') {
      void mutate(() => saveInjection('pens', id, { name: name.trim(), drug, capacityMcg: mcg, startingClicks: recordedClicks, closed }, pen?.updatedAt));
    } else {
      const instant = new Date(time);
      if (!Number.isFinite(+instant) || +instant > Date.now()) {
        setError('이미 투여한 날짜와 시각을 입력해 주세요.');
        return;
      }
      const takenAt = entry && time === localTime(new Date(entry.takenAt)) ? entry.takenAt : instant.toISOString();
      const condition = readCondition(e.currentTarget);
      void mutate(() => saveInjection('entries', id, { penId, amountMcg: mcg, usedClicks: recordedClicks, takenAt, ...condition }, entry?.updatedAt));
    }
  };

  const title = (editor.kind === 'pens' ? '펜' : '투여 기록') + (editor.row ? ' 수정' : ' 등록');
  return <Dialog title={title} onClose={() => { if (!locked.current) onClose(); }}><form onSubmit={save} aria-label={editor.kind === 'pens' ? '펜 편집' : '투여 기록 편집'} className="space-y-4">
    <fieldset disabled={busy} className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
      {editor.kind === 'pens' ? <>
        <label>약물<select className={field} value={drug} onChange={e => { setDrug(e.target.value as Drug); setAmount(''); setClicks(''); }}>
          {Object.entries(drugs).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}
        </select></label>
        <label>펜 이름<input required autoFocus maxLength={80} className={field} value={name} onChange={e => setName(e.target.value)} placeholder="예: 11월에 개봉한 펜" /></label>
      </> : <>
        <label>사용한 펜<select required className={field} value={penId} onChange={e => setPenId(e.target.value)}>
          <option value="">펜 선택</option>
          {pens.filter(p => !p.closed || p.id === entry?.penId).map(p => <option key={p.id} value={p.id}>{drugs[p.drug].name} · {p.name}</option>)}
        </select></label>
        <label>투여 일시<input required type="datetime-local" className={field} value={time} onChange={e => setTime(e.target.value)} /></label>
      </>}
      {editor.kind === 'pens' && drug === 'semaglutide' && <label>국내 위고비 4회용 펜 규격
        <select className={field} value={wegovyPens.find(p => p.capacityMcg / 1000 === Number(amount))?.capacityMcg ?? ''}
          onChange={e => setAmount(e.target.value ? String(Number(e.target.value) / 1000) : '')}>
          <option value="">총량 직접 입력</option>
          {wegovyPens.map(p => <option key={p.doseMcg} value={p.capacityMcg}>{mg(p.doseMcg)} mg × {wegovyDosesPerPen}회분 · 총 {mg(p.capacityMcg)} mg</option>)}
        </select>
      </label>}
      <label>{editor.kind === 'pens' ? '펜 한 개의 표시 총량 (mg)' : '실제 투여량 (mg)'}
        <input required type="number" inputMode="decimal" min="0.001" max="1000" step="0.001" className={field} value={amount} onChange={e => setAmount(e.target.value)} />
      </label>
      <label>{editor.kind === 'pens' ? '장부 시작 클릭 수 (선택)' : '기록한 사용 클릭 수 (선택)'}
        <input className={field} type="number" min="0" max="1000000" step="1" inputMode="numeric" value={clicks} onChange={e => setClicks(e.target.value)} />
      </label>
      {pen && <label className="flex items-center gap-2 self-end py-2"><input type="checkbox" checked={closed} onChange={e => setClosed(e.target.checked)} /> 사용 종료한 펜</label>}
    </fieldset>
    {editor.kind === 'entries' && <fieldset disabled={busy}><ConditionFields entry={entry} fieldClass={field} /></fieldset>}
    {editor.kind === 'pens' && <p className="text-xs text-zinc-600 dark:text-zinc-400">라벨에서 펜 전체에 들어 있는 약물량(mg)을 확인해 주세요. 1회 용량이나 용액의 부피(mL)와 다를 수 있어요. 제품의 사용 횟수와 폐기 기준을 따르고 남은 여분을 추가 투여하지 마세요.</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">{busy ? '처리 중…' : '저장'}</button>
      <button type="button" disabled={busy} onClick={onClose}>취소</button>
      {editor.row && <button type="button" disabled={busy} className="ml-auto text-red-600" onClick={() => {
        if (editor.row && confirm('이 기록을 삭제할까요?')) {
          const version = editor.row.updatedAt;
          void mutate(() => removeInjection(editor.kind, id, version));
        }
      }}>삭제</button>}
    </div>
  </form></Dialog>;
}
