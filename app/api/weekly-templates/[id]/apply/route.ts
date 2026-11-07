import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';

export const POST = authenticated(async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const body = await readMutation(req, 'weeklyTemplateApply', session.userId);
  if (body instanceof Response) return body;
  return Response.json(getUserRepositories(session.userId).weeklyTemplates.apply((await ctx.params).id, body.week));
});
