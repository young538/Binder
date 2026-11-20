import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';

export const GET = authenticated(async (session) => {
  const repositories = getUserRepositories(session.userId);
  return NextResponse.json(repositories.projects.overview());
});
