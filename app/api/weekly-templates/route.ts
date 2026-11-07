import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';

export const GET = authenticated(async session => Response.json(getUserRepositories(session.userId).weeklyTemplates.list()));

export const POST = authenticated(async (session, req: Request) => {
  const body = await readMutation(req, 'weeklyTemplateCreate', session.userId);
  if (body instanceof Response) return body;
  return Response.json(getUserRepositories(session.userId).weeklyTemplates.create(body.name, body.sourceWeek), { status: 201 });
});
