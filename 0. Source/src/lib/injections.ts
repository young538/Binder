export const drugs = {
  semaglutide: { name: '위고비', ingredient: '세마글루티드', halfLifeDays: 7, source: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/215256s025lbl.pdf' },
  tirzepatide: { name: '마운자로', ingredient: '터제파타이드', halfLifeDays: 5, source: 'https://www.ema.europa.eu/en/documents/product-information/mounjaro-epar-product-information_en.pdf' },
} as const;

export type Drug = keyof typeof drugs;
interface RecordIdentity { id: string; userId: string; createdAt: string; updatedAt: string }
export interface InjectionPen extends RecordIdentity {
  drug: Drug;
  name: string;
  capacityMcg: number;
  closed: boolean;
}
export interface InjectionEntry extends RecordIdentity {
  penId: string;
  takenAt: string;
  amountMcg: number;
}
export type PenInput = Omit<InjectionPen, keyof RecordIdentity>;
export type EntryInput = Omit<InjectionEntry, keyof RecordIdentity>;
export interface InjectionJournal { pens: InjectionPen[]; entries: InjectionEntry[] }

export function usedByPen(entries: Pick<InjectionEntry, 'penId' | 'amountMcg'>[]) {
  const used = new Map<string, number>();
  for (const entry of entries) used.set(entry.penId, (used.get(entry.penId) ?? 0) + entry.amountMcg);
  return used;
}

export const mg = (mcg: number) => (mcg / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 3 });

const day = 86400000;

// Retrospective elimination-only index. Include doses preceding the window in the baseline.
export function residualTrend(entries: InjectionEntry[], drug: Drug, end: number, days: number) {
  const start = end - days * day;
  const halfLife = drugs[drug].halfLifeDays * day;
  const events = entries.map(e => ({ time: Date.parse(e.takenAt), amount: e.amountMcg }))
    .filter(e => e.time <= end).sort((a, b) => a.time - b.time);
  let level = 0;
  let previous = events.length ? Math.min(start, events[0].time) : start;
  let peak = 0;
  const inWindow = new Map<number, number>();
  for (const e of events) {
    if (e.time < start) {
      level = level * 2 ** ((previous - e.time) / halfLife) + e.amount;
      peak = Math.max(peak, level);
      previous = e.time;
    } else {
      inWindow.set(e.time, (inWindow.get(e.time) ?? 0) + e.amount);
    }
  }
  const times = new Set(inWindow.keys());
  for (let i = 0; i <= days; i++) times.add(start + i * day);
  const points: { time: number; value: number }[] = [];
  for (const time of [...times].sort((a, b) => a - b)) {
    level *= 2 ** ((previous - time) / halfLife);
    points.push({ time, value: level });
    if (inWindow.has(time)) {
      level += inWindow.get(time)!;
      points.push({ time, value: level });
    }
    peak = Math.max(peak, level);
    previous = time;
  }
  return points.map(p => ({ ...p, value: peak > 0 ? 100 * p.value / peak : 0 }));
}
