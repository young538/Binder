'use client';
import { useEffect } from 'react';
import { useBinder } from '@/store';

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  const init = useBinder(s => s.init);
  const ready = useBinder(s => s.ready);
  useEffect(() => { init(); }, [init]);
  if (!ready) return <div className="p-8 text-center text-sm text-gray-500">로딩 중…</div>;
  return <>{children}</>;
};
