import { readMutation } from '@/lib/server/validation';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, verifyCredentials } from '@/lib/server/auth';

export async function POST(req: NextRequest) {
  const body = await readMutation(req, 'login', '');
  if (body instanceof Response) return body;
  const { username, password } = body;

  const creds = await verifyCredentials(username, password);
  if (!creds) {
    return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않아요' }, { status: 401 });
  }

  const session = await getSession();
  session.loggedIn = true;
  session.userId = creds.userId;
  session.username = creds.username;
  await session.save();

  return NextResponse.json({ ok: true });
}
