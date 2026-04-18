'use client';
import { useState } from 'react';
import { Download, Upload, AlertTriangle, Check } from 'lucide-react';
import { useBinder } from '@/store';
import {
  importData,
  fetchBuiltinSeed,
  validateImportData,
  ImportData,
  ImportResult,
} from '@/lib/importer';

type Mode = 'merge' | 'replace';

export const DataImportPanel = () => {
  const { reload } = useBinder();
  const [preview, setPreview] = useState<ImportData | null>(null);
  const [mode, setMode] = useState<Mode>('merge');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBuiltin = async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await fetchBuiltinSeed();
      const err = validateImportData(data);
      if (err) {
        setError(err);
        return;
      }
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const err = validateImportData(data);
      if (err) {
        setError(err);
        return;
      }
      setPreview(data);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'JSON 파싱 실패');
    }
    e.target.value = '';
  };

  const confirmImport = async () => {
    if (!preview) return;
    if (mode === 'replace' && !confirm('기존 데이터를 모두 삭제하고 덮어씁니다. 계속할까요?')) return;
    setLoading(true);
    try {
      const r = await importData(preview, mode);
      setResult(r);
      setPreview(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">데이터 가져오기</h2>
        <p className="text-xs text-zinc-500 mt-1">
          2026년 바인더 시드 또는 JSON 파일을 IndexedDB에 불러옵니다.
        </p>
      </div>

      {!preview && !result && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={loadBuiltin}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
          >
            <Download size={14} /> 2026 시드 불러오기
          </button>
          <label className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <Upload size={14} /> JSON 파일 업로드
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleFilePick}
              className="hidden"
            />
          </label>
        </div>
      )}

      {preview && (
        <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                {preview.goals?.length ?? 0}
              </div>
              <div className="text-xs text-zinc-500 mt-1">Goals</div>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                {preview.focusNotes?.length ?? 0}
              </div>
              <div className="text-xs text-zinc-500 mt-1">FocusNotes</div>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                {preview.todos?.length ?? 0}
              </div>
              <div className="text-xs text-zinc-500 mt-1">Todos</div>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                {preview.annualGoals?.length ?? 0}
              </div>
              <div className="text-xs text-zinc-500 mt-1">AnnualGoals</div>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                {preview.habits?.length ?? 0}
              </div>
              <div className="text-xs text-zinc-500 mt-1">Habits</div>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                {preview.habitLogs?.length ?? 0}
              </div>
              <div className="text-xs text-zinc-500 mt-1">HabitLogs</div>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                {preview.routines?.length ?? 0}
              </div>
              <div className="text-xs text-zinc-500 mt-1">Routines</div>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                {preview.books?.length ?? 0}
              </div>
              <div className="text-xs text-zinc-500 mt-1">Books</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              가져오기 방식
            </div>
            <div className="flex gap-2">
              <label
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition
                ${
                  mode === 'merge'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <input
                  type="radio"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">병합</div>
                  <div className="text-[10px] text-zinc-500">기존 데이터 유지 + 추가</div>
                </div>
              </label>
              <label
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition
                ${
                  mode === 'replace'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                    : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <input
                  type="radio"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">덮어쓰기</div>
                  <div className="text-[10px] text-zinc-500">기존 모두 삭제</div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPreview(null)}
              className="px-4 py-2 text-sm rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              취소
            </button>
            <button
              onClick={confirmImport}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
            >
              {loading ? '가져오는 중...' : mode === 'replace' ? '덮어쓰기 실행' : '병합 실행'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
          <Check size={18} className="text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-sm text-emerald-800 dark:text-emerald-300">
            <div className="font-medium">가져오기 완료</div>
            <div className="text-xs mt-0.5">
              Goals {result.goals} · FocusNotes {result.focusNotes} · Todos {result.todos} · AnnualGoals {result.annualGoals} · Habits {result.habits} · HabitLogs {result.habitLogs} · Routines {result.routines} · Books {result.books}
            </div>
            <button onClick={() => setResult(null)} className="mt-2 text-xs underline">
              닫기
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
          <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm text-red-800 dark:text-red-300">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-xs underline">
              닫기
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
