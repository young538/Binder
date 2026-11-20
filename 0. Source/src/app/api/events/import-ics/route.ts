import dns from 'node:dns/promises';
import net from 'node:net';
import { NextResponse } from 'next/server';
import { parseIcsEvents } from '@/lib/ics';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';

const MAX_ICS_BYTES = 2 * 1024 * 1024;

function isPrivateIp(address: string): boolean {
  if (net.isIPv4(address)) {
    const parts = address.split('.').map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    return false;
  }
  const lower = address.toLowerCase();
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower.startsWith('::ffff:127.') || lower.startsWith('::ffff:10.') || lower.startsWith('::ffff:192.168.');
}

async function assertPublicHttpsUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error('HTTPS URL만 가져올 수 있습니다.');
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('로컬 또는 내부 주소는 허용되지 않습니다.');
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('사설 IP 주소는 허용되지 않습니다.');
    return parsed;
  }
  const records = await dns.lookup(host, { all: true });
  if (records.length === 0 || records.some(r => isPrivateIp(r.address))) {
    throw new Error('허용되지 않는 호스트 주소입니다.');
  }
  return parsed;
}

export const POST = authenticated(async (session, req: Request) => {
  const body = await readMutation(req, 'icsImport', session.userId);
  if (body instanceof Response) return body;

  let icsText = body.icsText?.trim() ?? '';
  if (!icsText && body.url) {
    try {
      const target = await assertPublicHttpsUrl(body.url.trim());
      const res = await fetch(target.toString(), {
        signal: AbortSignal.timeout(10000),
        redirect: 'manual',
      });
      if (res.status >= 300 && res.status < 400) {
        return NextResponse.json({ error: '리다이렉트 없는 직접 .ics URL을 입력해 주세요.' }, { status: 400 });
      }
      if (!res.ok) {
        return NextResponse.json({ error: `원격 캘린더를 불러오지 못했습니다 (${res.status}).` }, { status: 400 });
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_ICS_BYTES) {
        return NextResponse.json({ error: 'ICS 파일 크기가 2MB를 초과했습니다.' }, { status: 400 });
      }
      icsText = new TextDecoder().decode(buf);
    } catch (error) {
      const message = error instanceof Error ? error.message : '원격 캘린더를 불러오지 못했습니다.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const parsed = parseIcsEvents(icsText);
  if (parsed.length === 0) {
    return NextResponse.json({ error: '가져올 수 있는 VEVENT 일정이 없습니다.' }, { status: 400 });
  }

  const repositories = getUserRepositories(session.userId);
  const result = repositories.lifeEvents.importIcsEvents(parsed);
  return NextResponse.json(result);
});
