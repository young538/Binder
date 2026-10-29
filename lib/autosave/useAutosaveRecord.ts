'use client';

import { useEffect, useRef, useState } from 'react';
import { useBinder } from '@/store';
import { useLatest } from '@/lib/hooks/useLatest';
import { AutosaveQueue, SaveStatus } from './queue';

const queues = new Map<string, object>();

interface Options<T> {
  recordKey: string;
  initial: T;
  load: () => Promise<T>;
  save: (patch: T) => Promise<unknown>;
  merge: (previous: T, patch: T) => T;
}

export function useAutosaveRecord<T>(options: Options<T>) {
  const userId = useBinder(state => state.me?.userId);
  const key = userId ? `binder:draft:${userId}:${options.recordKey}` : '';
  const [state, setState] = useState({ key: '', value: options.initial, loaded: false, loadError: false });
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [attempt, setAttempt] = useState(0);
  const currentOptions = useLatest(options);
  const controller = useRef<{ key: string; queue: AutosaveQueue<T> } | undefined>(undefined);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const { initial, load, save, merge } = currentOptions.current;
    let queue = queues.get(key) as AutosaveQueue<T> | undefined;
    if (!queue) {
      queue = new AutosaveQueue(save, merge, draft => {
        try {
          if (draft === undefined) sessionStorage.removeItem(key);
          else sessionStorage.setItem(key, JSON.stringify(draft));
        } catch { /* Memory queue still preserves edits if storage is unavailable. */ }
      });
      queues.set(key, queue);
      try {
        const draft = sessionStorage.getItem(key);
        if (draft !== null) queue.enqueue(JSON.parse(draft) as T);
      } catch { /* Ignore an unreadable browser draft. */ }
    }
    const activeQueue = queue;
    controller.current = { key, queue: activeQueue };
    const unsubscribe = activeQueue.subscribe(() => {
      if (!cancelled) setStatus(activeQueue.status);
    });
    void (async () => {
      // A remounted editor must read after the previous editor's pending write.
      await activeQueue.flush();
      if (cancelled) return;
      setStatus(activeQueue.status);
      try {
        const loaded = await load();
        if (cancelled) return;
        const draft = activeQueue.draft();
        setState({ key, value: draft === undefined ? loaded : merge(loaded, draft), loaded: true, loadError: false });
      } catch {
        if (!cancelled) setState({ key, value: initial, loaded: false, loadError: true });
      }
    })();
    const flush = () => { void activeQueue.flush(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (activeQueue.draft() === undefined) return;
      flush();
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      // Route changes and closing sheets dispatch their final edit immediately.
      flush();
    };
  }, [key, attempt, currentOptions]);

  const loaded = state.key === key && state.loaded;
  return {
    value: state.key === key ? state.value : options.initial,
    loaded,
    loadError: state.key === key && state.loadError,
    status,
    patch: (patch: T) => {
      if (!loaded || controller.current?.key !== key) return;
      const merge = currentOptions.current.merge;
      setState(previous => ({ ...previous, value: merge(previous.value, patch) }));
      controller.current.queue.enqueue(patch);
    },
    retry: () => {
      if (loaded) void controller.current?.queue.flush();
      else setAttempt(previous => previous + 1);
    },
  };
}
