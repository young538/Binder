'use client';
import { useEffect, useState } from 'react';
import { Camera, RotateCcw, Trash2, AlertTriangle, Check } from 'lucide-react';
import {
  createSnapshot,
  listSnapshots,
  restoreSnapshot,
  deleteSnapshot,
  SnapshotMeta,
} from '@/lib/snapshots';
import { useBinder } from '@/store';

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const SnapshotPanel = () => {
  const { reload } = useBinder();
  const [snaps, setSnaps] = useState<SnapshotMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => listSnapshots().then(setSnaps);
  useEffect(() => {
    refresh();
  }, []);

  const onCreate = async () => {
    setBusy(true);
    setErr(null);
    try {
      await createSnapshot('manual', '수동');
      setNote('스냅샷 저장 완료');
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '실패');
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async (id: string) => {
    if (
      !confirm(
        '이 스냅샷 시점의 데이터로 되돌립니다. 현재 데이터는 "복구 직전" 스냅샷으로 저장돼요. 계속할까요?'
      )
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      await restoreSnapshot(id);
      setNote('복구 완료');
      await reload();
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '실패');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('삭제?')) return;
    await deleteSnapshot(id);
    refresh();
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-50">스냅샷 / 복구</h2>
        <p className="text-xs text-zinc-500 mt-1">
          로컬에 최대 5개의 자동 스냅샷이 롤링으로 저장됩니다. 실수로 데이터 삭제 시 여기서 복구하세요.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCreate}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          <Camera size={14} /> 지금 스냅샷
        </button>
      </div>

      {snaps.length === 0 ? (
        <div className="text-xs text-zinc-400 text-center py-6">저장된 스냅샷이 없어요.</div>
      ) : (
        <ul className="space-y-1.5">
          {snaps.map(s => (
            <li
              key={s.id}
              className="flex items-center gap-3 p-2 rounded-md bg-zinc-50/60 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800"
            >
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded
                ${
                  s.kind === 'manual'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                }`}
              >
                {s.kind === 'manual' ? '수동' : '자동'}
              </span>
              <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300 tabular-nums">
                {fmt(s.createdAt)}
              </span>
              {s.label && <span className="text-xs text-zinc-500 italic">{s.label}</span>}
              <button
                onClick={() => onRestore(s.id)}
                disabled={busy}
                title="복구"
                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded disabled:opacity-50"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={() => onDelete(s.id)}
                disabled={busy}
                title="삭제"
                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {note && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs">
          <Check size={14} /> {note}
          <button onClick={() => setNote(null)} className="ml-auto underline">
            닫기
          </button>
        </div>
      )}
      {err && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-xs">
          <AlertTriangle size={14} /> {err}
          <button onClick={() => setErr(null)} className="ml-auto underline">
            닫기
          </button>
        </div>
      )}
    </section>
  );
};
