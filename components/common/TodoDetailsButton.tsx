'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import type { Todo, TodoRepeatRule } from '@/lib/types';
import { useBinder } from '@/store';
import { updateTodo } from '@/lib/repo/todos';
import { toIsoDate } from '@/lib/utils/date';
import { retroHref } from '@/lib/todos/planning';
import { Dialog, actionClass, fieldClass } from './Dialog';

export function TodoDetailsButton({ todo }: { todo: Todo }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-label={`${todo.title} 상세 설정`} title="날짜·목표·반복 설정" onClick={() => setOpen(true)} className="shrink-0 rounded p-1.5 text-zinc-500 hover:text-blue-600"><SlidersHorizontal size={14} /></button>
    {open && <TodoDetails key={todo.id} todo={todo} onClose={() => setOpen(false)} />}
  </>;
}

function TodoDetails({ todo, onClose }: { todo: Todo; onClose: () => void }) {
  const { goals } = useBinder();
  const [date, setDate] = useState(todo.scope === 'day' ? todo.scopeKey : '');
  const [goal, setGoal] = useState(todo.parentGoalId ?? '');
  const [note, setNote] = useState(todo.note ?? '');
  const [rule, setRule] = useState<TodoRepeatRule | null>(todo.repeatRule ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const canSchedule = todo.scope === 'day' || todo.scope === 'inbox';
  const save = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await updateTodo(todo.id, {
        note: note.trim() || null, parentGoalId: goal || null, repeatRule: rule,
        ...(canSchedule ? { scope: date ? 'day' : 'inbox', scopeKey: date || 'inbox' } : {}),
      });
      onClose();
    } catch { setError('저장하지 못했어요. 날짜와 반복 설정을 확인하고 다시 시도해 주세요.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Dialog title="할 일 상세 설정" onClose={() => { if (!busy) onClose(); }}>
    <p className="mb-4 break-words font-medium">{todo.title}</p>
    <form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        {canSchedule && <label className="block text-sm">실행 날짜 <span className="text-xs text-zinc-500">(비우면 수집함)</span>
          <input type="date" aria-label="실행 날짜" value={date} onChange={event => { setDate(event.target.value); if (!event.target.value) setRule(null); }} className={fieldClass} />
        </label>}
        <label className="block text-sm">연결 목표<select aria-label="연결 목표" className={fieldClass} value={goal} onChange={event => setGoal(event.target.value)}>
          <option value="">목표 없음</option>{goals.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select></label>
        <label className="block text-sm">메모<textarea aria-label="할 일 메모" className={fieldClass} rows={3} value={note} onChange={event => setNote(event.target.value)} /></label>
        {canSchedule && <div className="space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!rule} onChange={event => {
            setRule(event.target.checked ? { unit: 'week', interval: 1, basis: 'scheduled' } : null);
            if (event.target.checked && !date) setDate(toIsoDate(new Date()));
          }} />반복 할 일</label>
          {rule && <>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">간격<input aria-label="반복 간격" type="number" min={1} max={365} required value={rule.interval} onChange={event => setRule({ ...rule, interval: Number(event.target.value) })} className={fieldClass} /></label>
              <label className="text-xs">단위<select aria-label="반복 단위" value={rule.unit} onChange={event => setRule({ ...rule, unit: event.target.value as TodoRepeatRule['unit'] })} className={fieldClass}><option value="day">일</option><option value="week">주</option><option value="month">개월</option></select></label>
            </div>
            <label className="block text-xs">반복 기준<select aria-label="반복 기준" value={rule.basis} onChange={event => setRule({ ...rule, basis: event.target.value as TodoRepeatRule['basis'] })} className={fieldClass}><option value="scheduled">예정일 기준</option><option value="completed">완료일 기준</option></select></label>
            <p className="text-xs leading-5 text-zinc-500">완료하면 다음 할 일이 한 번 생성됩니다. 완료를 취소해도 다음 할 일은 유지됩니다.</p>
            {todo.repeatGenerated && <p className="text-xs text-amber-700 dark:text-amber-300">다음 할 일이 이미 생성되었습니다. 이후 반복은 다음 할 일에서 변경해 주세요.</p>}
          </>}
        </div>}
      </fieldset>
      {todo.sourceRetro && <Link href={retroHref(todo.sourceRetro)} className="block text-sm text-blue-600">원래 회고 보기 · {todo.sourceRetro.dateOrWeek}</Link>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" className={actionClass} disabled={busy}>{busy ? '저장 중…' : '설정 저장'}</button>
    </form>
  </Dialog>;
}
