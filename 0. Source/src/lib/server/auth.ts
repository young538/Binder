import 'server-only';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { getDb, schema } from './db/client';
import type { BinderDatabase } from './db/connection';

export const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

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
  } catch (err) {
    // 손상된 hash 또는 argon2 native 바인딩 문제 시 wrong-password 와 구별되게 로그
    console.error(`[auth] argon2.verify failed for username='${username}'`, err);
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

export type PasswordChangeResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export const changeUserPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
  database: BinderDatabase = getDb(),
): Promise<PasswordChangeResult> => {
  const row = await database
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();
  if (!row) {
    return { ok: false, error: '사용자를 찾을 수 없어요.', status: 404 };
  }

  let verified = false;
  try {
    verified = await argon2.verify(row.passwordHash, currentPassword);
  } catch (err) {
    console.error(`[auth] argon2.verify failed during password change for userId='${userId}'`, err);
    return { ok: false, error: '현재 비밀번호 확인에 실패했어요.', status: 400 };
  }

  if (!verified) {
    // 400 (not 401) so the authenticated client doesn't trigger a forced /login redirect.
    return { ok: false, error: '현재 비밀번호가 올바르지 않아요.', status: 400 };
  }

  const nextHash = await argon2.hash(newPassword, PASSWORD_HASH_OPTIONS);
  await database
    .update(schema.users)
    .set({
      passwordHash: nextHash,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.users.id, userId))
    .run();

  return { ok: true };
};
