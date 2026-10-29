import { HttpClient } from '@/lib/client/HttpClient';

// PATCH: null explicitly clears a field; undefined is omitted by JSON.stringify.
export const http = new HttpClient(undefined, () => {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?next=${next}`;
  }
});
