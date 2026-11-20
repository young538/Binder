import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';

export const DELETE = authenticated(async (session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
  getUserRepositories(session.userId).weeklyTemplates.delete((await ctx.params).id);
  return Response.json({ ok: true });
});
