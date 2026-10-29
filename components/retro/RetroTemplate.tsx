'use client';
import { Retrospective, RetroRating } from '@/lib/types';
import { GrowingTextarea } from '@/components/common/GrowingTextarea';

interface Props {
  value: Partial<Retrospective>;
  onChange: (patch: Partial<Retrospective>) => void;
  layout?: 'stacked' | 'wide';
}

const RATINGS: { value: RetroRating; emoji: string }[] = [
  { value: 1, emoji: '😞' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😊' },
];

export const RetroTemplate = ({ value, onChange, layout = 'stacked' }: Props) => {
  const tpl = value.template ?? {};
  const wide = layout === 'wide';
  const Textarea = wide ? GrowingTextarea : 'textarea';
  const fieldLabel = wide ? 'mb-2 text-sm font-semibold' : 'mb-1.5 text-xs font-medium';
  const textareaCls = wide
    ? 'block min-h-[176px] w-full resize-none overflow-hidden rounded-xl border border-blue-200 bg-blue-50/20 px-4 py-4 text-base leading-8 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-blue-900 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500'
    :
    'w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none';
  return (
    <div className={wide ? 'grid items-start gap-5 lg:grid-cols-3' : 'space-y-4'}>
      <div className={layout === 'wide' ? 'lg:col-span-3' : undefined}>
        <div className={`${fieldLabel} text-zinc-600 dark:text-zinc-300`}>평가</div>
        <div className="flex gap-2">
          {RATINGS.map((r) => {
            const active = value.rating === r.value;
            return (
              <button
                key={r.value}
                aria-pressed={active}
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
        <div className={`${fieldLabel} text-emerald-700 dark:text-emerald-400`}>✓ 좋았던 것</div>
        <Textarea
          rows={2}
          placeholder={wide ? '기억하고 싶은 순간이나 잘해 낸 일을 적어 보세요.' : undefined}
          value={tpl.good ?? ''}
          onChange={(e) => onChange({ template: { good: e.target.value } })}
          className={textareaCls}
        />
      </label>
      <label className="block">
        <div className={`${fieldLabel} text-rose-700 dark:text-rose-400`}>✗ 아쉬운 것</div>
        <Textarea
          rows={2}
          placeholder={wide ? '아쉬웠던 경험과 다음에 바꿔 보고 싶은 점을 적어 보세요.' : undefined}
          value={tpl.bad ?? ''}
          onChange={(e) => onChange({ template: { bad: e.target.value } })}
          className={textareaCls}
        />
      </label>
      <label className="block">
        <div className={`${fieldLabel} text-blue-700 dark:text-blue-400`}>→ 내일/다음주 1가지</div>
        <Textarea
          rows={2}
          placeholder={wide ? '내일 실천할 작은 행동 하나를 정해 보세요.' : undefined}
          value={tpl.nextStep ?? ''}
          onChange={(e) => onChange({ template: { nextStep: e.target.value } })}
          className={textareaCls}
        />
      </label>
      <label className={layout === 'wide' ? 'block lg:col-span-3' : 'block'}>
        <div className={`${fieldLabel} text-zinc-700 dark:text-zinc-300`}>✍️ 자유 메모</div>
        <Textarea
          rows={4}
          placeholder={wide ? '오늘 떠오른 생각이나 더 남기고 싶은 이야기를 편하게 적어 보세요.' : undefined}
          value={value.freeText ?? ''}
          onChange={(e) => onChange({ freeText: e.target.value })}
          className={wide ? `${textareaCls} min-h-[224px]` : textareaCls}
        />
      </label>
    </div>
  );
};
