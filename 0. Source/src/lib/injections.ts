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
  startingClicks?: number | null;
  closed: boolean;
}
export interface InjectionEntry extends RecordIdentity {
  penId: string;
  takenAt: string;
  amountMcg: number;
  usedClicks?: number | null;
  injectionSite?: string | null;
  weightKg?: number | null;
  appetiteSuppression?: number | null;
  conditionNote?: string | null;
  lifestyleNote?: string | null;
}
export type PenInput = Omit<InjectionPen, keyof RecordIdentity>;
export type EntryInput = Omit<InjectionEntry, keyof RecordIdentity>;
export interface InjectionJournal { pens: InjectionPen[]; entries: InjectionEntry[] }

export interface JournalOverview extends InjectionJournal { examples?: InjectionJournal }

export function usedByPen(entries: Pick<InjectionEntry, 'penId' | 'amountMcg'>[]) {
  const used = new Map<string, number>();
  for (const entry of entries) used.set(entry.penId, (used.get(entry.penId) ?? 0) + entry.amountMcg);
  return used;
}

interface PenClickBalance {
  starting: number | null;
  used: number;
  missing: number;
  remaining: number | null;
}

// Journal entries arrive newest first. A missing count makes subsequent balances unknown.
export function clickLedger({ pens, entries }: InjectionJournal) {
  const byPen = new Map<string, PenClickBalance>(pens.map(pen => [pen.id, {
    starting: pen.startingClicks ?? null, used: 0, missing: 0, remaining: pen.startingClicks ?? null,
  }]));
  const afterEntry = new Map<string, number>();
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const balance = byPen.get(entry.penId);
    if (!balance) continue;
    if (entry.usedClicks == null) balance.missing++;
    else balance.used += entry.usedClicks;
    balance.remaining = balance.starting !== null && !balance.missing && balance.used <= balance.starting
      ? balance.starting - balance.used : null;
    if (balance.remaining !== null) afterEntry.set(entry.id, balance.remaining);
  }
  return { byPen, afterEntry };
}

// Entries use the journal's newest-first order, including its tie-breaker.
export function weightChanges(entries: InjectionEntry[]) {
  const changes = new Map<string, number>();
  let previous: number | undefined;
  for (let i = entries.length - 1; i >= 0; i--) {
    const { id, weightKg } = entries[i];
    if (weightKg == null) continue;
    if (previous !== undefined) changes.set(id, Number((weightKg - previous).toFixed(2)));
    previous = weightKg;
  }
  return changes;
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
