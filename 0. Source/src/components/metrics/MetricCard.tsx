'use client';
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { summarizeMetric, type LifeMetricWithEntries } from '@/lib/metrics';
import { deleteMetric, deleteMetricEntry, upsertMetricEntry } from '@/lib/repo/metrics';
import { METRIC_DIRECTION_LABEL, type LifeMetric } from '@/lib/types';
import { toIsoDate } from '@/lib/utils/date';
import { useBinder } from '@/store';
import { MetricSparkline } from './MetricSparkline';

interface Props {
  item: LifeMetricWithEntries;
  onEdit: (metric: LifeMetric) => void;
}

export function MetricCard({ item, onEdit }: Props) {
  const { metric, entries } = item;
  const { goals } = useBinder();
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [valStr, setValStr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const summary = summarizeMetric(metric, entries);
  const goal = metric.goalId ? goals.find(g => g.id === metric.goalId) : null;

  const submitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const num = Number(valStr.trim());
    if (!valStr.trim() || !Number.isFinite(num)) {
      setError('올바른 숫자를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await upsertMetricEntry(metric.id, {
        date,
        value: num,
        note: note.trim() || null,
      });
      setValStr('');
      setNote('');
    } catch {
      setError('수치를 저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const removeMetric = async () => {
    if (!confirm(`'${metric.name}' 지표와 모든 기록을 삭제할까요?`)) return;
    await deleteMetric(metric.id);
  };

  const fmtVal = (v: number) => `${v}${metric.unit ? ` ${metric.unit}` : ''}`;

  return (
    <article className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: metric.color }} />
            <h2 className="break-words text-base font-bold text-zinc-900 dark:text-zinc-50">{metric.name}</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {METRIC_DIRECTION_LABEL[metric.direction]}
            </span>
          </div>
          {goal && <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">🎯 {goal.title}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`${metric.name} 편집`}
            onClick={() => onEdit(metric)}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            aria-label={`${metric.name} 삭제`}
            onClick={() => void removeMetric()}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {summary.latest ? fmtVal(summary.latest.value) : '-'}
          </span>
          {summary.delta !== null && (
            <span className="ml-2 text-xs font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
              ({summary.delta > 0 ? `+${summary.delta}` : summary.delta}{metric.unit ? ` ${metric.unit}` : ''})
            </span>
          )}
        </div>
        {metric.targetValue != null && (
          <span className="text-xs tabular-nums text-zinc-500">
            목표 {fmtVal(metric.targetValue)}
            {summary.progressPercent != null ? ` (${summary.progressPercent}%)` : ''}
          </span>
        )}
      </div>

      {summary.progressPercent != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${summary.progressPercent}%`, background: metric.color }}
          />
        </div>
      )}

      <div className="mt-3">
        <MetricSparkline
          entries={entries}
          color={metric.color}
          targetValue={metric.targetValue}
          label={metric.name}
        />
      </div>

      <form onSubmit={e => void submitEntry(e)} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="date"
          aria-label={`${metric.name} 기록 날짜`}
          value={date}
          onChange={e => setDate(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="number"
          step="any"
          aria-label={`${metric.name} 수치`}
          placeholder={metric.unit ? `수치 (${metric.unit})` : '수치'}
          value={valStr}
          onChange={e => setValStr(e.target.value)}
          className="w-28 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="text"
          aria-label={`${metric.name} 메모`}
          placeholder="메모 (선택)"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="min-w-[120px] flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={13} /> 기록
        </button>
      </form>
      {error && <p role="alert" className="mt-1.5 text-xs text-red-600">{error}</p>}

      {entries.length > 0 && (
        <div className="mt-3 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setShowHistory(v => !v)}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {showHistory ? '기록 접기' : `최근 기록 ${entries.length}건 보기`}
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5">
              {[...entries].reverse().slice(0, 12).map(entry => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs dark:bg-zinc-950"
                >
                  <span className="tabular-nums text-zinc-500">{entry.date}</span>
                  <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {fmtVal(entry.value)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-zinc-500">{entry.note ?? ''}</span>
                  <button
                    type="button"
                    aria-label={`${entry.date} 기록 삭제`}
                    onClick={() => void deleteMetricEntry(metric.id, entry.id)}
                    className="p-1 text-zinc-400 hover:text-red-600"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
