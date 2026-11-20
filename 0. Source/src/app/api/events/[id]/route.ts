import { NextResponse } from 'next/server';
import { GoogleCalendarApiClient } from '@/lib/server/googleCalendar/client';
import { getGoogleOAuthConfig } from '@/lib/server/googleCalendar/config';
import { GoogleCalendarSyncService } from '@/lib/server/googleCalendar/syncService';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';

export const PATCH = authenticated(async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const patch = await readMutation(req, 'lifeEvents', session.userId, true, id);
  if (patch instanceof Response) return patch;
  const repositories = getUserRepositories(session.userId);
  const row = repositories.lifeEvents.update(id, patch);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const syncService = new GoogleCalendarSyncService(
    repositories,
    new GoogleCalendarApiClient(),
    getGoogleOAuthConfig(req),
  );
  const synced = await syncService.pushUpdatedEvent(row);
  return NextResponse.json(synced);
});

export const DELETE = authenticated(async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const repositories = getUserRepositories(session.userId);
  const existing = repositories.lifeEvents.getById(id);
  repositories.lifeEvents.delete(id);
  if (existing) {
    const syncService = new GoogleCalendarSyncService(
      repositories,
      new GoogleCalendarApiClient(),
      getGoogleOAuthConfig(req),
    );
    await syncService.pushDeletedEvent(existing);
  }
  return NextResponse.json({ ok: true });
});
