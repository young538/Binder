'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toIsoWeek } from '@/lib/utils/date';

const links = [
  { label: '📅 주간', basePath: '/week', href: () => `/week/${toIsoWeek(new Date())}` },
  { label: '🎯 만다라트', basePath: '/mandalart', href: () => '/mandalart' },
  { label: '📝 회고', basePath: '/retrospective', href: () => `/retrospective/week/${toIsoWeek(new Date())}` },
  { label: '⚙️ 설정', basePath: '/settings', href: () => '/settings' },
];

export const TopNav = () => {
  const path = usePathname();
  return (
    <nav className="hidden lg:flex items-center gap-4 border-b px-6 py-3 bg-blue-600 text-white">
      <span className="font-bold mr-auto">3P 바인더</span>
      {links.map(l => (
        <Link
          key={l.basePath}
          href={l.href()}
          className={`px-3 py-1 rounded ${path.startsWith(l.basePath) ? 'bg-blue-800' : 'hover:bg-blue-700'}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
};
