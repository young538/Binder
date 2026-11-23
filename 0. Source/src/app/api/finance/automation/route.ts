import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { resolveAppOrigin } from '@/lib/server/googleCalendar/config';
import { getUserRepositories } from '@/lib/server/repos';

function buildEndpointUrl(req: Request): string {
  return `${resolveAppOrigin(req)}/api/finance/import/automation`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export const GET = authenticated(async (session, req: Request) => {
  const repositories = getUserRepositories(session.userId);
  return NextResponse.json(repositories.financeAutomation.getStatus(buildEndpointUrl(req)));
});

export const POST = authenticated(async (session, req: Request) => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isPlainObject(raw)) {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const keys = Object.keys(raw);
  if (keys.some(k => k !== 'action')) {
    return NextResponse.json({ error: '허용되지 않은 필드가 포함되어 있습니다.' }, { status: 400 });
  }

  const endpointUrl = buildEndpointUrl(req);
  const repositories = getUserRepositories(session.userId);

  if (raw.action === 'issue_token') {
    const issued = repositories.financeAutomation.issueToken(endpointUrl);
    return NextResponse.json(issued);
  }
  if (raw.action === 'revoke_token') {
    const status = repositories.financeAutomation.revokeToken(endpointUrl);
    return NextResponse.json({ status });
  }

  return NextResponse.json({ error: '지원하지 않는 action입니다.' }, { status: 400 });
});

export const PATCH = authenticated(async (session, req: Request) => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isPlainObject(raw)) {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const keys = Object.keys(raw);
  if (keys.length === 0 || keys.some(k => k !== 'enabled' && k !== 'excelPassword')) {
    return NextResponse.json({ error: '허용되지 않은 설정 필드입니다.' }, { status: 400 });
  }

  const patch: { enabled?: boolean; excelPassword?: string | null } = {};
  if ('enabled' in raw) {
    if (typeof raw.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled는 boolean이어야 합니다.' }, { status: 400 });
    }
    patch.enabled = raw.enabled;
  }

  if ('excelPassword' in raw) {
    if (raw.excelPassword !== null && typeof raw.excelPassword !== 'string') {
      return NextResponse.json({ error: 'excelPassword는 문자열 또는 null이어야 합니다.' }, { status: 400 });
    }
    if (typeof raw.excelPassword === 'string' && raw.excelPassword.length > 128) {
      return NextResponse.json({ error: '비밀번호는 최대 128자까지 저장할 수 있습니다.' }, { status: 400 });
    }
    patch.excelPassword = raw.excelPassword;
  }

  const endpointUrl = buildEndpointUrl(req);
  const repositories = getUserRepositories(session.userId);

  try {
    const status = repositories.financeAutomation.updateSettings(patch, endpointUrl);
    return NextResponse.json({ status });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('SESSION_SECRET')) {
      return NextResponse.json(
        { error: '서버 암호화 키(SESSION_SECRET) 설정을 확인해 주세요.' },
        { status: 500 },
      );
    }
    throw err;
  }
});
