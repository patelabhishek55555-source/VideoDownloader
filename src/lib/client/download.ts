/**
 * Browser-side file saving.
 *
 * Two paths:
 *  - proxied fetch → Blob → object URL. Gives real byte-level progress and the
 *    exact filename we chose, at the cost of holding one file in memory.
 *  - direct navigation to the proxy URL. Used above `BLOB_BYTE_LIMIT` so a huge
 *    file is streamed by the browser instead of buffered by the page.
 *
 * Both go through `/api/download`, which only serves URLs our own resolver
 * signed, so the page never asks a third-party CDN for a cross-origin file.
 */

import { downloadProxyUrl } from "./api";
import { extFromUrl, sanitiseFilename, uniqueFileNames } from "@/lib/zip/filename";
import type { MediaFormat, ResolvedMedia } from "@/lib/types";

/** Above this size the page navigates instead of buffering a Blob. */
export const BLOB_BYTE_LIMIT = 200 * 1024 * 1024;

export function titleForMedia(media: ResolvedMedia | undefined, url: string): string {
  if (media?.title && media.title.trim().length > 0) return media.title.trim();
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (path) return decodeURIComponent(path);
  } catch {
    /* fall through */
  }
  return "video";
}

/** Filename for one item, including the extension of the chosen rendition. */
export function buildFileName(
  media: ResolvedMedia | undefined,
  format: MediaFormat,
  url: string,
  index?: number,
): string {
  const ext = format.ext || extFromUrl(format.url);
  const fallback = index === undefined ? "video" : `video-${String(index + 1).padStart(2, "0")}`;
  return sanitiseFilename(titleForMedia(media, url), { fallback, ext });
}

/** Sanitise + de-duplicate a whole batch of names, matching the server's rules. */
export function buildFileNames(
  items: Array<{ media?: ResolvedMedia; format: MediaFormat; url: string }>,
): string[] {
  return uniqueFileNames(
    items.map((item, index) =>
      buildFileName(item.media, item.format, item.url, index),
    ),
  );
}

export function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the transfer before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export function saveFromUrl(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.target = "_blank";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export interface DownloadProgress {
  received: number;
  total?: number;
}

export interface DownloadFileOptions {
  url: string;
  token: string;
  filename: string;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}

export interface DownloadFileResult {
  mode: "blob" | "direct";
  bytes?: number;
}

/** Download one file, reporting progress when the size allows it. */
export async function downloadFile(options: DownloadFileOptions): Promise<DownloadFileResult> {
  const proxyUrl = downloadProxyUrl(options.url, options.token, options.filename);

  let response: Response;
  try {
    response = await fetch(proxyUrl, { signal: options.signal });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new Error("We couldn't start that download. Please try again.");
  }

  if (!response.ok) {
    let message = "We couldn't fetch that file. Please try again.";
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      if (payload.error?.message) message = payload.error.message;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }

  const totalHeader = response.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) : undefined;
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";

  if (!response.body || (total && total > BLOB_BYTE_LIMIT)) {
    saveFromUrl(proxyUrl, options.filename);
    return { mode: "direct" };
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      options.onProgress?.({ received, total });
    }
  }

  saveBlob(new Blob(chunks, { type: contentType }), options.filename);
  return { mode: "blob", bytes: received };
}

/** Small stagger so "download all" never fires every request in the same tick. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `task` over `items` with at most `concurrency` in flight.
 * Yields each result as it settles so callers can update the UI immediately.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
  options: { signal?: AbortSignal } = {},
): Promise<Array<{ index: number; result?: R; error?: unknown }>> {
  const results: Array<{ index: number; result?: R; error?: unknown }> = [];
  let cursor = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (options.signal?.aborted) return;
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) return;
      try {
        const result = await task(item, index);
        results.push({ index, result });
      } catch (error) {
        results.push({ index, error });
      }
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}
