import { isValid, parseISO } from 'date-fns';
import { toIsoDate } from '@/lib/utils/date';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { computeGoalProgress } from '@/lib/server/progress';

export const GET = authenticated(async (session, req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const goalId = sp.get('goalId');
  const goalIds = sp.get('goalIds');
  const dateText = sp.get('date');
  const date = dateText === null ? new Date() : parseISO(dateText);
  if (dateText !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !isValid(date) || toIsoDate(date) !== dateText)) {
    return NextResponse.json({ error: 'date must be a valid YYYY-MM-DD' }, { status: 400 });
  }

  if (goalId) {
    const p = await computeGoalProgress(session.userId, goalId, date);
    return NextResponse.json(p);
  }
  if (goalIds) {
    const ids = goalIds.split(',').filter(Boolean);
    const entries = await Promise.all(
      ids.map(async id => [id, await computeGoalProgress(session.userId, id, date)] as const)
    );
    return NextResponse.json(Object.fromEntries(entries));
  }
  return NextResponse.json({ error: 'goalId or goalIds required' }, { status: 400 });
});
