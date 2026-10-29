// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticated } from '@/lib/server/http';

const auth = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server/auth', () => ({ requireSession: auth }));
beforeEach(() => auth.mockReset().mockResolvedValue({ userId: 'a', username: 'alice' }));

describe('authenticated route boundary', () => {
  it('passes session and asynchronous route params without changing the response', async () => {
    const route = authenticated(async (session, _request: Request, context: { params: Promise<{ id: string }> }) =>
      Response.json({ userId: session.userId, id: (await context.params).id }, { status: 201 }));
    const response = await route(new Request('http://localhost/api/todos/a'), { params: Promise.resolve({ id: 'todo' }) });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ userId: 'a', id: 'todo' });
  });

  it('returns authentication responses but does not swallow configuration or database errors', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const route = authenticated(handler);
    auth.mockRejectedValueOnce(new Response('Unauthorized', { status: 401 }));
    expect((await route()).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    auth.mockRejectedValueOnce(new Error('invalid configuration'));
    await expect(route()).rejects.toThrow('invalid configuration');
    handler.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(route()).rejects.toThrow('database unavailable');
  });
});
