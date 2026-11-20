import 'server-only';
import type { GoogleCalendarEventResource, GoogleCalendarWriteBody } from '@/lib/googleCalendar';
import type { GoogleCalendarInfo } from '@/lib/types';

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresInSec: number;
}

const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class GoogleCalendarApiClient {
  constructor(private readonly fetchImpl: FetchLike = globalThis.fetch) {}

  buildAuthUrl(params: { clientId: string; redirectUri: string; state: string }): string {
    const query = new URLSearchParams({
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: params.state,
    });
    return `${OAUTH_AUTH_URL}?${query.toString()}`;
  }

  async exchangeCode(params: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
  }): Promise<TokenExchangeResult> {
    const body = new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    });
    return this.postToken(body);
  }

  async refreshAccessToken(params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }): Promise<TokenExchangeResult> {
    const body = new URLSearchParams({
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: 'refresh_token',
    });
    return this.postToken(body);
  }

  async getUserEmail(accessToken: string): Promise<string> {
    const data = await this.requestJson<{ email?: string }>(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.email?.trim() || 'google-user';
  }

  async listCalendars(accessToken: string): Promise<GoogleCalendarInfo[]> {
    const items: GoogleCalendarInfo[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < 5; page++) {
      const url = new URL(`${CALENDAR_API_BASE}/users/me/calendarList`);
      url.searchParams.set('minAccessRole', 'reader');
      url.searchParams.set('maxResults', '100');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const data = await this.requestJson<{
        items?: Array<{
          id?: string;
          summary?: string;
          summaryOverride?: string;
          backgroundColor?: string;
          primary?: boolean;
          accessRole?: string;
        }>;
        nextPageToken?: string;
      }>(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      for (const cal of data.items ?? []) {
        if (!cal.id) continue;
        items.push({
          id: cal.id,
          summary: cal.summaryOverride?.trim() || cal.summary?.trim() || cal.id,
          backgroundColor: cal.backgroundColor ?? null,
          primary: Boolean(cal.primary),
          accessRole: cal.accessRole ?? 'reader',
        });
      }

      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }

    return items;
  }

  async listEvents(
    accessToken: string,
    calendarId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<GoogleCalendarEventResource[]> {
    const events: GoogleCalendarEventResource[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < 10; page++) {
      const url = new URL(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`);
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('maxResults', '250');
      url.searchParams.set('showDeleted', 'false');
      url.searchParams.set('timeMin', timeMin);
      url.searchParams.set('timeMax', timeMax);
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const data = await this.requestJson<{
        items?: GoogleCalendarEventResource[];
        nextPageToken?: string;
      }>(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (Array.isArray(data.items)) {
        events.push(...data.items);
      }
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }

    return events;
  }

  async createEvent(
    accessToken: string,
    calendarId: string,
    body: GoogleCalendarWriteBody,
  ): Promise<{ id: string; updated: string | null }> {
    const data = await this.requestJson<{ id: string; updated?: string }>(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    return { id: data.id, updated: data.updated ?? null };
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    body: GoogleCalendarWriteBody,
  ): Promise<{ id: string; updated: string | null }> {
    const data = await this.requestJson<{ id: string; updated?: string }>(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    return { id: data.id, updated: data.updated ?? null };
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    const res = await this.fetchImpl(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(12000),
      },
    );
    if (res.status === 404 || res.status === 410 || res.ok) return;
    throw new GoogleApiError(`Google Calendar event delete failed (${res.status})`, res.status);
  }

  async revokeToken(token: string): Promise<void> {
    try {
      await this.fetchImpl(OAUTH_REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // Best-effort revocation only.
    }
  }

  private async postToken(body: URLSearchParams): Promise<TokenExchangeResult> {
    const data = await this.requestJson<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    }>(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!data.access_token) {
      throw new GoogleApiError('Google OAuth response did not contain access_token', 502);
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSec: typeof data.expires_in === 'number' ? data.expires_in : 3600,
    };
  }

  private async requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      let detail = '';
      try {
        const errBody = (await res.json()) as { error?: { message?: string } | string; error_description?: string };
        if (typeof errBody.error_description === 'string') detail = errBody.error_description;
        else if (typeof errBody.error === 'string') detail = errBody.error;
        else if (errBody.error && typeof errBody.error.message === 'string') detail = errBody.error.message;
      } catch {
        // ignore JSON parse error
      }
      throw new GoogleApiError(
        detail ? `Google API (${res.status}): ${detail}` : `Google API request failed (${res.status})`,
        res.status,
      );
    }
    return (await res.json()) as T;
  }
}
