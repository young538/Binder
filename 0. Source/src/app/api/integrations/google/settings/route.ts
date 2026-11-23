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

  const knownTaskListIds = new Set(existing.tasksListMeta.map(l => l.id));
  if (patch.tasksSelectedListIds && knownTaskListIds.size > 0) {
    if (patch.tasksSelectedListIds.some(id => !knownTaskListIds.has(id))) {
      return NextResponse.json({ error: '유효하지 않은 Google Tasks 목록이 선택되었습니다.' }, { status: 400 });
    }
  }
  if (patch.tasksDefaultListId && knownTaskListIds.size > 0 && !knownTaskListIds.has(patch.tasksDefaultListId)) {
    return NextResponse.json({ error: '존재하지 않는 기본 Google Tasks 목록입니다.' }, { status: 400 });
  }
  if (patch.tasksProjectMap) {
    const knownProjectIds = new Set((await repositories.projects.list()).map(p => p.id));
    for (const [listId, projectId] of Object.entries(patch.tasksProjectMap)) {
      if (knownTaskListIds.size > 0 && !knownTaskListIds.has(listId)) {
        return NextResponse.json({ error: '존재하지 않는 Google Tasks 목록이 매핑되었습니다.' }, { status: 400 });
      }
      if (projectId !== null && !knownProjectIds.has(projectId)) {
        return NextResponse.json({ error: '존재하지 않는 바인더 프로젝트가 매핑되었습니다.' }, { status: 400 });
      }
    }
  }

  const updated = repositories.googleCalendar.updateSettings({
    ...(patch.selectedCalendarIds !== undefined
      ? { selectedCalendarIds: [...new Set(patch.selectedCalendarIds)] }
      : {}),
    ...(patch.pushCalendarId !== undefined ? { pushCalendarId: patch.pushCalendarId } : {}),
    ...(patch.syncEnabled !== undefined ? { syncEnabled: patch.syncEnabled } : {}),
    ...(patch.autoPushEvents !== undefined ? { autoPushEvents: patch.autoPushEvents } : {}),
    ...(patch.tasksSyncEnabled !== undefined ? { tasksSyncEnabled: patch.tasksSyncEnabled } : {}),
    ...(patch.tasksAutoPush !== undefined ? { tasksAutoPush: patch.tasksAutoPush } : {}),
    ...(patch.tasksSelectedListIds !== undefined
      ? { tasksSelectedListIds: [...new Set(patch.tasksSelectedListIds)] }
      : {}),
    ...(patch.tasksDefaultListId !== undefined
      ? { tasksDefaultListId: patch.tasksDefaultListId }
      : {}),
    ...(patch.tasksProjectMap !== undefined
      ? { tasksProjectMap: patch.tasksProjectMap }
      : {}),
  });

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(toGoogleConnectionSummary(updated));
});
