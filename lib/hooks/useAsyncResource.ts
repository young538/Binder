'use client';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AsyncResource } from '@/lib/client/AsyncResource';
import { onDirty, type MutationResource } from '@/lib/repo/events';
import { useLatest } from './useLatest';
import { useBinder } from '@/store';

export function useAsyncResource<T>(key: string, load: () => Promise<T>, initial: T, dirty: (MutationResource | '*')[] = []) {
  const userId = useBinder(state => state.me?.userId);
  const scopedKey = `${userId ?? 'anonymous'}:${key}`;
  const resource = useMemo(() => new AsyncResource<T>(scopedKey), [scopedKey]);
  const loader = useLatest(load);
  const snapshot = useSyncExternalStore(resource.subscribe, resource.snapshot, resource.snapshot);
  const refresh = useCallback((showLoading = false) => resource.load(() => loader.current(), showLoading), [resource, loader]);
  const dirtyKey = dirty.join(',');

  useEffect(() => {
    void refresh();
    const names = dirtyKey.split(',');
    const unsubscribe = onDirty(name => { if (names.includes(name ?? '') || names.includes('*')) void refresh(); });
    return () => { resource.cancel(); unsubscribe(); };
  }, [resource, refresh, dirtyKey]);

  const setValue = useCallback((update: T | ((previous: T) => T)) => {
    const previous = resource.snapshot().value ?? initial;
    resource.set(typeof update === 'function' ? (update as (value: T) => T)(previous) : update);
  }, [resource, initial]);
  return { value: snapshot.value ?? initial, loading: snapshot.loading, error: snapshot.error, refresh, setValue };
}
