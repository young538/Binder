import { Category } from '@/lib/types';

export const CategoryChip = ({
  category,
  size = 'md',
}: {
  category: Category;
  size?: 'sm' | 'md';
}) => (
  <span
    style={{ backgroundColor: category.color }}
    className={`inline-flex items-center rounded-full ${
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
    } text-zinc-800 font-medium`}
  >
    {category.name}
  </span>
);
