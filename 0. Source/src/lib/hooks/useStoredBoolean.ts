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

function readStoredFlag(key: string): boolean {
  if (fallback.has(key)) return fallback.get(key)!;
  try { return window.localStorage.getItem(key) === 'true'; }
  catch { return fallback.get(key) ?? false; }
}

function writeStoredFlag(key: string, next: boolean): void {
  try { window.localStorage.setItem(key, String(next)); fallback.delete(key); }
  catch { fallback.set(key, next); }
  window.dispatchEvent(new Event(changed));
}

export function useStoredFlag(key: string) {
  const read = useCallback(() => readStoredFlag(key), [key]);
  const value = useSyncExternalStore(subscribe, read, () => false);
  const setFlag = useCallback((next: boolean) => writeStoredFlag(key, next), [key]);
  return [value, setFlag] as const;
}

export function useStoredBoolean(key: string) {
  const [value, setFlag] = useStoredFlag(key);
  const toggle = useCallback(() => setFlag(!readStoredFlag(key)), [key, setFlag]);
  return [value, toggle] as const;
}
