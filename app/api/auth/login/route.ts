import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, verifyCredentials } from '@/lib/server/auth';

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요' }, { status: 400 });
  }

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
