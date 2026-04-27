// Minimal fetch wrapper for same-origin JSON APIs.
const request = async <T>(
  method: string,
  url: string,
  body?: unknown
): Promise<T> => {
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
  };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (res.status === 401) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    let msg = `${method} ${url}: ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = `${method} ${url}: ${j.error}`;
    } catch { /* not json */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
};

export const http = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body: unknown) => request<T>('PUT', url, body),
  patch: <T>(url: string, body: unknown) => request<T>('PATCH', url, body),
  del: <T = void>(url: string) => request<T>('DELETE', url),
};
