/**
 * Minimal AWS Signature Version 4 implementation.
 *
 * Only what the optional temporary object store needs: signed requests and
 * presigned URLs for S3-compatible services. Implemented directly on
 * `node:crypto` so the app does not carry the full AWS SDK for one feature.
 */

import { createHash, createHmac } from "node:crypto";

export const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional for providers that do not use session tokens. */
  sessionToken?: string;
}

export interface SigV4Target {
  region: string;
  service: string;
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/** RFC 3986 encoding, matching AWS's rules (space as %20, `~` unescaped). */
export function uriEncode(value: string, encodeSlash = true): string {
  let out = "";
  for (const char of value) {
    if (
      (char >= "A" && char <= "Z") ||
      (char >= "a" && char <= "z") ||
      (char >= "0" && char <= "9") ||
      char === "-" ||
      char === "_" ||
      char === "." ||
      char === "~"
    ) {
      out += char;
    } else if (char === "/" && !encodeSlash) {
      out += char;
    } else {
      for (const byte of Buffer.from(char, "utf8")) {
        out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
      }
    }
  }
  return out;
}

function amzDateParts(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

export function signingKey(secretAccessKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

export interface CanonicalRequestInput {
  method: string;
  path: string;
  query?: Record<string, string>;
  headers: Record<string, string>;
  payloadHash: string;
}

export interface CanonicalRequestResult {
  canonicalRequest: string;
  signedHeaders: string;
}

export function canonicalRequest(input: CanonicalRequestInput): CanonicalRequestResult {
  const canonicalUri = input.path === "" ? "/" : input.path;

  const canonicalQueryString = Object.keys(input.query ?? {})
    .sort()
    .map((key) => `${uriEncode(key)}=${uriEncode(input.query![key]!)}`)
    .join("&");

  const headerEntries = Object.entries(input.headers)
    .map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, " ")] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const canonicalHeaders = headerEntries.map(([name, value]) => `${name}:${value}\n`).join("");
  const signedHeaders = headerEntries.map(([name]) => name).join(";");

  return {
    canonicalRequest: [
      input.method.toUpperCase(),
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      input.payloadHash,
    ].join("\n"),
    signedHeaders,
  };
}

export interface SignRequestInput extends SigV4Credentials, SigV4Target, CanonicalRequestInput {
  date?: Date;
  /**
   * S3 requires an `x-amz-content-sha256` header. Other services do not, and the
   * official SigV4 test vectors omit it, so it can be suppressed.
   */
  includeContentShaHeader?: boolean;
}

export interface SignedRequest {
  headers: Record<string, string>;
  authorization: string;
  signedHeaders: string;
  stringToSign: string;
  signature: string;
}

export function signRequest(input: SignRequestInput): SignedRequest {
  const date = input.date ?? new Date();
  const { amzDate, dateStamp } = amzDateParts(date);
  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;

  const headers: Record<string, string> = { ...input.headers };
  headers["x-amz-date"] = amzDate;
  if (input.sessionToken) headers["x-amz-security-token"] = input.sessionToken;

  const includeContentSha = input.includeContentShaHeader ?? true;
  const hasContentSha = Object.keys(headers).some((name) => name.toLowerCase() === "x-amz-content-sha256");
  if (includeContentSha && !hasContentSha) {
    headers["x-amz-content-sha256"] = input.payloadHash;
  }

  const canonical = canonicalRequest({ ...input, headers });
  const signedHeaders = canonical.signedHeaders;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonical.canonicalRequest),
  ].join("\n");

  const signature = createHmac("sha256", signingKey(input.secretAccessKey, dateStamp, input.region, input.service))
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { headers, authorization, signedHeaders, stringToSign, signature };
}

export interface PresignInput extends SigV4Credentials, SigV4Target {
  method?: string;
  host: string;
  path: string;
  query?: Record<string, string>;
  expiresInSeconds?: number;
  date?: Date;
}

/** Build a presigned URL valid for `expiresInSeconds`. */
export function presignUrl(input: PresignInput): string {
  const date = input.date ?? new Date();
  const { amzDate, dateStamp } = amzDateParts(date);
  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const expiresInSeconds = input.expiresInSeconds ?? 900;

  const query: Record<string, string> = {
    ...(input.query ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${input.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  };
  if (input.sessionToken) query["X-Amz-Security-Token"] = input.sessionToken;

  const canonical = canonicalRequest({
    method: input.method ?? "GET",
    path: input.path,
    query,
    headers: { host: input.host },
    payloadHash: UNSIGNED_PAYLOAD,
  });

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonical.canonicalRequest),
  ].join("\n");

  const signature = createHmac("sha256", signingKey(input.secretAccessKey, dateStamp, input.region, input.service))
    .update(stringToSign, "utf8")
    .digest("hex");

  const search = new URLSearchParams(query);
  search.append("X-Amz-Signature", signature);
  return `https://${input.host}${input.path === "" ? "/" : input.path}?${search.toString()}`;
}
