/**
 * Browser-side API client.
 *
 * Every call funnels through `request` so a failure surfaces as an `ApiError`
 * carrying the server's stable error code and its already-friendly message —
 * the UI never has to interpret a stack trace or invent copy for an HTTP status.
 */

import type { Job, ResolvedMedia, ServiceStatus, ZipRequestBody } from "@/lib/types";

export class ApiError extends Error {
  readonly code: string;
  readonly retryAfterSeconds?: number;

  constructor(code: string, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface ErrorEnvelope {
  ok?: false;
  error?: { code?: string; message?: string; retryAfterSeconds?: number };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError("network", "We couldn't reach the server. Please check your connection and try again.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    let envelope: ErrorEnvelope = {};
    if (isJson) {
      try {
        envelope = (await response.json()) as ErrorEnvelope;
      } catch {
        envelope = {};
      }
    }
    const headerRetry = Number(response.headers.get("retry-after"));
    const retryAfter = envelope.error?.retryAfterSeconds ?? (Number.isFinite(headerRetry) ? headerRetry : undefined);
    throw new ApiError(
      envelope.error?.code ?? `http_${response.status}`,
      envelope.error?.message ?? "Something went wrong on our side. Please try again.",
      retryAfter,
    );
  }

  if (!isJson) {
    throw new ApiError("unexpected_response", "The server returned an unexpected response.");
  }

  return (await response.json()) as T;
}

export interface ResolveResponse {
  ok: true;
  media: ResolvedMedia;
}

export function resolveUrl(url: string, signal?: AbortSignal): Promise<ResolveResponse> {
  return request<ResolveResponse>("/api/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  });
}

export interface CreateJobResponse {
  ok: true;
  jobId: string;
  job: Job;
  duplicates: string[];
  invalid: { raw: string; message: string }[];
  truncated: boolean;
  storeKind: "memory" | "redis";
}

export function createJob(input: string): Promise<CreateJobResponse> {
  return request<CreateJobResponse>("/api/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input }),
  });
}

export function continueJob(jobId: string): Promise<{ ok: true; job: Job; storeKind: "memory" | "redis" }> {
  return request(`/api/jobs/${encodeURIComponent(jobId)}/continue`, { method: "POST" });
}

export function fetchJob(jobId: string): Promise<{ ok: true; job: Job; storeKind: "memory" | "redis" }> {
  return request(`/api/jobs/${encodeURIComponent(jobId)}`);
}

export function discardJob(jobId: string): Promise<{ ok: true }> {
  return request(`/api/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
}

export interface HealthResponse {
  ok: true;
  capabilities: ServiceStatus;
  limits: {
    maxBulkUrls: number;
    concurrency: number;
    maxZipEntries: number;
    maxFileSizeBytes: number;
    rateLimitMax: number;
    rateLimitWindowSeconds: number;
  };
}

export function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health");
}

/** Same-origin proxy URL for a resolved media file. */
export function downloadProxyUrl(url: string, token: string, filename: string): string {
  const params = new URLSearchParams({ url, token, name: filename });
  return `/api/download?${params.toString()}`;
}

export interface ZipStreamResult {
  blob: Blob;
  bytes: number;
}

export interface ZipProgressEvent {
  /** Bytes received so far. */
  received: number;
  /** Total bytes, when the server could determine them. */
  total?: number;
  /** Index of the entry currently being written, when sizes are known. */
  entryIndex?: number;
  /** Filename of the entry currently being written, when sizes are known. */
  entryName?: string;
}

/**
 * POST the archive request and consume the streamed ZIP, reporting progress.
 *
 * Entry boundaries are derived from the file sizes the client already knows, so
 * "adding 3 of 12" is accurate rather than a guess.
 */
export async function streamZipArchive(
  body: ZipRequestBody,
  options: {
    onProgress?: (event: ZipProgressEvent) => void;
    signal?: AbortSignal;
    entryOffsets?: Array<{ name: string; start: number; end: number }>;
    total?: number;
  } = {},
): Promise<ZipStreamResult> {
  let response: Response;
  try {
    response = await fetch("/api/zip", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch {
    throw new ApiError("network", "We couldn't reach the server. Please check your connection and try again.");
  }

  if (!response.ok) {
    let envelope: ErrorEnvelope = {};
    try {
      envelope = (await response.json()) as ErrorEnvelope;
    } catch {
      envelope = {};
    }
    throw new ApiError(
      envelope.error?.code ?? `http_${response.status}`,
      envelope.error?.message ?? "The archive couldn't be created. Please try again.",
    );
  }

  if (!response.body) {
    const blob = await response.blob();
    return { blob, bytes: blob.size };
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  const offsets = options.entryOffsets ?? [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;

      let entryIndex: number | undefined;
      let entryName: string | undefined;
      for (let i = 0; i < offsets.length; i += 1) {
        const offset = offsets[i]!;
        if (received >= offset.start) {
          entryIndex = i;
          entryName = offset.name;
        } else {
          break;
        }
      }

      options.onProgress?.({ received, total: options.total, entryIndex, entryName });
    }
  }

  const blob = new Blob(chunks, { type: "application/zip" });
  return { blob, bytes: received };
}

/** Build the ZIP in object storage and return the temporary URL, if configured. */
export function storeZipArchive(body: ZipRequestBody): Promise<{
  ok: true;
  url: string;
  filename: string;
  bytes: number;
  entries: number;
  expiresAt: number;
}> {
  return request("/api/zip/store", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
