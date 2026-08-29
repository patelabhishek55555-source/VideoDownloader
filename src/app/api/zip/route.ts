import { type NextRequest } from "next/server";

import { errorResponse, guard, json } from "@/lib/api/http";
import { getConfig } from "@/lib/config/env";
import { AppError } from "@/lib/errors";
import { contentDisposition } from "@/lib/validation/mime";
import { archiveResponseStream, planArchiveEntries } from "@/lib/zip/archive";
import { sanitiseArchiveName } from "@/lib/zip/filename";
import type { ZipRequestBody } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Build a ZIP and stream it straight to the browser.
 *
 * POST { items: [{ url, token, filename, fileSize }], archiveName }
 *   → application/zip (chunked)
 *
 * Memory stays flat regardless of archive size: each entry's upstream stream is
 * opened only when the writer reaches it and is piped into the response. For jobs
 * large enough to outlive a function invocation, use /api/zip/store instead.
 */
export async function POST(request: NextRequest) {
  try {
    const config = getConfig();
    await guard({ scope: "zip", request, max: Math.max(6, Math.floor(config.rateLimit.max / 4)) });

    let body: ZipRequestBody;
    try {
      body = (await request.json()) as ZipRequestBody;
    } catch {
      throw new AppError("invalid_url", { message: "That request could not be read." });
    }

    const planned = planArchiveEntries(body?.items ?? []);
    const archiveName = sanitiseArchiveName(body?.archiveName);

    // Reject an obviously oversized batch before committing to a response we
    // could not retract.
    const knownTotal = planned.reduce((sum, entry) => sum + (entry.fileSize ?? 0), 0);
    if (knownTotal > config.limits.maxZipSizeBytes) {
      throw new AppError("too_large", {
        message: "That selection is larger than the archive limit. Please download fewer files at once.",
      });
    }

    const stream = archiveResponseStream(planned, {
      maxTotalBytes: config.limits.maxZipSizeBytes,
    });

    return new Response(stream, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": contentDisposition(archiveName),
        "cache-control": "no-store, no-transform",
        "x-archive-entries": String(planned.length),
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse("api/zip", error);
  }
}

/** Health probe for the ZIP pipeline — confirms planning works without fetching anything. */
export async function GET() {
  return json({
    ok: true,
    endpoint: "zip",
    maxEntries: getConfig().limits.maxZipEntries,
    maxZipSizeBytes: getConfig().limits.maxZipSizeBytes,
  });
}
