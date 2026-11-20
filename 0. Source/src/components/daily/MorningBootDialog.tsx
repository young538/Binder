'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarHeart, Check, FolderKanban, Inbox, Plus, Scale, Sparkles, Star, Target, Users, X } from 'lucide-react';
import type { MorningBootSnapshot } from '@/lib/morningBoot';
import { describeDeadline } from '@/lib/projects';
import { upsertFocus } from '@/lib/repo/focusNotes';
import { applyMorningBoot } from '@/lib/repo/morningBoot';
import { createTodo, setStatus, updateTodo } from '@/lib/repo/todos';
import type { Todo } from '@/lib/types';
import { useBinder } from '@/store';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';
import { TodoCreateInput } from '@/components/common/TodoCreateInput';

interface Props {
  date: string;
  snapshot: MorningBootSnapshot;
  onClose: () => void;
  onComplete: () => void;
}

type Step = 1 | 2 | 3;

export function MorningBootDialog({ date, snapshot, onClose, onComplete }: Props) {
  const { goals, projects } = useBinder();
  const [step, setStep] = useState<Step>(() => (snapshot.overdueTodos.length > 0 ? 1 : 2));
  const [highlightDraft, setHighlightDraft] = useState(snapshot.highlight);
  const [addingProjectId, setAddingProjectId] = useState<string | null>(null);
  const [addingToday, setAddingToday] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const completeLock = useRef(false);

  const activeProjectIds = new Set(snapshot.activeProjects.map(item => item.project.id));
  const otherWeekTodos = snapshot.weekTodos.filter(todo => !activeProjectIds.has(todo.projectId ?? ''));
  const otherInboxTodos = snapshot.inboxTodos.filter(todo => !activeProjectIds.has(todo.projectId ?? ''));
  const activeTodayTodos = snapshot.todayTodos.filter(
    todo => todo.status === 'pending' || todo.status === 'postponed',
  );

  const projectTitle = (id?: string | null) =>
    id ? projects.find(item => item.id === id)?.title : null;
  const goalTitle = (id?: string | null) =>
    id ? goals.find(item => item.id === id)?.title : null;

  const runAction = async (key: string, fn: () => Promise<unknown>) => {
    if (busyId || completing) return;
    setBusyId(key);
    setError('');
    try {
      await fn();
    } catch {
      setError('작업을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusyId(null);
    }
  };

  const finishBoot = async () => {
    if (completeLock.current || busyId) return;
    completeLock.current = true;
    setCompleting(true);
    setError('');
    try {
      const trimmed = highlightDraft.trim();
      if (trimmed !== snapshot.highlight.trim()) {
        await upsertFocus('highlight', date, trimmed);
      }
      onComplete();
    } catch {
      setError('오늘의 초점을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      completeLock.current = false;
      setCompleting(false);
    }
  };

  const renderBadges = (todo: Todo) => {
    const pTitle = projectTitle(todo.projectId);
    const gTitle = goalTitle(todo.parentGoalId);
    if (!pTitle && !gTitle) return null;
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        {pTitle && <span className="truncate text-indigo-600 dark:text-indigo-400">📁 {pTitle}</span>}
        {gTitle && <span className="truncate text-blue-600 dark:text-blue-400">🎯 {gTitle}</span>}
      </div>
    );
  };

  const steps: { id: Step; label: string }[] = [
    { id: 1, label: `1. 밀린 할 일 (${snapshot.overdueTodos.length})` },
    { id: 2, label: '2. 오늘 당겨오기' },
    { id: 3, label: '3. 오늘의 초점' },
  ];

  return (
    <Dialog title="모닝 부팅 루틴" onClose={() => { if (!busyId && !completing) onClose(); }}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="모닝 부팅 단계">
          {steps.map(item => {
            const active = step === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={completing}
                onClick={() => setStep(item.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}

        {step === 1 && (
          <section className="space-y-3" aria-label="밀린 할 일 수습">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                최근 7일간 완료되지 않은 일일 할 일입니다. 오늘 처리할 것만 남기고 정리하세요.
              </p>
              {snapshot.overdueTodos.length > 0 && (
                <button
                  type="button"
                  disabled={!!busyId}
                  onClick={() =>
                    void runAction('all-today', () =>
                      applyMorningBoot({
                        targetDate: date,
                        moveToTodayIds: snapshot.overdueTodos.map(todo => todo.id),
                      }),
                    )
                  }
                  className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-950/60 dark:text-blue-300"
                >
                  모두 오늘로 가져오기
                </button>
              )}
            </div>

            {snapshot.overdueTodos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 p-5 text-center text-sm text-zinc-500 dark:border-zinc-800">
                최근 7일간 밀린 할 일이 없습니다. 다음 단계로 넘어가세요.
              </div>
            ) : (
              <ul className="space-y-2">
                {snapshot.overdueTodos.map(todo => {
                  const rowBusy = busyId === todo.id || busyId === 'all-today';
                  return (
                    <li
                      key={todo.id}
                      className="min-w-0 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {todo.scopeKey}
                            </span>
                            <span className="break-words text-sm font-medium text-zinc-900 dark:text-zinc-50">
                              {todo.title}
                            </span>
                          </div>
                          {renderBadges(todo)}
                        </div>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={!!busyId}
                          onClick={() =>
                            void runAction(todo.id, () =>
                              applyMorningBoot({ targetDate: date, moveToTodayIds: [todo.id] }),
                            )
                          }
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {rowBusy ? '처리 중…' : '오늘로'}
                        </button>
                        <button
                          type="button"
                          disabled={!!busyId}
                          onClick={() =>
                            void runAction(todo.id, () =>
                              applyMorningBoot({ targetDate: date, moveToInboxIds: [todo.id] }),
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                        >
                          <Inbox size={12} /> 수집함
                        </button>
                        <button
                          type="button"
                          disabled={!!busyId}
                          onClick={() => void runAction(todo.id, () => setStatus(todo.id, 'done'))}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                        >
                          <Check size={12} /> 완료
                        </button>
                        <button
                          type="button"
                          disabled={!!busyId}
                          onClick={() => void runAction(todo.id, () => setStatus(todo.id, 'cancelled'))}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-500 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                        >
                          <X size={12} /> 취소
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setStep(2)} className={actionClass}>
                다음 단계 →
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4" aria-label="오늘 할 일 당겨오기">
            <div className="space-y-2.5">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <FolderKanban size={14} /> 진행 중 프로젝트 ({snapshot.activeProjects.length})
              </h3>
              {snapshot.activeProjects.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-xs text-zinc-500 dark:border-zinc-800">
                  진행 중인 프로젝트가 없습니다.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {snapshot.activeProjects.map(item => {
                    const deadline = describeDeadline(item.project.deadline, date, item.project.status);
                    const isAdding = addingProjectId === item.project.id;
                    return (
                      <div
                        key={item.project.id}
                        className="min-w-0 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span className="break-words text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                              {item.project.title}
                            </span>
                            {deadline && (
                              <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                {deadline.label}
                              </span>
                            )}
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                              오늘 {item.todayCount}개
                            </span>
                            {item.needsNextAction && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                                <AlertTriangle size={11} /> 다음 행동 필요
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setAddingProjectId(isAdding ? null : item.project.id)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:bg-zinc-900 dark:text-blue-300"
                          >
                            <Plus size={12} /> 오늘 행동 추가
                          </button>
                        </div>

                        {isAdding && (
                          <div className="mt-2.5 rounded-lg border border-blue-200 bg-white p-2.5 dark:border-blue-900 dark:bg-zinc-900">
                            <TodoCreateInput
                              key={`${item.project.id}:${date}`}
                              onCreate={(title, requestKey) =>
                                createTodo(
                                  {
                                    title,
                                    scope: 'day',
                                    scopeKey: date,
                                    status: 'pending',
                                    order: snapshot.todayTodos.length,
                                    projectId: item.project.id,
                                    parentGoalId: item.project.goalId ?? null,
                                    categoryId: item.project.categoryId ?? null,
                                  },
                                  requestKey,
                                )
                              }
                              onDone={() => setAddingProjectId(null)}
                              className={fieldClass}
                            />
                          </div>
                        )}

                        {item.candidateTodos.length > 0 && (
                          <ul className="mt-2.5 space-y-1.5">
                            {item.candidateTodos.map(todo => (
                              <li
                                key={todo.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="mr-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                    {todo.scope === 'inbox' ? '수집함' : todo.scopeKey}
                                  </span>
                                  <span className="break-words text-sm text-zinc-800 dark:text-zinc-100">
                                    {todo.title}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  disabled={!!busyId}
                                  onClick={() =>
                                    void runAction(todo.id, () =>
                                      applyMorningBoot({ targetDate: date, moveToTodayIds: [todo.id] }),
                                    )
                                  }
                                  className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  오늘로 가져오기
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {otherWeekTodos.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  이번 주 할 일 ({snapshot.isoWeek})
                </h3>
                <ul className="space-y-1.5">
                  {otherWeekTodos.map(todo => (
                    <li
                      key={todo.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <span className="min-w-0 flex-1 break-words text-sm text-zinc-800 dark:text-zinc-100">
                        {todo.title}
                      </span>
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() =>
                          void runAction(todo.id, () =>
                            applyMorningBoot({ targetDate: date, moveToTodayIds: [todo.id] }),
                          )
                        }
                        className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-950/60 dark:text-blue-300"
                      >
                        오늘 할 일로 이동
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {otherInboxTodos.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  수집함 할 일 ({otherInboxTodos.length})
                </h3>
                <ul className="space-y-1.5">
                  {otherInboxTodos.map(todo => (
                    <li
                      key={todo.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <span className="min-w-0 flex-1 break-words text-sm text-zinc-800 dark:text-zinc-100">
                        {todo.title}
                      </span>
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() =>
                          void runAction(todo.id, () =>
                            applyMorningBoot({ targetDate: date, moveToTodayIds: [todo.id] }),
                          )
                        }
                        className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-950/60 dark:text-blue-300"
                      >
                        오늘로 가져오기
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {((snapshot.upcomingEvents?.length ?? 0) > 0 ||
              (snapshot.duePeople?.length ?? 0) > 0 ||
              (snapshot.dueDecisions?.length ?? 0) > 0) && (
              <div className="space-y-2.5 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-200">
                  다가오는 일정 · 안부 · 복기
                </h3>
                {snapshot.upcomingEvents.length > 0 && (
                  <ul className="space-y-1">
                    {snapshot.upcomingEvents.map(ev => (
                      <li key={ev.id} className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-100">
                        <CalendarHeart size={12} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                          {ev.daysLeft === 0 ? '오늘' : `D-${ev.daysLeft}`}
                        </span>
                        <span className="truncate">{ev.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {snapshot.duePeople.length > 0 && (
                  <ul className="space-y-1.5">
                    {snapshot.duePeople.map(person => (
                      <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 text-zinc-800 dark:text-zinc-100">
                          <Users size={12} className="text-amber-600" />
                          <strong>{person.name}</strong>
                          <span className="text-zinc-500">
                            {person.daysSince != null ? `(${person.daysSince}일 전 연락)` : '(연락 기록 없음)'}
                          </span>
                        </span>
                        <button
                          type="button"
                          disabled={!!busyId}
                          onClick={() =>
                            void runAction(`person:${person.id}`, () =>
                              createTodo({
                                title: `📞 ${person.name} 안부 연락`,
                                scope: 'day',
                                scopeKey: date,
                                status: 'pending',
                                order: snapshot.todayTodos.length,
                              }),
                            )
                          }
                          className="rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-blue-700 shadow-sm hover:bg-blue-50 disabled:opacity-50 dark:bg-zinc-900 dark:text-blue-300"
                        >
                          오늘 안부 할 일 추가
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {snapshot.dueDecisions.length > 0 && (
                  <div className="space-y-1">
                    {snapshot.dueDecisions.map(d => (
                      <Link
                        key={d.id}
                        href={`/notes?note=${encodeURIComponent(d.id)}`}
                        onClick={onClose}
                        className="flex items-center gap-1.5 text-xs text-amber-800 hover:underline dark:text-amber-300"
                      >
                        <Scale size={12} className="shrink-0" />
                        <span>의사결정 복기: {d.title} ({d.reviewDate})</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                ← 이전
              </button>
              <button type="button" onClick={() => setStep(3)} className={actionClass}>
                다음 단계 →
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4" aria-label="오늘의 초점 확정">
            <label className="block space-y-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-600 dark:text-blue-400" /> 오늘의 초점 한 문장
              </span>
              <input
                type="text"
                aria-label="오늘의 초점 한 문장"
                placeholder="오늘 하루 가장 중요한 한 가지는 무엇인가요?"
                value={highlightDraft}
                disabled={completing}
                onChange={event => setHighlightDraft(event.target.value)}
                className={fieldClass}
              />
            </label>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <Target size={14} /> 오늘 할 일 ({activeTodayTodos.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setAddingToday(open => !open)}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Plus size={12} /> 오늘 할 일 직접 추가
                </button>
              </div>

              {addingToday && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-2.5 dark:border-blue-900 dark:bg-blue-950/30">
                  <TodoCreateInput
                    key={`today:${date}`}
                    onCreate={(title, requestKey) =>
                      createTodo(
                        {
                          title,
                          scope: 'day',
                          scopeKey: date,
                          status: 'pending',
                          order: snapshot.todayTodos.length,
                        },
                        requestKey,
                      )
                    }
                    onDone={() => setAddingToday(false)}
                    className={fieldClass}
                  />
                </div>
              )}

              {activeTodayTodos.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-500 dark:border-zinc-800">
                  오늘 날짜에 예정된 할 일이 아직 없습니다.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {activeTodayTodos.map(todo => {
                    const isPriority = todo.priority != null;
                    return (
                      <li
                        key={todo.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="break-words text-sm font-medium text-zinc-900 dark:text-zinc-50">
                            {todo.title}
                          </div>
                          {renderBadges(todo)}
                        </div>
                        <button
                          type="button"
                          aria-label={`${todo.title} 핵심 표시`}
                          aria-pressed={isPriority}
                          disabled={!!busyId || completing}
                          onClick={() =>
                            void runAction(`prio:${todo.id}`, () =>
                              updateTodo(todo.id, { priority: todo.priority ? null : 1 }),
                            )
                          }
                          className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                            isPriority
                              ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                              : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <Star size={12} fill={isPriority ? 'currentColor' : 'none'} />
                          {todo.priority === 1
                            ? '핵심'
                            : todo.priority
                              ? `우선순위 ${todo.priority}`
                              : '일반'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                disabled={completing}
                onClick={() => setStep(2)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                ← 이전
              </button>
              <button
                type="button"
                disabled={completing || !!busyId}
                onClick={() => void finishBoot()}
                className={actionClass}
              >
                {completing ? '저장 중…' : '부팅 완료'}
              </button>
            </div>
          </section>
        )}
      </div>
    </Dialog>
  );
}
