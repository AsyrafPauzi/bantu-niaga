/**
 * Bantu Niaga — in-process rate limiter.
 *
 * Fixed-window counter keyed on `(bucket, identifier)`. Used to put a
 * cap on:
 *
 *   - Auth-adjacent mutations (forgot-password, sign-up, reset-password)
 *   - Outbound 3rd-party calls (Meta Graph publish + insights)
 *   - Cross-tenant platform-admin actions
 *
 * In-process means each Vercel function instance has its own counter.
 * That's a *floor*, not a ceiling — a hot tenant talking to N warm
 * instances could exceed the limit by ~Nx. For higher-stakes rate
 * limiting (e.g. anti-abuse on sign-up), wire an Upstash/Redis backend
 * by replacing `lookupBucket()` below.
 *
 * Returns `{ allowed: false, retryAfterSeconds }` when blocked so the
 * caller can hand it to `tooManyRequests()`.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

// Single per-process map. We trim oldest buckets when it grows past
// MAX_BUCKETS to bound memory under DDoS-style traffic.
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function lookupBucket(key: string, now: number, windowMs: number): Bucket {
  const existing = buckets.get(key);
  if (existing && existing.resetAt > now) return existing;
  const fresh: Bucket = { count: 0, resetAt: now + windowMs };
  buckets.set(key, fresh);

  if (buckets.size > MAX_BUCKETS) {
    // Drop ~25% oldest buckets. Maps preserve insertion order so the
    // first keys returned by .keys() are the oldest.
    let toDrop = Math.floor(MAX_BUCKETS / 4);
    for (const k of buckets.keys()) {
      if (toDrop-- <= 0) break;
      buckets.delete(k);
    }
  }
  return fresh;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the next request will succeed. */
  retryAfterSeconds: number;
  /** Remaining requests in the current window. 0 means the next call will be blocked. */
  remaining: number;
  /** Total limit for the bucket — useful for the `X-RateLimit-Limit` header. */
  limit: number;
}

export interface RateLimitOptions {
  /** Logical bucket name (e.g. "social.publish"). */
  bucket: string;
  /** Caller identifier — e.g. `user:<uid>` or `ip:<addr>`. */
  identifier: string;
  /** Maximum hits permitted within `windowMs`. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Increment and check. Always call this once per logical request — it
 * mutates the bucket on success.
 */
export function consume(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const key = `${opts.bucket}:${opts.identifier}`;
  const b = lookupBucket(key, now, opts.windowMs);
  b.count += 1;

  if (b.count > opts.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
      remaining: 0,
      limit: opts.limit,
    };
  }
  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, opts.limit - b.count),
    limit: opts.limit,
  };
}

/**
 * Standard `X-RateLimit-*` headers to attach to every response (success
 * or 429) so well-behaved clients can self-throttle.
 */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
  };
}

/**
 * Pull a best-effort client identifier from request headers. Falls back
 * to "anon" — the caller should prepend the userId when one is available
 * to avoid lumping every authenticated request into the same bucket.
 *
 * Notes:
 *   - We trust `x-forwarded-for` because the app is deployed behind
 *     Vercel which sets it from the real edge. Self-hosted setups MUST
 *     verify their reverse proxy strips client-supplied XFF first.
 */
export function clientIdentifierFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return `ip:${xff.split(",")[0].trim()}`;
  const real = headers.get("x-real-ip");
  if (real) return `ip:${real}`;
  return "ip:anon";
}
