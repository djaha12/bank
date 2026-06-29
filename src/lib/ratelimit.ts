/**
 * In-memory fixed-window rate limiter. Per-process only — adequate for the
 * sandbox / single instance. Swap `RateLimiter` for a Redis-backed
 * implementation behind the same interface for multi-instance production.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const DEFAULT_WINDOW = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const DEFAULT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 100);

export function rateLimit(
  key: string,
  options: { max?: number; windowMs?: number } = {},
): RateLimitResult {
  const max = options.max ?? DEFAULT_MAX;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, limit: max, resetAt };
  }

  bucket.count += 1;
  const remaining = Math.max(0, max - bucket.count);
  return { ok: bucket.count <= max, remaining, limit: max, resetAt: bucket.resetAt };
}

// Opportunistic cleanup so the map does not grow unbounded.
let lastSweep = 0;
export function sweepRateLimiter(now = Date.now()) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Tighter limits for sensitive endpoints. */
export const RATE_LIMITS = {
  auth: { max: 10, windowMs: 60_000 },
  otp: { max: 5, windowMs: 60_000 },
  money: { max: 30, windowMs: 60_000 },
  ai: { max: 20, windowMs: 60_000 },
  default: { max: DEFAULT_MAX, windowMs: DEFAULT_WINDOW },
};
