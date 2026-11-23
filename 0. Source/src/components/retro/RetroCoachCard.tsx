'use client';
import { useState } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import type {
  RetroCoachMode,
  RetroCoachProvider,
  RetroCoachRequestedProvider,
  RetroCoachResponse,
  RetroCoachStatus,
} from '@/lib/retroCoach';
import { generateRetroCoach, getRetroCoachStatus } from '@/lib/repo/retrospectives';
import type { Retrospective } from '@/lib/types';

interface Props {
  mode: RetroCoachMode;
  period: string;
  currentTemplate?: Retrospective['template'];
  editorLoaded: boolean;
  onApplyDraft: (patch: { template: { good: string; bad: string; nextStep: string } }) => void;
}

const INITIAL_STATUS: RetroCoachStatus = {
  configuredProviders: [],
  defaultProvider: 'auto',
  models: {},
};

function mergeDraftField(existing: string | undefined, generated: string): string {
  const prev = existing?.trim() ?? '';
  if (!prev) return generated;
  if (prev.includes(generated)) return prev;
  return `${prev}\n\n${generated}`;
}

function formatProviderBadge(provider: RetroCoachProvider, model?: string): string {
  if (provider === 'openai') {
    return `OpenAI${model ? ` (${model})` : ''}`;
  }
  if (provider === 'gemini') {
    return `Gemini AI${model ? ` (${model})` : ''}`;
  }
  return '데이터 패턴 분석';
}

export function RetroCoachCard({
  mode,
  period,
  currentTemplate,
  editorLoaded,
  onApplyDraft,
}: Props) {
  const { value: status } = useAsyncResource(
    'retro-coach:status',
    getRetroCoachStatus,
    INITIAL_STATUS,
  );
  const [selectedProvider, setSelectedProvider] = useState<RetroCoachRequestedProvider>('auto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RetroCoachResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onGenerate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await generateRetroCoach(mode, period, selectedProvider);
      setResult(data);
    } catch {
      setError('회고 인사이트를 생성하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const onApply = () => {
    if (!result || !editorLoaded) return;
    onApplyDraft({
      template: {
        good: mergeDraftField(currentTemplate?.good, result.draft.good),
        bad: mergeDraftField(currentTemplate?.bad, result.draft.bad),
        nextStep: mergeDraftField(currentTemplate?.nextStep, result.draft.nextStep),
      },
    });
    setNotice('초안을 회고 입력란에 반영했어요.');
  };

  const onCopyPrompt = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.promptText);
      setNotice('AI 프롬프트를 클립보드에 복사했어요.');
    } catch {
      setNotice('클립보드 복사를 지원하지 않는 환경이에요.');
    }
  };

  return (
    <section
      aria-label="AI 회고 코치"
      className="mb-6 rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <Sparkles size={15} className="text-blue-600 dark:text-blue-400" />
              AI 회고 코치 · 패턴 요약
            </h2>
            {result && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-200 dark:bg-zinc-900 dark:text-blue-300 dark:ring-blue-800">
                {formatProviderBadge(result.provider, result.model)}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            시간 블록, 할 일 완료율, 습관, 수면·에너지 기록을 묶어 회고 인사이트와 초안을 제안합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status.configuredProviders.length > 0 && (
            <select
              aria-label="AI 분석 엔진"
              value={selectedProvider}
              onChange={e => setSelectedProvider(e.target.value as RetroCoachRequestedProvider)}
              disabled={busy}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="auto">자동 ({status.defaultProvider === 'gemini' ? 'Gemini 우선' : 'OpenAI/자동'})</option>
              {status.configuredProviders.includes('openai') && (
                <option value="openai">OpenAI ({status.models.openai ?? 'gpt-4.1-mini'})</option>
              )}
              {status.configuredProviders.includes('gemini') && (
                <option value="gemini">Gemini ({status.models.gemini ?? 'gemini-2.5-flash'})</option>
              )}
              <option value="local">로컬 패턴 분석</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => void onGenerate()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Sparkles size={14} />
            {busy ? '분석 중…' : result ? '다시 분석' : '회고 초안 생성'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3 border-t border-blue-200/70 pt-3 dark:border-blue-900/40">
          {result.fallbackReason && (
            <div className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {result.fallbackReason}
            </div>
          )}

          <ul className="space-y-1.5 text-xs leading-5 text-zinc-700 dark:text-zinc-200">
            {result.insights.map((line, index) => (
              <li key={index} className="flex gap-2">
                <span className="font-semibold text-blue-600 dark:text-blue-400">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200/80 bg-white p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-1 font-semibold text-emerald-700 dark:text-emerald-400">✓ 좋았던 것 초안</div>
              <p className="whitespace-pre-line text-zinc-600 dark:text-zinc-300">{result.draft.good}</p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-white p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-1 font-semibold text-rose-700 dark:text-rose-400">✗ 아쉬운 것 초안</div>
              <p className="whitespace-pre-line text-zinc-600 dark:text-zinc-300">{result.draft.bad}</p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-white p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-1 font-semibold text-blue-700 dark:text-blue-400">→ 다음 행동 초안</div>
              <p className="whitespace-pre-line text-zinc-600 dark:text-zinc-300">{result.draft.nextStep}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onApply}
              disabled={!editorLoaded}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              회고에 초안 채우기
            </button>
            <button
              type="button"
              onClick={() => void onCopyPrompt()}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Copy size={13} />
              AI 프롬프트 복사
            </button>
            {notice && (
              <span role="status" className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {notice}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
