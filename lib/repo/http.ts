import { HttpClient } from '@/lib/client/HttpClient';

// PATCH: null explicitly clears a field; undefined is omitted by JSON.stringify.
export const http = new HttpClient(undefined, () => {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    // A 401 must discard all in-memory user data. This transport runs outside React.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${next}`;
  }
});
