'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react';
import {
  PROJECT_STATUS_LABEL,
  type Project,
  type ProjectStatus,
  type Todo,
} from '@/lib/types';
import { describeDeadline, type ProjectOverviewItem } from '@/lib/projects';
import { deleteProject, updateProject } from '@/lib/repo/projects';
import { listNotes } from '@/lib/repo/notes';
import { createTodo, deleteTodo, setStatus, updateTodo } from '@/lib/repo/todos';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { todoHref } from '@/lib/todos/planning';
import { tint } from '@/lib/utils/color';
import { useBinder } from '@/store';
import { GrowingTextarea } from '@/components/common/GrowingTextarea';
import { TodoCreateInput } from '@/components/common/TodoCreateInput';
import { TodoDetailsButton } from '@/components/common/TodoDetailsButton';
import { TodoNote } from '@/components/common/TodoNote';
import { TodoStatusButton } from '@/components/common/TodoStatusButton';
import { TodoTitleEditor } from '@/components/common/TodoTitleEditor';
import { NoteEditorDialog } from '@/components/notes/NoteEditorDialog';

const STATUS_OPTIONS: ProjectStatus[] = ['active', 'planned', 'onHold', 'done'];

interface Props {
  item: ProjectOverviewItem;
  today: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: (project: Project) => void;
}

export function ProjectCard({ item, today, expanded, onToggleExpand, onEdit }: Props) {
  const { project, todos, totalTodos, doneTodos, activeTodos, actualMinutes, needsNextAction } = item;
  const { goals, categories, reload } = useBinder();
  const [addingTarget, setAddingTarget] = useState<'day' | 'inbox' | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [cardError, setCardError] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const noteLock = useRef(false);

  const { value: projectNotes } = useAsyncResource(
    `project-notes:${project.id}:${expanded}`,
    () => (expanded ? listNotes({ projectId: project.id }) : Promise.resolve([])),
    [],
    ['notes'],
  );

  const goal = project.goalId ? goals.find(g => g.id === project.goalId) : null;
  const category = project.categoryId ? categories.find(c => c.id === project.categoryId) : null;
  const deadlineInfo = describeDeadline(project.deadline, today, project.status);
  const percent = totalTodos > 0 ? Math.round((doneTodos / totalTodos) * 100) : 0;

  const handleStatusChange = async (next: ProjectStatus) => {
    if (statusBusy || next === project.status) return;
    setStatusBusy(true);
    setCardError('');
    try {
      await updateProject(project.id, { status: next });
      await reload();
    } catch {
      setCardError('상태를 변경하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setStatusBusy(false);
    }
  };

  const handleRemoveProject = async () => {
    if (!confirm(`'${project.title}' 프로젝트를 삭제할까요? 연결된 할 일은 삭제되지 않고 유지됩니다.`)) return;
    setCardError('');
    try {
      await deleteProject(project.id);
      await reload();
    } catch {
      setCardError('프로젝트를 삭제하지 못했어요. 다시 시도해 주세요.');
    }
  };

  const startEditNote = () => {
    setNoteDraft(project.note ?? '');
    setNoteError('');
    setEditingNote(true);
  };

  const saveNote = async () => {
    if (noteLock.current) return;
    noteLock.current = true;
    setNoteBusy(true);
    setNoteError('');
    try {
      await updateProject(project.id, { note: noteDraft.trim() || null });
      await reload();
      setEditingNote(false);
    } catch {
      setNoteError('메모를 저장하지 못했어요. 작성한 내용은 유지됩니다.');
    } finally {
      noteLock.current = false;
      setNoteBusy(false);
    }
  };

  const scheduleToday = async (todo: Todo) => {
    setCardError('');
    try {
      await updateTodo(todo.id, { scope: 'day', scopeKey: today });
    } catch {
      setCardError('오늘 할 일로 배정하지 못했어요.');
    }
  };

  const removeTodo = async (todo: Todo) => {
    if (!confirm('이 할 일을 삭제할까요?')) return;
    await deleteTodo(todo.id);
  };

  const scopeBadgeLabel = (todo: Todo) => {
    if (todo.scope === 'inbox') return '수집함';
    if (todo.scope === 'day') return todo.scopeKey === today ? '오늘' : todo.scopeKey;
    return todo.scopeKey;
  };

  return (
    <article
      className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      style={category ? { borderLeft: `4px solid ${category.color}` } : undefined}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-base font-bold text-zinc-900 dark:text-zinc-50 sm:text-lg">
                {project.title}
              </h2>
              {needsNextAction && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                  <AlertTriangle size={12} /> 다음 행동 필요
                </span>
              )}
              {deadlineInfo && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    deadlineInfo.overdue
                      ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                      : deadlineInfo.urgent
                        ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  <CalendarClock size={12} /> {deadlineInfo.label}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {category && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                  style={{ background: tint.soft(category.color) }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: category.color }} />
                  <span className="text-zinc-800 dark:text-zinc-200">{category.name}</span>
                </span>
              )}
              {goal && (
                <Link
                  href="/mandalart"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  🎯 {goal.title}
                </Link>
              )}
            </div>

            {project.outcome && (
              <p className="break-words text-sm text-zinc-600 dark:text-zinc-300">
                <span className="font-medium text-zinc-500 dark:text-zinc-400">완료 기준:</span> {project.outcome}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <select
              aria-label={`${project.title} 상태 변경`}
              disabled={statusBusy}
              value={project.status}
              onChange={event => void handleStatusChange(event.target.value as ProjectStatus)}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {PROJECT_STATUS_LABEL[opt]}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`${project.title} 편집`}
              onClick={() => onEdit(project)}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              aria-label={`${project.title} 삭제`}
              onClick={() => void handleRemoveProject()}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="tabular-nums">
              할 일 <strong>{doneTodos}</strong>/{totalTodos} 완료 ({percent}%) · 남은 행동 {activeTodos}개
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock size={12} /> 실제 투입 {(actualMinutes / 60).toFixed(1)}h
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
            role="progressbar"
            aria-label={`${project.title} 완료율`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
              style={{ width: `${percent}%`, ...(category ? { background: category.color } : {}) }}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!expanded) onToggleExpand();
                setAddingTarget('day');
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
            >
              <Plus size={13} /> 오늘 할 일 추가
            </button>
            <button
              type="button"
              onClick={() => {
                if (!expanded) onToggleExpand();
                setAddingTarget('inbox');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Plus size={13} /> 수집함 할 일 추가
            </button>
          </div>

          <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {expanded ? (
              <>
                상세 접기 <ChevronUp size={14} />
              </>
            ) : (
              <>
                할 일 {todos.length}개 · 메모 보기 <ChevronDown size={14} />
              </>
            )}
          </button>
        </div>

        {cardError && (
          <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
            {cardError}
          </p>
        )}
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/50 sm:p-5">
          {addingTarget && (
            <div className="rounded-xl border border-blue-200 bg-white p-3 dark:border-blue-900 dark:bg-zinc-900">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  {addingTarget === 'day' ? `오늘(${today}) 할 일로 추가` : '수집함(날짜 미정)으로 추가'}
                </span>
                <button
                  type="button"
                  onClick={() => setAddingTarget(null)}
                  className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  닫기
                </button>
              </div>
              <TodoCreateInput
                key={`${project.id}:${addingTarget}`}
                onCreate={(title, requestKey) =>
                  createTodo(
                    {
                      title,
                      scope: addingTarget,
                      scopeKey: addingTarget === 'day' ? today : 'inbox',
                      status: 'pending',
                      order: todos.length,
                      projectId: project.id,
                      parentGoalId: project.goalId ?? null,
                      categoryId: project.categoryId ?? null,
                    },
                    requestKey,
                  )
                }
                onDone={() => setAddingTarget(null)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              연결된 할 일 ({todos.length})
            </h3>
            {todos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 bg-white p-4 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                아직 연결된 할 일이 없습니다. 위 버튼으로 첫 번째 다음 행동을 추가해 보세요.
              </p>
            ) : (
              <ul className="space-y-2">
                {todos.map(todo => (
                  <li
                    key={todo.id}
                    className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">
                        <TodoStatusButton
                          status={todo.status}
                          onChange={next => { void setStatus(todo.id, next); }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <TodoTitleEditor
                          todo={todo}
                          onCommit={(target, nextTitle) => updateTodo(target.id, { title: nextTitle })}
                          textClassName="text-zinc-800 dark:text-zinc-50"
                        />
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <Link
                            href={todoHref(todo)}
                            className="rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 hover:underline dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            {scopeBadgeLabel(todo)}
                          </Link>
                          {(todo.scope === 'inbox' || (todo.scope === 'day' && todo.scopeKey < today && todo.status !== 'done')) && (
                            <button
                              type="button"
                              onClick={() => void scheduleToday(todo)}
                              className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300"
                            >
                              오늘로 배정
                            </button>
                          )}
                          <TodoDetailsButton todo={todo} />
                          <button
                            type="button"
                            aria-label={`${todo.title} 삭제`}
                            onClick={() => void removeTodo(todo)}
                            className="rounded p-1 text-zinc-400 hover:text-red-600"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <TodoNote todo={todo} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                <StickyNote size={14} /> 프로젝트 메모
              </span>
              {!editingNote && (
                <button
                  type="button"
                  onClick={startEditNote}
                  className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {project.note ? '메모 편집' : '메모 작성'}
                </button>
              )}
            </div>
            {editingNote ? (
              <form onSubmit={event => { event.preventDefault(); void saveNote(); }} className="space-y-2">
                <GrowingTextarea
                  aria-label={`${project.title} 메모 편집`}
                  minHeight={112}
                  value={noteDraft}
                  disabled={noteBusy}
                  placeholder="프로젝트 진행 메모, 링크, 의사결정 근거를 기록하세요."
                  onChange={event => setNoteDraft(event.target.value)}
                  className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white p-2.5 text-sm leading-6 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                {noteError && <p role="alert" className="text-xs text-red-600">{noteError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={noteBusy}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {noteBusy ? '저장 중…' : '메모 저장'}
                  </button>
                  <button
                    type="button"
                    disabled={noteBusy}
                    onClick={() => setEditingNote(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    취소
                  </button>
                </div>
              </form>
            ) : project.note ? (
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 [overflow-wrap:anywhere] dark:text-zinc-300">
                {project.note}
              </p>
            ) : (
              <p className="text-xs text-zinc-400">작성된 메모가 없습니다.</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                🗂️ 연결 노트 · 레퍼런스 ({projectNotes.length})
              </span>
              <button
                type="button"
                onClick={() => setAddingNote(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <Plus size={12} /> 프로젝트 노트 추가
              </button>
            </div>
            {projectNotes.length === 0 ? (
              <p className="text-xs text-zinc-400">연결된 노트가 없습니다.</p>
            ) : (
              <ul className="space-y-1.5">
                {projectNotes.map(n => (
                  <li key={n.id} className="text-xs">
                    <Link href={`/notes?note=${encodeURIComponent(n.id)}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                      {n.title}
                    </Link>
                    {n.body && <p className="truncate text-zinc-500">{n.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {addingNote && (
            <NoteEditorDialog
              defaultKind="reference"
              defaultProjectId={project.id}
              onClose={() => setAddingNote(false)}
            />
          )}
        </div>
      )}
    </article>
  );
}
