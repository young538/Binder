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
      className="border rounded px-2 py-1 w-full"
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
