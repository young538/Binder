'use client';
import { useEffect } from 'react';
import { useBinder } from '@/store';
import { ThemeApplier } from './ThemeApplier';

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  const init = useBinder(s => s.init);
  const ready = useBinder(s => s.ready);
  const error = useBinder(s => s.error);
  useEffect(() => {
    void init();
  }, [init]);
  if (!ready) return <div className="p-8 text-center text-sm text-gray-500">
    {error ? <div role="alert">
      <p>{error}</p>
      <button type="button" onClick={() => { void init(); }} className="mt-3 text-blue-600 underline">다시 시도</button>
    </div> : '로딩 중…'}
  </div>;
  return (
    <>
      <ThemeApplier />
      {children}
    </>
  );
};
