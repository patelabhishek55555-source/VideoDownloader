import { type NextRequest } from "next/server";

import { errorResponse, guard, json } from "@/lib/api/http";
import { getConfig } from "@/lib/config/env";
import { createJobFromInput, processJob } from "@/lib/downloaders/jobs";
import { AppError } from "@/lib/errors";
import { getJobStore } from "@/lib/storage/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CreateJobBody {
  input?: unknown;
  urls?: unknown;
}

/**
 * Create a bulk download job.
 *
 * POST { input: "url\nurl" } | { urls: string[] }
 *   → { ok, jobId, job, duplicates, invalid, truncated, storeKind }
 *
 * The job is created and then processed in-band until either every item is
 * resolved or the wall-clock budget expires. If items remain queued the client
 * continues the job through POST /api/jobs/:id/continue.
 */
export async function POST(request: NextRequest) {
  try {
    const config = getConfig();
    await guard({ scope: "jobs", request });

    let body: CreateJobBody;
    try {
      body = (await request.json()) as CreateJobBody;
    } catch {
      throw new AppError("invalid_url", { message: "That doesn't look like a valid video link." });
    }

    const input =
      typeof body?.input === "string"
        ? body.input
        : Array.isArray(body?.urls)
          ? (body.urls.filter((entry) => typeof entry === "string") as string[])
          : "";

    const created = await createJobFromInput({ input });

    // Spend the first processing slice inside this invocation so a small batch
    // completes in a single round trip.
    const processed = (await processJob(created.job.id, {
      budgetMs: Math.min(config.limits.jobProcessBudgetMs, 20000),
    })) ?? created.job;

    return json({
      ok: true,
      jobId: processed.id,
      job: processed,
      duplicates: created.duplicates,
      invalid: created.invalid,
      truncated: created.truncated,
      storeKind: getJobStore().kind,
    });
  } catch (error) {
    return errorResponse("api/jobs", error);
  }
}
