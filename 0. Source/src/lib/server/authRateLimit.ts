import 'server-only';

export interface AuthRateLimitConfig {
  windowMs: number;
  maxPerKey: number;
  maxPerIp: number;
  maxBuckets?: number;
}

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

const DEFAULT_MAX_BUCKETS = 2048;

/** Extract client IP behind a single reverse proxy (Caddy sets/appends right-most hop). */
export function extractClientIp(req: Pick<Request, 'headers'>): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'local';
}

export function formatRetryAfter(seconds: number): string {
  if (seconds >= 60) {
    return `약 ${Math.ceil(seconds / 60)}분`;
  }
  return `${Math.max(1, Math.ceil(seconds))}초`;
}

/** Sliding-window in-memory failure limiter bounded by bucket eviction. */
export class AuthRateLimiter {
  private readonly perKey = new Map<string, number[]>();
  private readonly perIp = new Map<string, number[]>();
  private readonly maxBuckets: number;

  constructor(
    private readonly config: AuthRateLimitConfig,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.maxBuckets = config.maxBuckets ?? DEFAULT_MAX_BUCKETS;
  }

  private pruneBucket(map: Map<string, number[]>, bucketKey: string, currentMs: number): number[] {
    const existing = map.get(bucketKey);
    if (!existing || existing.length === 0) return [];
    const cutoff = currentMs - this.config.windowMs;
    const recent = existing.filter(ts => ts > cutoff);
    if (recent.length === 0) {
      map.delete(bucketKey);
      return [];
    }
    if (recent.length !== existing.length) {
      map.set(bucketKey, recent);
    }
    return recent;
  }

  private evictIfNeeded(map: Map<string, number[]>, currentMs: number): void {
    if (map.size < this.maxBuckets) return;
    const cutoff = currentMs - this.config.windowMs;
    for (const [k, list] of map.entries()) {
      const recent = list.filter(ts => ts > cutoff);
      if (recent.length === 0) {
        map.delete(k);
      } else {
        map.set(k, recent);
      }
    }
    while (map.size >= this.maxBuckets) {
      const oldestKey = map.keys().next().value;
      if (oldestKey === undefined) break;
      map.delete(oldestKey);
    }
  }

  private compositeKey(ip: string, key: string): string {
    return `${ip}:${key}`;
  }

  check(ip: string, key: string): RateLimitDecision {
    const currentMs = this.now();
    const keyBucket = this.pruneBucket(this.perKey, this.compositeKey(ip, key), currentMs);
    const ipBucket = this.pruneBucket(this.perIp, ip, currentMs);

    let blockingStart: number | null = null;
    if (keyBucket.length >= this.config.maxPerKey) {
      blockingStart = keyBucket[keyBucket.length - this.config.maxPerKey];
    }
    if (ipBucket.length >= this.config.maxPerIp) {
      const ipBlocking = ipBucket[ipBucket.length - this.config.maxPerIp];
      if (blockingStart === null || ipBlocking > blockingStart) {
        blockingStart = ipBlocking;
      }
    }

    if (blockingStart === null) {
      return { allowed: true };
    }

    const retryAfterMs = Math.max(1000, blockingStart + this.config.windowMs - currentMs);
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recordFailure(ip: string, key: string): void {
    const currentMs = this.now();
    const comp = this.compositeKey(ip, key);

    const keyBucket = this.pruneBucket(this.perKey, comp, currentMs);
    if (!this.perKey.has(comp)) this.evictIfNeeded(this.perKey, currentMs);
    keyBucket.push(currentMs);
    this.perKey.set(comp, keyBucket);

    const ipBucket = this.pruneBucket(this.perIp, ip, currentMs);
    if (!this.perIp.has(ip)) this.evictIfNeeded(this.perIp, currentMs);
    ipBucket.push(currentMs);
    this.perIp.set(ip, ipBucket);
  }

  recordSuccess(ip: string, key: string): void {
    this.perKey.delete(this.compositeKey(ip, key));
  }

  reset(): void {
    this.perKey.clear();
    this.perIp.clear();
  }
}

const globalForRateLimit = globalThis as unknown as {
  __binderLoginRateLimiter?: AuthRateLimiter;
  __binderPasswordChangeRateLimiter?: AuthRateLimiter;
};

export const loginRateLimiter =
  globalForRateLimit.__binderLoginRateLimiter ??
  (globalForRateLimit.__binderLoginRateLimiter = new AuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxPerKey: 5,
    maxPerIp: 20,
  }));

export const passwordChangeRateLimiter =
  globalForRateLimit.__binderPasswordChangeRateLimiter ??
  (globalForRateLimit.__binderPasswordChangeRateLimiter = new AuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxPerKey: 5,
    maxPerIp: 15,
  }));
