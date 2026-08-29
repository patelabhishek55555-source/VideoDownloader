import { NextResponse } from "next/server";

import { getConfig } from "@/lib/config/env";
import { getJobStore } from "@/lib/storage/job-store";
import { getObjectStore } from "@/lib/storage/object-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment health and capability summary.
 *
 * Reports which optional subsystems are wired up so an operator (and the UI) can
 * see exactly what will and will not work. Contains no secrets.
 */
export async function GET() {
  const config = getConfig();
  const store = getJobStore();
  const objectStore = getObjectStore();

  return NextResponse.json(
    {
      ok: true,
      service: config.site.name,
      time: new Date().toISOString(),
      capabilities: {
        downloaderService: config.status.downloaderService,
        jobStore: store.kind,
        objectStore: objectStore.kind,
        signedTokens: config.status.signedTokens,
      },
      limits: {
        maxBulkUrls: config.limits.maxBulkUrls,
        concurrency: config.limits.concurrency,
        maxZipEntries: config.limits.maxZipEntries,
        maxFileSizeBytes: config.limits.maxFileSizeBytes,
        rateLimitMax: config.rateLimit.max,
        rateLimitWindowSeconds: config.rateLimit.windowSeconds,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
