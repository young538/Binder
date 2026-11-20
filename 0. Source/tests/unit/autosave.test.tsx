import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutosaveQueue } from '@/lib/autosave/queue';
import { useAutosaveRecord } from '@/lib/autosave/useAutosaveRecord';
import { useBinder } from '@/store';

const deferred = () => {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

afterEach(() => { vi.useRealTimers(); });

describe('record autosave queue', () => {
  it('serializes a slow write and coalesces subsequent edits', async () => {
    vi.useFakeTimers();
    const first = deferred();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const queue = new AutosaveQueue<string>(save, (_a, b) => b);
    queue.enqueue('first');
    const done = queue.flush();
    await Promise.resolve();
    queue.enqueue('second');
    queue.enqueue('latest');
    await vi.advanceTimersByTimeAsync(1000);
    expect(save.mock.calls).toEqual([['first']]);
    expect(queue.status).toBe('saving');
    first.resolve();
    await done;
    expect(save.mock.calls).toEqual([['first'], ['latest']]);
    expect(queue.status).toBe('saved');
    expect(queue.draft()).toBeUndefined();
  });

  it('keeps failed fields and newer edits for retry, including explicit empty text', async () => {
    vi.useFakeTimers();
    const first = deferred();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const persist = vi.fn();
    const queue = new AutosaveQueue<Record<string, string>>(save, (a, b) => ({ ...a, ...b }), persist);
    queue.enqueue({ good: 'old', bad: 'keep' });
    const done = queue.flush();
    await Promise.resolve();
    queue.enqueue({ good: '' });
    first.reject();
    await done;
    expect(queue.status).toBe('error');
    expect(queue.draft()).toEqual({ good: '', bad: 'keep' });
    expect(persist).toHaveBeenLastCalledWith({ good: '', bad: 'keep' });
    await queue.flush();
    expect(save).toHaveBeenLastCalledWith({ good: '', bad: 'keep' });
    expect(persist).toHaveBeenLastCalledWith(undefined);
  });
});

describe('autosave editor lifecycle', () => {
  beforeEach(() => {
    useBinder.setState({ me: { userId: crypto.randomUUID(), username: 'test' } });
    sessionStorage.clear();
  });

  it('flushes the old record on date switch and the final edit on unmount', async () => {
    const writes: [string, string][] = [];
    const { result, rerender, unmount } = renderHook(({ date }) => useAutosaveRecord({
      recordKey: date,
      initial: '',
      load: async () => `loaded ${date}`,
      save: async text => { writes.push([date, text]); },
      merge: (_a: string, b: string) => b,
    }), { initialProps: { date: '2026-09-01' } });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.patch('September 1 edit'));
    rerender({ date: '2026-09-02' });
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.value).toBe('loaded 2026-09-02');
    act(() => result.current.patch('September 2 edit'));
    unmount();
    await waitFor(() => expect(writes).toEqual([
      ['2026-09-01', 'September 1 edit'], ['2026-09-02', 'September 2 edit'],
    ]));
  });

  it('recovers this user’s failed browser draft and exposes a save retry', async () => {
    const userId = useBinder.getState().me!.userId;
    const key = `binder:draft:${userId}:recovery`;
    sessionStorage.setItem(key, JSON.stringify('unsaved draft'));
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useAutosaveRecord({
      recordKey: 'recovery', initial: '', load: async () => 'server text', save,
      merge: (_a: string, b: string) => b,
    }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.value).toBe('unsaved draft');
    expect(result.current.status).toBe('error');
    expect(sessionStorage.getItem(key)).toBe(JSON.stringify('unsaved draft'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('saved'));
    expect(save).toHaveBeenLastCalledWith('unsaved draft');
    expect(sessionStorage.getItem(key)).toBeNull();
    unmount();
  });

  it('ignores a response from the previous date and disables failed loads', async () => {
    let resolveOld!: (value: string) => void;
    const old = new Promise<string>(resolve => { resolveOld = resolve; });
    const save = vi.fn();
    const { result, rerender, unmount } = renderHook(({ date }) => useAutosaveRecord({
      recordKey: date, initial: '',
      load: () => date === 'old' ? old : Promise.reject(new Error('unavailable')),
      save, merge: (_a: string, b: string) => b,
    }), { initialProps: { date: 'old' } });
    rerender({ date: 'new' });
    await waitFor(() => expect(result.current.loadError).toBe(true));
    await act(async () => { resolveOld('old text'); });
    expect(result.current.value).toBe('');
    expect(result.current.loaded).toBe(false);
    act(() => result.current.patch('must not write'));
    expect(save).not.toHaveBeenCalled();
    unmount();
  });
});
