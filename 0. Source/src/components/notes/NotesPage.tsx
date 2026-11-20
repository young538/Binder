'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, BookMarked, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { deleteNote, listNotes, updateNote } from '@/lib/repo/notes';
import { retroHref } from '@/lib/todos/planning';
import { NOTE_KIND_LABEL, type BinderNote, type NoteKind } from '@/lib/types';
import { toIsoDate } from '@/lib/utils/date';
import { useBinder } from '@/store';
import { fieldClass } from '@/components/common/Dialog';
import { NoteEditorDialog } from './NoteEditorDialog';

type Tab = NoteKind | 'all';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'principle', label: '📌 내 원칙' },
  { key: 'decision', label: '⚖️ 의사결정' },
  { key: 'insight', label: '💡 인사이트' },
  { key: 'reference', label: '🗂️ 레퍼런스' },
];

export function NotesPage({
  initialNoteId,
  initialKind,
}: {
  initialNoteId?: string;
  initialKind?: NoteKind;
}) {
  const { goals, projects } = useBinder();
  const today = toIsoDate(new Date());
  const { value: notes, loading, error, refresh } = useAsyncResource(
    'notes:all',
    () => listNotes(),
    [],
    ['notes'],
  );

  const [tab, setTab] = useState<Tab>(() => initialKind ?? 'all');
  const [goalFilter, setGoalFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; editing?: BinderNote }>({ open: false });

  const dueDecisions = useMemo(
    () =>
      notes.filter(
        n =>
          n.kind === 'decision' &&
          !!n.reviewDate &&
          n.reviewDate <= today &&
          (!n.decisionOutcome || !n.decisionOutcome.trim()),
      ),
    [notes, today],
  );

  const filtered = useMemo(
    () =>
      notes.filter(n => {
        if (tab !== 'all' && n.kind !== tab) return false;
        if (goalFilter && n.goalId !== goalFilter) return false;
        if (projectFilter && n.projectId !== projectFilter) return false;
        return true;
      }),
    [notes, tab, goalFilter, projectFilter],
  );

  const togglePin = async (note: BinderNote) => {
    await updateNote(note.id, { pinned: !note.pinned });
  };

  const remove = async (note: BinderNote) => {
    if (!confirm(`'${note.title}' 노트를 삭제할까요?`)) return;
    await deleteNote(note.id);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-24 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            Personal Knowledge & Principles
          </div>
          <h1 className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-zinc-50">원칙 · 의사결정 · 노트</h1>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            회고에서 건져 올린 내 삶의 원칙, 중요한 결정의 근거와 복기, 프로젝트 레퍼런스를 모아 두세요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ open: true })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus size={16} /> 새 노트
        </button>
      </header>

      {dueDecisions.length > 0 && (
        <section
          aria-label="복기 예정 의사결정 알림"
          className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/30"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <AlertCircle size={16} /> 복기 예정일이 도래한 의사결정이 {dueDecisions.length}건 있어요
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {dueDecisions.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDialog({ open: true, editing: d })}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-200"
              >
                {d.title} ({d.reviewDate}) → 복기 작성
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="노트 분류 필터">
          {TABS.map(item => {
            const count =
              item.key === 'all' ? notes.length : notes.filter(n => n.kind === item.key).length;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {item.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <select
            aria-label="목표별 노트 필터"
            value={goalFilter}
            onChange={e => setGoalFilter(e.target.value)}
            className={`sm:w-44 ${fieldClass}`}
          >
            <option value="">모든 목표</option>
            {goals.map(g => (
              <option key={g.id} value={g.id}>
                🎯 {g.title}
              </option>
            ))}
          </select>
          <select
            aria-label="프로젝트별 노트 필터"
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className={`sm:w-44 ${fieldClass}`}
          >
            <option value="">모든 프로젝트</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                📁 {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && notes.length === 0 && <p className="text-sm text-zinc-500">노트를 불러오는 중…</p>}
      {!!error && (
        <button type="button" onClick={() => void refresh()} className="text-sm text-red-600 hover:underline">
          노트를 불러오지 못했어요. 다시 시도
        </button>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-5 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
            <BookMarked size={22} />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">저장된 노트가 없습니다</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            나만의 행동 원칙이나 중요한 의사결정을 첫 노트로 남겨 보세요.
          </p>
          <button
            type="button"
            onClick={() => setDialog({ open: true })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} /> 첫 노트 쓰기
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map(note => {
          const goal = note.goalId ? goals.find(g => g.id === note.goalId) : null;
          const project = note.projectId ? projects.find(p => p.id === note.projectId) : null;
          const highlighted = initialNoteId === note.id;
          return (
            <article
              key={note.id}
              className={`min-w-0 rounded-2xl border bg-white p-4 shadow-sm dark:bg-zinc-900 sm:p-5 ${
                highlighted
                  ? 'border-blue-400 ring-2 ring-blue-500/20 dark:border-blue-600'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {NOTE_KIND_LABEL[note.kind]}
                    </span>
                    {note.pinned && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                        고정됨
                      </span>
                    )}
                    {note.reviewDate && (
                      <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                        복기일 {note.reviewDate}
                      </span>
                    )}
                  </div>
                  <h2 className="break-words text-base font-bold text-zinc-900 dark:text-zinc-50">{note.title}</h2>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`${note.title} 고정 토글`}
                    aria-pressed={note.pinned}
                    onClick={() => void togglePin(note)}
                    className={`rounded-lg p-1.5 transition ${
                      note.pinned
                        ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/50'
                        : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Pin size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${note.title} 편집`}
                    onClick={() => setDialog({ open: true, editing: note })}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${note.title} 삭제`}
                    onClick={() => void remove(note)}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {note.body && (
                <p className="mt-2.5 whitespace-pre-wrap text-sm leading-6 text-zinc-700 [overflow-wrap:anywhere] dark:text-zinc-300">
                  {note.body}
                </p>
              )}

              {note.decisionOutcome && (
                <div className="mt-3 rounded-xl bg-emerald-50/70 p-3 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <span className="font-semibold">복기 결과: </span>
                  {note.decisionOutcome}
                </div>
              )}

              {(goal || project || note.sourceRetro) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2.5 text-xs dark:border-zinc-800">
                  {project && note.projectId && (
                    <Link
                      href={`/projects?project=${encodeURIComponent(note.projectId)}`}
                      className="text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      📁 {project.title}
                    </Link>
                  )}
                  {goal && <span className="text-blue-600 dark:text-blue-400">🎯 {goal.title}</span>}
                  {note.sourceRetro && (
                    <Link href={retroHref(note.sourceRetro)} className="text-zinc-500 hover:underline">
                      원래 회고 ({note.sourceRetro.dateOrWeek})
                    </Link>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {dialog.open && (
        <NoteEditorDialog
          key={dialog.editing?.id ?? 'new'}
          existing={dialog.editing}
          defaultKind={tab === 'all' ? 'principle' : tab}
          onClose={() => setDialog({ open: false })}
        />
      )}
    </div>
  );
}
