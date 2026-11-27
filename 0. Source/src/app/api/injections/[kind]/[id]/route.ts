import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';

type Context = { params: Promise<{ kind: string; id: string }> };
const notFound = () => Response.json({ error: '기록을 찾을 수 없어요.' }, { status: 404 });

export const PUT = authenticated(async ({ userId }, req: Request, ctx: Context) => {
  const { id, kind } = await ctx.params;
  if (!id.trim() || id.length > 128) return notFound();
  const repo = getUserRepositories(userId).injections;
  const version = req.headers.get('X-Record-Version');
  if (kind === 'pens') {
    const data = await readMutation(req, 'injectionPens', userId);
    return data instanceof Response ? data : Response.json(repo.savePen(id, data, version));
  }
  if (kind === 'entries') {
    const data = await readMutation(req, 'injectionEntries', userId);
    return data instanceof Response ? data : Response.json(repo.saveEntry(id, data, version));
  }
  return notFound();
});

export const DELETE = authenticated(async ({ userId }, req: Request, ctx: Context) => {
  const { id, kind } = await ctx.params;
  if (kind !== 'pens' && kind !== 'entries') return notFound();
  getUserRepositories(userId).injections.remove(kind, id, req.headers.get('X-Record-Version'));
  return new Response(null, { status: 204 });
});
