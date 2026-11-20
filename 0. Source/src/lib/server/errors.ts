/** Expected domain failures that can safely be shown at an HTTP boundary. */
export class DomainError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 | 410) {
    super(message);
  }
}
