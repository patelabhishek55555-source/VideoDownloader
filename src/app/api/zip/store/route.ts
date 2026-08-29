import { type NextRequest } from "next/server";

import { errorResponse, guard, json } from "@/lib/api/http";
import { getConfig } from "@/lib/config/env";
import { AppError } from "@/lib/errors";
import { getObjectStore } from "@/lib/storage/object-store";
import type { ZipRequestBody } from "@/lib/types";
import {
  archiveResponseStream,
  estimateArchiveSize,
  planArchiveEntries,
} from "@/lib/zip/archive";
import { defaultArchiveName, sanitiseArchiveName } from "@/lib/zip/filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Build a ZIP into temporary object storage and return a short-lived URL.
 *
 * This is the path for bulk jobs too large to finish inside a single function
 * invocation: the archive is streamed into the bucket rather than through the
 * response, and the signed URL expires after OBJECT_STORE_TTL_SECONDS so nothing
 * is retained.
 *
 * Requires OBJECT_STORE_* to be configured, and exact file sizes for every item —
 * without a known length an S3-compatible PUT cannot be signed for streaming, so
 * the caller is pointed back at /api/zip.
 */
export async function POST(request: NextRequest) {
  try {
    const config = getConfig();
    const store = getObjectStore();
    await guard({ scope: "zip-store", request, max: Math.max(4, Math.floor(config.rateLimit.max / 6)) });

    let body: ZipRequestBody;
    try {
      body = (await request.json()) as ZipRequestBody;
    } catch {
      throw new AppError("invalid_url", { message: "That request could not be read." });
    }

    const planned = planArchiveEntries(body?.items ?? []);
    const archiveName = sanitiseArchiveName(body?.archiveName || defaultArchiveName());
    const totalBytes = estimateArchiveSize(planned);

    if (totalBytes === null) {
      throw new AppError("unsupported", {
        message:
          "File sizes are unknown, so the archive can't be stored ahead of time. Use the direct ZIP download instead.",
      });
    }
    if (totalBytes > config.limits.maxZipSizeBytes) {
      throw new AppError("too_large", {
        message: "That selection is larger than the archive limit. Please download fewer files at once.",
      });
    }

    const key = store.objectKey(archiveName);
    const result = await store.put({
      key,
      contentType: "application/zip",
      contentLength: totalBytes,
      body: archiveResponseStream(planned, { maxTotalBytes: config.limits.maxZipSizeBytes }),
    });

    return json({
      ok: true,
      url: result.url,
      filename: archiveName,
      bytes: totalBytes,
      entries: planned.length,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    return errorResponse("api/zip/store", error);
  }
}
