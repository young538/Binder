'use client';
import { useCallback, useSyncExternalStore } from 'react';

const changed = 'binder:preference-changed';
const subscribe = (notify: () => void) => {
  window.addEventListener('storage', notify);
  window.addEventListener(changed, notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener(changed, notify);
  };
};
const fallback = new Map<string, boolean>();

export function useStoredBoolean(key: string) {
  const read = useCallback(() => {
    if (fallback.has(key)) return fallback.get(key)!;
    try { return window.localStorage.getItem(key) === 'true'; }
    catch { return fallback.get(key) ?? false; }
  }, [key]);
  const value = useSyncExternalStore(subscribe, read, () => false);
  const toggle = () => {
    const next = !read();
    try { window.localStorage.setItem(key, String(next)); fallback.delete(key); }
    catch { fallback.set(key, next); }
    window.dispatchEvent(new Event(changed));
  };
  return [value, toggle] as const;
}
