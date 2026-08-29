/**
 * Bulk download job persistence.
 *
 * Two adapters implement the same interface:
 *  - MemoryJobStore  — in-process Map with TTL expiry (local dev, single node)
 *  - RedisJobStore   — Upstash Redis with native TTL (serverless, multi-instance)
 *
 * `getJobStore()` picks one from configuration. Callers must treat a missing job
 * as a normal outcome: on a multi-instance deployment without Redis a job created
 * on one instance is invisible to another, and the client falls back to resolving
 * the remaining links directly.
 */

import { getConfig } from "@/lib/config/env";
import type { Job } from "@/lib/types";
import { getRedis, key } from "./redis-client";

export interface JobStore {
  readonly kind: "memory" | "redis";
  get(id: string): Promise<Job | null>;
  set(job: Job, ttlSeconds?: number): Promise<void>;
  delete(id: string): Promise<void>;
}

interface MemoryEntry {
  job: Job;
  expiresAt: number;
}

export class MemoryJobStore implements JobStore {
  readonly kind = "memory" as const;
  private readonly entries = new Map<string, MemoryEntry>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlSeconds: number) {
    this.defaultTtlMs = defaultTtlSeconds * 1000;
  }

  async get(id: string): Promise<Job | null> {
    this.sweep();
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(id);
      return null;
    }
    return entry.job;
  }

  async set(job: Job, ttlSeconds?: number): Promise<void> {
    const ttlMs = (ttlSeconds ?? this.defaultTtlMs / 1000) * 1000;
    this.entries.set(job.id, { job, expiresAt: Date.now() + ttlMs });
    this.sweep();
  }

  async delete(id: string): Promise<void> {
    this.entries.delete(id);
  }

  /** Drop expired entries so an idle dev server does not grow without bound. */
  private sweep(): void {
    if (this.entries.size < 64) return;
    const now = Date.now();
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt < now) this.entries.delete(id);
    }
  }
}

export class RedisJobStore implements JobStore {
  readonly kind = "redis" as const;

  async get(id: string): Promise<Job | null> {
    const redis = getRedis();
    if (!redis) return null;
    try {
      const raw = await redis.get<string>(key(`job:${id}`));
      if (!raw) return null;
      return JSON.parse(raw) as Job;
    } catch (error) {
      console.warn("[storage] job read failed", error);
      return null;
    }
  }

  async set(job: Job, ttlSeconds?: number): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
      await redis.set(key(`job:${job.id}`), JSON.stringify(job), {
        ex: ttlSeconds ?? getConfig().limits.jobTtlSeconds,
      });
    } catch (error) {
      console.warn("[storage] job write failed", error);
    }
  }

  async delete(id: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
      await redis.del(key(`job:${id}`));
    } catch (error) {
      console.warn("[storage] job delete failed", error);
    }
  }
}

let store: JobStore | null = null;

export function getJobStore(): JobStore {
  if (store) return store;
  const config = getConfig();
  store = config.redis.configured
    ? new RedisJobStore()
    : new MemoryJobStore(config.limits.jobTtlSeconds);
  return store;
}

/** Test hook. */
export function resetJobStore(): void {
  store = null;
}
