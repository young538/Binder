// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { AsyncResource } from '@/lib/client/AsyncResource';
import { HttpClient } from '@/lib/client/HttpClient';
import { createBinderStore } from '@/store/createBinderStore';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import type { Category } from '@/lib/types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('async resource lifecycle', () => {
  it('ignores old reads after refresh, optimistic updates, and disposal', async () => {
    const resource = new AsyncResource<string>('day:a');
    const first = deferred<string>();
    const pending = resource.load(() => first.promise);
    await resource.load(async () => 'latest');
    first.resolve('old');
    await pending;
    expect(resource.snapshot().value).toBe('latest');
    const second = deferred<string>();
    const refresh = resource.load(() => second.promise);
    resource.set('edited');
    second.resolve('before-edit');
    await refresh;
    expect(resource.snapshot().value).toBe('edited');
    const third = deferred<string>();
    const closing = resource.load(() => third.promise);
    resource.cancel();
    third.resolve('closed-view');
    await closing;
    expect(resource.snapshot().value).toBe('edited');
  });

  it('retains the last good value on failure and permits retry', async () => {
    const resource = new AsyncResource<number>('year:2026');
    const notify = vi.fn();
    const unsubscribe = resource.subscribe(notify);
    await resource.load(async () => 10);
    await resource.load(async () => { throw new Error('offline'); });
    expect(resource.snapshot()).toMatchObject({ value: 10, loading: false, error: expect.any(Error) });
    await resource.load(async () => 11, true);
    expect(resource.snapshot()).toEqual({ value: 11, loading: false, error: null });
    unsubscribe();
    notify.mockClear();
    resource.set(12);
    expect(notify).not.toHaveBeenCalled();
  });
});

const source = () => ({
  me: vi.fn().mockResolvedValue({ userId: 'a', username: 'alice' }),
  categories: vi.fn<() => Promise<Category[]>>().mockResolvedValue([]),
  goals: vi.fn().mockResolvedValue([]),
  settings: vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS }),
});

describe('isolated application store', () => {
  it('shares initialization across simultaneous mounts', async () => {
    const data = source();
    const store = createBinderStore(data);
    await Promise.all([store.getState().init(), store.getState().init()]);
    expect(data.me).toHaveBeenCalledTimes(1);
    expect(data.categories).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ ready: true, me: { userId: 'a' }, error: null });
  });

  it('can retry initialization without exposing partial data', async () => {
    const data = source();
    data.settings.mockRejectedValueOnce(new Error('offline'));
    const store = createBinderStore(data);
    await store.getState().init();
    expect(store.getState()).toMatchObject({ ready: false, me: null, error: expect.any(String) });
    await store.getState().init();
    expect(store.getState()).toMatchObject({ ready: true, error: null });
  });

  it('keeps the newer refresh when responses arrive out of order', async () => {
    const data = source();
    const store = createBinderStore(data);
    await store.getState().init();
    const old = deferred<Category[]>();
    data.categories.mockReturnValueOnce(old.promise).mockResolvedValueOnce([{ id: 'latest' } as Category]);
    const pending = store.getState().reload();
    await store.getState().reload();
    old.resolve([{ id: 'old' } as Category]);
    await pending;
    expect(store.getState().categories[0].id).toBe('latest');
    expect(createBinderStore(source()).getState().ready).toBe(false);
  });
});

describe('JSON transport', () => {
  it('preserves explicit null, omits undefined, and accepts empty success responses', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new HttpClient(fetcher);
    await client.patch('/api/todos/a', { priority: null, categoryId: undefined });
    expect(fetcher).toHaveBeenCalledWith('/api/todos/a', expect.objectContaining({
      credentials: 'same-origin', body: '{"priority":null}',
    }));
  });

  it('separates authentication handling from server validation errors', async () => {
    const unauthorized = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(Response.json({ error: 'invalid date' }, { status: 400 }));
    const client = new HttpClient(fetcher, unauthorized);
    await expect(client.get('/api/todos')).rejects.toThrow('Unauthorized');
    await expect(client.post('/api/todos', {})).rejects.toThrow('invalid date');
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });
});
