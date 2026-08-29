/**
 * HTTP helpers with the safety rails every outbound request must go through:
 * host validation, timeouts, redirect re-validation, response size caps and a
 * realistic browser-like header set (many CDNs reject the default Node UA).
 */

import { AppError } from "@/lib/errors";
import { assertAllowedHost, assertPublicTarget, type HostCheckOptions } from "./ssrf";

export const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
};

export interface SafeFetchOptions extends HostCheckOptions {
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  method?: "GET" | "POST" | "HEAD";
  body?: string;
  /** Skip the DNS public-range check (used for the configured provider API). */
  skipPublicCheck?: boolean;
  /**
   * The target is an operator-configured endpoint (e.g. a self-hosted resolver on
   * any port). Skip all host checks and fetch it directly — the operator chose it.
   */
  trusted?: boolean;
  cache?: RequestCache;
}

export function combineSignals(signals: Array<AbortSignal | undefined>): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      controller.abort(signal.reason);
      continue;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

export function timeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

/**
 * Fetch a URL after validating it. Redirects are followed by the runtime, so the
 * final URL is validated as well once the response arrives.
 */
export async function safeFetch(url: string | URL, options: SafeFetchOptions = {}): Promise<Response> {
  const {
    timeoutMs = 15000,
    headers,
    signal,
    method = "GET",
    body,
    skipPublicCheck = false,
    trusted = false,
    allowPrivateForTest = false,
    allowedSuffixes,
    cache,
  } = options;

  if (!trusted) {
    if (skipPublicCheck) {
      assertAllowedHost(url, { allowedSuffixes, allowPrivateForTest });
    } else {
      await assertPublicTarget(url, { allowedSuffixes, allowPrivateForTest });
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      body,
      headers: { ...BROWSER_HEADERS, ...headers },
      redirect: "follow",
      signal: combineSignals([timeoutSignal(timeoutMs), signal]),
      cache,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AppError("timeout", { message: "The site took too long to respond. Please try again." });
    }
    throw new AppError("provider_error", {
      message: "We couldn't reach that site right now. Please try again.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  if (!trusted && !skipPublicCheck && response.url) {
    // A redirect could have landed somewhere the original host did not.
    try {
      await assertPublicTarget(response.url, { allowedSuffixes, allowPrivateForTest });
    } catch {
      throw new AppError("blocked", { message: "This link can't be fetched for safety reasons." });
    }
  }

  return response;
}

/** Read at most `maxBytes` from a response body and decode it as text. */
export async function readTextCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        chunks.push(value.slice(0, Math.max(0, maxBytes - (total - value.byteLength))));
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export interface JsonFetchOptions extends SafeFetchOptions {
  /** Shape validation is the caller's responsibility; this only guards parsing. */
  maxBytes?: number;
}

export async function fetchJson<T = unknown>(url: string, options: JsonFetchOptions = {}): Promise<T> {
  const { maxBytes = 2 * 1024 * 1024, ...rest } = options;
  const response = await safeFetch(url, rest);
  if (!response.ok) {
    throw new AppError(response.status === 404 ? "not_found" : "provider_error", {
      message:
        response.status === 404
          ? "We couldn't find any media at that link."
          : "We couldn't process this link right now. Please try again.",
      detail: `upstream ${response.status} from ${new URL(url).hostname}`,
    });
  }
  const text = await readTextCapped(response, maxBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppError("provider_error", {
      message: "We couldn't process this link right now. Please try again.",
      detail: "upstream returned invalid JSON",
    });
  }
}

/** Wrap a response body in a stream that aborts past `maxBytes`. */
export function cappedBodyStream(body: ReadableStream<Uint8Array>, maxBytes: number): ReadableStream<Uint8Array> {
  let seen = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      reader ??= body.getReader();
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      seen += value.byteLength;
      if (seen > maxBytes) {
        controller.error(new AppError("too_large"));
        await reader.cancel().catch(() => undefined);
        return;
      }
      controller.enqueue(value);
    },
    async cancel(reason) {
      await (reader ? reader.cancel(reason) : body.cancel(reason)).catch(() => undefined);
    },
  });
}

/** Content-Length when the upstream reported a usable one. */
export function contentLengthOf(response: Response): number | undefined {
  const raw = response.headers.get("content-length");
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
