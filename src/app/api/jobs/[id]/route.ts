import { type NextRequest } from "next/server";

import { errorResponse, json } from "@/lib/api/http";
import { getJob } from "@/lib/downloaders/jobs";
import { AppError } from "@/lib/errors";
import { getJobStore } from "@/lib/storage/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/jobs/:id → { ok, job: { status, total, completed, failed, items } }
 *
 * A 404 with code `job_not_found` is a normal outcome on a multi-instance
 * deployment without Redis: the job lives in the instance that created it. The
 * client uses that signal to fall back to resolving the rest directly.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await getJob(id);

    if (!job) {
      throw new AppError("not_found", {
        message: "This download session is no longer available.",
        detail: "job_not_found",
        status: 404,
      });
    }

    return json({ ok: true, job, storeKind: getJobStore().kind });
  } catch (error) {
    return errorResponse("api/jobs/:id", error);
  }
}

/** DELETE /api/jobs/:id — forget a job. Temporary by design, but explicit is better. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await getJobStore().delete(id);
    return json({ ok: true });
  } catch (error) {
    return errorResponse("api/jobs/:id", error);
  }
}
