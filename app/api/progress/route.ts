import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { computeGoalProgress } from '@/lib/server/progress';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const goalId = sp.get('goalId');
  const goalIds = sp.get('goalIds');

  if (goalId) {
    const p = await computeGoalProgress(goalId);
    return NextResponse.json(p);
  }
  if (goalIds) {
    const ids = goalIds.split(',').filter(Boolean);
    const entries = await Promise.all(
      ids.map(async id => [id, await computeGoalProgress(id)] as const)
    );
    return NextResponse.json(Object.fromEntries(entries));
  }
  return NextResponse.json({ error: 'goalId or goalIds required' }, { status: 400 });
}
