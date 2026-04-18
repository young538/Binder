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
    className={`inline-flex items-center rounded ${
      size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1'
    } text-gray-800`}
  >
    {category.name}
  </span>
);
