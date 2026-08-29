/**
 * Lazily constructed Upstash Redis (REST) client.
 *
 * Serverless functions have no shared memory, so anything that must survive
 * between invocations — bulk download jobs, rate-limit counters — lives here
 * when credentials are present. Without them we fall back to an in-process store
 * which is correct for local development and single-instance deployments.
 *
 * This module is server-only: it must never be imported from client code.
 */

import { Redis } from "@upstash/redis";

import { getConfig } from "@/lib/config/env";

let client: Redis | null = null;
let attempted = false;

export function getRedis(): Redis | null {
  if (attempted) return client;
  attempted = true;

  const { url, token } = getConfig().redis;
  if (!url || !token) return null;

  try {
    client = new Redis({ url, token });
  } catch (error) {
    console.error("[storage] failed to initialise Redis client", error);
    client = null;
  }

  return client;
}

export const REDIS_PREFIX = "vd:";

export function key(name: string): string {
  return `${REDIS_PREFIX}${name}`;
}
