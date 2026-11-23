import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { GoogleApiError } from '@/lib/server/googleCalendar/client';
import {
  DEFAULT_CLIENT_SYNC_COOLDOWN_MS,
  googleSyncCoordinator,
} from '@/lib/server/googleCalendar/autoSync';
import { GoogleSyncNotConnectedError } from '@/lib/server/googleCalendar/syncService';

type SyncMode = 'manual' | 'auto';

async function parseSyncMode(req: Request): Promise<SyncMode | Response> {
  const raw = await req.text();
  if (!raw.trim()) return 'manual';

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return NextResponse.json({ error: 'JSON body must be an object' }, { status: 400 });
  }

  const mode = (parsed as { mode?: unknown }).mode;
  if (mode === undefined) return 'manual';
  if (mode === 'manual' || mode === 'auto') return mode;
  return NextResponse.json({ error: 'Invalid sync mode' }, { status: 400 });
}

export const POST = authenticated(async (session, req: Request) => {
  const mode = await parseSyncMode(req);
  if (mode instanceof Response) return mode;

  if (mode === 'auto') {
    const outcome = await googleSyncCoordinator.syncUserIfDue(session.userId, {
      force: false,
      minIntervalMs: DEFAULT_CLIENT_SYNC_COOLDOWN_MS,
      req,
    });
    return NextResponse.json(outcome);
  }

  try {
    const outcome = await googleSyncCoordinator.syncUserIfDue(session.userId, {
      force: true,
      req,
    });
    if (outcome.skipped) {
      return NextResponse.json({ error: 'Google 캘린더 동기화를 실행하지 못했습니다.' }, { status: 502 });
    }
    const { skipped: _skipped, ...result } = outcome;
    void _skipped;
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
