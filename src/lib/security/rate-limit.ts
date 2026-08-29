/**
 * Per-IP request limiting for the expensive endpoints.
 *
 * A short window protects the resolver from bursts; a daily window stops a single
 * address from consuming the whole quota. Both are configurable through
 * environment variables and both degrade to an in-process counter when Redis is
 * not configured.
 */

import { getConfig } from "@/lib/config/env";
import { getRedis, key } from "@/lib/storage/redis-client";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

interface MemoryBucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, MemoryBucket>();

function memoryIncrement(bucketKey: string, windowSeconds: number): MemoryBucket {
  const now = Date.now();
  const existing = memoryBuckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowSeconds * 1000 };
    memoryBuckets.set(bucketKey, fresh);
    if (memoryBuckets.size > 5000) {
      for (const [k, v] of memoryBuckets) if (v.resetAt <= now) memoryBuckets.delete(k);
    }
    return fresh;
  }
  existing.count += 1;
  return existing;
}

async function increment(bucketKey: string, windowSeconds: number): Promise<MemoryBucket> {
  const redis = getRedis();
  if (!redis) return memoryIncrement(bucketKey, windowSeconds);

  try {
    const redisKey = key(`rl:${bucketKey}`);
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds);
    const ttl = await redis.ttl(redisKey);
    return { count, resetAt: Date.now() + Math.max(1, ttl) * 1000 };
  } catch (error) {
    // Fail open rather than blocking every user because Redis is unreachable.
    console.warn("[security] rate limit store unavailable, using in-process counter", error);
    return memoryIncrement(bucketKey, windowSeconds);
  }
}

export interface RateLimitOptions {
  /** Bucket name, typically the caller IP plus the route being protected. */
  bucket: string;
  max?: number;
  windowSeconds?: number;
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const config = getConfig();
  const max = options.max ?? config.rateLimit.max;
  const windowSeconds = options.windowSeconds ?? config.rateLimit.windowSeconds;

  const { count, resetAt } = await increment(options.bucket, windowSeconds);
  const allowed = count <= max;

  return {
    allowed,
    limit: max,
    remaining: Math.max(0, max - count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
    resetAt,
  };
}

/** Secondary daily quota. Returns `null` when no daily cap is configured. */
export async function checkDailyLimit(bucket: string): Promise<RateLimitResult | null> {
  const config = getConfig();
  if (!config.rateLimit.maxPerDay) return null;
  return checkRateLimit({
    bucket: `${bucket}:day:${new Date().toISOString().slice(0, 10)}`,
    max: config.rateLimit.maxPerDay,
    windowSeconds: 86_400,
  });
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };
  if (!result.allowed) headers["Retry-After"] = String(result.retryAfterSeconds);
  return headers;
}

/** Reset the in-process buckets. Test hook only. */
export function resetRateLimitMemory(): void {
  memoryBuckets.clear();
}
