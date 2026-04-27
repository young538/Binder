'use client';
import { useRef, useState } from 'react';
import { Upload, Check, AlertTriangle } from 'lucide-react';

interface ImportResult {
  ok: boolean;
  mode: 'merge' | 'replace';
  counts: Record<string, number>;
}

export const DataImportPanel = () => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setData(parsed);
      const counts: Record<string, number> = {};
      for (const key of [
        'goals',
        'categories',
        'timeBlocks',
        'retrospectives',
        'todos',
        'focusNotes',
        'annualGoals',
        'habits',
        'habitLogs',
        'books',
      ]) {
        const v = (parsed as Record<string, unknown>)[key];
        if (Array.isArray(v)) counts[key] = v.length;
      }
      setPreview(counts);
    } catch {
      setErr('JSON 파싱 실패');
    }
  };

  const confirmImport = async () => {
    if (!data) return;
    setLoading(true);
    setErr(null);
    try {
      if (mode === 'replace' && !confirm('기존 데이터를 모두 삭제하고 덮어씁니다. 계속할까요?')) {
        setLoading(false);
        return;
      }
      const res = await fetch('/api/import', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, data }),
      });
      if (!res.ok) throw new Error(`가져오기 실패: ${res.status}`);
      const json = (await res.json()) as ImportResult;
      setResult(json);
      setPreview(null);
      setData(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setErr(e instanceof Error ? e.message : '실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-50">데이터 가져오기</h2>
        <p className="text-xs text-zinc-500 mt-1">
          이전에 내보낸 JSON 파일을 서버로 업로드합니다.
        </p>
      </div>

      <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer w-fit">
        <Upload size={14} /> JSON 파일 선택
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onSelect}
          className="hidden"
        />
      </label>

      {preview && (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {Object.entries(preview).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-2">
                <div className="text-xl font-bold text-zinc-800 dark:text-zinc-50 tabular-nums">{v}</div>
                <div className="text-[10px] text-zinc-500">{k}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              가져오기 방식
            </div>
            <div className="flex gap-2">
              <label
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                  mode === 'merge'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">병합</div>
                  <div className="text-[10px] text-zinc-500">기존 유지 + 추가 (같은 id는 skip)</div>
                </div>
              </label>
              <label
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                  mode === 'replace'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                    : 'border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">덮어쓰기</div>
                  <div className="text-[10px] text-zinc-500">기존 전체 삭제</div>
                </div>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPreview(null);
                setData(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              className="px-4 py-2 text-sm rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              취소
            </button>
            <button
              onClick={confirmImport}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
            >
              {loading ? '가져오는 중…' : mode === 'replace' ? '덮어쓰기 실행' : '병합 실행'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
          <Check size={16} className="text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-sm text-emerald-800 dark:text-emerald-300">
            <div className="font-medium">가져오기 완료 ({result.mode})</div>
            <div className="text-xs mt-0.5">
              {Object.entries(result.counts).map(([k, v]) => `${k} ${v}`).join(' · ')}
            </div>
            <button onClick={() => setResult(null)} className="mt-2 text-xs underline">
              닫기
            </button>
          </div>
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
