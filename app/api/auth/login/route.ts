import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, verifyPassword } from '@/lib/server/auth';

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

  const expectedUsername = process.env.APP_USERNAME ?? 'admin';
  if (username !== expectedUsername) {
    return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않아요' }, { status: 401 });
  }

  const ok = await verifyPassword(password);
  if (!ok) {
    return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않아요' }, { status: 401 });
  }

  const session = await getSession();
  session.loggedIn = true;
  session.username = username;
  await session.save();

  return NextResponse.json({ ok: true });
}
