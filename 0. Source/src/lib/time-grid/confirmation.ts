import type { TimeBlock } from '@/lib/types';

export function unconfirmedPlansForDay(blocks: TimeBlock[]): TimeBlock[] {
  const confirmed = new Set(blocks.filter(block => block.kind === 'actual').map(block => block.sourcePlanId));
  return blocks.filter(block => (block.kind ?? 'plan') === 'plan' && !confirmed.has(block.id));
}
