import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { toGoogleConnectionSummary } from '@/lib/server/repos/googleCalendar';
import { readMutation } from '@/lib/server/validation';

export const PATCH = authenticated(async (session, req: Request) => {
  const patch = await readMutation(req, 'googleCalendarSettings', session.userId, true);
  if (patch instanceof Response) return patch;

  const repositories = getUserRepositories(session.userId);
  const existing = repositories.googleCalendar.get();
  if (!existing) {
    return NextResponse.json({ error: 'Google 캘린더 계정이 연결되어 있지 않습니다.' }, { status: 400 });
  }

  const knownIds = new Set(existing.calendarMeta.map(c => c.id));
  if (patch.selectedCalendarIds && knownIds.size > 0) {
    if (patch.selectedCalendarIds.some(id => !knownIds.has(id))) {
      return NextResponse.json({ error: '유효하지 않은 캘린더가 선택되었습니다.' }, { status: 400 });
    }
  }
  if (patch.pushCalendarId && knownIds.size > 0) {
    const pushMeta = existing.calendarMeta.find(c => c.id === patch.pushCalendarId);
    if (!pushMeta) {
      return NextResponse.json({ error: '존재하지 않는 내보내기 캘린더입니다.' }, { status: 400 });
    }
    if (pushMeta.accessRole !== 'owner' && pushMeta.accessRole !== 'writer') {
      return NextResponse.json({ error: '쓰기 권한이 있는 Google 캘린더만 내보내기 대상으로 지정할 수 있습니다.' }, { status: 400 });
    }
  }

  const updated = repositories.googleCalendar.updateSettings({
    ...(patch.selectedCalendarIds !== undefined
      ? { selectedCalendarIds: [...new Set(patch.selectedCalendarIds)] }
      : {}),
    ...(patch.pushCalendarId !== undefined ? { pushCalendarId: patch.pushCalendarId } : {}),
    ...(patch.syncEnabled !== undefined ? { syncEnabled: patch.syncEnabled } : {}),
    ...(patch.autoPushEvents !== undefined ? { autoPushEvents: patch.autoPushEvents } : {}),
  });

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(toGoogleConnectionSummary(updated));
});
