import type { LifeMetricEntry } from '@/lib/types';

interface Props {
  entries: LifeMetricEntry[];
  color: string;
  targetValue?: number | null;
  label: string;
}

export function MetricSparkline({ entries, color, targetValue, label }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex h-14 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-400 dark:border-zinc-800">
        아직 기록된 수치가 없습니다
      </div>
    );
  }

  const recent = entries.slice(-20);
  const width = 240;
  const height = 56;
  const padX = 8;
  const padY = 8;
  const values = recent.map(e => e.value);
  if (targetValue != null) values.push(targetValue);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = maxVal - minVal || 1;

  const yAt = (v: number) => height - padY - ((v - minVal) / span) * (height - padY * 2);
  const xAt = (idx: number) =>
    recent.length === 1 ? width / 2 : padX + (idx / (recent.length - 1)) * (width - padX * 2);

  const points = recent.map((e, i) => `${xAt(i).toFixed(1)},${yAt(e.value).toFixed(1)}`).join(' ');
  const targetY = targetValue != null ? yAt(targetValue) : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label} 추세 그래프`}
      className="h-14 w-full overflow-visible rounded-lg bg-zinc-50 dark:bg-zinc-950/60"
    >
      {targetY != null && (
        <line
          x1={padX}
          x2={width - padX}
          y1={targetY}
          y2={targetY}
          stroke="currentColor"
          strokeDasharray="3 3"
          className="text-zinc-300 dark:text-zinc-700"
        />
      )}
      {recent.length > 1 && (
        <polyline
          fill="none"
          stroke={color}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      )}
      {recent.map((e, i) => (
        <circle
          key={e.id}
          cx={xAt(i)}
          cy={yAt(e.value)}
          r={i === recent.length - 1 ? 3.5 : 2.2}
          fill={color}
        >
          <title>{`${e.date}: ${e.value}`}</title>
        </circle>
      ))}
    </svg>
  );
}
