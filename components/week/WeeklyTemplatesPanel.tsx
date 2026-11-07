'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { applyWeeklyTemplate, createWeeklyTemplate, deleteWeeklyTemplate, listWeeklyTemplates } from '@/lib/repo/weeklyTemplates';
import { actionClass, fieldClass } from '@/components/common/Dialog';
import { minutesToTimeStr, WEEKDAYS_KO } from '@/lib/utils/date';
import { isWeek } from '@/lib/validation/mutations';

export function WeeklyTemplatesPanel({ isoweek }: { isoweek: string }) {
  const { value: templates, error, refresh } = useAsyncResource('weeklyTemplates', listWeeklyTemplates, [], ['weeklyTemplates']);
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [target, setTarget] = useState(isoweek);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const lock = useRef(false);
  const selected = templates.find(template => template.id === selectedId);
  const run = async (operation: () => Promise<string>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage(''); setFailure('');
    try { setMessage(await operation()); }
    catch (error) { setFailure(error instanceof Error ? error.message : '저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <details className="mx-4 mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
    <summary className="cursor-pointer text-sm font-semibold">주간 계획 템플릿</summary>
    <div className="mt-4 grid gap-5 md:grid-cols-2">
      <form onSubmit={event => { event.preventDefault(); void run(async () => {
        const template = await createWeeklyTemplate(name, isoweek); setSelectedId(template.id); setName(''); return '이 주의 계획을 템플릿으로 저장했어요.';
      }); }} className="space-y-3">
        <p className="text-sm text-zinc-500">{isoweek}의 계획 시간표를 저장합니다. 실제 기록과 할 일 연결은 복사하지 않습니다.</p>
        <label className="block text-sm">템플릿 이름<input disabled={busy} required value={name} onChange={event => setName(event.target.value)} className={fieldClass} /></label>
        <button type="submit" disabled={busy || !name.trim()} className={actionClass}>이 주를 템플릿으로 저장</button>
      </form>
      <div className="space-y-3">
        {!!error && <button onClick={() => void refresh()} className="text-sm text-red-600">템플릿을 불러오지 못했어요. 다시 시도</button>}
        <label className="block text-sm">저장한 템플릿<select disabled={busy} className={fieldClass} value={selectedId} onChange={event => { setSelectedId(event.target.value); setMessage(''); }}><option value="">템플릿 선택</option>{templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
        {selected && <>
          <ul aria-label="템플릿 미리보기" className="max-h-48 space-y-1 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-800">
            {selected.blocks.map((block, index) => <li key={index} className="break-words">{WEEKDAYS_KO[block.dayOffset]} {minutesToTimeStr(block.startMin)}–{minutesToTimeStr(block.endMin)} · {block.text || '제목 없음'}</li>)}
          </ul>
          <label className="block text-sm">적용할 주<input disabled={busy} type="week" aria-label="템플릿 적용할 주" value={target} onChange={event => { setTarget(event.target.value); setMessage(''); }} className={fieldClass} /></label>
          <p className="text-xs leading-5 text-zinc-500">기존 계획에 추가합니다. 같은 템플릿을 같은 주에 다시 적용해도 남아 있는 항목은 중복 생성하지 않습니다. 겹치는 시간은 자동 조정하지 않습니다.</p>
          <div className="flex flex-wrap gap-3">
            <button disabled={busy || !isWeek(target)} className={actionClass} onClick={() => void run(async () => { const result = await applyWeeklyTemplate(selected.id, target); return `${result.added}개 추가, 기존 ${result.skipped}개 유지`; })}>이 주에 적용</button>
            <button disabled={busy} className="text-sm text-red-600" onClick={() => { if (confirm('템플릿을 삭제할까요? 이미 적용한 시간표는 유지됩니다.')) void run(async () => { await deleteWeeklyTemplate(selected.id); setSelectedId(''); return '템플릿을 삭제했어요.'; }); }}>템플릿 삭제</button>
          </div>
        </>}
      </div>
    </div>
    {message && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{message} {isWeek(target) && <Link className="underline" href={`/week/${target}`}>주간 화면 보기</Link>}</p>}
    {failure && <p role="alert" className="mt-3 text-sm text-red-600">{failure}</p>}
  </details>;
}
