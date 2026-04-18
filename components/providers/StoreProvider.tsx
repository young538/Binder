'use client';
import { useEffect } from 'react';
import { useBinder } from '@/store';
import { installAutoSnapshot } from '@/lib/snapshots';

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  const init = useBinder(s => s.init);
  const ready = useBinder(s => s.ready);
  useEffect(() => {
    init();
    installAutoSnapshot();
  }, [init]);
  if (!ready) return <div className="p-8 text-center text-sm text-gray-500">로딩 중…</div>;
  return <>{children}</>;
};
