'use client';
import { useRef, useState } from 'react';
import { ArrowRight, Check, CheckCheck, Clock, Inbox, X } from 'lucide-react';
import type { EveningShutdownSnapshot } from '@/lib/eveningShutdown';
import { upsertDailyCheckin } from '@/lib/repo/dailyCheckins';
import { applyEveningShutdown } from '@/lib/repo/eveningShutdown';
import { upsertRetrospective } from '@/lib/repo/retrospectives';
import { setStatus } from '@/lib/repo/todos';
import type { RetroRating } from '@/lib/types';
import { minutesToTimeStr } from '@/lib/utils/date';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';

interface Props {
  date: string;
  snapshot: EveningShutdownSnapshot;
  onClose: () => void;
  onComplete: () => void;
}

type Step = 1 | 2 | 3;

const RATINGS: { value: RetroRating; emoji: string }[] = [
  { value: 1, emoji: '😞' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😊' },
];

export function EveningShutdownDialog({ date, snapshot, onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>(() =>
    snapshot.unconfirmedPlans.length > 0 ? 1 : snapshot.openTodayTodos.length > 0 ? 2 : 3,
  );
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>(() =>
    snapshot.unconfirmedPlans.map(b => b.id),
  );
  const [sleepDraft, setSleepDraft] = useState(() =>
    snapshot.checkin?.sleepHours != null ? String(snapshot.checkin.sleepHours) : '',
  );
  const [energyDraft, setEnergyDraft] = useState<RetroRating | null>(
    snapshot.checkin?.energy ?? null,
  );
  const [ratingDraft, setRatingDraft] = useState<RetroRating | undefined>(
    snapshot.retrospective?.rating,
  );
  const [goodDraft, setGoodDraft] = useState(snapshot.retrospective?.template.good ?? '');
  const [badDraft, setBadDraft] = useState(snapshot.retrospective?.template.bad ?? '');
  const [nextStepDraft, setNextStepDraft] = useState(snapshot.retrospective?.template.nextStep ?? '');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);

  const togglePlan = (id: string) => {
    setSelectedPlanIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const runAction = async (key: string, fn: () => Promise<unknown>) => {
    if (busyKey || completing) return;
    setBusyKey(key);
    setError('');
    try {
      await fn();
    } catch {
      setError('작업을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusyKey(null);
    }
  };

  const confirmSelectedPlans = async () => {
    const activeIds = snapshot.unconfirmedPlans
      .filter(b => selectedPlanIds.includes(b.id))
      .map(b => b.id);
    if (activeIds.length === 0) {
      setStep(2);
      return;
    }
    await runAction('confirm-plans', async () => {
      await applyEveningShutdown({ date, confirmBlockIds: activeIds });
      setStep(2);
    });
  };

  const finishShutdown = async () => {
    if (lock.current || busyKey) return;
    lock.current = true;
    setCompleting(true);
    setError('');
    try {
      const sleepTrim = sleepDraft.trim();
      let sleepHours: number | null | undefined;
      if (sleepTrim) {
        const num = Number(sleepTrim);
        if (!Number.isFinite(num) || num < 0 || num > 24) {
          setError('수면 시간은 0~24 사이 숫자여야 합니다.');
          return;
        }
        sleepHours = num;
      } else if (snapshot.checkin?.sleepHours != null) {
        sleepHours = null;
      }

      if (sleepHours !== undefined || energyDraft !== (snapshot.checkin?.energy ?? null)) {
        await upsertDailyCheckin({
          date,
          ...(sleepHours !== undefined ? { sleepHours } : {}),
          energy: energyDraft,
        });
      }

      const tplPatch: { good?: string; bad?: string; nextStep?: string } = {};
      if (goodDraft !== (snapshot.retrospective?.template.good ?? '')) tplPatch.good = goodDraft;
      if (badDraft !== (snapshot.retrospective?.template.bad ?? '')) tplPatch.bad = badDraft;
      if (nextStepDraft !== (snapshot.retrospective?.template.nextStep ?? '')) tplPatch.nextStep = nextStepDraft;

      if (ratingDraft !== snapshot.retrospective?.rating || Object.keys(tplPatch).length > 0) {
        await upsertRetrospective('daily', date, {
          ...(ratingDraft ? { rating: ratingDraft } : {}),
          ...(Object.keys(tplPatch).length > 0 ? { template: tplPatch } : {}),
        });
      }
      onComplete();
    } catch {
      setError('하루 마감을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      lock.current = false;
      setCompleting(false);
    }
  };

  const steps: { id: Step; label: string }[] = [
    { id: 1, label: `1. 시간 확정 (${snapshot.unconfirmedPlans.length})` },
    { id: 2, label: `2. 남은 할 일 (${snapshot.openTodayTodos.length})` },
    { id: 3, label: '3. 컨디션 · 회고' },
  ];

  return (
    <Dialog title="이브닝 셧다운 (하루 마감)" onClose={() => { if (!busyKey && !completing) onClose(); }}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="이브닝 셧다운 단계">
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
                    ? 'bg-indigo-600 text-white'
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
          <section className="space-y-3" aria-label="계획 시간 실제 확정">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>실제로 진행한 계획 블록을 한 번에 실제 기록으로 확정하세요.</span>
              <span className="inline-flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-200">
                <Clock size={12} /> 오늘 실제 {(snapshot.actualMinutes / 60).toFixed(1)}h
              </span>
            </div>

            {snapshot.unconfirmedPlans.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 p-5 text-center text-sm text-zinc-500 dark:border-zinc-800">
                미확정 계획 블록이 없습니다. 다음 단계로 넘어가세요.
              </div>
            ) : (
              <ul className="space-y-2">
                {snapshot.unconfirmedPlans.map(block => {
                  const checked = selectedPlanIds.includes(block.id);
                  return (
                    <li
                      key={block.id}
                      className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/50"
                    >
                      <label className="flex cursor-pointer items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePlan(block.id)}
                          className="h-4 w-4 rounded border-zinc-300"
                        />
                        <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                          {minutesToTimeStr(block.startMin)}–{minutesToTimeStr(block.endMin)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-zinc-900 dark:text-zinc-50">
                          {block.text || '(내용 없음)'}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {snapshot.unconfirmedPlans.length > 0 && (
                <button
                  type="button"
                  disabled={!!busyKey}
                  onClick={() => void confirmSelectedPlans()}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCheck size={14} /> 선택 계획 실제 확정 후 다음 →
                </button>
              )}
              <button type="button" onClick={() => setStep(2)} className={actionClass}>
                다음 단계 →
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3" aria-label="남은 할 일 정리">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                오늘 완료 {snapshot.doneCount}/{snapshot.totalCount}개 · 미완료 할 일을 정리하세요.
              </p>
              {snapshot.openTodayTodos.length > 0 && (
                <button
                  type="button"
                  disabled={!!busyKey}
                  onClick={() =>
                    void runAction('all-rollover', () =>
                      applyEveningShutdown({
                        date,
                        rolloverTodoIds: snapshot.openTodayTodos.map(t => t.id),
                      }),
                    )
                  }
                  className="shrink-0 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950/60 dark:text-indigo-300"
                >
                  모두 내일로 이월
                </button>
              )}
            </div>

            {snapshot.openTodayTodos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 p-5 text-center text-sm text-zinc-500 dark:border-zinc-800">
                남은 미완료 할 일이 없습니다. 수고했어요!
              </div>
            ) : (
              <ul className="space-y-2">
                {snapshot.openTodayTodos.map(todo => (
                  <li
                    key={todo.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
                  >
                    <p className="break-words text-sm font-medium text-zinc-900 dark:text-zinc-50">{todo.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={!!busyKey}
                        onClick={() =>
                          void runAction(todo.id, () =>
                            applyEveningShutdown({ date, rolloverTodoIds: [todo.id] }),
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <ArrowRight size={12} /> 내일로
                      </button>
                      <button
                        type="button"
                        disabled={!!busyKey}
                        onClick={() =>
                          void runAction(todo.id, () =>
                            applyEveningShutdown({ date, inboxTodoIds: [todo.id] }),
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        <Inbox size={12} /> 수집함
                      </button>
                      <button
                        type="button"
                        disabled={!!busyKey}
                        onClick={() => void runAction(todo.id, () => setStatus(todo.id, 'done'))}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                      >
                        <Check size={12} /> 완료
                      </button>
                      <button
                        type="button"
                        disabled={!!busyKey}
                        onClick={() => void runAction(todo.id, () => setStatus(todo.id, 'cancelled'))}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-500 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                      >
                        <X size={12} /> 취소
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
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
          <section className="space-y-4" aria-label="컨디션 및 하루 회고 마감">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                수면 시간 (h)
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  aria-label="마감 수면 시간"
                  value={sleepDraft}
                  onChange={e => setSleepDraft(e.target.value)}
                  className={`mt-1 ${fieldClass}`}
                />
              </label>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">오늘 에너지</div>
                <div className="flex gap-1.5">
                  {([1, 2, 3, 4, 5] as RetroRating[]).map(n => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={energyDraft === n}
                      onClick={() => setEnergyDraft(energyDraft === n ? null : n)}
                      className={`h-9 flex-1 rounded-lg text-xs font-semibold ${
                        energyDraft === n
                          ? 'bg-emerald-600 text-white'
                          : 'border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">하루 평가</div>
              <div className="flex gap-2">
                {RATINGS.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    aria-pressed={ratingDraft === r.value}
                    onClick={() => setRatingDraft(r.value)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition ${
                      ratingDraft === r.value
                        ? 'bg-indigo-100 ring-2 ring-indigo-500 dark:bg-indigo-900/50'
                        : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-xs font-medium text-emerald-700 dark:text-emerald-400">
              ✓ 오늘 좋았던 것
              <textarea
                rows={2}
                value={goodDraft}
                onChange={e => setGoodDraft(e.target.value)}
                className={`mt-1 ${fieldClass}`}
              />
            </label>
            <label className="block text-xs font-medium text-rose-700 dark:text-rose-400">
              ✗ 아쉬운 것
              <textarea
                rows={2}
                value={badDraft}
                onChange={e => setBadDraft(e.target.value)}
                className={`mt-1 ${fieldClass}`}
              />
            </label>
            <label className="block text-xs font-medium text-blue-700 dark:text-blue-400">
              → 내일 1가지
              <textarea
                rows={2}
                value={nextStepDraft}
                onChange={e => setNextStepDraft(e.target.value)}
                className={`mt-1 ${fieldClass}`}
              />
            </label>

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
                disabled={completing || !!busyKey}
                onClick={() => void finishShutdown()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {completing ? '저장 중…' : '하루 마감 완료'}
              </button>
            </div>
          </section>
        )}
      </div>
    </Dialog>
  );
}
