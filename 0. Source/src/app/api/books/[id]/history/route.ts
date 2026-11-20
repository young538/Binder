import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';

export const GET = authenticated(async (session, _req: Request, ctx: { params: Promise<{ id: string }> }) =>
  Response.json(getUserRepositories(session.userId).insights.bookHistory((await ctx.params).id)));
