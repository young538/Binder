'use client';
import { useBinder } from '@/store';

interface Props {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}

export const GoalPicker = ({ value, onChange }: Props) => {
  const { goals } = useBinder();
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 w-full text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">(목표 미지정)</option>
      {goals.map((g) => (
        <option key={g.id} value={g.id}>
          [{g.level}] {g.title}
        </option>
      ))}
    </select>
  );
};
