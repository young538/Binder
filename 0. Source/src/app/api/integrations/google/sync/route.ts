import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { GoogleApiError, GoogleCalendarApiClient } from '@/lib/server/googleCalendar/client';
import { getGoogleOAuthConfig } from '@/lib/server/googleCalendar/config';
import {
  GoogleCalendarSyncService,
  GoogleSyncNotConnectedError,
} from '@/lib/server/googleCalendar/syncService';
import { getUserRepositories } from '@/lib/server/repos';

export const POST = authenticated(async (session, req: Request) => {
  const config = getGoogleOAuthConfig(req);
  const repositories = getUserRepositories(session.userId);
  const syncService = new GoogleCalendarSyncService(
    repositories,
    new GoogleCalendarApiClient(),
    config,
  );

  try {
    const result = await syncService.syncNow();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GoogleSyncNotConnectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof GoogleApiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : 'Google 캘린더 동기화에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
});
