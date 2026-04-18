'use client';
import { Goal } from '@/lib/types';

interface Props {
  goal: Goal | null;
  isCenter: boolean;
  isCore: boolean;
  onClick: () => void;
}

export const GoalCell = ({ goal, isCenter, isCore, onClick }: Props) => {
  const base = 'aspect-square p-1 text-[10px] sm:text-xs overflow-hidden cursor-pointer border';
  const fill = isCenter ? 'bg-black text-white font-bold'
    : isCore ? 'bg-blue-100 font-semibold'
    : 'bg-gray-50';
  return (
    <button onClick={onClick} className={`${base} ${fill} hover:ring-2 ring-blue-400 text-center leading-tight`}>
      {goal?.title ?? <span className="text-gray-400">+</span>}
    </button>
  );
};
