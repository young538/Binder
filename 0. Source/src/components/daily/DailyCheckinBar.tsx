'use client';
import { useState } from 'react';
import { Activity, BatteryCharging, Moon } from 'lucide-react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { getDailyCheckin, upsertDailyCheckin } from '@/lib/repo/dailyCheckins';
import type { DailyCheckin, RetroRating } from '@/lib/types';

const LEVELS: RetroRating[] = [1, 2, 3, 4, 5];

export function DailyCheckinBar({ date }: { date: string }) {
  const { value: checkin, loading } = useAsyncResource(
    `dailyCheckin:${date}`,
    () => getDailyCheckin(date),
    null,
    ['dailyCheckins'],
  );

  const [sleepDraft, setSleepDraft] = useState<string | null>(null);
  const [moodDraft, setMoodDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sleepValue = sleepDraft ?? (checkin?.sleepHours != null ? String(checkin.sleepHours) : '');
  const moodValue = moodDraft ?? (checkin?.mood ?? '');

  const savePatch = async (
    patch: Partial<Omit<DailyCheckin, 'id' | 'userId' | 'date' | 'createdAt' | 'updatedAt'>>,
  ) => {
    setSaving(true);
    setError('');
    try {
      await upsertDailyCheckin({ date, ...patch });
    } catch {
      setError('컨디션을 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const commitSleep = async () => {
    if (sleepDraft === null) return;
    const trimmed = sleepDraft.trim();
    if (!trimmed) {
      setSleepDraft(null);
      if (checkin?.sleepHours != null) await savePatch({ sleepHours: null });
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 24) {
      setError('수면 시간은 0~24 사이 숫자로 입력해 주세요.');
      return;
    }
    setSleepDraft(null);
    if (checkin?.sleepHours !== parsed) {
      await savePatch({ sleepHours: parsed });
    }
  };

  const commitMood = async () => {
    if (moodDraft === null) return;
    const trimmed = moodDraft.trim();
    const current = checkin?.mood ?? '';
    setMoodDraft(null);
    if (trimmed !== current) {
      await savePatch({ mood: trimmed || null });
    }
  };

  const toggleRating = (field: 'energy' | 'stress', next: RetroRating) => {
    const current = checkin?.[field] ?? null;
    void savePatch({ [field]: current === next ? null : next });
  };

  return (
    <section
      aria-label="오늘의 컨디션 체크인"
      className="mb-5 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:px-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          <Activity size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span>오늘 컨디션 10초 체크인</span>
        </div>
        <span className="text-[11px] text-zinc-400">
          {saving ? '저장 중…' : loading ? '불러오는 중…' : '수면·에너지·스트레스'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
          <Moon size={13} className="text-indigo-500" />
          <span>수면</span>
          <input
            type="number"
            aria-label="수면 시간"
            step="0.5"
            min="0"
            max="24"
            placeholder="7.5"
            value={sleepValue}
            onChange={e => setSleepDraft(e.target.value)}
            onBlur={() => void commitSleep()}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="w-16 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-xs tabular-nums text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <span className="text-zinc-400">h</span>
        </label>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <BatteryCharging size={13} className="text-amber-500" /> 에너지
          </span>
          <div className="flex gap-1" role="group" aria-label="에너지">
            {LEVELS.map(level => {
              const active = checkin?.energy === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-label={`에너지 ${level}`}
                  aria-pressed={active}
                  disabled={saving}
                  onClick={() => toggleRating('energy', level)}
                  className={`h-7 w-7 rounded-lg text-xs font-semibold tabular-nums transition ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">스트레스</span>
          <div className="flex gap-1" role="group" aria-label="스트레스">
            {LEVELS.map(level => {
              const active = checkin?.stress === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-label={`스트레스 ${level}`}
                  aria-pressed={active}
                  disabled={saving}
                  onClick={() => toggleRating('stress', level)}
                  className={`h-7 w-7 rounded-lg text-xs font-semibold tabular-nums transition ${
                    active
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>

        <label className="min-w-[160px] flex-1">
          <input
            type="text"
            aria-label="컨디션 메모"
            placeholder="오늘 컨디션 한 마디 (예: 집중 잘됨)"
            value={moodValue}
            onChange={e => setMoodDraft(e.target.value)}
            onBlur={() => void commitMood()}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.currentTarget.blur();
              }
            }}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </section>
  );
}
