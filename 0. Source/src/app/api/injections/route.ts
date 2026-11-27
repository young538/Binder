import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';

export const GET = authenticated(async (session, req: Request) => Response.json(getUserRepositories(session.userId).injections.journal(new URL(req.url).searchParams.get('examples') === '1'), {
  headers: { 'Cache-Control': 'private, no-store' },
}));
