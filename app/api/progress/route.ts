import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { computeGoalProgress } from '@/lib/server/progress';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const sp = req.nextUrl.searchParams;
  const goalId = sp.get('goalId');
  const goalIds = sp.get('goalIds');

  if (goalId) {
    const p = await computeGoalProgress(session.userId, goalId);
    return NextResponse.json(p);
  }
  if (goalIds) {
    const ids = goalIds.split(',').filter(Boolean);
    const entries = await Promise.all(
      ids.map(async id => [id, await computeGoalProgress(session.userId, id)] as const)
    );
    return NextResponse.json(Object.fromEntries(entries));
  }
  return NextResponse.json({ error: 'goalId or goalIds required' }, { status: 400 });
}
