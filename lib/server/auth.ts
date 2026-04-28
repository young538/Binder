import 'server-only';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { getDb, schema } from './db/client';

export interface SessionData {
  loggedIn?: boolean;
  userId?: string;
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

export interface VerifiedCreds {
  userId: string;
  username: string;
}

export const verifyCredentials = async (
  username: string,
  password: string
): Promise<VerifiedCreds | null> => {
  if (!username || !password) return null;
  const db = getDb();
  const row = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .get();
  if (!row) return null;
  try {
    const ok = await argon2.verify(row.passwordHash, password);
    if (!ok) return null;
    return { userId: row.id, username: row.username };
  } catch {
    return null;
  }
};

export interface RequiredSession {
  userId: string;
  username: string;
}

export const requireSession = async (): Promise<RequiredSession> => {
  const session = await getSession();
  if (!session.loggedIn || !session.userId || !session.username) {
    throw new Response('Unauthorized', { status: 401 });
  }
  return { userId: session.userId, username: session.username };
};
