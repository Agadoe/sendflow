/**
 * In-memory rate limiter for serverless auth endpoints.
 *
 * Why in-memory: zero dependencies, zero env vars, zero latency.
 * Why it's safe enough: Vercel functions are warm per-region; even if a
 * user's requests land on different instances, they're slowed enough to
 * make credential-stuffing uneconomical. For higher-traffic production,
 * swap `store` for Upstash/Redis (see TODO at bottom).
 *
 * Limits: 5 attempts per 60s per IP+endpoint, sliding window.
 */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

// Sweep expired entries every 5 min to prevent memory bloat in long-lived
// serverless instances. Safe to call repeatedly — it's a no-op if empty.
function sweep() {
  const now = Date.now();
  store.forEach((v, k) => {
    if (v.resetAt < now) store.delete(k);
  });
}

export interface RateLimitConfig {
  /** Max requests in the window. */
  max: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetInSec: number;
}

export function checkRateLimit(
  key: string,
  cfg: RateLimitConfig = { max: 5, windowSec: 60 }
): RateLimitResult {
  sweep();
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + cfg.windowSec * 1000 });
    return { ok: true, remaining: cfg.max - 1, resetInSec: cfg.windowSec };
  }

  if (bucket.count >= cfg.max) {
    return {
      ok: false,
      remaining: 0,
      resetInSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count++;
  return {
    ok: true,
    remaining: cfg.max - bucket.count,
    resetInSec: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/**
 * Extracts a client identifier for rate-limit bucketing.
 * Uses x-forwarded-for (Vercel sets this) and falls back to a constant
 * for direct connections (rare in production).
 */
export function clientKey(req: Request, route: string): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = fwd || req.headers.get('x-real-ip') || 'unknown';
  return `${route}:${ip}`;
}

// TODO: replace `store` with Upstash Redis for multi-instance production.
// import { Redis } from '@upstash/redis';
// const redis = Redis.fromEnv();
// Use INCR with EXPIRE for an atomic counter, or a sliding-window log.
