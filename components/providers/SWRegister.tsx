'use client';
import { useEffect } from 'react';

export const SWRegister = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('SW register failed', err));
  }, []);
  return null;
};
