import 'server-only';
import crypto from 'node:crypto';

export interface OAuthStatePayload {
  state: string;
  userId: string;
  returnTo: string;
  exp: number;
}

function deriveKey(secret?: string): Buffer {
  const raw = secret ?? process.env.SESSION_SECRET ?? '';
  if (raw.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters for Google token encryption');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptSecret(plainText: string, secret?: string): string {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(encoded: string, secret?: string): string {
  const parts = encoded.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted secret format');
  }
  const key = deriveKey(secret);
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const payload = Buffer.from(parts[3], 'base64url');
  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error('Malformed encrypted secret envelope');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
}

export function signOAuthState(payload: OAuthStatePayload, secret?: string): string {
  const key = deriveKey(secret);
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyOAuthState(raw: string, secret?: string): OAuthStatePayload | null {
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  try {
    const key = deriveKey(secret);
    const expected = crypto.createHmac('sha256', key).update(body).digest();
    const provided = Buffer.from(sig, 'base64url');
    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<OAuthStatePayload>;
    if (
      typeof parsed.state !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.returnTo !== 'string' ||
      typeof parsed.exp !== 'number' ||
      Date.now() > parsed.exp
    ) {
      return null;
    }
    return parsed as OAuthStatePayload;
  } catch {
    return null;
  }
}
