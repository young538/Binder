'use client';
import { useState } from 'react';
import { Activity, Plus } from 'lucide-react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { createMetric, listMetricsWithEntries, updateMetric } from '@/lib/repo/metrics';
import { METRIC_DIRECTION_LABEL, type LifeMetric, type MetricDirection } from '@/lib/types';
import { useBinder } from '@/store';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';
import { MetricCard } from './MetricCard';

const PRESET_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export function MetricsPage() {
  const { goals } = useBinder();
  const { value: items, loading, error, refresh } = useAsyncResource(
    'metrics:list',
    listMetricsWithEntries,
    [],
    ['metrics', 'metricEntries'],
  );

  const [dialog, setDialog] = useState<{ open: boolean; editing?: LifeMetric }>({ open: false });

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-24 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            Life Metrics
          </div>
          <h1 className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-zinc-50">상태 지표 트래커</h1>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            체중, 골격근량, 순자산처럼 오르내리는 내 삶의 핵심 상태 지표를 추세로 기록하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ open: true })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus size={16} /> 새 지표
        </button>
      </header>

      {loading && items.length === 0 && <p className="text-sm text-zinc-500">지표를 불러오는 중…</p>}
      {!!error && (
        <button type="button" onClick={() => void refresh()} className="text-sm text-red-600 hover:underline">
          지표를 불러오지 못했어요. 다시 시도
        </button>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-5 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
            <Activity size={22} />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">첫 상태 지표를 등록해 보세요</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            예: 체중(kg), 순자산(만원), 주간 평균 수면(시간)
          </p>
          <button
            type="button"
            onClick={() => setDialog({ open: true })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} /> 지표 만들기
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map(item => (
          <MetricCard
            key={item.metric.id}
            item={item}
            onEdit={metric => setDialog({ open: true, editing: metric })}
          />
        ))}
      </div>

      {dialog.open && (
        <MetricEditorDialog
          key={dialog.editing?.id ?? 'new'}
          existing={dialog.editing}
          nextOrder={items.length}
          goals={goals}
          onClose={() => setDialog({ open: false })}
        />
      )}
    </div>
  );
}

function MetricEditorDialog({
  existing,
  nextOrder,
  goals,
  onClose,
}: {
  existing?: LifeMetric;
  nextOrder: number;
  goals: { id: string; title: string }[];
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [unit, setUnit] = useState(existing?.unit ?? '');
  const [direction, setDirection] = useState<MetricDirection>(existing?.direction ?? 'target');
  const [targetStr, setTargetStr] = useState(
    existing?.targetValue != null ? String(existing.targetValue) : '',
  );
  const [goalId, setGoalId] = useState(existing?.goalId ?? '');
  const [color, setColor] = useState(existing?.color ?? PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError('지표 이름을 입력해 주세요.');
      return;
    }
    let targetValue: number | null = null;
    if (targetStr.trim()) {
      const n = Number(targetStr.trim());
      if (!Number.isFinite(n)) {
        setError('목표 수치는 숫자여야 합니다.');
        return;
      }
      targetValue = n;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        unit: unit.trim(),
        direction,
        targetValue,
        goalId: goalId || null,
        color,
      };
      if (existing) {
        await updateMetric(existing.id, payload);
      } else {
        await createMetric({ ...payload, order: nextOrder });
      }
      onClose();
    } catch {
      setError('지표를 저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={existing ? '지표 편집' : '새 상태 지표'} onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <label className="block text-sm font-medium">
          지표 이름
          <input
            type="text"
            aria-label="지표 이름"
            required
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="예: 체중, 순자산, 체지방률"
            className={`mt-1 ${fieldClass}`}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            단위
            <input
              type="text"
              aria-label="지표 단위"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              placeholder="예: kg, %, 만원"
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="block text-sm font-medium">
            목표 수치 <span className="text-xs font-normal text-zinc-500">(선택)</span>
            <input
              type="number"
              step="any"
              aria-label="목표 수치"
              value={targetStr}
              onChange={e => setTargetStr(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            방향
            <select
              aria-label="지표 방향"
              value={direction}
              onChange={e => setDirection(e.target.value as MetricDirection)}
              className={`mt-1 ${fieldClass}`}
            >
              {(['up', 'down', 'target'] as MetricDirection[]).map(d => (
                <option key={d} value={d}>
                  {METRIC_DIRECTION_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            상위 목표 연결
            <select
              aria-label="지표 상위 목표"
              value={goalId}
              onChange={e => setGoalId(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            >
              <option value="">목표 없음</option>
              {goals.map(g => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <span className="block text-sm font-medium">색상</span>
          <div className="mt-1.5 flex gap-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                aria-label={`색상 ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-zinc-900 dark:border-white scale-110' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button type="submit" disabled={busy} className={actionClass}>
            {busy ? '저장 중…' : existing ? '변경 저장' : '지표 만들기'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
