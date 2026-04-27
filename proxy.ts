import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { unsealData } from 'iron-session';

interface SessionData {
  loggedIn?: boolean;
}

const COOKIE_NAME = 'binder_session';
const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: 'SESSION_SECRET env missing' }, { status: 500 });
  }

  const sealed = req.cookies.get(COOKIE_NAME)?.value;
  let loggedIn = false;
  if (sealed) {
    try {
      const session = await unsealData<SessionData>(sealed, { password: secret });
      loggedIn = !!session.loggedIn;
    } catch {
      loggedIn = false;
    }
  }

  if (!loggedIn) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // All paths except static assets, _next internals, favicon, manifest, service worker
    '/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|sw.js|workbox-.*\\.js|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp).*)',
  ],
};
