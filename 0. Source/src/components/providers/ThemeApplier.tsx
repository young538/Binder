'use client';
import { useEffect } from 'react';
import { useBinder } from '@/store';

/** Applies settings.theme to <html data-theme="..."> so Tailwind dark: + CSS variables work. */
export const ThemeApplier = () => {
  const theme = useBinder((s) => s.settings?.theme ?? 'light');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return null;
};
