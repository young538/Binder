import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { isDate } from '@/lib/validation/mutations';

export const GET = authenticated(async (session, req: Request) => {
  const date = new URL(req.url).searchParams.get('date');
  if (!isDate(date)) return Response.json({ error: '올바른 기준 날짜가 필요합니다.' }, { status: 400 });
  return Response.json(getUserRepositories(session.userId).insights.goalReview(date!));
});
