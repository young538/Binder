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
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-gray-500 mb-1">평가</div>
        <div className="flex gap-2 text-2xl">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              onClick={() => onChange({ rating: r.value })}
              className={`w-10 h-10 rounded-full ${
                value.rating === r.value
                  ? 'bg-blue-100 ring-2 ring-blue-500'
                  : 'hover:bg-gray-100'
              }`}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <div className="text-xs text-green-700 font-medium">✓ 좋았던 것</div>
        <textarea
          rows={2}
          value={tpl.good ?? ''}
          onChange={(e) => onChange({ template: { ...tpl, good: e.target.value } })}
          className="w-full border rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <div className="text-xs text-red-600 font-medium">✗ 아쉬운 것</div>
        <textarea
          rows={2}
          value={tpl.bad ?? ''}
          onChange={(e) => onChange({ template: { ...tpl, bad: e.target.value } })}
          className="w-full border rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <div className="text-xs text-blue-600 font-medium">→ 내일/다음주 1가지</div>
        <textarea
          rows={2}
          value={tpl.nextStep ?? ''}
          onChange={(e) => onChange({ template: { ...tpl, nextStep: e.target.value } })}
          className="w-full border rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <div className="text-xs text-gray-500">✍️ 자유 메모</div>
        <textarea
          rows={4}
          value={value.freeText ?? ''}
          onChange={(e) => onChange({ freeText: e.target.value })}
          className="w-full border rounded px-2 py-1 text-sm"
        />
      </label>
    </div>
  );
};
