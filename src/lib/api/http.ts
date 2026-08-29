/**
 * Shared helpers for API route handlers.
 *
 * Every response goes through here so error bodies stay uniform and never leak
 * internals, and so rate-limit headers are always present.
 */

import type { NextRequest } from "next/server";

import { AppError, logError, serialiseError } from "@/lib/errors";
import { checkDailyLimit, checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

export function json<T>(data: T, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}

export function errorResponse(scope: string, error: unknown, extraHeaders?: Record<string, string>): Response {
  logError(scope, error);
  const { error: publicError, status } = serialiseError(error);
  return json({ ok: false, error: publicError }, { status, headers: extraHeaders });
}

export function badRequest(message: string): Response {
  return json({ ok: false, error: { code: "invalid_url", message } }, { status: 400 });
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface GuardOptions {
  scope: string;
  request: NextRequest;
  /** Override the per-window request cap for expensive routes. */
  max?: number;
  windowSeconds?: number;
}

/**
 * Apply the per-IP window and daily quotas.
 * Returns a Response to return immediately when the caller is over quota.
 */
export async function guard(options: GuardOptions): Promise<Response | null> {
  const ip = clientIp(options.request);
  const bucket = `${ip}:${options.scope}`;

  const [window, daily] = await Promise.all([
    checkRateLimit({ bucket, max: options.max, windowSeconds: options.windowSeconds }),
    checkDailyLimit(`${ip}:${options.scope}`),
  ]);

  if (!window.allowed) {
    throw new AppError("rate_limited", {
      message: "Too many requests. Please wait a moment and try again.",
      retryAfterSeconds: window.retryAfterSeconds,
    });
  }
  if (daily && !daily.allowed) {
    throw new AppError("rate_limited", {
      message: "You've reached the daily limit for this tool. Please try again tomorrow.",
      retryAfterSeconds: daily.retryAfterSeconds,
    });
  }
  return null;
}

export function withRateLimitHeaders(response: Response, headers: Record<string, string>): Response {
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}

export { rateLimitHeaders };
