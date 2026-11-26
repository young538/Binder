import type { LifeMetric, LifeMetricEntry } from './types';

export const METRIC_CHART_ENTRIES = 20;

export interface LifeMetricWithEntries {
  metric: LifeMetric;
  entries: LifeMetricEntry[];
}

export interface MetricSummary {
  latest: LifeMetricEntry | null;
  previous: LifeMetricEntry | null;
  delta: number | null;
  progressPercent: number | null;
}

export function sortMetricEntries(entries: LifeMetricEntry[]): LifeMetricEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function summarizeMetric(metric: LifeMetric, entries: LifeMetricEntry[]): MetricSummary {
  const ordered = sortMetricEntries(entries);
  const latest = ordered.length > 0 ? ordered[ordered.length - 1] : null;
  const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;
  const delta = latest && previous ? Number((latest.value - previous.value).toFixed(2)) : null;

  let progressPercent: number | null = null;
  if (latest && metric.targetValue != null) {
    const target = metric.targetValue;
    if (metric.direction === 'up') {
      if (target > 0) {
        progressPercent = Math.max(0, Math.min(100, Math.round((latest.value / target) * 100)));
      }
    } else if (metric.direction === 'down') {
      const start = ordered[0].value;
      if (latest.value <= target) {
        progressPercent = 100;
      } else if (start > target) {
        const ratio = (start - latest.value) / (start - target);
        progressPercent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      } else {
        progressPercent = 0;
      }
    } else {
      const denom = Math.max(1, Math.abs(target));
      const diffRatio = Math.abs(latest.value - target) / denom;
      progressPercent = Math.max(0, Math.min(100, Math.round((1 - diffRatio) * 100)));
    }
  }

  return { latest, previous, delta, progressPercent };
}
