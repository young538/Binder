import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';

export const POST = authenticated(
  async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const body = await readMutation(req, 'bookLinkDaily', session.userId);
    if (body instanceof Response) return body;

    if ((!body.dates || body.dates.length === 0) && !body.matchTitle) {
      return NextResponse.json({ error: '연결할 날짜 또는 책 제목이 필요합니다.' }, { status: 400 });
    }

    const { id } = await ctx.params;
    const result = getUserRepositories(session.userId).insights.linkDailyReadings(id, body);
    return NextResponse.json(result);
  },
);
