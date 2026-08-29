import { type NextRequest } from "next/server";

import { errorResponse, guard, json } from "@/lib/api/http";
import { getConfig } from "@/lib/config/env";
import { processJob } from "@/lib/downloaders/jobs";
import { AppError } from "@/lib/errors";
import { getJobStore } from "@/lib/storage/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/jobs/:id/continue
 *
 * Process the next slice of queued items and return an updated snapshot. This is
 * the serverless-friendly way to run a long bulk job: each invocation is bounded
 * by PROCESS_CONCURRENCY and JOB_PROCESS_BUDGET_MS, and the client keeps calling
 * until nothing is queued.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await guard({ scope: "jobs-continue", request });
    const { id } = await context.params;

    const job = await processJob(id, { budgetMs: getConfig().limits.jobProcessBudgetMs });
    if (!job) {
      throw new AppError("not_found", {
        message: "This download session is no longer available.",
        detail: "job_not_found",
        status: 404,
      });
    }

    return json({ ok: true, job, storeKind: getJobStore().kind });
  } catch (error) {
    return errorResponse("api/jobs/:id/continue", error);
  }
}
