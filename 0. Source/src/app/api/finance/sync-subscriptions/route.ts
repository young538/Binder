import { NextResponse } from 'next/server';
import { getFinanceCycleKeyForDate } from '@/lib/finance';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { isMonth } from '@/lib/server/validation';

function currentSeoulDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export const POST = authenticated(async (session, req: Request) => {
  let body: { yyyymm?: unknown } = {};
  try {
    const raw = await req.text();
    if (raw.trim()) body = JSON.parse(raw) as { yyyymm?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const repositories = getUserRepositories(session.userId);
  const cycleStartDay = repositories.settings.get().financeCycleStartDay;

  const yyyymm =
    typeof body.yyyymm === 'string' && body.yyyymm.trim()
      ? body.yyyymm.trim()
      : getFinanceCycleKeyForDate(currentSeoulDate(), cycleStartDay);
  if (!isMonth(yyyymm)) {
    return NextResponse.json({ error: 'Invalid yyyymm' }, { status: 400 });
  }

  const res = repositories.finance.syncSubscriptionsForMonth(yyyymm, cycleStartDay);
  return NextResponse.json({ yyyymm, ...res });
});
