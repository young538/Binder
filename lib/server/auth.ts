import 'server-only';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import argon2 from 'argon2';

export interface SessionData {
  loggedIn?: boolean;
  username?: string;
}

const getSessionOptions = (): SessionOptions => {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      'SESSION_SECRET env var missing or too short (need ≥32 chars). Generate via: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return {
    password,
    cookieName: 'binder_session',
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    },
  };
};

export const getSession = async (): Promise<IronSession<SessionData>> => {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
};

export const verifyPassword = async (plain: string): Promise<boolean> => {
  const hash = process.env.APP_PASSWORD_HASH;
  const username = process.env.APP_USERNAME ?? 'admin';
  if (!hash) {
    throw new Error(
      'APP_PASSWORD_HASH env var missing. Generate via: node scripts/hash-password.mjs <your-password>'
    );
  }
  void username; // reserved for future multi-user
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
};

export const requireSession = async (): Promise<SessionData> => {
  const session = await getSession();
  if (!session.loggedIn) {
    throw new Response('Unauthorized', { status: 401 });
  }
  return session;
};
