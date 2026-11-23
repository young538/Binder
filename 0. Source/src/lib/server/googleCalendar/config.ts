import 'server-only';

export interface GoogleOAuthConfig {
  configured: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const CALLBACK_PATH = '/api/integrations/google/callback';
export const OAUTH_STATE_COOKIE = 'binder_google_oauth';

export function getGoogleOAuthConfig(req?: Request): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '';
  const explicitRedirect = process.env.GOOGLE_REDIRECT_URI?.trim();

  let redirectUri: string;
  if (explicitRedirect) {
    redirectUri = explicitRedirect;
  } else {
    const origin = resolveAppOrigin(req);
    redirectUri = `${origin}${CALLBACK_PATH}`;
  }

  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function resolveAppOrigin(req?: Request): string {
  const publicOrigin = process.env.APP_PUBLIC_ORIGIN?.trim().replace(/\/+$/, '');
  if (publicOrigin) return publicOrigin;

  if (req) {
    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const host = forwardedHost || req.headers.get('host')?.split(',')[0]?.trim();
    if (host) {
      const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
      const proto =
        forwardedProto ||
        (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
      return `${proto}://${host}`;
    }
    try {
      return new URL(req.url).origin;
    } catch {
      // fall back to localhost below
    }
  }
  return 'http://localhost:3000';
}

export function sanitizeReturnTo(raw?: string | null): string {
  if (!raw) return '/settings';
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/settings';
  }
  return trimmed;
}
