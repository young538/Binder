import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { GoogleCalendarApiClient } from '@/lib/server/googleCalendar/client';
import { decryptSecret } from '@/lib/server/googleCalendar/crypto';
import { getUserRepositories } from '@/lib/server/repos';

export const DELETE = authenticated(async (session, req: NextRequest) => {
  const purgeEvents = req.nextUrl.searchParams.get('purgeEvents') === 'true';
  const repositories = getUserRepositories(session.userId);
  const existing = repositories.googleCalendar.get();

  if (existing) {
    const apiClient = new GoogleCalendarApiClient();
    try {
      const refreshToken = decryptSecret(existing.refreshTokenEnc);
      await apiClient.revokeToken(refreshToken);
    } catch {
      // Best-effort revocation only.
    }
    repositories.googleCalendar.delete();
  }

  const deletedEvents = purgeEvents ? repositories.lifeEvents.deleteGoogleSyncedEvents() : 0;
  return NextResponse.json({ ok: true, deletedEvents });
});
