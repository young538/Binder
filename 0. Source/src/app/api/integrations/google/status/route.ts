import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getGoogleOAuthConfig } from '@/lib/server/googleCalendar/config';
import { getUserRepositories } from '@/lib/server/repos';

export const GET = authenticated(async (session, req: Request) => {
  const config = getGoogleOAuthConfig(req);
  const repositories = getUserRepositories(session.userId);
  const connection = repositories.googleCalendar.getSummary();
  return NextResponse.json({
    configured: config.configured,
    connected: connection !== null,
    redirectUri: config.redirectUri,
    connection,
  });
});
