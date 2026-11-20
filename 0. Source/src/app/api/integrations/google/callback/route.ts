import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { GoogleCalendarApiClient } from '@/lib/server/googleCalendar/client';
import { getGoogleOAuthConfig, OAUTH_STATE_COOKIE } from '@/lib/server/googleCalendar/config';
import { encryptSecret, verifyOAuthState } from '@/lib/server/googleCalendar/crypto';
import { GoogleCalendarSyncService } from '@/lib/server/googleCalendar/syncService';
import { getUserRepositories } from '@/lib/server/repos';

function buildReturnRedirect(redirectUri: string, returnTo: string, query: Record<string, string>) {
  const origin = new URL(redirectUri).origin;
  const target = new URL(returnTo, origin);
  for (const [k, v] of Object.entries(query)) {
    target.searchParams.set(k, v);
  }
  const res = NextResponse.redirect(target.toString(), { status: 302 });
  res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: '/api/integrations/google' });
  return res;
}

export const GET = authenticated(async (session, req: NextRequest) => {
  const config = getGoogleOAuthConfig(req);
  const sp = req.nextUrl.searchParams;
  const cookieRaw = req.cookies.get(OAUTH_STATE_COOKIE)?.value ?? '';
  const statePayload = verifyOAuthState(cookieRaw);
  const returnTo = statePayload?.returnTo ?? '/settings';

  if (!statePayload || statePayload.userId !== session.userId || statePayload.state !== sp.get('state')) {
    return buildReturnRedirect(config.redirectUri, returnTo, {
      google: 'error',
      reason: 'invalid_state',
    });
  }

  const oauthError = sp.get('error');
  if (oauthError) {
    return buildReturnRedirect(config.redirectUri, returnTo, {
      google: 'error',
      reason: oauthError.slice(0, 60),
    });
  }

  const code = sp.get('code')?.trim();
  if (!code) {
    return buildReturnRedirect(config.redirectUri, returnTo, {
      google: 'error',
      reason: 'missing_code',
    });
  }

  if (!config.configured) {
    return buildReturnRedirect(config.redirectUri, returnTo, {
      google: 'error',
      reason: 'not_configured',
    });
  }

  const apiClient = new GoogleCalendarApiClient();
  const repositories = getUserRepositories(session.userId);

  try {
    const tokens = await apiClient.exchangeCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      code,
    });

    const existing = repositories.googleCalendar.get();
    const refreshTokenEnc = tokens.refreshToken
      ? encryptSecret(tokens.refreshToken)
      : existing?.refreshTokenEnc;

    if (!refreshTokenEnc) {
      return buildReturnRedirect(config.redirectUri, returnTo, {
        google: 'error',
        reason: 'missing_refresh_token',
      });
    }

    const [googleEmail, calendarMeta] = await Promise.all([
      apiClient.getUserEmail(tokens.accessToken),
      apiClient.listCalendars(tokens.accessToken),
    ]);

    repositories.googleCalendar.upsert({
      googleEmail,
      accessTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc,
      tokenExpiresAt: new Date(Date.now() + tokens.expiresInSec * 1000).toISOString(),
      calendarMeta,
    });

    // Best-effort initial sync so calendars populate right away after returning.
    try {
      const syncService = new GoogleCalendarSyncService(repositories, apiClient, config);
      await syncService.syncNow();
    } catch {
      // Failure is recorded in lastSyncError for visibility in settings.
    }

    return buildReturnRedirect(config.redirectUri, returnTo, { google: 'connected' });
  } catch {
    return buildReturnRedirect(config.redirectUri, returnTo, {
      google: 'error',
      reason: 'exchange_failed',
    });
  }
});
