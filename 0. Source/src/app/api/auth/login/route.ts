import { readMutation } from '@/lib/server/validation';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, verifyCredentials } from '@/lib/server/auth';
import { extractClientIp, formatRetryAfter, loginRateLimiter } from '@/lib/server/authRateLimit';

export async function POST(req: NextRequest) {
  const body = await readMutation(req, 'login', '');
  if (body instanceof Response) return body;
  const { username, password } = body;

  const ip = extractClientIp(req);
  const normalizedUser = username.trim().toLowerCase();
  const decision = loginRateLimiter.check(ip, normalizedUser);
  if (!decision.allowed) {
    return NextResponse.json(
      { error: `로그인 시도가 너무 많아요. ${formatRetryAfter(decision.retryAfterSec)} 후 다시 시도해 주세요.` },
      { status: 429, headers: { 'Retry-After': String(decision.retryAfterSec) } },
    );
  }

  const creds = await verifyCredentials(username, password);
  if (!creds) {
    loginRateLimiter.recordFailure(ip, normalizedUser);
    return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않아요' }, { status: 401 });
  }

  loginRateLimiter.recordSuccess(ip, normalizedUser);
  const session = await getSession();
  session.loggedIn = true;
  session.userId = creds.userId;
  session.username = creds.username;
  await session.save();

  return NextResponse.json({ ok: true });
}
