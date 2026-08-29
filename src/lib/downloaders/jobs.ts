/**
 * Bulk download jobs.
 *
 * A job is the server-side record of a bulk paste: one item per URL, each with
 * its own status. Processing is bounded in two ways so it fits a serverless
 * function:
 *
 *  - concurrency (PROCESS_CONCURRENCY, default 3) — never 50 fetches at once
 *  - a wall-clock budget (JOB_PROCESS_BUDGET_MS) — when it expires the job is
 *    persisted as `processing` and the client asks `/api/jobs/:id/continue` to
 *    carry on with the remaining items
 *
 * With Redis configured the job survives between those invocations on any
 * instance. Without it the job lives in the instance that created it, and the
 * client transparently falls back to resolving the rest directly.
 */

import { randomUUID } from "node:crypto";

import { getConfig } from "@/lib/config/env";
import { AppError, logError, serialiseError } from "@/lib/errors";
import { getJobStore } from "@/lib/storage/job-store";
import { parseUrlList } from "@/lib/validation/urls";
import type { Job, JobItem, JobStatus } from "@/lib/types";
import { resolveMediaUrl } from "./resolve";

export function createJob(urls: string[]): Job {
  const now = Date.now();
  const items: JobItem[] = urls.map((url, index) => ({
    id: `job_${index}_${Math.random().toString(36).slice(2, 8)}`,
    url,
    status: "queued",
  }));

  return {
    id: randomUUID(),
    status: "queued",
    createdAt: now,
    updatedAt: now,
    total: items.length,
    completed: 0,
    failed: 0,
    items,
  };
}

export interface CreateJobInput {
  /** Raw pasted text or a pre-split list. */
  input: string | string[];
}

export interface CreateJobResult {
  job: Job;
  duplicates: string[];
  invalid: { raw: string; message: string }[];
  truncated: boolean;
  storeKind: "memory" | "redis";
}

export async function createJobFromInput(input: CreateJobInput): Promise<CreateJobResult> {
  const config = getConfig();
  const raw = Array.isArray(input.input) ? input.input.join("\n") : input.input;
  const parsed = parseUrlList(raw, config.limits.maxBulkUrls);

  if (parsed.valid.length === 0) {
    if (parsed.invalid.length > 0) {
      throw new AppError("invalid_url", { message: parsed.invalid[0]!.message });
    }
    throw new AppError("invalid_url", { message: "Paste at least one link to get started." });
  }

  const job = createJob(parsed.valid.map((item) => item.normalized));
  const store = getJobStore();
  await store.set(job);

  return {
    job,
    duplicates: parsed.duplicates,
    invalid: parsed.invalid,
    truncated: parsed.truncated,
    storeKind: store.kind,
  };
}

export function jobSummary(job: Job): JobStatus {
  const finished = job.items.filter((item) => item.status !== "queued" && item.status !== "processing");
  if (finished.length < job.items.length) return "processing";
  if (job.failed === 0) return "completed";
  if (job.completed === 0) return "failed";
  return "partial";
}

function recount(job: Job): Job {
  const completed = job.items.filter((item) => item.status === "ready").length;
  const failed = job.items.filter(
    (item) => item.status === "failed" || item.status === "unsupported",
  ).length;
  const updated: Job = { ...job, completed, failed, updatedAt: Date.now() };
  return { ...updated, status: jobSummary(updated) };
}

/** Run at most `concurrency` resolutions at a time, honouring the time budget. */
async function runWithConcurrency(
  job: Job,
  concurrency: number,
  deadline: number,
  onProgress: (job: Job) => Promise<void>,
): Promise<Job> {
  let working = job;
  const queue = working.items.filter((item) => item.status === "queued");
  let cursor = 0;
  let timedOut = false;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (Date.now() > deadline) {
        timedOut = true;
        return;
      }
      const index = cursor;
      cursor += 1;
      const item = queue[index];
      if (!item) return;

      working = {
        ...working,
        items: working.items.map((entry) =>
          entry.id === item.id ? { ...entry, status: "processing" as const } : entry,
        ),
      };
      await onProgress(working);

      try {
        const media = await resolveMediaUrl(item.url, {
          timeoutMs: Math.min(getConfig().limits.fetchTimeoutMs, 20000),
        });
        working = {
          ...working,
          items: working.items.map((entry) =>
            entry.id === item.id ? { ...entry, status: "ready" as const, media, error: undefined } : entry,
          ),
        };
      } catch (error) {
        const { error: publicError } = serialiseError(error);
        logError("job", error);
        const status = publicError.code === "unsupported" ? "unsupported" : "failed";
        working = {
          ...working,
          items: working.items.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: status as JobItem["status"], error: publicError, media: undefined }
              : entry,
          ),
        };
      }

      working = recount(working);
      await onProgress(working);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  await Promise.all(workers);

  if (timedOut) {
    working = {
      ...working,
      items: working.items.map((entry) =>
        entry.status === "processing" ? { ...entry, status: "queued" as const } : entry,
      ),
    };
  }

  return recount(working);
}

export interface ProcessOptions {
  /** Overrides the configured budget (milliseconds). */
  budgetMs?: number;
}

/** Process queued items in place and persist each update. */
export async function processJob(jobId: string, options: ProcessOptions = {}): Promise<Job | null> {
  const config = getConfig();
  const store = getJobStore();
  const job = await store.get(jobId);
  if (!job) return null;

  const budgetMs = options.budgetMs ?? config.limits.jobProcessBudgetMs;
  const deadline = Date.now() + budgetMs;

  const updated = await runWithConcurrency(job, config.limits.concurrency, deadline, async (next) => {
    await store.set(next);
  });

  await store.set(updated);
  return updated;
}

export async function getJob(jobId: string): Promise<Job | null> {
  return getJobStore().get(jobId);
}
