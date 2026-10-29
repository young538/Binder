import 'server-only';
import { requireSession, type RequiredSession } from './auth';

/** Authenticate once and preserve real server failures instead of returning them as responses. */
export function authenticated<Args extends unknown[]>(
  handler: (session: RequiredSession, ...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      const session = await requireSession();
      return await handler(session, ...args);
    } catch (error) {
      if (error instanceof Response) return error;
      throw error;
    }
  };
}
