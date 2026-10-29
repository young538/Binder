type Transport = typeof fetch;

/** Same-origin JSON transport with injectable network and authentication handling. */
export class HttpClient {
  constructor(
    private readonly transport: Transport = (...args) => fetch(...args),
    private readonly unauthorized: () => void = () => { },
  ) { }

  private async request<T>(method: string, url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    const init: RequestInit = { method, credentials: 'same-origin', ...(headers ? { headers } : {}) };
    if (body !== undefined) {
      init.headers = { ...headers, 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const response = await this.transport(url, init);
    if (response.status === 401) {
      this.unauthorized();
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      let message = `${method} ${url}: ${response.status}`;
      try {
        const json = await response.json();
        if (json?.error) message = `${method} ${url}: ${json.error}`;
      } catch { /* Preserve the HTTP status when the response is not JSON. */ }
      throw new Error(message);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  get = <T>(url: string) => this.request<T>('GET', url);
  post = <T>(url: string, body?: unknown, headers?: Record<string, string>) => this.request<T>('POST', url, body ?? {}, headers);
  put = <T>(url: string, body: unknown) => this.request<T>('PUT', url, body);
  patch = <T>(url: string, body: unknown) => this.request<T>('PATCH', url, body);
  del = <T = void>(url: string) => this.request<T>('DELETE', url);
}
