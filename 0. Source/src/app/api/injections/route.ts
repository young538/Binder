import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';

export const GET = authenticated(async session => Response.json(getUserRepositories(session.userId).injections.journal(), {
  headers: { 'Cache-Control': 'private, no-store' },
}));
