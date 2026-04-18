'use client';
import { Retrospective, RetroRating } from '@/lib/types';

interface Props {
  value: Partial<Retrospective>;
  onChange: (patch: Partial<Retrospective>) => void;
}

const RATINGS: { value: RetroRating; emoji: string }[] = [
  { value: 1, emoji: '😞' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😊' },
];

export const RetroTemplate = ({ value, onChange }: Props) => {
  const tpl = value.template ?? {};
  const textareaCls =
    'w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none';
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">평가</div>
        <div className="flex gap-2">
          {RATINGS.map((r) => {
            const active = value.rating === r.value;
            return (
              <button
                key={r.value}
                onClick={() => onChange({ rating: r.value })}
                className={`w-11 h-11 rounded-full text-2xl transition flex items-center justify-center ${
                  active
                    ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500'
                    : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {r.emoji}
              </button>
            );
          })}
        </div>
      </div>
      <label className="block">
        <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1.5">✓ 좋았던 것</div>
        <textarea
          rows={2}
          value={tpl.good ?? ''}
          onChange={(e) => onChange({ template: { ...tpl, good: e.target.value } })}
          className={textareaCls}
        />
      </label>
      <label className="block">
        <div className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-1.5">✗ 아쉬운 것</div>
        <textarea
          rows={2}
          value={tpl.bad ?? ''}
          onChange={(e) => onChange({ template: { ...tpl, bad: e.target.value } })}
          className={textareaCls}
        />
      </label>
      <label className="block">
        <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1.5">→ 내일/다음주 1가지</div>
        <textarea
          rows={2}
          value={tpl.nextStep ?? ''}
          onChange={(e) => onChange({ template: { ...tpl, nextStep: e.target.value } })}
          className={textareaCls}
        />
      </label>
      <label className="block">
        <div className="text-xs font-medium text-zinc-500 mb-1.5">✍️ 자유 메모</div>
        <textarea
          rows={4}
          value={value.freeText ?? ''}
          onChange={(e) => onChange({ freeText: e.target.value })}
          className={textareaCls}
        />
      </label>
    </div>
  );
};
