'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toIsoWeek } from '@/lib/utils/date';

const items = [
  { label: '주간', icon: '📅', basePath: '/week', href: () => `/week/${toIsoWeek(new Date())}` },
  { label: '목표', icon: '🎯', basePath: '/mandalart', href: () => '/mandalart' },
  { label: '회고', icon: '📝', basePath: '/retrospective', href: () => `/retrospective/week/${toIsoWeek(new Date())}` },
  { label: '설정', icon: '⚙️', basePath: '/settings', href: () => '/settings' },
];

export const BottomNav = () => {
  const path = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 flex border-t bg-white dark:bg-black z-30">
      {items.map(i => {
        const active = path.startsWith(i.basePath);
        return (
          <Link
            key={i.basePath}
            href={i.href()}
            className={`flex-1 text-center py-2 text-xs ${active ? 'text-blue-600' : ''}`}
          >
            <div className="text-lg">{i.icon}</div>
            <div>{i.label}</div>
          </Link>
        );
      })}
    </nav>
  );
};
