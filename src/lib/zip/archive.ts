/**
 * Turning a ZIP request into a stream of archive entries.
 *
 * Entries are opened lazily — the fetch for entry N happens when the writer asks
 * for it — so the function holds at most one media stream open at a time and
 * memory stays flat no matter how many files are in the archive.
 */

import { AppError } from "@/lib/errors";
import { getConfig } from "@/lib/config/env";
import { safeFetch } from "@/lib/security/http";
import { assertAllowedHost, assertPublicTarget } from "@/lib/security/ssrf";
import { verifyUrlToken } from "@/lib/security/tokens";
import type { ZipRequestItem } from "@/lib/types";
import { extFromUrl, sanitiseFilename, uniqueFileNames } from "./filename";
import { streamZip, toAsyncIterable, type ZipEntryInput } from "./zip-writer";

export {
  END_OF_CENTRAL_DIRECTORY_SIZE,
  centralHeaderSize,
  entryOverhead,
  entryOffsets,
  estimateArchiveSize,
  localHeaderSize,
} from "./size";

export interface PlannedEntry {
  url: string;
  token: string;
  filename: string;
  fileSize?: number;
}

/**
 * Validate a ZIP request and produce safe, de-duplicated entry names.
 *
 * The signed token is the authorisation: it proves the URL was handed out by our
 * own resolver, so this endpoint can never be pointed at an arbitrary address.
 * An optional host allowlist can be layered on top with MEDIA_HOST_ALLOWLIST.
 */
export function planArchiveEntries(items: ZipRequestItem[]): PlannedEntry[] {
  const config = getConfig();

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("invalid_url", { message: "Add at least one file to the archive." });
  }
  if (items.length > config.limits.maxZipEntries) {
    throw new AppError("too_large", {
      message: `An archive can hold at most ${config.limits.maxZipEntries} files. Please split the selection.`,
    });
  }

  const allowlist = config.security.mediaHostAllowlist;
  const planned: PlannedEntry[] = [];

  for (const item of items) {
    if (typeof item?.url !== "string" || !/^https?:\/\//i.test(item.url)) {
      throw new AppError("invalid_url", { message: "One of the files has an invalid address." });
    }

    const verification = verifyUrlToken(item.url, item.token);
    if (!verification.ok) {
      throw new AppError("blocked", {
        message:
          verification.reason === "expired"
            ? "These download links have expired. Please process the links again."
            : "This link can't be fetched for safety reasons.",
      });
    }

    assertAllowedHost(item.url, { allowedSuffixes: allowlist });

    const ext = extFromUrl(item.url);
    // Callers (including our own client) may already send a name with its
    // extension; strip it so sanitising does not fold ".mp4" into the basename.
    const stripped = (item.filename ?? "").replace(/\.[a-z0-9]{2,5}$/i, "");
    const filename = sanitiseFilename(stripped, { fallback: `video-${planned.length + 1}`, ext });
    planned.push({
      url: item.url,
      token: item.token,
      filename,
      fileSize: Number.isFinite(item.fileSize) ? item.fileSize : undefined,
    });
  }

  const names = uniqueFileNames(planned.map((entry) => entry.filename));
  return planned.map((entry, index) => ({ ...entry, filename: names[index]! }));
}

export interface BuildEntriesOptions {
  signal?: AbortSignal;
  /** Called with the response headers for each entry as it opens. */
  onEntryOpened?: (filename: string, contentType?: string) => void;
}

/** Lazily-opening entry sources for the ZIP writer. */
export function buildArchiveEntries(
  entries: PlannedEntry[],
  options: BuildEntriesOptions = {},
): ZipEntryInput[] {
  const config = getConfig();

  return entries.map((entry) => ({
    filename: entry.filename,
    data: async () => {
      await assertPublicTarget(entry.url, {
        allowedSuffixes: getConfig().security.mediaHostAllowlist,
      });

      const response = await safeFetch(entry.url, {
        timeoutMs: 120_000,
        signal: options.signal,
        allowPrivateForTest: false,
      });

      if (!response.ok || !response.body) {
        throw new AppError("provider_error", {
          message: `We couldn't fetch ${entry.filename} for the archive.`,
          detail: `upstream ${response.status}`,
        });
      }

      options.onEntryOpened?.(entry.filename, response.headers.get("content-type") ?? undefined);

      const limit = entry.fileSize
        ? Math.max(entry.fileSize, 1) + 1024 * 1024
        : config.limits.maxFileSizeBytes;

      return toAsyncIterable(limitBody(response.body, limit));
    },
  }));
}

/** Guard against an upstream sending more than it advertised. */
function limitBody(body: ReadableStream<Uint8Array>, maxBytes: number): ReadableStream<Uint8Array> {
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

/**
 * Adapt the ZIP writer's async generator to a Response body stream.
 *
 * Nothing is buffered: the response starts as soon as the first local file
 * header is written, and each media stream is consumed as it arrives.
 */
export function archiveResponseStream(
  entries: PlannedEntry[],
  options: BuildEntriesOptions & { maxTotalBytes?: number } = {},
): ReadableStream<Uint8Array> {
  const iterator = streamZip(buildArchiveEntries(entries, options), {
    signal: options.signal,
    maxTotalBytes: options.maxTotalBytes,
  })[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await iterator.return?.(reason);
    },
  });
}
