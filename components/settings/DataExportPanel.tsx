'use client';
import { useState } from 'react';
import { Download, Check, AlertTriangle } from 'lucide-react';
import { downloadExportJson } from '@/lib/exporter';

export const DataExportPanel = () => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onExport = async () => {
    setBusy(true);
    setErr(null);
    try {
      await downloadExportJson();
      setNote('내보내기 완료 — 다운로드 폴더를 확인하세요');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">데이터 내보내기</h2>
        <p className="text-xs text-zinc-500 mt-1">
          전체 데이터를 JSON 파일로 다운로드합니다. 본인 PC/클라우드에 백업하거나 다른 기기로 옮길 때 사용하세요.
        </p>
      </div>
      <button
        onClick={onExport}
        disabled={busy}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
      >
        <Download size={14} /> 전체 JSON 다운로드
      </button>
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
