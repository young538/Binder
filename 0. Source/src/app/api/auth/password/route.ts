import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { changeUserPassword } from '@/lib/server/auth';
import { extractClientIp, formatRetryAfter, passwordChangeRateLimiter } from '@/lib/server/authRateLimit';
import { authenticated } from '@/lib/server/http';
import { readMutation } from '@/lib/server/validation';

export const POST = authenticated(async (session, req: NextRequest) => {
  const ip = extractClientIp(req);
  const decision = passwordChangeRateLimiter.check(ip, session.userId);
  if (!decision.allowed) {
    return NextResponse.json(
      { error: `비밀번호 확인 시도가 너무 많아요. ${formatRetryAfter(decision.retryAfterSec)} 후 다시 시도해 주세요.` },
      { status: 429, headers: { 'Retry-After': String(decision.retryAfterSec) } },
    );
  }

  const body = await readMutation(req, 'changePassword', session.userId);
  if (body instanceof Response) return body;

  const result = await changeUserPassword(session.userId, body.currentPassword, body.newPassword);
  if (!result.ok) {
    if (result.status === 400) {
      passwordChangeRateLimiter.recordFailure(ip, session.userId);
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  passwordChangeRateLimiter.recordSuccess(ip, session.userId);
  return NextResponse.json({ ok: true });
});
