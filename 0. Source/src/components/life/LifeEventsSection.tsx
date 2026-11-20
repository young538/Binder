'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarPlus, Download, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { describeEventDday } from '@/lib/lifeEvents';
import { getGoogleCalendarStatus, syncGoogleCalendar } from '@/lib/repo/googleCalendar';
import { createLifeEvent, deleteLifeEvent, updateLifeEvent } from '@/lib/repo/lifeEvents';
import { LIFE_EVENT_KIND_LABEL, type LifeEvent, type LifeEventKind, type Person } from '@/lib/types';
import { minutesToTimeStr, timeStrToMinutes } from '@/lib/utils/date';
import { useBinder } from '@/store';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';
import { IcsImportDialog } from './IcsImportDialog';

interface Props {
  events: LifeEvent[];
  people: Person[];
  today: string;
}

const KINDS: LifeEventKind[] = ['event', 'dday', 'anniversary'];

export function LifeEventsSection({ events, people, today }: Props) {
  const { goals, projects } = useBinder();
  const [editor, setEditor] = useState<{ open: boolean; editing?: LifeEvent }>({ open: false });
  const [icsOpen, setIcsOpen] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const { value: googleStatus } = useAsyncResource(
    'google-calendar:status-brief',
    getGoogleCalendarStatus,
    null,
    ['googleCalendar'],
  );

  const sorted = useMemo(() => {
    return [...events]
      .map(ev => ({ ev, dday: describeEventDday(ev, today) }))
      .sort((a, b) => {
        if (a.dday.isPast !== b.dday.isPast) return a.dday.isPast ? 1 : -1;
        return a.dday.daysLeft - b.dday.daysLeft || a.ev.date.localeCompare(b.ev.date);
      });
  }, [events, today]);

  const remove = async (ev: LifeEvent) => {
    if (!confirm(`'${ev.title}' 일정을 삭제할까요?`)) return;
    await deleteLifeEvent(ev.id);
  };

  const handleGoogleSync = async () => {
    if (googleBusy) return;
    setGoogleBusy(true);
    try {
      const res = await syncGoogleCalendar();
      setImportStatus(
        `Google 캘린더 동기화: 새로 ${res.pulledCreated}건 · 갱신 ${res.pulledUpdated}건 · 삭제 반영 ${res.pulledDeleted}건 · 구글 전송 ${res.pushedCreated}건`,
      );
    } catch (err) {
      setImportStatus(err instanceof Error ? err.message : 'Google 캘린더 동기화에 실패했습니다.');
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <section className="space-y-4" aria-label="일정 및 기념일 목록">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          약속, D-Day, 매년 반복되는 기념일과 외부 `.ics`·Google 캘린더 일정을 한곳에서 관리하세요.
        </p>
        <div className="flex flex-wrap gap-2">
          {googleStatus?.connected ? (
            <button
              type="button"
              disabled={googleBusy}
              onClick={() => void handleGoogleSync()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300"
            >
              <RefreshCw size={14} className={googleBusy ? 'animate-spin' : ''} /> Google 동기화
            </button>
          ) : (
            <Link
              href="/settings#google-calendar"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Google 캘린더 연결
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIcsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Download size={14} /> .ics 가져오기
          </button>
          <button
            type="button"
            onClick={() => setEditor({ open: true })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <CalendarPlus size={14} /> 새 일정 · D-Day
          </button>
        </div>
      </div>

      {importStatus && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {importStatus}
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          등록된 일정이나 기념일이 없습니다.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {sorted.map(({ ev, dday }) => {
            const person = ev.personId ? people.find(p => p.id === ev.personId) : null;
            const project = ev.projectId ? projects.find(p => p.id === ev.projectId) : null;
            const goal = ev.goalId ? goals.find(g => g.id === ev.goalId) : null;
            return (
              <li
                key={ev.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        dday.daysLeft === 0
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : dday.isPast
                            ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                            : dday.daysLeft <= 7
                              ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      }`}
                    >
                      {dday.label}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {LIFE_EVENT_KIND_LABEL[ev.kind]}
                    </span>
                    {ev.googleEventId && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                        Google
                      </span>
                    )}
                    <h3 className="break-words text-sm font-bold text-zinc-900 dark:text-zinc-50">{ev.title}</h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="tabular-nums">
                      {ev.date}
                      {ev.endDate ? ` ~ ${ev.endDate}` : ''}
                      {!ev.allDay && ev.startMin != null && ev.endMin != null
                        ? ` · ${minutesToTimeStr(ev.startMin)}–${minutesToTimeStr(ev.endMin)}`
                        : ' · 종일'}
                    </span>
                    {person && <span>👤 {person.name}</span>}
                    {project && <span>📁 {project.title}</span>}
                    {goal && <span>🎯 {goal.title}</span>}
                  </div>
                  {ev.note && <p className="whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">{ev.note}</p>}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`${ev.title} 편집`}
                    onClick={() => setEditor({ open: true, editing: ev })}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${ev.title} 삭제`}
                    onClick={() => void remove(ev)}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editor.open && (
        <EventEditorDialog
          key={editor.editing?.id ?? 'new'}
          existing={editor.editing}
          today={today}
          people={people}
          goals={goals}
          projects={projects}
          onClose={() => setEditor({ open: false })}
        />
      )}

      {icsOpen && (
        <IcsImportDialog
          onClose={() => setIcsOpen(false)}
          onImported={res =>
            setImportStatus(`총 ${res.total}개 일정 중 ${res.imported}개 추가, ${res.updated}개 업데이트했어요.`)
          }
        />
      )}
    </section>
  );
}

function EventEditorDialog({
  existing,
  today,
  people,
  goals,
  projects,
  onClose,
}: {
  existing?: LifeEvent;
  today: string;
  people: Person[];
  goals: { id: string; title: string }[];
  projects: { id: string; title: string }[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [kind, setKind] = useState<LifeEventKind>(existing?.kind ?? 'event');
  const [date, setDate] = useState(existing?.date ?? today);
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [allDay, setAllDay] = useState(existing?.allDay ?? true);
  const [startStr, setStartStr] = useState(
    existing?.startMin != null ? minutesToTimeStr(existing.startMin) : '09:00',
  );
  const [endStr, setEndStr] = useState(
    existing?.endMin != null ? minutesToTimeStr(existing.endMin) : '10:00',
  );
  const [personId, setPersonId] = useState(existing?.personId ?? '');
  const [projectId, setProjectId] = useState(existing?.projectId ?? '');
  const [goalId, setGoalId] = useState(existing?.goalId ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) {
      setError('일정 제목을 입력해 주세요.');
      return;
    }
    let startMin: number | null = null;
    let endMin: number | null = null;
    if (!allDay) {
      startMin = timeStrToMinutes(startStr);
      endMin = endStr === '00:00' ? 1440 : timeStrToMinutes(endStr);
      if (startMin >= endMin) {
        setError('종료 시각은 시작 시각보다 늦어야 합니다.');
        return;
      }
    }
    if (endDate && endDate < date) {
      setError('종료 날짜는 시작 날짜 이후여야 합니다.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        kind,
        date,
        endDate: endDate || null,
        allDay,
        startMin,
        endMin,
        color: existing?.color ?? null,
        personId: personId || null,
        projectId: projectId || null,
        goalId: goalId || null,
        externalUid: existing?.externalUid ?? null,
        note: note.trim() || null,
      };
      if (existing) await updateLifeEvent(existing.id, payload);
      else await createLifeEvent(payload);
      onClose();
    } catch {
      setError('일정을 저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={existing ? '일정 편집' : '새 일정 · D-Day'} onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <label className="block text-sm font-medium">
          제목
          <input
            type="text"
            aria-label="일정 제목"
            required
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="예: 부모님 결혼기념일, 건강검진"
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            종류
            <select
              aria-label="일정 종류"
              value={kind}
              onChange={e => setKind(e.target.value as LifeEventKind)}
              className={`mt-1 ${fieldClass}`}
            >
              {KINDS.map(k => (
                <option key={k} value={k}>
                  {LIFE_EVENT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            날짜
            <input
              type="date"
              aria-label="일정 날짜"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="block text-sm font-medium">
            종료일 <span className="text-xs font-normal text-zinc-500">(선택)</span>
            <input
              type="date"
              aria-label="일정 종료일"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>

        <div className="space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={allDay}
              onChange={e => setAllDay(e.target.checked)}
            />
            종일 일정
          </label>
          {!allDay && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                aria-label="일정 시작 시각"
                value={startStr}
                onChange={e => setStartStr(e.target.value)}
                className={fieldClass}
              />
              <span className="text-sm text-zinc-400">~</span>
              <input
                type="time"
                aria-label="일정 종료 시각"
                value={endStr}
                onChange={e => setEndStr(e.target.value)}
                className={fieldClass}
              />
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium">
            관련 사람
            <select aria-label="관련 사람" value={personId} onChange={e => setPersonId(e.target.value)} className={`mt-1 ${fieldClass}`}>
              <option value="">없음</option>
              {people.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            프로젝트
            <select aria-label="일정 프로젝트" value={projectId} onChange={e => setProjectId(e.target.value)} className={`mt-1 ${fieldClass}`}>
              <option value="">없음</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            목표
            <select aria-label="일정 목표" value={goalId} onChange={e => setGoalId(e.target.value)} className={`mt-1 ${fieldClass}`}>
              <option value="">없음</option>
              {goals.map(g => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium">
          메모
          <textarea
            rows={2}
            aria-label="일정 메모"
            value={note}
            onChange={e => setNote(e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button type="submit" disabled={busy} className={actionClass}>
            {busy ? '저장 중…' : existing ? '변경 저장' : '일정 추가'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
