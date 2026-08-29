/**
 * Short-lived HMAC tokens that bind a media URL to this service.
 *
 * The download and ZIP endpoints only fetch URLs that carry a valid token, which
 * proves the URL was produced by our own resolver. Without that, those endpoints
 * would be an open proxy to anywhere on the internet.
 *
 * Set TOKEN_SECRET in production. Without it an ephemeral per-instance secret is
 * generated, so signatures will not validate across serverless instances — the
 * config status surfaces this as `signedTokens: "ephemeral"`.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getConfig } from "@/lib/config/env";
import { AppError } from "@/lib/errors";

let ephemeralSecret: string | null = null;

function secret(): string {
  const configured = getConfig().token.secret;
  if (configured) return configured;
  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32).toString("base64url");
    console.warn(
      "[security] TOKEN_SECRET is not set — using an ephemeral per-instance signing key. " +
        "Set TOKEN_SECRET so signed download links survive across serverless instances.",
    );
  }
  return ephemeralSecret;
}

function mac(message: string): string {
  return createHmac("sha256", secret()).update(message).digest("base64url");
}

export interface SignedUrl {
  url: string;
  token: string;
}

/** Sign a URL. The returned token embeds its own expiry. */
export function signUrl(url: string, ttlSeconds?: number): SignedUrl {
  const ttl = ttlSeconds ?? getConfig().token.ttlSeconds;
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const signature = mac(`${expiresAt}:${url}`);
  return { url, token: `${expiresAt}.${signature}` };
}

export interface VerifyResult {
  ok: boolean;
  reason?: "malformed" | "expired" | "mismatch";
}

export function verifyUrlToken(url: string, token: string | undefined | null): VerifyResult {
  if (!token) return { ok: false, reason: "malformed" };

  const dot = token.indexOf(".");
  if (dot <= 0) return { ok: false, reason: "malformed" };

  const expiresRaw = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt)) return { ok: false, reason: "malformed" };

  if (expiresAt < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };

  const expected = mac(`${expiresAt}:${url}`);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "mismatch" };

  return { ok: true };
}

/** Convenience guard used by the proxy endpoints. */
export function assertValidSignedUrl(url: string, token: string | undefined | null): void {
  const result = verifyUrlToken(url, token);
  if (result.ok) return;
  throw new AppError("blocked", {
    message:
      result.reason === "expired"
        ? "This download link has expired. Please process the link again."
        : "This link can't be fetched for safety reasons.",
  });
}
