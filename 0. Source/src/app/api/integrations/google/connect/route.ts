import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { GoogleCalendarApiClient } from '@/lib/server/googleCalendar/client';
import { getGoogleOAuthConfig, OAUTH_STATE_COOKIE, sanitizeReturnTo } from '@/lib/server/googleCalendar/config';
import { signOAuthState } from '@/lib/server/googleCalendar/crypto';

export const GET = authenticated(async (session, req: NextRequest) => {
  const config = getGoogleOAuthConfig(req);
  if (!config.configured) {
    return NextResponse.json(
      { error: 'Google OAuth 클라이언트(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)가 설정되지 않았습니다.' },
      { status: 400 },
    );
  }

  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get('returnTo'));
  const state = crypto.randomBytes(24).toString('base64url');
  const signed = signOAuthState({
    state,
    userId: session.userId,
    returnTo,
    exp: Date.now() + 10 * 60 * 1000,
  });

  const apiClient = new GoogleCalendarApiClient();
  const authUrl = apiClient.buildAuthUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state,
  });

  const response = NextResponse.redirect(authUrl, { status: 302 });
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: signed,
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(config.redirectUri).protocol === 'https:',
    maxAge: 600,
    path: '/api/integrations/google',
  });
  return response;
});
